import { NextResponse, type NextRequest } from "next/server";
import { getPayment, markPaid, markUnsuccessful } from "@/lib/payments/core";
import { paymentSignature } from "@/lib/payments/providers";
import { verifyAndLockReceipt } from "@/lib/payments/verifyReceipt";
import { safeEqual } from "@/lib/security/crypto";
import { handler, HttpError, readJson } from "@/lib/security/http";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { confirmPaymentSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Payment & Fiscal Receipt Confirmation Endpoint:
 * 1. Verifies HMAC signature.
 * 2. If `receiptRaw` (`ofd.soliq.uz/...`) is provided, verifies it live on the server
 *    against `https://new-ofd.soliq.uz/api/payment`, enforces anti-replay uniqueness,
 *    and credits the donor on the Top Donors Leaderboard (`leaderboardCredited: true`).
 * 3. If `skipLeaderboard: true`, marks the bill payment without crediting Leaderboard points.
 */
export const POST = handler(async (req: NextRequest) => {
  await enforceRateLimit(req, "paymentConfirm");
  const { paymentId, outcome, signature, receiptRaw, skipLeaderboard } = await readJson(req, confirmPaymentSchema);

  if (!safeEqual(signature, paymentSignature(paymentId))) throw new HttpError(401, "bad_signature");

  const payment = await getPayment(paymentId);
  if (!payment) throw new HttpError(404, "payment_not_found");

  if (payment.status === "created" && payment.expiresAt < new Date()) {
    await markUnsuccessful(payment._id, "expired");
    throw new HttpError(409, "payment_expired");
  }

  if (outcome === "failure") {
    const cancelled = (await markUnsuccessful(payment._id, "failed")) ?? payment;
    return NextResponse.json({ ok: true, status: cancelled.status });
  }

  const verified = await verifyAndLockReceipt(skipLeaderboard ? null : receiptRaw, payment.amount);
  const creditLeaderboard = !skipLeaderboard && verified.verifiedForLeaderboard;

  const result = await markPaid(payment._id, {
    receiptKey: verified.receiptKey,
    receiptLabel: verified.receiptLabel,
    leaderboardCredited: creditLeaderboard,
  });

  return NextResponse.json({
    ok: true,
    status: result.status,
    leaderboardCredited: creditLeaderboard,
    receiptLabel: verified.receiptLabel,
  });
});
