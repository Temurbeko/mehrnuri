import { z } from "zod";
import { REGIONS, UTILITY_TYPES, PAYMENT_PROVIDERS, PAYMENT_PURPOSES, VERDICT_KINDS } from "@/lib/domain";
import { LOCALES } from "@/i18n/config";

const digitsOnly = (v: unknown) => (typeof v === "string" ? v.replace(/[\s-]/g, "") : v);

export const accountNumberSchema = z.preprocess(
  digitsOnly,
  z.string().regex(/^\d{5,20}$/, "Account number must be 5–20 digits"),
);

const safeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s.replace(/\s+/g, " "))
    .refine((s) => !/[<>\u0000-\u001f\u007f]/.test(s), "Invalid characters");

export const createBillSchema = z.object({
  utilityType: z.enum(UTILITY_TYPES),
  region: z.enum(REGIONS),
  district: z.string().trim().min(1).max(40).optional(),
  accountNumber: accountNumberSchema,
  paymentPurpose: z.enum(PAYMENT_PURPOSES).default("main"),
  meterReading: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().nonnegative().max(9_999_999).nullable().optional().transform((v) => v ?? null),
  ),
  amountOwed: z.coerce.number().int().min(1000).max(5_000_000),
  familyName: safeText(40).optional().transform((v) => (v ? v : null)),
  story: safeText(300).optional().transform((v) => (v ? v : null)),
  consent: z.literal(true),
  website: z.string().max(0).optional(),
});

export const nicknameSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[\p{L}\p{N}_.\- ]+$/u, "Letters, numbers, space, _ . - only")
  .refine((s) => !/^(admin|moderator|support|mehrnuri|anonymous|anonim|аноним|system)$/i.test(s.replace(/\s/g, "")), "Reserved nickname");

export const createDonorSchema = z.object({ nickname: nicknameSchema });

export const restoreDonorSchema = z.object({
  recoveryCode: z.string().trim().regex(/^[a-f0-9]{24}\.[A-Za-z0-9_-]{20,100}$/, "Invalid recovery code"),
});

export const checkoutSchema = z.object({
  billId: z.string().regex(/^[a-f0-9]{24}$/),
  amount: z.coerce.number().int().positive(),
  provider: z.enum(PAYMENT_PROVIDERS),
  locale: z.enum(LOCALES),
});

export const confirmPaymentSchema = z.object({
  paymentId: z.string().regex(/^[a-f0-9]{24}$/),
  outcome: z.enum(["success", "failure"]),
  signature: z.string().min(10).max(200),
  receiptRaw: z.string().trim().max(500).optional(),
  skipLeaderboard: z.boolean().optional(),
});

export const attachReceiptSchema = z.object({
  paymentId: z.string().regex(/^[a-f0-9]{24}$/),
  signature: z.string().min(10).max(200),
  receiptRaw: z.string().trim().min(10).max(500),
});

/**
 * A donor reporting what their payment app actually showed for the account.
 * `seenAmount` is only meaningful for `amount_differs`.
 */
export const verdictSchema = z
  .object({
    kind: z.enum(VERDICT_KINDS),
    seenAmount: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().int().nonnegative().max(50_000_000).nullable().optional().transform((v) => v ?? null),
    ),
  })
  .transform((v) => ({ ...v, seenAmount: v.kind === "amount_differs" ? v.seenAmount : null }));

export const remainingSchema = z.object({ remaining: z.number().int().min(0).max(100_000_000) });

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/);

export const adminLoginSchema = z.object({ password: z.string().min(1).max(200) });

export const adminBillActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("reject"),
    reason: safeText(200).pipe(z.string().min(3)),
    /** Also block the utility account, so no new request can use it. */
    blockAccount: z.boolean().optional(),
  }),
  z.object({ action: z.literal("payout"), reference: safeText(100).pipe(z.string().min(3)) }),
]);

export type CreateBillInput = z.infer<typeof createBillSchema>;
