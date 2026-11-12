import type { PublicBill, UtilityType } from "@/lib/domain";

/**
 * Order for the swipe feed: random, but tilted towards the requests that hurt
 * most if nobody answers. Each request gets a weight; a weighted shuffle then
 * draws them, so every visit is different while heavy ones tend to come first.
 *
 *  - gas and electricity (and heating) weigh more, most of all in the cold months:
 *    a home without them in winter is an emergency;
 *  - the longer a request has waited, the heavier (up to 3x after two weeks);
 *  - a bigger remaining debt weighs more (up to 2x);
 *  - a penalty ("penya") bill weighs double: it grows while it waits.
 */
const WINTER_MONTHS = [10, 11, 0, 1, 2]; // Nov–Mar, Tashkent time

const TYPE_WEIGHT: Record<UtilityType, { winter: number; rest: number }> = {
  gas: { winter: 3, rest: 1.6 },
  electricity: { winter: 3, rest: 1.8 },
  heating: { winter: 2.4, rest: 1 },
  hot_water: { winter: 1.4, rest: 1 },
  water: { winter: 1.2, rest: 1.2 },
  waste: { winter: 0.7, rest: 0.7 },
};

export function spotlightWeight(b: PublicBill, now = new Date()): number {
  const month = new Date(now.getTime() + 5 * 3600_000).getUTCMonth();
  const winter = WINTER_MONTHS.includes(month);
  const type = TYPE_WEIGHT[b.utilityType][winter ? "winter" : "rest"];

  const days = Math.max(0, (now.getTime() - new Date(b.createdAt).getTime()) / 86_400_000);
  const age = 1 + 2 * Math.min(1, days / 14);

  const remaining = Math.max(0, b.amountOwed - b.paidAmount);
  const amount = 1 + Math.min(1, remaining / 1_000_000);

  const penalty = b.paymentPurpose === "penalty" ? 2 : 1;
  return type * age * amount * penalty;
}

/** Weighted random order (Efraimidis–Spirakis): sort by random^(1/weight), highest first. */
export function spotlightOrder(bills: PublicBill[], random: () => number = Math.random): PublicBill[] {
  const now = new Date();
  return bills
    .map((b) => ({ b, key: Math.pow(random(), 1 / spotlightWeight(b, now)) }))
    .sort((x, y) => y.key - x.key)
    .map((x) => x.b);
}
