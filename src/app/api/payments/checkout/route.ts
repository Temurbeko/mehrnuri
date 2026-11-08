import { NextResponse, type NextRequest } from "next/server";
import { getBill } from "@/lib/bills/service";
import { currentDonor } from "@/lib/donors/session";
import { createPayment } from "@/lib/payments/core";
import { getProvider } from "@/lib/payments/providers";
import { assertSameOrigin, handler, HttpError, readJson } from "@/lib/security/http";
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

  const payment = await createPayment({
    bill,
    donor,
    amount: input.amount,
    provider: provider.id,
    locale: input.locale,
  });

  const redirectUrl = provider.checkoutUrl(payment, { locale: input.locale });
  return NextResponse.json({ ok: true, paymentId: payment._id.toHexString(), redirectUrl }, { status: 201 });
});
