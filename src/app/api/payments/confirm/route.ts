import { NextResponse, type NextRequest } from "next/server";
import { getPayment, markPaid, markUnsuccessful, pendingReceipt } from "@/lib/payments/core";
import { paymentSignature } from "@/lib/payments/providers";
import { verifyAndLockReceipt, isRetryableReceiptError } from "@/lib/payments/verifyReceipt";
import { safeEqual } from "@/lib/security/crypto";
import { handler, HttpError, readJson } from "@/lib/security/http";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { confirmPaymentSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Payment & Fiscal Receipt Confirmation Endpoint:
 * 1. Verifies HMAC signature.
 * 2. If `receiptRaw` (`ofd.soliq.uz/...`) is provided, verifies it live on the server
 *    against `https://new-ofd.soliq.uz/api/payment` (skipped when `SOLIQ_MODE=mock`), checks the
 *    receipt covers the payment amount, enforces anti-replay uniqueness, and credits the donor on the Top Donors Leaderboard (`leaderboardCredited: true`).
 * 3. If `skipLeaderboard: true`, marks the bill payment without crediting Leaderboard points.
 */
export const POST = handler(async (req: NextRequest) => {
  await enforceRateLimit(req, "paymentConfirm");
  const { paymentId, outcome, signature, receiptRaw, skipLeaderboard } = await readJson(req, confirmPaymentSchema);

  if (!safeEqual(signature, paymentSignature(paymentId))) throw new HttpError(401, "bad_signature");

  const payment = await getPayment(paymentId);
  if (!payment) throw new HttpError(404, "payment_not_found");

  // No "payment_expired" refusal for a success: the 20-minute reservation only
  // holds the amount for other donors. A donor who spent longer in their bank
  // app has still paid the utility, so the confirmation is recorded (markPaid
  // accepts expired payments without double-releasing the reservation).

  if (outcome === "failure") {
    const cancelled = (await markUnsuccessful(payment._id, "failed")) ?? payment;
    return NextResponse.json({ ok: true, status: cancelled.status });
  }

  const raw = skipLeaderboard ? null : (receiptRaw ?? null);
  let verified;
  try {
    verified = await verifyAndLockReceipt(raw, payment.amount, payment.createdAt, payment.billId);
  } catch (err) {
    // Soliq does not have the receipt yet (or is unreachable): the payment is
    // recorded now and the receipt is re-checked in the background.
    if (!raw || !isRetryableReceiptError(err)) throw err;
    const result = await markPaid(payment._id, { leaderboardCredited: false, receiptPending: pendingReceipt(raw) });
    return NextResponse.json({ ok: true, status: result.status, leaderboardCredited: false, receiptPending: true });
  }
  const creditLeaderboard = !skipLeaderboard && verified.verifiedForLeaderboard;

  // Receipt shows less than tapped: count (and credit) what was really paid.
  const lower = verified.receiptAmount !== null && verified.receiptAmount < payment.amount ? verified.receiptAmount : null;
  const result = await markPaid(payment._id, {
    ...(lower !== null ? { amount: lower, claimedAmount: payment.amount } : {}),
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
