import Link from "next/link";
import { ChevronLeft } from "lucide-react";
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
import { isBillOwner, OWNER_COOKIE } from "@/lib/bills/owner";
import { billRecentHelps, withHelpers } from "@/lib/community";
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
        <h1 className="text-lg font-extrabold text-stone-900">{dict.bill.notFound}</h1>
        <Link href={`/${locale}`} className="btn-tonal">
          {dict.common.back}
        </Link>
      </div>
    );
  }

  const recentHelps = await billRecentHelps(billDoc._id, 3).catch(() => []);
  const [publicBill] = await withHelpers([toPublicBill(billDoc)]).catch(() => [toPublicBill(billDoc)]);
  const canReact = canReactToBill(cookieStore, billDoc._id.toHexString());

  return (
    <div className="mx-auto max-w-lg space-y-2">
      <Link
        href={`/${locale}`}
        className="btn-ghost -ml-2 w-auto whitespace-nowrap px-2"
      >
        <ChevronLeft size={18} aria-hidden="true" />
        <span>{dict.common.back}</span>
      </Link>
      <DonatePanel
        initialBill={publicBill!}
        initialReviewStatus={billDoc.reviewStatus}
        initialNickname={donor?.nickname ?? null}
        recentHelps={recentHelps}
        providers={enabledProviders()}
        minAmount={env().MIN_DONATION_UZS}
        canReact={canReact}
        isOwner={isBillOwner(cookieStore.get(OWNER_COOKIE)?.value, billDoc._id.toHexString())}
        locale={locale}
        dict={dict}
      />
    </div>
  );
}
