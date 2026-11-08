import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getPayment } from "@/lib/payments/core";
import { PaymentResultClient } from "@/components/PaymentResultClient";

export const dynamic = "force-dynamic";

export default async function PaymentResultPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  const payment = await getPayment(id);
  if (!payment) {
    return (
      <div className="card space-y-4 text-center">
        <p className="font-bold">{dict.checkout.invalid}</p>
        <Link href={`/${locale}`} className="btn-primary">
          {dict.common.back}
        </Link>
      </div>
    );
  }

  return (
    <PaymentResultClient
      paymentId={payment._id.toHexString()}
      initialStatus={payment.status}
      amount={payment.amount}
      billId={payment.billId.toHexString()}
      locale={locale}
      dict={dict}
    />
  );
}
