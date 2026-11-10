import Link from "next/link";
import { ArrowRight, Check, Heart, MapPin } from "lucide-react";
import { UTILITY_ICONS, type PublicBill, type UtilityType } from "@/lib/domain";
import { findDistrict } from "@/lib/uzbekistan";
import type { Locale } from "@/i18n/config";
import { formatMoney, type Dictionary } from "@/i18n";
import { TrustBadge } from "./DebtCheck";

export const UTILITY_THEMES: Record<
  UtilityType,
  { bg: string; text: string; ring: string; bar: string }
> = {
  electricity: {
    bg: "bg-amber-500/12",
    text: "text-amber-600",
    ring: "ring-amber-500/20",
    bar: "from-amber-400 to-amber-500",
  },
  gas: {
    bg: "bg-orange-500/12",
    text: "text-orange-600",
    ring: "ring-orange-500/20",
    bar: "from-orange-400 to-rose-500",
  },
  water: {
    bg: "bg-sky-500/12",
    text: "text-sky-600",
    ring: "ring-sky-500/20",
    bar: "from-sky-400 to-blue-500",
  },
  heating: {
    bg: "bg-rose-500/12",
    text: "text-rose-600",
    ring: "ring-rose-500/20",
    bar: "from-rose-400 to-red-500",
  },
  hot_water: {
    bg: "bg-indigo-500/12",
    text: "text-indigo-600",
    ring: "ring-indigo-500/20",
    bar: "from-indigo-400 to-violet-500",
  },
  waste: {
    bg: "bg-emerald-500/12",
    text: "text-emerald-600",
    ring: "ring-emerald-500/20",
    bar: "from-emerald-400 to-teal-500",
  },
};

export function StatusBadge({ bill, dict }: { bill: PublicBill; dict: Dictionary }) {
  if (bill.payoutStatus === "paid_out") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700 ring-1 ring-emerald-500/20">
        <Check size={14} aria-hidden="true" />{dict.status.paid_out}
      </span>
    );
  }
  const styles = {
    unpaid: "bg-rose-500/10 text-rose-700 ring-rose-500/20",
    partially_paid: "bg-amber-500/15 text-amber-800 ring-amber-500/25",
    fully_paid: "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold ring-1 ${styles[bill.fundingStatus]}`}>
      {dict.status[bill.fundingStatus]}
    </span>
  );
}

export function BillCard({ bill, locale, dict }: { bill: PublicBill; locale: Locale; dict: Dictionary }) {
  const pct = Math.min(100, Math.round((bill.paidAmount / Math.max(1, bill.amountOwed)) * 100));
  const remaining = Math.max(0, bill.amountOwed - bill.paidAmount);
  const theme = UTILITY_THEMES[bill.utilityType];
  const isDone = bill.fundingStatus === "fully_paid";
  const districtInfo = findDistrict(bill.region, bill.district);
  const dot =
    bill.payoutStatus === "paid_out" || isDone
      ? "bg-emerald-500"
      : bill.fundingStatus === "partially_paid"
        ? "bg-amber-500"
        : "bg-rose-500";
  const statusText = bill.payoutStatus === "paid_out" ? dict.status.paid_out : dict.status[bill.fundingStatus];
  const money = formatMoney(remaining, dict);
  const paidLine = `${formatMoney(bill.paidAmount, dict)} / ${formatMoney(bill.amountOwed, dict)}`;

  return (
    <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-12px_rgba(15,23,42,0.25)] active:scale-[0.99]">
      <div aria-hidden="true" className={`h-1.5 w-full bg-gradient-to-r ${theme.bar}`} />

      <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-full py-1 pl-2 pr-3 text-sm font-extrabold ${theme.bg} ${theme.text}`}>
            <span aria-hidden="true" className="text-base leading-none">{UTILITY_ICONS[bill.utilityType]}</span>
            <span className="truncate">{dict.utility[bill.utilityType]}</span>
            {bill.verified && (
              <span title={dict.bill.verified} className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check size={11} strokeWidth={3} aria-hidden="true" />
              </span>
            )}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-bold text-slate-600">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot}`} />
            {statusText}
          </span>
        </div>

        <div className="min-w-0">
          <div className="text-xs font-bold text-slate-500">{dict.bill.remaining}</div>
          <div className="whitespace-nowrap text-[2rem] font-extrabold leading-tight tracking-tight text-slate-900">
            {money}
          </div>
          <div className="mt-0.5 truncate text-xs font-semibold text-slate-500">{paidLine}</div>
        </div>

        <div className="flex items-center gap-2.5">
          <div
            className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`h-full rounded-full bg-gradient-to-r ${theme.bar} transition-all duration-500`}
              style={{ width: `${Math.max(pct, bill.paidAmount > 0 ? 6 : 0)}%` }}
            />
          </div>
          <span className={`w-10 shrink-0 text-right text-sm font-extrabold ${theme.text}`}>{pct}%</span>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-500">
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin size={14} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{dict.districts[districtInfo.id]}</span>
          </span>
          <TrustBadge bill={bill} dict={dict} />
          {bill.thanksReactions && bill.thanksReactions.length > 0 && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-emerald-700">
              <Heart size={12} aria-hidden="true" />
              {dict.reactions.cardBadge}
            </span>
          )}
        </div>

        {bill.story && (
          <p className="line-clamp-2 border-l-2 border-slate-200 pl-3 text-sm font-medium italic leading-snug text-slate-600">
            {bill.story}
          </p>
        )}

        {isDone ? (
          <Link
            href={`/${locale}/bill/${bill.id}`}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-extrabold text-emerald-800 ring-1 ring-emerald-500/20 after:absolute after:inset-0 after:content-['']"
          >
            <Check size={18} aria-hidden="true" />
            <span>{dict.bill.thanks}</span>
          </Link>
        ) : (
          <Link
            href={`/${locale}/bill/${bill.id}`}
            className="btn-primary whitespace-nowrap py-3 text-base after:absolute after:inset-0 after:rounded-3xl after:content-['']"
          >
            <span>{dict.bill.help}</span>
            <ArrowRight size={18} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
    </article>
  );
}
