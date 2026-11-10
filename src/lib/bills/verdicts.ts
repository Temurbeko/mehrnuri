import "server-only";
import { MongoServerError, ObjectId } from "mongodb";
import { collections } from "@/lib/db/mongo";
import type { BillDoc, VerdictDoc } from "@/lib/db/models";
import {
  accountKeyOf,
  MISMATCH_LIMIT_ACCOUNT,
  MISMATCH_LIMIT_BILL,
  type PublicBill,
  type TrustLevel,
  type UtilityType,
  type VerdictKind,
} from "@/lib/domain";
import { hmac } from "@/lib/security/crypto";
import { HttpError } from "@/lib/security/http";
import { notify } from "@/lib/notify";
import { toPublicBill } from "./service";

/**
 * Donor-side verification.
 *
 * MehrNuri cannot read anybody's utility debt — that needs a supplier contract.
 * But every donor does: they paste the account number into Click / Payme / Uzum
 * / Paynet and the app shows the real balance before they pay. So the donor who
 * was already looking at the true number tells us whether it matched, and those
 * answers decide whether a request stays up. No admin in the normal path.
 *
 * It holds because MehrNuri never touches the money: donors pay the utility
 * account directly, so a false request can only waste a donor's attention, and
 * it dies at the moment they open their app.
 */

/** One vote per visitor per bill: a signed-in donor, or a plain visitor by IP. */
function voterHashOf(voterKey: string): string {
  return hmac(`verdict:${voterKey}`).slice(0, 32);
}

/**
 * Fields for an account ledger row that does not exist yet. Bills created
 * before this feature (and seeded ones) have no row, and their reputation
 * would otherwise be thrown away.
 */
function accountSeed(bill: BillDoc, now: Date) {
  return {
    utilityType: bill.utilityType,
    accountNumber: bill.accountNumber,
    provenPayments: 0,
    blocked: false,
    blockedReason: null,
    firstSeenAt: now,
  };
}

function nextLevel(current: TrustLevel, matchVotes: number): TrustLevel {
  if (current === "proven") return "proven";
  return matchVotes > 0 ? "donor_checked" : current;
}

export interface VerdictOutcome {
  bill: PublicBill;
  /** True when this report was the one that took the request off the feed. */
  hidden: boolean;
}

/**
 * Who may vote. A vote can hide a family's request, so it must cost something:
 * only a donor who opened a payment on THIS bill (they reached the step where
 * they look the account up in their app), never the family that posted it, and
 * one vote per network — otherwise one person with a few free nicknames could
 * take down any genuine request alone.
 */
export async function assertCanVote(args: {
  bill: BillDoc;
  donorId: ObjectId | null;
  ipHash: string;
  isOwner: boolean;
}): Promise<void> {
  const { bill, donorId, ipHash, isOwner } = args;
  if (isOwner || ipHash === bill.ipHash) throw new HttpError(403, "verdict_not_allowed");
  if (!donorId) throw new HttpError(401, "donor_required");
  const { payments, verdicts } = await collections();
  const paid = await payments.findOne({ billId: bill._id, donorId }, { projection: { _id: 1 } });
  if (!paid) throw new HttpError(403, "verdict_not_allowed");
  const sameNetwork = await verdicts.findOne({ billId: bill._id, ipHash }, { projection: { _id: 1 } });
  if (sameNetwork) throw new HttpError(409, "already_voted");
}

