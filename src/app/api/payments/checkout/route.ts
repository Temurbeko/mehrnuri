import { NextResponse, type NextRequest } from "next/server";
import { getBill } from "@/lib/bills/service";
import { currentDonor } from "@/lib/donors/session";
import { createPayment } from "@/lib/payments/core";
import { getProvider } from "@/lib/payments/providers";
import { isBillOwner, OWNER_COOKIE } from "@/lib/bills/owner";
import { hashIp } from "@/lib/security/crypto";
import { assertSameOrigin, clientIp, handler, HttpError, readJson } from "@/lib/security/http";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { checkoutSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const POST = handler(async (req: NextRequest) => {
  assertSameOrigin(req);
  await enforceRateLimit(req, "checkout");
  const input = await readJson(req, checkoutSchema);

  const donor = await currentDonor();
  if (!donor) throw new HttpError(401, "donor_required");

  const provider = getProvider(input.provider);
  if (!provider) throw new HttpError(400, "provider_disabled");

  const bill = await getBill(input.billId);
  if (!bill) throw new HttpError(404, "bill_not_found");
  // The family that posted a request cannot donate to it: that would put them on
  // the leaderboard for paying their own bill.
  if (isBillOwner(req.cookies.get(OWNER_COOKIE)?.value, input.billId)) throw new HttpError(403, "own_bill");

  const payment = await createPayment({
    bill,
    donor,
    amount: input.amount,
    provider: provider.id,
    locale: input.locale,
    ipHash: hashIp(clientIp(req)),
  });

  const redirectUrl = provider.checkoutUrl(payment, { locale: input.locale });
  return NextResponse.json({ ok: true, paymentId: payment._id.toHexString(), redirectUrl }, { status: 201 });
});
