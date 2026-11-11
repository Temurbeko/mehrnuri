import "server-only";
import { ObjectId } from "mongodb";
import { collections } from "@/lib/db/mongo";
import type { PublicBill, ReactionType, Region, UtilityType } from "@/lib/domain";

/**
 * The "people are helping right now" layer of the app: who helped recently,
 * how many homes were fully paid this week, thank-you notes from families whose
 * bills were closed, and a donor's own impact. All of it is derived from real
 * payments and bills; nothing here is invented or stored separately.
 *
 * Only public information leaves this module: donor nicknames (already public
 * on the leaderboard), amounts, utility type and district. Never phone, account
 * number, family name or story.
 */

const firstLetter = (nickname: string) => (nickname.trim()[0] ?? "?").toUpperCase();

/** Attach helper counts + the latest three helpers' initials to a list of bills. */
export async function withHelpers(bills: PublicBill[]): Promise<PublicBill[]> {
  if (bills.length === 0) return bills;
  const { payments } = await collections();
  const ids = bills.map((b) => new ObjectId(b.id));
  const rows = await payments
    .aggregate<{ _id: ObjectId; donors: string[]; nicknames: string[] }>([
      { $match: { billId: { $in: ids }, status: "paid" } },
      { $sort: { paidAt: -1 } },
      { $group: { _id: "$billId", donors: { $addToSet: "$donorId" }, nicknames: { $push: "$donorNickname" } } },
    ])
    .toArray();
  const byId = new Map(rows.map((r) => [r._id.toHexString(), r]));
  return bills.map((b) => {
    const r = byId.get(b.id);
    if (!r) return { ...b, helpers: { count: 0, initials: [] } };
    const latest = [...new Set(r.nicknames)].slice(0, 3).map(firstLetter);
    return { ...b, helpers: { count: r.donors.length, initials: latest } };
  });
}

export interface RecentHelp {
  nickname: string;
  amount: number;
  utilityType: UtilityType;
  region: Region;
  district: string | null;
  at: string;
}

/** Latest paid payments across the app (for the live "someone just helped" line). */
export async function recentHelps(limit = 8): Promise<RecentHelp[]> {
  const { payments } = await collections();
  const rows = await payments
    .aggregate<{ donorNickname: string; amount: number; paidAt: Date; bill: { utilityType: UtilityType; region: Region; district?: string } }>([
      { $match: { status: "paid", paidAt: { $ne: null } } },
      { $sort: { paidAt: -1 } },
      { $limit: limit },
      { $lookup: { from: "bills", localField: "billId", foreignField: "_id", as: "bill" } },
      { $unwind: "$bill" },
      { $project: { donorNickname: 1, amount: 1, paidAt: 1, "bill.utilityType": 1, "bill.region": 1, "bill.district": 1 } },
    ])
    .toArray();
  return rows.map((r) => ({
    nickname: r.donorNickname,
    amount: r.amount,
    utilityType: r.bill.utilityType,
    region: r.bill.region,
    district: r.bill.district ?? null,
    at: r.paidAt.toISOString(),
  }));
}

/** The last few people who helped one bill (shown on its page). */
export async function billRecentHelps(billId: ObjectId, limit = 3): Promise<Array<{ nickname: string; amount: number; at: string }>> {
  const { payments } = await collections();
  const rows = await payments
    .find({ billId, status: "paid" }, { projection: { donorNickname: 1, amount: 1, paidAt: 1 } })
    .sort({ paidAt: -1 })
    .limit(limit)
    .toArray();
  return rows.map((p) => ({ nickname: p.donorNickname, amount: p.amount, at: (p.paidAt ?? p.updatedAt).toISOString() }));
}

/** Homes whose bill became fully paid in the last 7 days. */
export async function homesLitThisWeek(): Promise<number> {
  const { bills } = await collections();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60_000);
  return bills.countDocuments({
    $expr: { $gte: ["$paidAmount", "$amountOwed"] },
    // older bills have no fundedAt yet: fall back to their last update
    $or: [{ fundedAt: { $gte: since } }, { fundedAt: { $exists: false }, updatedAt: { $gte: since } }],
  });
}

export interface ClosedThanks {
  id: string;
  utilityType: UtilityType;
  reaction: ReactionType;
  helpers: number;
}

/** Recently fully-paid bills where the family left a thank-you reaction. */
export async function recentlyClosedWithThanks(limit = 6): Promise<ClosedThanks[]> {
  const { bills } = await collections();
  const docs = await bills
    .find(
      { $expr: { $gte: ["$paidAmount", "$amountOwed"] }, "thanksReactions.0": { $exists: true } },
      { projection: { utilityType: 1, thanksReactions: 1 } },
    )
    .sort({ fundedAt: -1, updatedAt: -1 })
    .limit(limit)
    .toArray();
  if (docs.length === 0) return [];
  const withCounts = await withHelpers(
    docs.map((d) => ({ id: d._id.toHexString() }) as PublicBill),
  );
  return docs.map((d, i) => ({
    id: d._id.toHexString(),
    utilityType: d.utilityType,
    reaction: (d.thanksReactions ?? [])[0]!,
    helpers: withCounts[i]?.helpers?.count ?? 0,
  }));
}

/** Families a donor helped since the start of this month (shown only to that donor). */
export async function donorFamiliesThisMonth(donorId: ObjectId): Promise<number> {
  const { payments } = await collections();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const billIds = await payments.distinct("billId", { donorId, status: "paid", paidAt: { $gte: monthStart } });
  return billIds.length;
}

/** Open, published bills per region (for the region picker). */
export async function openBillsByRegion(): Promise<Partial<Record<Region, number>>> {
  const { bills } = await collections();
  const rows = await bills
    .aggregate<{ _id: Region; n: number }>([
      { $match: { reviewStatus: "approved", isOpen: true } },
      { $group: { _id: "$region", n: { $sum: 1 } } },
    ])
    .toArray();
  return Object.fromEntries(rows.map((r) => [r._id, r.n]));
}
