import "server-only";
import { MongoServerError, ObjectId, type Filter } from "mongodb";
import { collections } from "@/lib/db/mongo";
import type { BillDoc } from "@/lib/db/models";
import { fundingStatusOf, type PublicBill, type Region, type UtilityType } from "@/lib/domain";
import { HttpError } from "@/lib/security/http";
import { hashIp, shortCode } from "@/lib/security/crypto";
import type { CreateBillInput } from "@/lib/validation";
import { findDistrict, officialSupplierName } from "@/lib/uzbekistan";
import { notify } from "@/lib/notify";

export function maskAccount(acc: string): string {
  return acc.length <= 4 ? acc : `${"•".repeat(Math.min(acc.length - 4, 6))}${acc.slice(-4)}`;
}

export function toPublicBill(b: BillDoc): PublicBill {
  const available = Math.max(0, b.amountOwed - b.paidAmount);
  const d = findDistrict(b.region, b.district);
  return {
    id: b._id.toHexString(),
    code: b.code,
    utilityType: b.utilityType,
    region: b.region,
    district: b.district ?? d.id,
    soato: b.soato ?? d.soato,
    supplier: b.supplier ?? officialSupplierName(b.utilityType, b.region),
    paymentPurpose: b.paymentPurpose ?? "main",
    meterReading: b.meterReading ?? null,
    accountNumber: b.accountNumber,
    accountMasked: maskAccount(b.accountNumber),
    holderMasked: b.verification.holderMasked,
    addressMasked: b.verification.addressMasked ?? null,
    familyName: b.familyName,
    story: b.story,
    amountOwed: b.amountOwed,
    paidAmount: b.paidAmount,
    available,
    fundingStatus: fundingStatusOf(b.paidAmount, b.amountOwed),
    verified: b.verification.verified,
    payoutStatus: b.payout.status,
    thanksReactions: b.thanksReactions ?? [],
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

export async function createBill(input: CreateBillInput, ip: string): Promise<BillDoc> {
  const { bills } = await collections();

  const existing = await bills.findOne(
    { utilityType: input.utilityType, accountNumber: input.accountNumber, isOpen: true },
    { projection: { _id: 1 } },
  );
  if (existing) {
    throw new HttpError(409, "duplicate_open_bill");
  }

  const d = findDistrict(input.region, input.district);
  const supplier = officialSupplierName(input.utilityType, input.region);

  const now = new Date();
  const base = {
    utilityType: input.utilityType,
    region: input.region,
    district: d.id,
    soato: d.soato,
    supplier,
    paymentPurpose: input.paymentPurpose,
    meterReading: input.meterReading,
    accountNumber: input.accountNumber,
    familyName: input.familyName,
    story: input.story,
    phone: input.phone,
    amountOwed: input.amountOwed,
    paidAmount: 0,
    reservedAmount: 0,
    isOpen: true,
    reviewStatus: "pending_review" as const,
    rejectReason: null,
    verification: {
      provider: "manual",
      verified: false,
      holderMasked: null,
      addressMasked: null,
      verifiedDebt: null,
      checkedAt: now,
    },
    payout: { status: "not_paid_out" as const, reference: null, at: null },
    ipHash: hashIp(ip),
    createdAt: now,
    updatedAt: now,
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    const doc: BillDoc = { _id: new ObjectId(), code: shortCode(), ...base };
    try {
      await bills.insertOne(doc);
      void notify({ type: "bill_submitted", code: doc.code, amount: doc.amountOwed });
      return doc;
    } catch (err) {
      if (err instanceof MongoServerError && err.code === 11000) {
        if (String(err.message).includes("one_open_per_account")) throw new HttpError(409, "duplicate_open_bill");
        continue;
      }
      throw err;
    }
  }
  throw new HttpError(500, "code_generation_failed");
}

export interface FeedQuery {
  utilityType?: UtilityType;
  region?: Region;
  limit?: number;
}

export async function listOpenBills(q: FeedQuery = {}): Promise<PublicBill[]> {
  const { bills } = await collections();
  const filter: Filter<BillDoc> = { reviewStatus: "approved", isOpen: true };
  if (q.utilityType) filter.utilityType = q.utilityType;
  if (q.region) filter.region = q.region;
  const docs = await bills
    .find(filter)
    .sort({ paidAmount: 1, createdAt: 1 })
    .limit(Math.min(q.limit ?? 50, 100))
    .toArray();
  return docs.map(toPublicBill);
}

export async function countOpenBills(): Promise<number> {
  const { bills } = await collections();
  return bills.countDocuments({ reviewStatus: "approved", isOpen: true });
}

export async function getBill(id: string): Promise<BillDoc | null> {
  if (!ObjectId.isValid(id) || id.length !== 24) return null;
  const { bills } = await collections();
  return bills.findOne({ _id: new ObjectId(id) });
}

export function isPubliclyVisible(b: BillDoc): boolean {
  return b.reviewStatus === "approved";
}

export async function billsChangedSince(since: Date, limit = 100): Promise<PublicBill[]> {
  const { bills } = await collections();
  const docs = await bills
    .find({ reviewStatus: "approved", updatedAt: { $gt: since } })
    .sort({ updatedAt: 1 })
    .limit(limit)
    .toArray();
  return docs.map(toPublicBill);
}
