import Link from "next/link";
import { CardStory } from "./CardStory";
import { ArrowRight, Check, Heart, MapPin } from "lucide-react";
import { UTILITY_ICONS, type PublicBill, type UtilityType } from "@/lib/domain";
import { findDistrict } from "@/lib/uzbekistan";
import type { Locale } from "@/i18n/config";
import { fmt, type Dictionary } from "@/i18n";
import { groupDigits, timeAgo } from "@/lib/format";
import { TrustBadge } from "./DebtCheck";

/** Soft background of the utility icon tile. */
export const UTILITY_TINTS: Record<UtilityType, string> = {
  electricity: "#fff3d6",
  gas: "#ffe6dc",
  water: "#e1f0ff",
  heating: "#ffe3e3",
  hot_water: "#e8e6ff",
  waste: "#e2f5e9",
};

export function UtilityTile({ type, big = false }: { type: UtilityType; big?: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{ background: UTILITY_TINTS[type] }}
      className={`flex shrink-0 items-center justify-center leading-none ${big ? "h-16 w-16 rounded-[20px] text-[32px]" : "h-[46px] w-[46px] rounded-[15px] text-2xl"}`}
    >
      {UTILITY_ICONS[type]}
    </span>
  );
}

/** Helper avatars (initials) + "{n} saxiy", or the invitation to be first. */
export function HelpersLine({ bill, dict }: { bill: PublicBill; dict: Dictionary }) {
  const helpers = bill.helpers;
  if (!helpers || helpers.count === 0) {
    return <span className="min-w-0 text-[13px] font-bold text-[var(--ink-soft)]">{dict.feed.firstHelper}</span>;
  }
  return (
    <span className="flex min-w-0 items-center gap-2 text-[13px] font-bold text-[var(--ink-soft)]">
      <span className="flex shrink-0">
        {helpers.initials.slice(0, 3).map((c, i) => (
          <span
            key={i}
            className={`flex h-6 w-6 items-center justify-center rounded-full bg-[var(--glow)] text-[11px] font-extrabold text-[#3b2508] ring-2 ring-white ${i > 0 ? "-ml-[7px]" : ""}`}
          >
            {c}
          </span>
        ))}
      </span>
      <span className="truncate">{fmt(dict.feed.helpersCount, { count: helpers.count })}</span>
    </span>
  );
}


export const UTILITY_THEMES: Record<
  UtilityType,
  { bg: string; text: string; bar: string }
> = {
  electricity: {
    bg: "bg-amber-500/12",
    text: "text-amber-600",
        bar: "from-amber-400 to-amber-500",
  },
  gas: {
    bg: "bg-orange-500/12",
    text: "text-orange-600",
        bar: "from-orange-400 to-rose-500",
  },
  water: {
    bg: "bg-sky-500/12",
    text: "text-sky-600",
        bar: "from-sky-400 to-blue-500",
  },
  heating: {
    bg: "bg-rose-500/12",
    text: "text-rose-600",
        bar: "from-rose-400 to-red-500",
  },
  hot_water: {
    bg: "bg-indigo-500/12",
    text: "text-indigo-600",
        bar: "from-indigo-400 to-violet-500",
  },
  waste: {
    bg: "bg-emerald-500/12",
    text: "text-emerald-600",
        bar: "from-emerald-400 to-teal-500",
  },
};

export function StatusBadge({ bill, dict }: { bill: PublicBill; dict: Dictionary }) {
  if (bill.payoutStatus === "paid_out") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-extrabold text-emerald-700">
        <Check size={14} aria-hidden="true" />{dict.status.paid_out}
      </span>
    );
  }
  const styles = {
    unpaid: "bg-rose-500/10 text-rose-700",
    partially_paid: "bg-amber-500/15 text-amber-800",
    fully_paid: "bg-emerald-500/12 text-emerald-700",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold ${styles[bill.fundingStatus]}`}>
      {dict.status[bill.fundingStatus]}
    </span>
  );
}

export function BillCard({ bill, locale, dict }: { bill: PublicBill; locale: Locale; dict: Dictionary }) {
  const pct = Math.min(100, Math.round((bill.paidAmount / Math.max(1, bill.amountOwed)) * 100));
  const remaining = Math.max(0, bill.amountOwed - bill.paidAmount);
  const isDone = bill.fundingStatus === "fully_paid";
  const districtInfo = findDistrict(bill.region, bill.district);
  const checked = bill.trustLevel === "donor_checked" || bill.trustLevel === "proven";
  const href = `/${locale}/bill/${bill.id}`;

  return (
    <article className="group relative flex h-full min-w-0 flex-col gap-4 rounded-3xl bg-white p-[18px] shadow-[var(--lift)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--lift-hover)] active:scale-[0.99]">
      <div className="flex items-center gap-3">
        <UtilityTile type={bill.utilityType} />
        <div className="min-w-0 flex-1">
          <strong className="block text-base font-extrabold break-words text-[var(--ink)]">{dict.utilityBill[bill.utilityType]}</strong>
          <span className="flex items-start gap-1 text-[13px] font-semibold text-[var(--ink-soft)]">
            <MapPin size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span className="min-w-0 break-words">{dict.districts[districtInfo.id]}</span>
          </span>
        </div>
        <span suppressHydrationWarning className="shrink-0 self-start text-[13px] font-semibold whitespace-nowrap text-[var(--ink-soft)]">
          {timeAgo(bill.createdAt, dict.time)}
        </span>
      </div>

      {bill.story && <CardStory story={bill.story} more={dict.app.more} less={dict.app.less} />}

      <div>
        <div className="flex items-end justify-between gap-2.5">
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-[var(--ink-soft)]">{dict.bill.remaining}</div>
            <div className="text-[26px] leading-[1.1] font-extrabold tracking-tight whitespace-nowrap text-[var(--ink)]">
              {groupDigits(String(remaining))} <small className="text-[15px] font-bold text-[var(--ink-soft)]">{dict.common.som}</small>
            </div>
          </div>
          {checked && <TrustBadge bill={bill} dict={dict} />}
        </div>
        <div
          className="mt-2.5 h-2 overflow-hidden rounded-full bg-[var(--tone)]"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--lamp),#ffc04d)] transition-all duration-700"
            style={{ width: `${Math.max(pct, bill.paidAmount > 0 ? 4 : 0)}%` }}
          />
        </div>
        {bill.thanksReactions && bill.thanksReactions.length > 0 && (
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold whitespace-nowrap text-[var(--hope)]">
            <Heart size={12} aria-hidden="true" />
            {dict.reactions.cardBadge}
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2.5 border-t border-[var(--hairline)] pt-3.5">
        <HelpersLine bill={bill} dict={dict} />
        <Link
          href={href}
          className={`inline-flex shrink-0 items-center gap-1 font-extrabold whitespace-nowrap after:absolute after:inset-0 after:content-[''] ${isDone ? "text-[var(--hope)]" : "text-[var(--lamp-deep)]"}`}
        >
          {isDone ? <Check size={16} aria-hidden="true" /> : null}
          {isDone ? dict.feed.closedPill : dict.bill.help}
          <ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </article>
  );
}
