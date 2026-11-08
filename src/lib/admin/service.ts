import "server-only";
import { ObjectId } from "mongodb";
import { collections } from "@/lib/db/mongo";
import type { BillDoc } from "@/lib/db/models";
import { toPublicBill } from "@/lib/bills/service";
import { HttpError } from "@/lib/security/http";
import type { PublicBill, ReviewStatus } from "@/lib/domain";

export interface AdminBill extends PublicBill {
  phone: string;
  accountNumber: string;
  reviewStatus: ReviewStatus;
  verifiedDebt: number | null;
  verificationProvider: string;
}

function toAdminBill(b: BillDoc): AdminBill {
  return {
    ...toPublicBill(b),
    phone: b.phone,
    accountNumber: b.accountNumber,
    reviewStatus: b.reviewStatus,
    verifiedDebt: b.verification.verifiedDebt,
    verificationProvider: b.verification.provider,
  };
}

export async function adminQueues(): Promise<{ pending: AdminBill[]; payouts: AdminBill[] }> {
  const { bills } = await collections();
  const [pending, payouts] = await Promise.all([
    bills.find({ reviewStatus: "pending_review" }).sort({ createdAt: 1 }).limit(100).toArray(),
    bills
      .find({ reviewStatus: "approved", "payout.status": "not_paid_out", $expr: { $gte: ["$paidAmount", "$amountOwed"] } })
      .sort({ updatedAt: 1 })
      .limit(100)
      .toArray(),
  ]);
  return { pending: pending.map(toAdminBill), payouts: payouts.map(toAdminBill) };
}

export async function approveBill(id: ObjectId): Promise<void> {
  const { bills } = await collections();
  const r = await bills.updateOne({ _id: id, reviewStatus: "pending_review" }, { $set: { reviewStatus: "approved", updatedAt: new Date() } });
  if (r.matchedCount === 0) throw new HttpError(409, "invalid_state");
}

export async function rejectBill(id: ObjectId, reason: string): Promise<void> {
  const { bills } = await collections();
  const r = await bills.updateOne(
    { _id: id, reviewStatus: "pending_review" },
    { $set: { reviewStatus: "rejected", rejectReason: reason, isOpen: false, updatedAt: new Date() } },
  );
  if (r.matchedCount === 0) throw new HttpError(409, "invalid_state");
}

/** Admin confirms the collected money was paid to the utility company. */
export async function markPaidOut(id: ObjectId, reference: string): Promise<void> {
  const { bills } = await collections();
  const r = await bills.updateOne(
    { _id: id, reviewStatus: "approved", "payout.status": "not_paid_out", $expr: { $gte: ["$paidAmount", "$amountOwed"] } },
    { $set: { payout: { status: "paid_out", reference, at: new Date() }, isOpen: false, updatedAt: new Date() } },
  );
  if (r.matchedCount === 0) throw new HttpError(409, "invalid_state");
}
