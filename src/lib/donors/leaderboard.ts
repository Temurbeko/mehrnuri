import "server-only";
import { collections } from "@/lib/db/mongo";
import type { PublicDonor } from "@/lib/domain";

export async function topDonors(limit = 50): Promise<PublicDonor[]> {
  const { donors } = await collections();
  const list = await donors
    .find({ totalDonated: { $gt: 0 } }, { projection: { nickname: 1, totalDonated: 1, donationsCount: 1 } })
    .sort({ totalDonated: -1, donationsCount: -1 })
    .limit(Math.min(limit, 100))
    .toArray();
  return list.map((d) => ({ nickname: d.nickname, totalDonated: d.totalDonated, donationsCount: d.donationsCount }));
}
