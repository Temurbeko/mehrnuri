import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { collections } from "@/lib/db/mongo";
import { toPublicBill } from "@/lib/bills/service";
import { isBillOwner, OWNER_COOKIE } from "@/lib/bills/owner";
import { remainingSchema } from "@/lib/validation";
import { assertSameOrigin, handler, HttpError, readJson } from "@/lib/security/http";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

/**
 * "Qarzim kamaydi": the owner says the debt is now lower than shown (paid outside the app).
 * Lowering only; counted as `familyPaid`, never as a donation (no leaderboard, no trust effect).
 */
export const POST = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  await enforceRateLimit(req, "checkout");
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id) || id.length !== 24) throw new HttpError(404, "bill_not_found");

  if (!isBillOwner(req.cookies.get(OWNER_COOKIE)?.value, id)) {
    throw new HttpError(403, "forbidden");
  }

  const { remaining } = await readJson(req, remainingSchema);
  const { bills } = await collections();

  const bill = await bills.findOne({ _id: new ObjectId(id) });
  if (!bill) throw new HttpError(404, "bill_not_found");
  if (!bill.isOpen) throw new HttpError(409, "bill_closed");

  const current = Math.max(0, bill.amountOwed - bill.paidAmount);
  if (remaining >= current) throw new HttpError(422, "remaining_not_lower");

  const delta = current - remaining;
  const now = new Date();
  const set: Record<string, unknown> = { familyUpdatedAt: now, updatedAt: now };
  if (remaining === 0) {
    set.isOpen = false;
    set.fundedAt = now;
  }

  const updated = await bills.findOneAndUpdate(
    { _id: bill._id, isOpen: true, paidAmount: bill.paidAmount },
    { $inc: { paidAmount: delta, familyPaid: delta }, $set: set },
    { returnDocument: "after" },
  );
  if (!updated) throw new HttpError(409, "try_again");

  return NextResponse.json({ ok: true, bill: toPublicBill(updated) });
});
