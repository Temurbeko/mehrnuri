import "server-only";
import { MongoServerError, ObjectId } from "mongodb";
import { env } from "@/config/env";
import { collections } from "@/lib/db/mongo";
import type { BillDoc, DonorDoc, PaymentDoc } from "@/lib/db/models";
import type { PaymentProviderId, PaymentStatus } from "@/lib/domain";
import { HttpError } from "@/lib/security/http";
import { isRetryableReceiptError, verifyAndLockReceipt } from "@/lib/payments/verifyReceipt";
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

type TxPatch = Partial<Pick<PaymentDoc, "receiptKey" | "receiptLabel" | "leaderboardCredited" | "receiptPending">>;

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
      {
        $set: {
          isOpen: { $cond: [{ $gte: ["$paidAmount", "$amountOwed"] }, false, "$isOpen"] },
          // when the bill became fully paid (feeds "this week N homes" and "recently closed")
          fundedAt: {
            $cond: [{ $and: [{ $gte: ["$paidAmount", "$amountOwed"] }, { $not: ["$fundedAt"] }] }, "$$NOW", "$fundedAt"],
          },
        },
      },
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
  void retryPendingReceipts().catch((err: unknown) => console.warn("[receipts] retry failed", err));
}

/** How long a receipt Soliq has not seen yet keeps being re-checked. */
const RECEIPT_RETRY_DAYS = 3;

export function pendingReceipt(raw: string, tries = 0): NonNullable<PaymentDoc["receiptPending"]> {
  const now = Date.now();
  // 10 min, 20, 40 ... capped at 6 h between tries
  const wait = Math.min(10 * 60_000 * 2 ** tries, 6 * 60 * 60_000);
  return { raw, nextTryAt: new Date(now + wait), until: new Date(now + RECEIPT_RETRY_DAYS * 24 * 60 * 60_000), tries };
}

/**
 * Adds a fiscal receipt to a payment that is already counted as paid but has
 * none yet (donor skipped it, or Soliq did not have it at the time). Gives the
 * donor their leaderboard credit and proves the account, exactly as if the
 * receipt had come with the confirmation. Returns "pending" when Soliq still
 * does not know the receipt; it is then re-checked in the background.
 */
export async function attachReceipt(paymentId: ObjectId, raw: string): Promise<"verified" | "pending"> {
  const { payments, bills, donors } = await collections();
  const p = await payments.findOne({ _id: paymentId });
  if (!p) throw new HttpError(404, "payment_not_found");
  if (p.status !== "paid") throw new HttpError(409, "payment_not_paid");
  if (p.receiptKey) return "verified";

  let verified;
  try {
    verified = await verifyAndLockReceipt(raw, p.amount, p.createdAt);
  } catch (err) {
    if (!isRetryableReceiptError(err)) throw err;
    const tries = p.receiptPending?.raw === raw ? p.receiptPending.tries + 1 : 0;
    const pending = pendingReceipt(raw, tries);
    // keep the original deadline when re-trying the same receipt
    if (p.receiptPending?.raw === raw) pending.until = p.receiptPending.until;
    await payments.updateOne({ _id: p._id }, { $set: { receiptPending: pending, updatedAt: new Date() } });
    return "pending";
  }

  let updated: PaymentDoc | null;
  try {
    updated = await payments.findOneAndUpdate(
      { _id: p._id, status: "paid", receiptKey: { $in: [null, undefined] } as never },
      {
        $set: { receiptKey: verified.receiptKey, receiptLabel: verified.receiptLabel, leaderboardCredited: true, receiptPending: null, updatedAt: new Date() },
      },
      { returnDocument: "before" },
    );
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) throw new HttpError(409, "duplicate_receipt");
    throw err;
  }
  if (!updated) return "verified"; // another request attached it first

  if (updated.leaderboardCredited !== true) {
    await donors.updateOne({ _id: p.donorId }, { $inc: { totalDonated: p.amount, donationsCount: 1 } });
  }
  const bill = await bills.findOne({ _id: p.billId }, { projection: { utilityType: 1, accountNumber: 1, ipHash: 1 } });
  if (bill && !(p.ipHash && p.ipHash === bill.ipHash)) {
    void markAccountProven({ billId: bill._id, utilityType: bill.utilityType, accountNumber: bill.accountNumber }).catch(
      (err: unknown) => console.warn("[trust] markAccountProven failed", err),
    );
  }
  return "verified";
}

let lastReceiptRetry = 0;

