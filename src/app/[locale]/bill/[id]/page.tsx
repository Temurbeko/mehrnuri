import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { env } from "@/config/env";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getBill, toPublicBill } from "@/lib/bills/service";
import { currentDonor } from "@/lib/donors/session";
import { sweepExpired } from "@/lib/payments/core";
import { enabledProviders } from "@/lib/payments/providers";
import { canReactToBill } from "@/app/api/bills/[id]/react/route";
import { DonatePanel } from "@/components/DonatePanel";

export const dynamic = "force-dynamic";

export default async function BillPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  await sweepExpired();
  const [billDoc, donor, cookieStore] = await Promise.all([getBill(id), currentDonor(), cookies()]);
  if (!billDoc) {
    return (
      <div className="card mx-auto max-w-md space-y-4 text-center">
        <h1 className="text-lg font-extrabold text-slate-900">{dict.bill.notFound}</h1>
        <Link href={`/${locale}`} className="btn-primary">
          {dict.common.back}
        </Link>
      </div>
    );
  }

  const canReact = canReactToBill(cookieStore, billDoc._id.toHexString());

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href={`/${locale}`}
        className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-extrabold text-slate-600 shadow-2xs border border-slate-200/80 hover:text-slate-900 transition active:scale-95"
      >
        <span>←</span>
        <span>{dict.common.back}</span>
      </Link>
      <DonatePanel
        initialBill={toPublicBill(billDoc)}
        initialReviewStatus={billDoc.reviewStatus}
        initialNickname={donor?.nickname ?? null}
        providers={enabledProviders()}
        minAmount={env().MIN_DONATION_UZS}
        canReact={canReact}
        locale={locale}
        dict={dict}
      />
    </div>
  );
}
