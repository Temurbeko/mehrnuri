import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { ensureShareCode, getPayment } from "@/lib/payments/core";
import { MERCHANT_APPS } from "@/lib/merchants";
import { fmt, formatMoney } from "@/i18n";
import { LOCALE_HTML_LANG } from "@/i18n/config";
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
  const viewer = paid ? await currentDonor().catch(() => null) : null;
  const shareCode = paid ? await ensureShareCode(payment).catch(() => null) : null;
  // Someone else opened this link (another device, a forwarded link): this page is the
  // donor's private receipt, so show the public share page with the donor's name instead.
  if (paid && !(viewer && viewer._id.equals(payment.donorId))) {
    redirect(shareCode ? `/${locale}/h/${shareCode}` : `/${locale}`);
  }
  const donor = viewer;
  const familiesThisMonth = donor ? await donorFamiliesThisMonth(donor._id).catch(() => 0) : 0;

  // Details, formatted here (Tashkent time) so the client only prints them.
  const t = dict.details;
  const when = payment.paidAt ?? payment.updatedAt;
  const details = paid
    ? [
        {
          label: t.date,
          value: new Intl.DateTimeFormat(LOCALE_HTML_LANG[locale], { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tashkent" }).format(when),
        },
        ...(bill
          ? [
              {
                label: t.service,
                value: [dict.utilityBill[bill.utilityType], bill.district ? dict.districts[bill.district as keyof typeof dict.districts] : null]
                  .filter(Boolean)
                  .join(" · "),
              },
            ]
          : []),
        { label: t.app, value: MERCHANT_APPS[payment.provider]?.name ?? payment.provider },
        ...(bill ? [{ label: t.request, value: bill.code, href: `/${locale}/bill/${bill._id.toHexString()}` }] : []),
        {
          label: t.receipt,
          value: payment.receiptKey ? (payment.receiptLabel ?? dict.history.receiptOk) : payment.receiptPending ? t.receiptPending : t.receiptNone,
          tone: (payment.receiptKey ? "ok" : payment.receiptPending ? "wait" : undefined) as "ok" | "wait" | undefined,
        },
        ...(bill
          ? [
              {
                label: t.progress,
                value: `${fmt(t.progressValue, { pct: Math.min(100, Math.round((bill.paidAmount / Math.max(1, bill.amountOwed)) * 100)) })} · ${formatMoney(bill.amountOwed, dict)}`,
              },
            ]
          : []),
      ]
    : null;

  return (
    <PaymentResultClient
      paymentId={payment._id.toHexString()}
      initialStatus={payment.status}
      amount={payment.amount}
      billId={payment.billId.toHexString()}
      utilityType={bill?.utilityType ?? null}
      familiesThisMonth={familiesThisMonth}
      details={details}
      shareCode={shareCode}
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
