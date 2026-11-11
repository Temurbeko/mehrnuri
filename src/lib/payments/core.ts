import "server-only";
import { MongoServerError, ObjectId } from "mongodb";
import { env } from "@/config/env";
import { collections } from "@/lib/db/mongo";
import type { BillDoc, DonorDoc, PaymentDoc } from "@/lib/db/models";
import type { PaymentProviderId, PaymentStatus } from "@/lib/domain";
import { HttpError } from "@/lib/security/http";
import { markAccountProven } from "@/lib/bills/verdicts";
import { notify } from "@/lib/notify";

const OPEN_STATES: PaymentStatus[] = ["created", "processing"];

export function getPayment(id: string): Promise<PaymentDoc | null> {
  if (!/^[a-f0-9]{24}$/.test(id)) return Promise.resolve(null);
  return collections().then(({ payments }) => payments.findOne({ _id: new ObjectId(id) }));
}

export async function createPayment(args: {
  bill: BillDoc;
  donor: DonorDoc;
  amount: number;
  provider: PaymentProviderId;
  locale: string;
  ipHash?: string;
}): Promise<PaymentDoc> {
  const { bill, donor, amount, provider, locale, ipHash } = args;
  const { MIN_DONATION_UZS, MAX_DONATION_UZS, RESERVATION_MINUTES } = env();
  if (amount > MAX_DONATION_UZS) throw new HttpError(422, "amount_too_large", undefined, { max: MAX_DONATION_UZS });

  const { bills, payments } = await collections();
  await sweepExpired();

  const staleCreated = await payments
    .find({ billId: bill._id, status: "created" }, { projection: { _id: 1 } })
    .toArray();
  for (const prev of staleCreated) {
    await markUnsuccessful(prev._id, "cancelled");
  }

  const fresh = await bills.findOne({ _id: bill._id });
  if (!fresh || fresh.reviewStatus !== "approved" || !fresh.isOpen) throw new HttpError(409, "bill_not_open");
  const available = fresh.amountOwed - fresh.paidAmount - fresh.reservedAmount;
  if (amount < MIN_DONATION_UZS && amount !== available) throw new HttpError(422, "amount_too_small", undefined, { min: MIN_DONATION_UZS });

  const reserved = await bills.findOneAndUpdate(
    {
      _id: bill._id,
      reviewStatus: "approved",
      isOpen: true,
      $expr: { $lte: [{ $add: ["$paidAmount", "$reservedAmount", amount] }, "$amountOwed"] },
    },
    { $inc: { reservedAmount: amount }, $set: { updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!reserved) throw new HttpError(409, "amount_exceeds_available", undefined, { available: Math.max(0, available) });

  const now = new Date();
  const payment: PaymentDoc = {
    _id: new ObjectId(),
    billId: bill._id,
    donorId: donor._id,
    donorNickname: donor.nickname,
    amount,
    provider,
    status: "created",
    locale,
    ...(ipHash ? { ipHash } : {}),
    expiresAt: new Date(now.getTime() + RESERVATION_MINUTES * 60_000),
    paidAt: null,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await payments.insertOne(payment);
  } catch (err) {
    await releaseReservation(bill._id, amount);
    throw err;
  }
  return payment;
}

async function releaseReservation(billId: ObjectId, amount: number): Promise<void> {
  const { bills } = await collections();
  await bills.updateOne({ _id: billId }, [
    { $set: { reservedAmount: { $max: [0, { $subtract: ["$reservedAmount", amount] }] }, updatedAt: "$$NOW" } },
  ]);
}

type TxPatch = Partial<Pick<PaymentDoc, "receiptKey" | "receiptLabel" | "leaderboardCredited">>;

export async function markPaid(paymentId: ObjectId, set: TxPatch = {}): Promise<PaymentDoc> {
  const { payments, bills, donors } = await collections();
  const now = new Date();
  let before: PaymentDoc | null;
  try {
    // "expired" is accepted too: paying inside a bank app can take longer than
    // the reservation, and that money has already reached the utility account.
    before = await payments.findOneAndUpdate(
      { _id: paymentId, status: { $in: [...OPEN_STATES, "expired"] } },
      { $set: { ...set, status: "paid", paidAt: now, updatedAt: now } },
      { returnDocument: "before" },
    );
  } catch (err) {
    // Two donors submitting the same receipt at once: the unique receiptKey index rejects the second one.
    if (err instanceof MongoServerError && err.code === 11000) throw new HttpError(409, "duplicate_receipt");
    throw err;
  }
  if (!before) {
    const current = await payments.findOne({ _id: paymentId });
    if (!current) throw new HttpError(404, "payment_not_found");
    return current;
  }
  const p: PaymentDoc = { ...before, ...set, status: "paid", paidAt: now, updatedAt: now };
  // An expired payment's reservation was already released; releasing it again
  // would eat into another donor's live reservation.
  const release = OPEN_STATES.includes(before.status) ? p.amount : 0;

  const bill = await bills.findOneAndUpdate(
    { _id: p.billId },
    [
      {
        $set: {
          paidAmount: { $add: ["$paidAmount", p.amount] },
          reservedAmount: { $max: [0, { $subtract: ["$reservedAmount", release] }] },
          updatedAt: "$$NOW",
        },
      },
      { $set: { isOpen: { $cond: [{ $gte: ["$paidAmount", "$amountOwed"] }, false, "$isOpen"] } } },
    ],
    { returnDocument: "after" },
  );

  if (set.leaderboardCredited !== false) {
    await donors.updateOne(
      { _id: p.donorId },
      { $inc: { totalDonated: p.amount, donationsCount: 1 }, $set: { lastSeenAt: now } },
    );
  }

  if (bill) {
    // A real fiscal receipt on this account proves the account exists and is
    // collecting money, so future requests on it skip review entirely.
    // ...but not when the payment came from the network that posted the request:
    // a family paying its own bill must not make its account look trusted.
    const selfPaid = Boolean(p.ipHash && p.ipHash === bill.ipHash);
    if (typeof set.receiptKey === "string" && set.receiptKey.length > 0 && !selfPaid) {
      void markAccountProven({
        billId: bill._id,
        utilityType: bill.utilityType,
        accountNumber: bill.accountNumber,
      }).catch((err: unknown) => console.warn("[trust] markAccountProven failed", err));
    }
    void notify({ type: "payment_received", code: bill.code, amount: p.amount, nickname: p.donorNickname });
    if (bill.paidAmount >= bill.amountOwed) {
      void notify({ type: "bill_funded", code: bill.code, amount: bill.amountOwed });
    }
  }
  return p;
}

export async function markUnsuccessful(
  paymentId: ObjectId,
  status: Extract<PaymentStatus, "failed" | "cancelled" | "expired">,
  set: TxPatch = {},
): Promise<PaymentDoc | null> {
  const { payments } = await collections();
  const p = await payments.findOneAndUpdate(
    { _id: paymentId, status: { $in: OPEN_STATES } },
    { $set: { ...set, status, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (p) await releaseReservation(p.billId, p.amount);
  return p;
}

let lastSweep = 0;

export async function sweepExpired(force = false): Promise<void> {
  if (!force && Date.now() - lastSweep < 30_000) return;
  lastSweep = Date.now();
  const { payments } = await collections();
  const expired = await payments.find({ status: "created", expiresAt: { $lt: new Date() } }, { projection: { _id: 1 } }).limit(200).toArray();
  for (const p of expired) await markUnsuccessful(p._id, "expired");
}
