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

  return (
    <article className="card-interactive flex min-w-0 flex-col justify-between gap-4 p-5">
      <div className="space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ring-1 ${theme.bg} ${theme.text} ${theme.ring}`}
              aria-hidden="true"
            >
              {UTILITY_ICONS[bill.utilityType]}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                  {dict.utility[bill.utilityType]}
                </h3>
                {bill.verified && (
                  <span
                    title={dict.bill.verified}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white"
                  >
                    <Check size={14} aria-hidden="true" />
                  </span>
                )}
              </div>
              <p className="flex items-center gap-1 text-sm text-slate-500">
                <MapPin size={16} aria-hidden="true" className="shrink-0" />{dict.region[bill.region]} · {dict.districts[districtInfo.id]}
              </p>
              <div className="mt-1.5">
                <TrustBadge bill={bill} dict={dict} />
              </div>
            </div>
          </div>
          <StatusBadge bill={bill} dict={dict} />
        </div>

        {bill.story && (
          <p className="line-clamp-2 rounded-2xl bg-slate-50 px-3.5 py-2.5 text-[13px] font-medium text-slate-600 leading-relaxed">
            “{bill.story}”
          </p>
        )}

        {bill.thanksReactions && bill.thanksReactions.length > 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-3 py-1 text-[11px] font-extrabold text-emerald-800 ring-1 ring-emerald-500/20">
            <Heart size={14} aria-hidden="true" />
            <span>{dict.reactions.cardBadge}</span>
          </div>
        )}

        <div className="space-y-1.5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-slate-400 font-semibold">{dict.bill.account}: </span>
              <span className="font-mono font-bold text-slate-900">{bill.accountMasked}</span>
            </div>
            {bill.holderMasked ? (
              <span className="font-bold text-slate-700 truncate max-w-[140px]">{bill.holderMasked}</span>
            ) : (
              <span className="font-mono text-[11px] font-bold text-slate-400">{bill.code}</span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
            <span className="truncate font-semibold">{bill.supplier}</span>
          </div>
        </div>

        <div className="space-y-2 pt-0.5">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <div className="text-[11px] font-bold text-slate-400">
                {dict.bill.remaining}
              </div>
              <div className="text-lg font-extrabold tracking-tight text-slate-900">
                {formatMoney(remaining, dict)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold text-slate-400">
                {dict.bill.owed}: {formatMoney(bill.amountOwed, dict)}
              </div>
              <div className="text-xs font-extrabold text-emerald-600">{pct}%</div>
            </div>
          </div>

          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
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
        </div>
      </div>

      <div className="flex items-center gap-2.5 pt-0.5">
        {!isDone && (
          <div className="flex -space-x-1.5 shrink-0" aria-hidden="true">
            {(["/merchants/click.png", "/merchants/payme.png", "/merchants/uzum.png", "/merchants/paynet.png"] as const).map(
              (src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="h-6 w-6 rounded-full object-cover ring-2 ring-white shadow-2xs"
                />
              ),
            )}
          </div>
        )}
        <Link
          href={`/${locale}/bill/${bill.id}`}
          className={`flex-1 ${isDone ? "btn-outline py-2.5 text-sm" : "btn-primary py-3 text-sm"}`}
        >
          <span>{isDone ? dict.bill.thanks : dict.bill.help}</span>
          {!isDone && <ArrowRight size={18} aria-hidden="true" />}
        </Link>
      </div>
    </article>
  );
}
