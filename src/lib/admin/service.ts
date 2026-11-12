import "server-only";
import { ObjectId } from "mongodb";
import { collections } from "@/lib/db/mongo";
import type { BillDoc } from "@/lib/db/models";
import { toPublicBill } from "@/lib/bills/service";
import { HttpError } from "@/lib/security/http";
import { accountKeyOf, type PublicBill, type ReviewStatus, type VerdictKind } from "@/lib/domain";

export interface AdminBill extends PublicBill {
  phone: string;
  accountNumber: string;
  reviewStatus: ReviewStatus;
  verifiedDebt: number | null;
  verificationProvider: string;
  /** Donor reports that took this bill off the feed. */
  reportCount: number;
  lastMismatch: { kind: VerdictKind; seenAmount: number | null } | null;
  accountBlocked: boolean;
}

function toAdminBill(b: BillDoc, blockedAccounts: Set<string> = new Set()): AdminBill {
  const last = b.trust?.lastMismatch ?? null;
  return {
    ...toPublicBill(b),
    phone: b.phone,
    accountNumber: b.accountNumber,
    reviewStatus: b.reviewStatus,
    verifiedDebt: b.verification.verifiedDebt,
    verificationProvider: b.verification.provider,
    reportCount: b.trust?.mismatchVotes ?? 0,
    lastMismatch: last ? { kind: last.kind, seenAmount: last.seenAmount } : null,
    accountBlocked: blockedAccounts.has(accountKeyOf(b.utilityType, b.accountNumber)),
  };
}

/**
 * The admin queues are now exception queues, not a gate every family waits in:
 * `reported` holds bills donors said were wrong, `pending` only holds requests
 * an automatic guardrail refused to publish (an impossible amount).
 */
export async function adminQueues(): Promise<{ reported: AdminBill[]; pending: AdminBill[]; payouts: AdminBill[] }> {
  const { bills, accounts } = await collections();
  const [reported, pending, payouts] = await Promise.all([
    bills.find({ reviewStatus: "flagged" }).sort({ updatedAt: -1 }).limit(100).toArray(),
    bills.find({ reviewStatus: "pending_review" }).sort({ createdAt: 1 }).limit(100).toArray(),
    bills
      .find({ reviewStatus: "approved", "payout.status": "not_paid_out", familyPaid: { $not: { $gt: 0 } }, $expr: { $gte: ["$paidAmount", "$amountOwed"] } })
      .sort({ updatedAt: 1 })
      .limit(100)
      .toArray(),
  ]);
  const keys = [...reported, ...pending].map((b) => accountKeyOf(b.utilityType, b.accountNumber));
  const blocked = keys.length
    ? await accounts.find({ _id: { $in: keys }, blocked: true }, { projection: { _id: 1 } }).toArray()
    : [];
  const blockedKeys = new Set(blocked.map((a) => a._id));
  return {
    reported: reported.map((b) => toAdminBill(b, blockedKeys)),
    pending: pending.map((b) => toAdminBill(b, blockedKeys)),
    payouts: payouts.map((b) => toAdminBill(b)),
  };
}

/** Publishes a held or reported bill and clears the reports that hid it. */
export async function approveBill(id: ObjectId): Promise<void> {
  const { bills, accounts } = await collections();
  const bill = await bills.findOneAndUpdate(
    { _id: id, reviewStatus: { $in: ["pending_review", "flagged"] } },
    {
      $set: {
        reviewStatus: "approved",
        "trust.mismatchVotes": 0,
        "trust.lastMismatch": null,
        rejectReason: null,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );
  if (!bill) throw new HttpError(409, "invalid_state");
  // Clearing a bill also clears its account: the reports were wrong.
  await accounts.updateOne(
    { _id: accountKeyOf(bill.utilityType, bill.accountNumber) },
    { $set: { blocked: false, blockedReason: null, mismatchVotes: 0 } },
  );
}

export async function rejectBill(id: ObjectId, reason: string, blockAccount = false): Promise<void> {
  const { bills, accounts } = await collections();
  const bill = await bills.findOneAndUpdate(
    { _id: id, reviewStatus: { $in: ["pending_review", "flagged", "approved"] } },
    { $set: { reviewStatus: "rejected", rejectReason: reason, isOpen: false, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!bill) throw new HttpError(409, "invalid_state");
  if (blockAccount) {
    await accounts.updateOne(
      { _id: accountKeyOf(bill.utilityType, bill.accountNumber) },
      { $set: { blocked: true, blockedReason: reason, lastSeenAt: new Date() } },
    );
  }
}

/** Admin confirms the collected money was paid to the utility company. */
export async function markPaidOut(id: ObjectId, reference: string): Promise<void> {
  const { bills } = await collections();
  const r = await bills.updateOne(
    { _id: id, reviewStatus: "approved", "payout.status": "not_paid_out", familyPaid: { $not: { $gt: 0 } }, $expr: { $gte: ["$paidAmount", "$amountOwed"] } },
    { $set: { payout: { status: "paid_out", reference, at: new Date() }, isOpen: false, updatedAt: new Date() } },
  );
  if (r.matchedCount === 0) throw new HttpError(409, "invalid_state");
}