/** Re-checks a few pending receipts whose next try is due (runs with the expiry sweep). */
export async function retryPendingReceipts(): Promise<void> {
  if (Date.now() - lastReceiptRetry < 5 * 60_000) return;
  lastReceiptRetry = Date.now();
  const { payments } = await collections();
  const now = new Date();
  // give up on receipts past their deadline
  await payments.updateMany({ "receiptPending.until": { $lt: now } }, { $set: { receiptPending: null } });
  const due = await payments
    .find({ status: "paid", "receiptPending.nextTryAt": { $lte: now } }, { projection: { _id: 1, receiptPending: 1 } })
    .limit(5)
    .toArray();
  for (const p of due) {
    await attachReceipt(p._id, p.receiptPending!.raw).catch(async () => {
      // a final answer (wrong amount, used receipt...): stop trying
      await payments.updateOne({ _id: p._id }, { $set: { receiptPending: null } });
    });
  }
}

export interface DonorOpenPayment {
  id: string;
  amount: number;
  at: string;
  /** "paid": counted, but no verified receipt yet; "unconfirmed": the donor never confirmed it. */
  kind: "paid" | "unconfirmed";
  pending: boolean;
}

/** A donor's payments that still need something from them (shown in their profile). */
export async function donorOpenPayments(donorId: ObjectId): Promise<DonorOpenPayment[]> {
  const { payments } = await collections();
  const now = Date.now();
  const rows = await payments
    .find(
      {
        donorId,
        $or: [
          { status: "paid", receiptKey: { $in: [null, undefined] } as never, paidAt: { $gte: new Date(now - 30 * 24 * 60 * 60_000) } },
          { status: { $in: [...OPEN_STATES, "expired"] }, createdAt: { $gte: new Date(now - 3 * 24 * 60 * 60_000) } },
        ],
      },
      { projection: { amount: 1, status: 1, createdAt: 1, paidAt: 1, receiptPending: 1 } },
    )
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();
  return rows.map((p) => ({
    id: p._id.toHexString(),
    amount: p.amount,
    at: (p.paidAt ?? p.createdAt).toISOString(),
    kind: p.status === "paid" ? "paid" : "unconfirmed",
    pending: Boolean(p.receiptPending),
  }));
}

/* ---------- Sharing and history ---------- */

const SHARE_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomShareCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => SHARE_ALPHABET[b % SHARE_ALPHABET.length]).join("");
}

/**
 * A public share link must not be the payment id: the payment page lets
 * whoever opens it add a receipt. So each paid payment gets its own random
 * share code the first time its donor opens the success page.
 */
export async function ensureShareCode(p: PaymentDoc): Promise<string> {
  if (p.shareCode) return p.shareCode;
  const { payments } = await collections();
  const code = randomShareCode();
  const res = await payments.findOneAndUpdate(
    { _id: p._id, shareCode: { $exists: false } },
    { $set: { shareCode: code } },
    { returnDocument: "after" },
  );
  if (res?.shareCode) return res.shareCode;
  const again = await payments.findOne({ _id: p._id }, { projection: { shareCode: 1 } });
  return again?.shareCode ?? code;
}

export interface SharedHelp {
  nickname: string;
  amount: number;
  utilityType: BillDoc["utilityType"];
  at: string;
}

/** What a share link may show: nickname, amount, utility, date. Never anything about the family. */
export async function getSharedHelp(code: string): Promise<SharedHelp | null> {
  if (!/^[A-Za-z0-9]{6,20}$/.test(code)) return null;
  const { payments, bills } = await collections();
  const p = await payments.findOne({ shareCode: code, status: "paid" });
  if (!p) return null;
  const bill = await bills.findOne({ _id: p.billId }, { projection: { utilityType: 1 } });
  if (!bill) return null;
  return { nickname: p.donorNickname, amount: p.amount, utilityType: bill.utilityType, at: (p.paidAt ?? p.updatedAt).toISOString() };
}

export interface HistoryItem {
  id: string;
  amount: number;
  at: string;
  utilityType: BillDoc["utilityType"];
  district: string | null;
  receipt: "verified" | "pending" | "none";
}

/** A donor's paid helps, newest first (their profile history). */
export async function donorHistory(donorId: ObjectId, limit = 30): Promise<HistoryItem[]> {
  const { payments } = await collections();
  const rows = await payments
    .aggregate<PaymentDoc & { bill: Pick<BillDoc, "utilityType" | "district"> }>([
      { $match: { donorId, status: "paid" } },
      { $sort: { paidAt: -1 } },
      { $limit: limit },
      { $lookup: { from: "bills", localField: "billId", foreignField: "_id", as: "bill", pipeline: [{ $project: { utilityType: 1, district: 1 } }] } },
      { $unwind: "$bill" },
    ])
    .toArray();
  return rows.map((p) => ({
    id: p._id.toHexString(),
    amount: p.amount,
    at: (p.paidAt ?? p.updatedAt).toISOString(),
    utilityType: p.bill.utilityType,
    district: p.bill.district ?? null,
    receipt: p.receiptKey ? "verified" : p.receiptPending ? "pending" : "none",
  }));
}
