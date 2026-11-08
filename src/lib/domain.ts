/**
 * Domain constants & public (client-safe) types.
 * Server-only document shapes live in src/lib/db/models.ts.
 */

export const UTILITY_TYPES = ["electricity", "gas", "water", "heating", "hot_water", "waste"] as const;
export type UtilityType = (typeof UTILITY_TYPES)[number];

export const UTILITY_ICONS: Record<UtilityType, string> = {
  electricity: "⚡",
  gas: "🔥",
  water: "💧",
  heating: "♨️",
  hot_water: "🚿",
  waste: "♻️",
};

export const REGIONS = [
  "tashkent_city",
  "tashkent",
  "andijan",
  "bukhara",
  "fergana",
  "jizzakh",
  "kashkadarya",
  "khorezm",
  "namangan",
  "navoi",
  "samarkand",
  "surkhandarya",
  "syrdarya",
  "karakalpakstan",
] as const;
export type Region = (typeof REGIONS)[number];

export const PAYMENT_PURPOSES = ["main", "penalty"] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];

export const REACTION_TYPES = ["duo", "rahmat", "nur"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export const PAYMENT_PROVIDERS = ["click", "payme", "uzum", "paynet"] as const;
export type PaymentProviderId = (typeof PAYMENT_PROVIDERS)[number];

export type FundingStatus = "unpaid" | "partially_paid" | "fully_paid";
export type ReviewStatus = "pending_review" | "approved" | "rejected";
export type PayoutStatus = "not_paid_out" | "paid_out";
export type PaymentStatus = "created" | "processing" | "paid" | "failed" | "cancelled" | "expired" | "refunded";

/** What the public (feed, bill page, SSE) is allowed to see about a bill. */
export interface PublicBill {
  id: string;
  code: string;
  utilityType: UtilityType;
  region: Region;
  district: string;
  soato: string;
  supplier: string;
  paymentPurpose: PaymentPurpose;
  meterReading: number | null;
  accountNumber: string;
  accountMasked: string;
  holderMasked: string | null;
  addressMasked: string | null;
  familyName: string | null;
  story: string | null;
  amountOwed: number;
  paidAmount: number;
  /** Amount still open for new donations (owed - paid - currently reserved). */
  available: number;
  fundingStatus: FundingStatus;
  verified: boolean;
  payoutStatus: PayoutStatus;
  thanksReactions?: ReactionType[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicDonor {
  nickname: string;
  totalDonated: number;
  donationsCount: number;
}

export function fundingStatusOf(paid: number, owed: number): FundingStatus {
  if (paid <= 0) return "unpaid";
  if (paid >= owed) return "fully_paid";
  return "partially_paid";
}
