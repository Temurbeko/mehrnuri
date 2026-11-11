import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getPayment } from "@/lib/payments/core";
import { getBill } from "@/lib/bills/service";
import { currentDonor } from "@/lib/donors/session";
import { donorFamiliesThisMonth } from "@/lib/community";
import { AppBar } from "@/components/AppBar";
import { PaymentResultClient } from "@/components/PaymentResultClient";
import { paymentSignature } from "@/lib/payments/providers";

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
      <div className="mx-auto max-w-md">
        <AppBar title={dict.app.thanks} locale={locale} backLabel={dict.common.back} />
        <div className="card space-y-4 text-center">
          <p className="font-bold">{dict.checkout.invalid}</p>
          <Link href={`/${locale}`} className="btn-primary">
            {dict.common.back}
          </Link>
        </div>
      </div>
    );
  }

  const paid = payment.status === "paid";
  // The bill gives the utility type (what the money paid for); the monthly count is private to the donor.
  const bill = await getBill(payment.billId.toHexString()).catch(() => null);
  const donor = paid ? await currentDonor().catch(() => null) : null;
  const familiesThisMonth = donor ? await donorFamiliesThisMonth(donor._id).catch(() => 0) : 0;

  return (
    <PaymentResultClient
      paymentId={payment._id.toHexString()}
      initialStatus={payment.status}
      amount={payment.amount}
      billId={payment.billId.toHexString()}
      utilityType={bill?.utilityType ?? null}
      familiesThisMonth={familiesThisMonth}
      receipt={
        paid && !payment.receiptKey
          ? { signature: paymentSignature(payment._id.toHexString()), pending: Boolean(payment.receiptPending) }
          : null
      }
      locale={locale}
      dict={dict}
    />
  );
}
