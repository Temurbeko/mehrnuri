import "server-only";
import { MongoServerError, ObjectId, type Filter } from "mongodb";
import { collections } from "@/lib/db/mongo";
import type { BillDoc } from "@/lib/db/models";
import {
  accountKeyOf,
  BILL_TTL_DAYS,
  fundingStatusOf,
  isPlausibleAmount,
  MAX_BILLS_PER_NETWORK_30D,
  MAX_OPEN_BILLS_PER_NETWORK,
  type PublicBill,
  type Region,
  type TrustLevel,
  type UtilityType,
} from "@/lib/domain";
import { HttpError } from "@/lib/security/http";
import { hashIp } from "@/lib/security/crypto";
import type { CreateBillInput } from "@/lib/validation";
import { findDistrict, officialSupplierName } from "@/lib/uzbekistan";
import { notify } from "@/lib/notify";
import { withHelpers } from "@/lib/community";
import { checkRequestText } from "@/lib/moderation";

export function maskAccount(acc: string): string {
  return acc.length <= 4 ? acc : `${"•".repeat(Math.min(acc.length - 4, 6))}${acc.slice(-4)}`;
}

export function toPublicBill(b: BillDoc): PublicBill {
  // Money another donor is paying right now (a reservation) is not available,
  // or this donor picks an amount the server then refuses as "already collected".
  const available = Math.max(0, b.amountOwed - b.paidAmount - (b.reservedAmount ?? 0));
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
    holderMasked: b.verification?.holderMasked ?? null,
    addressMasked: b.verification?.addressMasked ?? null,
    familyName: b.familyName,
    story: b.story,
    amountOwed: b.amountOwed,
    paidAmount: b.paidAmount,
    familyPaid: b.familyPaid ?? 0,
    available,
    fundingStatus: fundingStatusOf(b.paidAmount, b.amountOwed),
    verified: b.verification?.verified ?? false,
    trustLevel: b.trust?.level ?? "new",
    checkedCount: b.trust?.matchVotes ?? 0,
    expiresAt: b.expiresAt ? b.expiresAt.toISOString() : null,
    payoutStatus: b.payout.status,
    thanksReactions: b.thanksReactions ?? [],
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

/** Request codes start here, so the first one is MN-1001. */
const BILL_CODE_START = 1000;

/**
 * Next request code: MN-1001, MN-1002, ... Families read it out over the phone
 * or write it down, so it must be short and orderly, not random letters.
 * An atomic counter document hands out each number exactly once, even when two
 * requests arrive at the same moment. Older random codes (MN-AUGBJB) keep
 * working: they are letters, so they can never collide with these.
 */
async function nextBillCode(): Promise<string> {
  const { counters } = await collections();
  const counter = await counters.findOneAndUpdate(
    { _id: "bill_code" },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  return `MN-${BILL_CODE_START + (counter?.seq ?? 1)}`;
}

/**
 * Checked while the family is still typing, so a second request for the same
 * account is caught at the account step, not after filling in the whole form.
 * It only says what the final submit would also say; an open bill's page is
 * public anyway (and is only linked once it is published).
 */
export async function accountStatus(
  utilityType: UtilityType,
  accountNumber: string,
): Promise<{ hasOpen: boolean; openBillId: string | null; blocked: boolean }> {
  const { bills, accounts } = await collections();
  const [open, account] = await Promise.all([
    bills.findOne({ utilityType, accountNumber, isOpen: true }, { projection: { _id: 1, reviewStatus: 1 } }),
    accounts.findOne({ _id: accountKeyOf(utilityType, accountNumber) }, { projection: { blocked: 1 } }),
  ]);
  return {
    hasOpen: !!open,
    openBillId: open && open.reviewStatus === "approved" ? open._id.toHexString() : null,
    blocked: !!account?.blocked,
  };
}

export async function createBill(input: CreateBillInput, ip: string, ownedIds: string[] = []): Promise<BillDoc> {
  // Free text must not carry links or contacts (the family gets a clear error);
  // profanity only holds the request for the admin queue, the family is told nothing different.
  let textHold = false;
  for (const text of [input.story, input.familyName]) {
    if (!text) continue;
    const check = checkRequestText(text);
    if (check.blocked) throw new HttpError(422, check.blocked === "link" ? "text_has_link" : "text_has_contact");
    if (check.hold) textHold = true;
  }

  const { bills, accounts } = await collections();

  const existing = await bills.findOne(
    { utilityType: input.utilityType, accountNumber: input.accountNumber, isOpen: true },
    { projection: { _id: 1 } },
  );
  if (existing) {
    throw new HttpError(409, "duplicate_open_bill");
  }

  const accountKey = accountKeyOf(input.utilityType, input.accountNumber);
  const account = await accounts.findOne({ _id: accountKey });
  // An account donors kept reporting stays out, whatever name or phone is used next.
  if (account?.blocked) throw new HttpError(403, "account_blocked");

  // This browser already has an open request (signed owner cookie).
  if (ownedIds.length > 0) {
    const ownOpen = await bills.findOne(
      { _id: { $in: ownedIds.map((id) => new ObjectId(id)) }, isOpen: true },
      { projection: { _id: 1 } },
    );
    if (ownOpen) throw new HttpError(409, "owner_has_open_bill");
  }

  // Generous per-network caps (carriers share IPs).
  const ipHash = hashIp(ip);
  const sinceWindow = new Date(Date.now() - 30 * 24 * 60 * 60_000);
  const [openForNetwork, recentForNetwork] = await Promise.all([
    bills.countDocuments({ ipHash, isOpen: true }),
    bills.countDocuments({ ipHash, createdAt: { $gte: sinceWindow } }),
  ]);
  if (openForNetwork >= MAX_OPEN_BILLS_PER_NETWORK) throw new HttpError(409, "network_has_open_bills");
  if (recentForNetwork >= MAX_BILLS_PER_NETWORK_30D) throw new HttpError(429, "network_limit_reached");

  const d = findDistrict(input.region, input.district);
  const supplier = officialSupplierName(input.utilityType, input.region);

  const now = new Date();
  // Published straight away. The only brake is an amount no household could owe:
  // nobody here can see the real debt, but every donor sees it in their payment
  // app before paying, so the donors do the verifying.
  const plausible = isPlausibleAmount(input.utilityType, input.amountOwed);
  const reviewStatus = plausible && !textHold ? ("approved" as const) : ("pending_review" as const);
  // An account that already received a Soliq-verified payment is proven real.
  const trustLevel: TrustLevel = (account?.provenPayments ?? 0) > 0 ? "proven" : "new";

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
    amountOwed: input.amountOwed,
    paidAmount: 0,
    reservedAmount: 0,
    isOpen: true,
    reviewStatus,
    rejectReason: null,
    trust: { level: trustLevel, matchVotes: 0, mismatchVotes: 0, lastMismatch: null },
    expiresAt: new Date(now.getTime() + BILL_TTL_DAYS * 24 * 60 * 60_000),
    verification: {
      provider: "manual",
      verified: false,
      holderMasked: null,
      addressMasked: null,
      verifiedDebt: null,
      checkedAt: now,
    },
    payout: { status: "not_paid_out" as const, reference: null, at: null },
    ipHash,
    createdAt: now,
    updatedAt: now,
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    const doc: BillDoc = { _id: new ObjectId(), code: await nextBillCode(), ...base };
    try {
      await bills.insertOne(doc);
      await accounts.updateOne(
        { _id: accountKey },
        {
          $setOnInsert: {
            utilityType: input.utilityType,
            accountNumber: input.accountNumber,
            provenPayments: 0,
            matchVotes: 0,
            mismatchVotes: 0,
            blocked: false,
            blockedReason: null,
            firstSeenAt: now,
          },
          $set: { lastSeenAt: now },
        },
        { upsert: true },
      );
      void notify(
        plausible && !textHold
          ? { type: "bill_submitted", code: doc.code, amount: doc.amountOwed }
          : {
              type: "bill_held",
              code: doc.code,
              amount: doc.amountOwed,
              reason: !plausible ? "amount above plausible range" : "text flagged (profanity)",
            },
      );
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

let lastBillSweep = 0;

/**
 * Closes requests that went stale. Utility debt is re-issued monthly, so a
 * month-old claimed amount is no longer true — and nobody should have to clean
 * that up by hand. Money already paid went straight to the supplier, so there
 * is nothing to unwind.
 */
export async function sweepStaleBills(force = false): Promise<void> {
  if (!force && Date.now() - lastBillSweep < 60_000) return;
  lastBillSweep = Date.now();
  const { bills } = await collections();
  // Bills posted before auto-expiry existed get a date from their own age.
  await bills.updateMany({ isOpen: true, expiresAt: { $exists: false } }, [
    { $set: { expiresAt: { $add: ["$createdAt", BILL_TTL_DAYS * 24 * 60 * 60_000] } } },
  ]);
  await bills.updateMany(
    { isOpen: true, expiresAt: { $lt: new Date() } },
    { $set: { isOpen: false, updatedAt: new Date() } },
  );
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
  // helper counts + initials for each card
  return withHelpers(docs.map(toPublicBill));
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

/** A family's own requests (any status), newest first, for the Profile page. */
export async function getBillsByIds(ids: string[]): Promise<BillDoc[]> {
  const valid = ids.filter((id) => ObjectId.isValid(id) && id.length === 24).map((id) => new ObjectId(id));
  if (valid.length === 0) return [];
  const { bills } = await collections();
  return bills.find({ _id: { $in: valid } }).sort({ createdAt: -1 }).toArray();
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
  return withHelpers(docs.map(toPublicBill));
}
