import "server-only";
import { ObjectId } from "mongodb";
import { collections } from "@/lib/db/mongo";
import type { ReactionType } from "@/lib/domain";

export interface PaymentThanks {
  billId: string;
  reactions: ReactionType[];
  /** The family's thanks was left (bill last touched) within the last 30 days. */
  recent: boolean;
}

const RECENT_MS = 30 * 24 * 3600 * 1000;

/** Thank-you reactions of the families behind the given payments, keyed by payment id. */
export async function thanksForPayments(paymentIds: string[]): Promise<Record<string, PaymentThanks>> {
  const ids = paymentIds.filter((id) => ObjectId.isValid(id) && id.length === 24).map((id) => new ObjectId(id));
  if (ids.length === 0) return {};
  const { payments } = await collections();
  const rows = await payments
    .aggregate<{ _id: ObjectId; billId: ObjectId; bill: { thanksReactions: ReactionType[]; updatedAt: Date; thanksAt?: Date | null } }>([
      { $match: { _id: { $in: ids } } },
      { $project: { billId: 1 } },
      {
        $lookup: {
          from: "bills",
          localField: "billId",
          foreignField: "_id",
          as: "bill",
          pipeline: [{ $match: { "thanksReactions.0": { $exists: true } } }, { $project: { thanksReactions: 1, updatedAt: 1, thanksAt: 1 } }],
        },
      },
      { $unwind: "$bill" },
    ])
    .toArray();
  const now = Date.now();
  const out: Record<string, PaymentThanks> = {};
  for (const r of rows) {
    out[r._id.toHexString()] = {
      billId: r.billId.toHexString(),
      reactions: r.bill.thanksReactions,
      recent: now - new Date(r.bill.thanksAt ?? r.bill.updatedAt).getTime() <= RECENT_MS,
    };
  }
  return out;
}
