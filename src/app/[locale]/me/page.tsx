import Link from "next/link";
import { ChevronRight, Clock, Receipt, Shield } from "lucide-react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { OWNER_COOKIE, ownedBillIds } from "@/lib/bills/owner";
import { getBillsByIds, toPublicBill } from "@/lib/bills/service";
import { MyRequests, type MyRequest } from "@/components/MyRequests";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { currentDonor, currentRecoveryCode } from "@/lib/donors/session";
import { ProfileClient } from "@/components/ProfileClient";
import { donorOpenPayments, type DonorOpenPayment } from "@/lib/payments/core";
import { formatMoney } from "@/i18n";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  let donor = null;
  let code = null;
  let myRequests: MyRequest[] = [];
  let openPayments: DonorOpenPayment[] = [];
  try {
    const jar = await cookies();
    const [d, c, owned] = await Promise.all([
      currentDonor(),
      currentRecoveryCode(),
      getBillsByIds(ownedBillIds(jar.get(OWNER_COOKIE)?.value)),
    ]);
    donor = d;
    if (d) openPayments = await donorOpenPayments(d._id);
    code = c;
    myRequests = owned.map((b) => ({ bill: toPublicBill(b), reviewStatus: b.reviewStatus, isOpen: b.isOpen }));
  } catch {
    /* DB offline */
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">{dict.me.title}</h1>
      <MyRequests items={myRequests} locale={locale} dict={dict} />
      {openPayments.length > 0 && (
        <section className="space-y-2.5">
          <div>
            <h2 className="text-lg font-extrabold text-[var(--ink)]">{dict.me.unconfirmed}</h2>
            <p className="text-sm text-[var(--ink-soft)]">{dict.me.unconfirmedHint}</p>
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
      <ProfileClient
        initialDonor={
          donor ? { nickname: donor.nickname, totalDonated: donor.totalDonated, donationsCount: donor.donationsCount } : null
        }
        recoveryCode={code}
        dict={dict}
      />
      <div className="pt-4 text-center">
        <Link href={`/${locale}/admin`} className="text-xs font-medium text-stone-400 hover:text-stone-600">
          <span className="inline-flex items-center gap-1.5"><Shield size={16} aria-hidden="true" />{dict.nav.admin}</span>
        </Link>
      </div>
    </div>
  );
}
