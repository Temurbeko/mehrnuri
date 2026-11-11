import "server-only";
import type { ObjectId } from "mongodb";
import type {
  PaymentProviderId,
  PaymentPurpose,
  PaymentStatus,
  PayoutStatus,
  ReactionType,
  Region,
  ReviewStatus,
  TrustLevel,
  UtilityType,
  VerdictKind,
} from "@/lib/domain";

export interface BillDoc {
  _id: ObjectId;
  code: string;
  utilityType: UtilityType;
  region: Region;
  district?: string;
  soato?: string;
  supplier?: string;
  paymentPurpose?: PaymentPurpose;
  meterReading?: number | null;
  accountNumber: string;
  familyName: string | null;
  story: string | null;
  phone: string;
  amountOwed: number;
  paidAmount: number;
  reservedAmount: number;
  isOpen: boolean;
  reviewStatus: ReviewStatus;
  rejectReason: string | null;
  /** Crowd verification by donors who looked the account up in their own app. */
  trust: {
    level: TrustLevel;
    matchVotes: number;
    mismatchVotes: number;
    /** Latest report, so the admin sees why a bill was auto-hidden. */
    lastMismatch: { kind: VerdictKind; seenAmount: number | null; at: Date } | null;
  };
  /** Auto-close date: utility debt is only current for about a month. */
  expiresAt?: Date | null;
  verification: {
    provider: string;
    verified: boolean;
    holderMasked: string | null;
    addressMasked?: string | null;
    verifiedDebt: number | null;
    checkedAt: Date;
  };
  payout: {
    status: PayoutStatus;
    reference: string | null;
    at: Date | null;
  };
  ownerTokenHash?: string;
  thanksReactions?: ReactionType[];
  ipHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentDoc {
  _id: ObjectId;
  billId: ObjectId;
  donorId: ObjectId;
  donorNickname: string;
  amount: number;
  provider: PaymentProviderId;
  status: PaymentStatus;
  locale: string;
  expiresAt: Date;
  paidAt: Date | null;
  receiptKey?: string | null;
  /** Network the donor paid from; a payment from the request's own network never builds trust. */
  ipHash?: string;
  receiptLabel?: string | null;
  leaderboardCredited?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DonorDoc {
  _id: ObjectId;
  nickname: string;
  nicknameKey: string;
  tokenHash: string;
  totalDonated: number;
  donationsCount: number;
  telegramId: string | null;
  phone: string | null;
  createdAt: Date;
  lastSeenAt: Date;
}

/** Atomic sequence counters (e.g. "bill_code" for MN-1001, MN-1002, ...). */
export interface CounterDoc {
  _id: string;
  seq: number;
}

export interface RateLimitDoc {
  _id: string;
  count: number;
  expiresAt: Date;
}

/** One donor's verdict on one bill, after checking the account in a payment app. */
export interface VerdictDoc {
  _id: ObjectId;
  billId: ObjectId;
  /** `utilityType:accountNumber` — reputation follows the account, not the person. */
  accountKey: string;
  kind: VerdictKind;
  /** What the payment app actually showed, when the donor reported a difference. */
  seenAmount: number | null;
  /** Hashed donor id. One vote per donor per bill. */
  voterHash: string;
  /** Hashed IP: one network cannot cast two votes on the same bill via several nicknames. */
  ipHash: string;
  createdAt: Date;
}

/**
 * Reputation ledger keyed by utility account number. This is what replaces the
 * admin: an account that has received a Soliq-verified payment is proven real,
 * and future requests on it publish as trusted. An account donors keep
 * reporting gets blocked, whatever name or phone is used next time.
 */
export interface AccountDoc {
  _id: string;
  utilityType: UtilityType;
  accountNumber: string;
  /** Payments on this account confirmed by a real Soliq fiscal receipt. */
  provenPayments: number;
  matchVotes: number;
  mismatchVotes: number;
  blocked: boolean;
  blockedReason: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
}
