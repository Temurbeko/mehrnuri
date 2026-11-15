import "server-only";
import { collections } from "@/lib/db/mongo";
import type { BillDoc } from "@/lib/db/models";
import { claimUnconfirmedForFamily, undoFamilyClaims } from "@/lib/payments/core";
import { HttpError } from "@/lib/security/http";

/**
 * The family reports a new, lower remaining debt.
 *
 * The drop is first explained by money donors paid without a receipt: that
 * part moves from `unconfirmedAmount` into `paidAmount` (the family has now
 * confirmed it). Whatever drop is left was paid outside the app: `familyPaid`.
 *
 * Order matters for races: the payments are claimed first (each one an atomic
 * conditional write), then the bill is written only if its paidAmount is still
 * the one the family saw. If that write loses, the claims are put back.
 */
export async function settleFamilyRemaining(bill: BillDoc, remaining: number): Promise<BillDoc> {
  if (!bill.isOpen) throw new HttpError(409, "bill_closed");

  const current = Math.max(0, bill.amountOwed - bill.paidAmount);
  if (remaining >= current) throw new HttpError(422, "remaining_not_lower");
  const drop = current - remaining;

  const claims = await claimUnconfirmedForFamily(bill._id, drop);
  const confirmed = claims.reduce((sum, c) => sum + c.take, 0);

  const now = new Date();
  const { bills } = await collections();
  let updated: BillDoc | null;
  try {
    updated = await bills.findOneAndUpdate(
      { _id: bill._id, isOpen: true, paidAmount: bill.paidAmount },
      [
        {
          $set: {
            paidAmount: { $add: ["$paidAmount", drop] },
            unconfirmedAmount: { $subtract: [{ $ifNull: ["$unconfirmedAmount", 0] }, confirmed] },
            familyPaid: { $add: [{ $ifNull: ["$familyPaid", 0] }, drop - confirmed] },
            familyUpdatedAt: now,
            updatedAt: now,
            ...(remaining === 0 ? { isOpen: false, fundedAt: now } : {}),
          },
        },
      ],
      { returnDocument: "after" },
    );
  } catch (err) {
    await undoFamilyClaims(bill._id, claims);
    throw err;
  }
  if (!updated) {
    await undoFamilyClaims(bill._id, claims);
    throw new HttpError(409, "try_again");
  }
  return updated;
}
