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
/**
 * `approved` is the DEFAULT for new requests: bills publish automatically.
 * `pending_review` is only for requests an automatic guardrail held back
 * (e.g. an impossible amount). `flagged` is a bill donors reported as wrong.
 */
export type ReviewStatus = "pending_review" | "approved" | "flagged" | "rejected";

/**
 * How much the crowd has confirmed a bill is real. Nobody at MehrNuri can see
 * a utility debt, but every donor sees it inside their own payment app before
 * paying — so the donors are the verifiers.
 */
export const TRUST_LEVELS = ["new", "donor_checked", "proven"] as const;
export type TrustLevel = (typeof TRUST_LEVELS)[number];

/** A donor's verdict after looking up the account in their payment app. */
export const VERDICT_KINDS = ["match", "amount_differs", "no_debt"] as const;
export type VerdictKind = (typeof VERDICT_KINDS)[number];

/** Reports needed before a bill auto-hides / an account is blocked for good. */
export const MISMATCH_LIMIT_BILL = 2;
export const MISMATCH_LIMIT_ACCOUNT = 3;

/** A posted request goes stale: utility debt changes every month. */
export const BILL_TTL_DAYS = 30;

/**
 * Largest believable household debt per utility, in so'm. Above this a request
 * is held for a human instead of being published — the only automatic brake
 * that still needs an admin.
 */
export const PLAUSIBLE_MAX_UZS: Record<UtilityType, number> = {
  electricity: 1_500_000,
  gas: 2_000_000,
  water: 500_000,
  heating: 2_500_000,
  hot_water: 800_000,
  waste: 200_000,
};

export function isPlausibleAmount(utilityType: UtilityType, amountUzs: number): boolean {
  return amountUzs <= PLAUSIBLE_MAX_UZS[utilityType];
}

/** Reputation key: the utility account number is the only stable identity here. */
export function accountKeyOf(utilityType: UtilityType, accountNumber: string): string {
  return `${utilityType}:${accountNumber}`;
}

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
  /** Crowd-verification state, shown as a badge on the feed and bill page. */
  trustLevel: TrustLevel;
  /** How many donors looked the account up and said the debt matched. */
  checkedCount: number;
  /** When this request goes stale and closes itself (ISO). */
  expiresAt: string | null;
  payoutStatus: PayoutStatus;
  thanksReactions?: ReactionType[];
  /** People who paid towards this bill, and initials of the latest three (public nicknames). */
  helpers?: { count: number; initials: string[] };
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
