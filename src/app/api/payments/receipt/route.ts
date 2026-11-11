import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { attachReceipt } from "@/lib/payments/core";
import { paymentSignature } from "@/lib/payments/providers";
import { safeEqual } from "@/lib/security/crypto";
import { handler, HttpError, readJson } from "@/lib/security/http";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { attachReceiptSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Adds a fiscal receipt to a payment already counted as paid: the donor
 * skipped it at the time, closed the page, or Soliq did not have it yet.
 * Answers "verified", or "pending" when Soliq still does not know the receipt
 * (it is then re-checked in the background for a few days).
 */
export const POST = handler(async (req: NextRequest) => {
  await enforceRateLimit(req, "paymentConfirm");
  const { paymentId, signature, receiptRaw } = await readJson(req, attachReceiptSchema);
  if (!safeEqual(signature, paymentSignature(paymentId))) throw new HttpError(401, "bad_signature");
  const result = await attachReceipt(new ObjectId(paymentId), receiptRaw);
  return NextResponse.json({ ok: true, result });
});
