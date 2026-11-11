"use client";

import { ArrowRight, Check, Clock, Heart, Lock, Share2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PaymentStatus, UtilityType } from "@/lib/domain";
import type { Locale } from "@/i18n/config";
import { fmt, formatMoney, type Dictionary } from "@/i18n";
import { copyText } from "@/lib/clipboard";
import { AddReceipt } from "./AddReceipt";
import { AppBar } from "./AppBar";

export function PaymentResultClient({
  paymentId,
  receipt = null,
  initialStatus,
  amount,
  billId,
  utilityType = null,
  familiesThisMonth = 0,
  locale,
  dict,
}: {
  paymentId: string;
  initialStatus: PaymentStatus;
  amount: number;
  billId: string;
  /** What the bill is for (decides the "account" and "outcome" words). */
  utilityType?: UtilityType | null;
  /** Families this donor helped this month: private, shown only to them. */
  familiesThisMonth?: number;
  /** Set when the payment is paid but has no verified fiscal receipt yet. */
  receipt?: { signature: string; pending: boolean } | null;
  locale: Locale;
  dict: Dictionary;
}) {
  const paid = initialStatus === "paid";
  const pending = initialStatus === "created" || initialStatus === "processing";

  if (paid) {
    return (
      <PaidScreen
        amount={amount}
        billId={billId}
        utilityType={utilityType}
        familiesThisMonth={familiesThisMonth}
        receiptSlot={receipt ? <AddReceipt paymentId={paymentId} signature={receipt.signature} pending={receipt.pending} dict={dict} /> : null}
        locale={locale}
        dict={dict}
      />
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5 text-center">
      <AppBar title={dict.app.thanks} locale={locale} backLabel={dict.common.back} />
      <div
        className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full ${
          pending ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"
        }`}
      >
        {pending ? <Clock size={44} aria-hidden="true" /> : <X size={44} aria-hidden="true" />}
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">
          {pending ? dict.result.pendingTitle : dict.result.failedTitle}
        </h1>
        <p className="text-4xl font-extrabold tracking-tight whitespace-nowrap text-stone-900">{formatMoney(amount, dict)}</p>
        <p className="text-sm leading-relaxed font-medium text-stone-600">
          {pending ? dict.result.pendingBody : dict.result.failedBody}
        </p>
      </div>

      <div className="space-y-2.5 pt-1">
        <Link href={`/${locale}/bill/${billId}`} className="btn-primary">
          <span>{dict.result.backToBill}</span>
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link href={`/${locale}`} className="btn-tonal">
          {dict.result.backToFeed}
        </Link>
      </div>
    </div>
  );
}

/** Paid: a window lights up, thanks, the donor's private impact, and a share card with no family details. */
function PaidScreen({
  receiptSlot,
  amount,
  billId,
  utilityType,
  familiesThisMonth,
  locale,
  dict,
}: {
  amount: number;
  billId: string;
  utilityType: UtilityType | null;
  familiesThisMonth: number;
  receiptSlot: React.ReactNode;
  locale: Locale;
  dict: Dictionary;
}) {
  const d = dict.done;
  const [withAmount, setWithAmount] = useState(false);
  const [origin, setOrigin] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function showToast(text: string) {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }

  const money = formatMoney(amount, dict);
  // Only ever these words: never the family, story, district, account number or phone.
  const cardLine = withAmount ? fmt(d.cardLineSum, { amount: money }) : d.cardLine;
  const shareText = withAmount ? fmt(d.shareTextSum, { amount: money }) : fmt(d.shareText);
  const siteLabel = origin.replace(/^https?:\/\//, "");

  async function share() {
    const text = `${shareText} ${d.cardJoin}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text, url: origin || window.location.origin });
      } catch {
        /* the user closed the share sheet */
      }
      return;
    }
    const ok = await copyText(`${text} ${origin || window.location.origin}`);
    showToast(ok ? d.copiedToast : d.copyFailToast);
  }

  return (
    <div className="mx-auto max-w-md text-center">
      <AppBar title={dict.app.thanks} locale={locale} backLabel={dict.common.back} />
      <div aria-hidden="true" className="lightup">
        <i />
      </div>

      <h1 className="mt-3 mb-1 text-[28px] leading-tight font-extrabold tracking-tight text-balance text-[var(--ink)]">{d.title}</h1>
      <p className="text-[34px] font-extrabold tracking-tight whitespace-nowrap text-[var(--ink)]">{money}</p>
      {utilityType && (
        <p className="mx-auto mt-2 max-w-[34ch] text-[15.5px] text-balance break-words text-[var(--ink-soft)]">
          {fmt(d.body, { account: d.account[utilityType], outcome: dict.outcome[utilityType] })}
        </p>
      )}

      {receiptSlot && <div className="mt-5">{receiptSlot}</div>}

      {/* Private: only this donor sees it. */}
      {familiesThisMonth >= 1 && (
        <div className="mt-6 flex items-center gap-3 rounded-[20px] bg-white p-3.5 text-left shadow-[var(--lift)]">
          <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] bg-[rgba(46,154,103,0.12)] text-[var(--hope)]">
            <Heart size={20} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[15px] leading-snug text-[var(--ink)]">{fmt(d.mineTitle, { count: familiesThisMonth })}</b>
            <small className="mt-0.5 flex items-center gap-1 text-[12.5px] font-bold text-[var(--ink-soft)]">
              <Lock size={14} aria-hidden="true" className="shrink-0" />
              {d.mineLock}
            </small>
          </span>
          <Link
            href={`/${locale}/me`}
            className="inline-flex h-[34px] shrink-0 items-center rounded-full bg-[var(--tone)] px-3 text-[13px] font-extrabold text-[var(--ink)]"
          >
            {d.mineLink}
          </Link>
        </div>
      )}

      {/* What will be shared: nothing about the family; the amount only if switched on. */}
      <div className="mt-6 text-left">
        <h2 className="mx-0.5 mb-2.5 text-[15px] font-extrabold text-[var(--ink)]">{d.shareTitle}</h2>
        <figure
          aria-label={d.shareAria}
          className="m-0 flex items-center gap-3.5 rounded-[20px] hero-mesh p-4 text-[#f6efe3]"
        >
          <svg viewBox="0 0 40 48" aria-hidden="true" className="h-[52px] w-11 shrink-0 drop-shadow-[0_0_10px_rgba(246,166,35,0.55)]">
            <rect x="1" y="1" width="38" height="46" rx="7" fill="#151826" />
            <rect x="5" y="5" width="30" height="38" rx="4" fill="#ffc94f" />
            <rect x="19.5" y="5" width="1.5" height="38" fill="#151826" />
            <rect x="5" y="20" width="30" height="1.5" fill="#151826" />
          </svg>
          <figcaption className="grid min-w-0 gap-1">
            <b className="text-base leading-snug break-words">{cardLine}</b>
            <span className="text-[13.5px] leading-snug text-[#d2c9bb]">{d.cardJoin}</span>
            <span suppressHydrationWarning className="text-[13.5px] font-extrabold break-all text-[var(--glow)]">
              {siteLabel}
            </span>
          </figcaption>
        </figure>
        <label className="relative mt-3 flex cursor-pointer items-center justify-between gap-3 px-0.5 py-1 text-[15px] font-bold text-[var(--ink)]">
          <span className="min-w-0">{d.showAmount}</span>
          <input
            type="checkbox"
            role="switch"
            checked={withAmount}
            onChange={(e) => setWithAmount(e.target.checked)}
            className="pointer-events-none absolute opacity-0"
          />
          <span aria-hidden="true" className="switch" />
        </label>
        <p className="mx-0.5 mt-1.5 text-[13px] text-[var(--ink-soft)]">{d.shareNote}</p>
      </div>

      <div className="mt-6 grid gap-2.5 text-left">
        <button type="button" onClick={share} className="btn-primary">
          <Share2 size={20} aria-hidden="true" />
          {d.shareBtn}
        </button>
        <Link href={`/${locale}`} className="btn-tonal">
          {d.another}
        </Link>
        <Link href={`/${locale}/bill/${billId}`} className="btn-ghost">
          {d.viewBill}
        </Link>
      </div>

      {toast && (
        <div role="status" className="toast flex max-w-[90vw] items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-3 text-center text-sm font-bold text-[var(--paper)] shadow-lg">
          <Check size={18} aria-hidden="true" className="shrink-0 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