export async function recordVerdict(args: {
  bill: BillDoc;
  kind: VerdictKind;
  seenAmount: number | null;
  voterKey: string;
  ipHash: string;
}): Promise<VerdictOutcome> {
  const { bill, kind, seenAmount, voterKey, ipHash } = args;
  const { bills, verdicts, accounts } = await collections();
  const now = new Date();
  const accountKey = accountKeyOf(bill.utilityType, bill.accountNumber);

  const doc: VerdictDoc = {
    _id: new ObjectId(),
    billId: bill._id,
    accountKey,
    kind,
    seenAmount,
    voterHash: voterHashOf(voterKey),
    ipHash,
    createdAt: now,
  };
  try {
    await verdicts.insertOne(doc);
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) throw new HttpError(409, "already_voted");
    throw err;
  }

  if (kind === "match") {
    const updated = await bills.findOneAndUpdate(
      { _id: bill._id },
      { $inc: { "trust.matchVotes": 1 }, $set: { updatedAt: now } },
      { returnDocument: "after" },
    );
    if (!updated) throw new HttpError(404, "bill_not_found");
    const level = nextLevel(updated.trust?.level ?? "new", updated.trust?.matchVotes ?? 1);
    if (level !== updated.trust?.level) {
      await bills.updateOne({ _id: bill._id }, { $set: { "trust.level": level, updatedAt: now } });
      updated.trust = { ...updated.trust, level };
    }
    await accounts.updateOne(
      { _id: accountKey },
      { $inc: { matchVotes: 1 }, $set: { lastSeenAt: now }, $setOnInsert: { ...accountSeed(bill, now), mismatchVotes: 0 } },
      { upsert: true },
    );
    return { bill: toPublicBill(updated), hidden: false };
  }

  // A report. An account proven by a real Soliq receipt needs more reports
  // before it is hidden: its debt can legitimately differ from the claim.
  const updated = await bills.findOneAndUpdate(
    { _id: bill._id },
    {
      $inc: { "trust.mismatchVotes": 1 },
      $set: { "trust.lastMismatch": { kind, seenAmount, at: now }, updatedAt: now },
    },
    { returnDocument: "after" },
  );
  if (!updated) throw new HttpError(404, "bill_not_found");

  const reports = updated.trust?.mismatchVotes ?? 1;
  const limit = updated.trust?.level === "proven" ? MISMATCH_LIMIT_BILL * 2 : MISMATCH_LIMIT_BILL;
  let hidden = false;

  if (reports >= limit && updated.reviewStatus === "approved") {
    const r = await bills.updateOne(
      { _id: bill._id, reviewStatus: "approved" },
      { $set: { reviewStatus: "flagged", updatedAt: now } },
    );
    if (r.modifiedCount > 0) {
      hidden = true;
      updated.reviewStatus = "flagged";
      void notify({ type: "bill_flagged", code: updated.code, reports, seenAmount });
    }
  }

  const acc = await accounts.findOneAndUpdate(
    { _id: accountKey },
    { $inc: { mismatchVotes: 1 }, $set: { lastSeenAt: now }, $setOnInsert: { ...accountSeed(bill, now), matchVotes: 0 } },
    { upsert: true, returnDocument: "after" },
  );
  if (acc && !acc.blocked && acc.mismatchVotes >= MISMATCH_LIMIT_ACCOUNT) {
    await accounts.updateOne(
      { _id: accountKey, blocked: false },
      { $set: { blocked: true, blockedReason: `${acc.mismatchVotes} donor reports` } },
    );
    void notify({ type: "account_blocked", accountKey, reports: acc.mismatchVotes });
  }

  return { bill: toPublicBill(updated), hidden };
}

/**
 * A Soliq-verified payment landed on this account, which proves the account is
 * real and collecting money. Future requests on it publish as trusted with no
 * review at all.
 */
export async function markAccountProven(args: {
  billId: ObjectId;
  utilityType: UtilityType;
  accountNumber: string;
}): Promise<void> {
  const { bills, accounts } = await collections();
  const now = new Date();
  const accountKey = accountKeyOf(args.utilityType, args.accountNumber);
  await Promise.all([
    accounts.updateOne(
      { _id: accountKey },
      {
        $inc: { provenPayments: 1 },
        $set: { lastSeenAt: now },
        $setOnInsert: {
          utilityType: args.utilityType,
          accountNumber: args.accountNumber,
          matchVotes: 0,
          mismatchVotes: 0,
          blocked: false,
          blockedReason: null,
          firstSeenAt: now,
        },
      },
      { upsert: true },
    ),
    bills.updateOne({ _id: args.billId }, { $set: { "trust.level": "proven", updatedAt: now } }),
  ]);
}
