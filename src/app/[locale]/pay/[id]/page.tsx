import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getBill, toPublicBill } from "@/lib/bills/service";
import { env } from "@/config/env";
import { getPayment } from "@/lib/payments/core";
import { paymentSignature } from "@/lib/payments/providers";
import { DirectPaymentClient } from "@/components/DirectPaymentClient";

export const dynamic = "force-dynamic";

export default async function DirectPayPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  const payment = await getPayment(id);
  // "expired" stays confirmable: the donor may have needed longer than the reservation to pay.
  if (!payment || (payment.status !== "created" && payment.status !== "processing" && payment.status !== "expired")) {
    return (
      <div className="card mx-auto max-w-md space-y-4 text-center">
        <p className="font-bold">{dict.checkout.invalid}</p>
        <Link href={`/${locale}`} className="btn-primary">
          {dict.common.back}
        </Link>
      </div>
    );
  }

  const billDoc = await getBill(payment.billId.toHexString());
  const pubBill = billDoc ? toPublicBill(billDoc) : null;
  const sig = paymentSignature(payment._id.toHexString());

  return (
    <DirectPaymentClient
      paymentId={payment._id.toHexString()}
      billId={pubBill?.id ?? null}
      provider={payment.provider}
      amount={payment.amount}
      utilityType={pubBill?.utilityType ?? "electricity"}
      supplier={pubBill?.supplier ?? "—"}
      accountNumber={pubBill?.accountNumber ?? "—"}
      signature={sig}
      testMode={env().SOLIQ_MODE === "mock"}
      locale={locale}
      dict={dict}
    />
  );
}
