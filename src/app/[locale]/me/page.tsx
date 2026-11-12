import type { Metadata } from "next";
import { PRIVATE_METADATA } from "@/lib/seo";
import Link from "next/link";
import { Check, ChevronRight, Clock, Receipt } from "lucide-react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { OWNER_COOKIE, ownedBillIds } from "@/lib/bills/owner";
import { getBillsByIds, toPublicBill } from "@/lib/bills/service";
import { MyRequests, type MyRequest } from "@/components/MyRequests";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { currentDonor, currentRecoveryCode } from "@/lib/donors/session";
import { ProfileClient } from "@/components/ProfileClient";
import { ProfileTabs } from "@/components/ProfileTabs";
import { donorHistory, donorOpenPayments, type DonorOpenPayment, type HistoryItem } from "@/lib/payments/core";
import { UTILITY_ICONS } from "@/lib/domain";
import { formatMoney } from "@/i18n";
import { timeAgo } from "@/lib/format";
import { ImpactCard } from "@/components/ImpactCard";
import { LOCALE_HTML_LANG } from "@/i18n/config";
import { donorMonthImpact, ensureImpactCode, monthKeyOf, monthLabel, previousMonthKey, type MonthImpact } from "@/lib/impact";

export const dynamic = "force-dynamic";

export const metadata: Metadata = PRIVATE_METADATA;

export default async function MePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  let donor = null;
  let code = null;
  let myRequests: MyRequest[] = [];
  let openPayments: DonorOpenPayment[] = [];
  let history: HistoryItem[] = [];
  let impact: (MonthImpact & { code: string }) | null = null;
  try {
    const jar = await cookies();
    const [d, c, owned] = await Promise.all([
      currentDonor(),
      currentRecoveryCode(),
      getBillsByIds(ownedBillIds(jar.get(OWNER_COOKIE)?.value)),
    ]);
    donor = d;
    if (d) {
      const [open, past] = await Promise.all([donorOpenPayments(d._id), donorHistory(d._id)]);
      // paid ones without a receipt show in the history with an "add receipt" badge
      openPayments = open.filter((p) => p.kind === "unconfirmed");
      history = past;
      if (past.length > 0) {
        const thisMonth = monthKeyOf(new Date());
        let m = await donorMonthImpact(d._id, thisMonth);
        if (m.families < 1) m = await donorMonthImpact(d._id, previousMonthKey(thisMonth));
        if (m.families >= 1) impact = { ...m, code: await ensureImpactCode(d._id) };
      }
    }
    code = c;
    myRequests = owned.map((b) => ({ bill: toPublicBill(b), reviewStatus: b.reviewStatus, isOpen: b.isOpen }));
  } catch {
    /* DB offline */
  }


  const hasHelps = openPayments.length > 0 || history.length > 0;
  const hasRequests = myRequests.length > 0;

  const helpsNode = hasHelps ? (
    <div className="space-y-5">
      {impact && (
        <ImpactCard
          code={impact.code}
          month={impact.month}
          monthText={monthLabel(impact.month, LOCALE_HTML_LANG[locale])}
          families={impact.families}
          total={impact.total}
          utilities={impact.utilities}
          locale={locale}
          dict={dict}
        />
      )}
      {openPayments.length > 0 && (
        <section className="space-y-2">
          <div className="mx-1">
            <h2 className="text-[13px] font-extrabold tracking-wide text-[var(--ink-soft)] uppercase">{dict.me.unconfirmed}</h2>
            <p className="mt-0.5 text-[13px] text-[var(--ink-soft)]">{dict.me.unconfirmedHint}</p>
          </div>
          <ul className="list">
            {openPayments.map((p) => (
              <li key={p.id}>
                <Link
                  href={p.kind === "paid" ? `/${locale}/payment/${p.id}` : `/${locale}/pay/${p.id}`}
                  className="list-row-tap flex min-w-0 items-center gap-3"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-amber-100 text-[var(--lamp-deep)]">
                    {p.pending ? <Clock size={18} aria-hidden="true" /> : <Receipt size={18} aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-[15px] whitespace-nowrap text-[var(--ink)] tabular-nums">{formatMoney(p.amount, dict)}</b>
                    <small className="block truncate text-[13px] text-[var(--ink-soft)]">
                      {p.kind === "unconfirmed" ? dict.me.notConfirmed : p.pending ? dict.me.waiting : dict.me.add} · {timeAgo(p.at, dict.time)}
                    </small>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-[var(--ink-soft)]" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className="mx-1 text-[13px] font-extrabold tracking-wide text-[var(--ink-soft)] uppercase">{dict.history.title}</h2>
          <ul className="list">
            {history.map((h) => (
              <li key={h.id}>
                <Link href={`/${locale}/payment/${h.id}`} className="list-row-tap flex min-w-0 items-center gap-3">
                  <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--tone)] text-[19px]">
                    {UTILITY_ICONS[h.utilityType]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[15px] text-[var(--ink)]">{dict.utilityBill[h.utilityType]}</b>
                    <small className="block truncate text-[13px] text-[var(--ink-soft)]">
                      {h.district ? `${dict.districts[h.district as keyof typeof dict.districts] ?? ""} · ` : ""}
                      {timeAgo(h.at, dict.time)}
                    </small>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <b className="text-[15px] whitespace-nowrap text-[var(--ink)] tabular-nums">{formatMoney(h.amount, dict)}</b>
                    {h.receipt === "verified" ? (
                      <small className="inline-flex items-center gap-1 text-[12px] font-bold whitespace-nowrap text-[var(--hope)]">
                        <Check size={13} aria-hidden="true" />
                        {dict.history.receiptOk}
                      </small>
                    ) : h.receipt === "pending" ? (
                      <small className="inline-flex items-center gap-1 text-[12px] font-bold whitespace-nowrap text-[var(--lamp-deep)]">
                        <Clock size={13} aria-hidden="true" />
                        {dict.history.receiptPending}
                      </small>
                    ) : (
                      <small className="inline-flex items-center gap-1 text-[12px] font-bold whitespace-nowrap text-[var(--lamp-deep)]">
                        <Receipt size={13} aria-hidden="true" />
                        {dict.history.receiptNone}
                      </small>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  ) : null;

  const requestsNode = hasRequests ? <MyRequests items={myRequests} locale={locale} dict={dict} /> : null;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-[24px] leading-tight font-extrabold tracking-tight text-[var(--ink)]">{dict.me.title}</h1>
      <ProfileClient
        initialDonor={
          donor ? { nickname: donor.nickname, totalDonated: donor.totalDonated, donationsCount: donor.donationsCount } : null
        }
        recoveryCode={code}
        adminHref={`/${locale}/admin`}
        dict={dict}
      >
        {hasHelps || hasRequests ? (
          <ProfileTabs helps={helpsNode} requests={requestsNode} helpsLabel={dict.ux.tabHelps} requestsLabel={dict.ux.tabRequests} />
        ) : donor ? (
          <p className="surface p-4 text-[15px] text-[var(--ink-soft)]">{dict.history.empty}</p>
        ) : null}
      </ProfileClient>
    </div>
  );
}
