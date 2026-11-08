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
  UtilityType,
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

export interface RateLimitDoc {
  _id: string;
  count: number;
  expiresAt: Date;
}
