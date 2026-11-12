"use client";

import { Check, Clock, FileText, Heart, HeartHandshake, ListChecks, Lock, RotateCcw, Share2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PaymentStatus, UtilityType } from "@/lib/domain";
import type { Locale } from "@/i18n/config";
import { fmt, formatMoney, type Dictionary } from "@/i18n";
import { copyText } from "@/lib/clipboard";
import { AddReceipt } from "./AddReceipt";
import { BottomSheet } from "./BottomSheet";
import { ThanksArt } from "./HeroArt";
import { ResultScreen, StatusIcon } from "./ResultScreen";
import { ShareOptions } from "./ShareOptions";

export function PaymentResultClient({
  paymentId,
  receipt = null,
  details = null,
  shareCode = null,
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
  /** Ready-made rows for the "payment details" list (formatted on the server). */
  details?: Array<{ label: string; value: string; href?: string; tone?: "ok" | "wait" }> | null;
  /** Random code of the public share page (never the payment id). */
  shareCode?: string | null;
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
        details={details}
        shareCode={shareCode}
        receiptSlot={receipt ? <AddReceipt paymentId={paymentId} signature={receipt.signature} pending={receipt.pending} dict={dict} /> : null}
        locale={locale}
        dict={dict}
      />
    );
  }

  return (
    <ResultScreen
      art={
        <StatusIcon tone={pending ? "wait" : "fail"}>
          {pending ? <Clock size={40} aria-hidden="true" /> : <X size={40} aria-hidden="true" />}
        </StatusIcon>
      }
      title={pending ? dict.result.pendingTitle : dict.result.failedTitle}
      amount={formatMoney(amount, dict)}
      body={pending ? dict.result.pendingBody : dict.result.failedBody}
      actions={[{ key: "back", label: dict.ux2.backToRequest, icon: <RotateCcw size={22} />, href: `/${locale}/bill/${billId}` }]}
      mainLabel={dict.ux2.done}
      mainHref={`/${locale}`}
    />
  );
}

/** Paid: a window lights up, thanks, the donor's private impact, and a share card with no family details. */
function PaidScreen({
  details,
  shareCode,
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
  details: Array<{ label: string; value: string; href?: string; tone?: "ok" | "wait" }> | null;
  shareCode: string | null;
  locale: Locale;
  dict: Dictionary;
}) {
  const d = dict.done;
  const [withAmount, setWithAmount] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const closeDetails = useCallback(() => setDetailsOpen(false), []);
  const closeShare = useCallback(() => setShareOpen(false), []);
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

  // The branded share page (with its own preview image); falls back to the home page.
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  const shareUrl = shareCode ? `${base}/${locale}/h/${shareCode}${withAmount ? "-a" : ""}` : base;

  const t = dict.details;
  const dateLine = details?.find((r) => r.label === t.date)?.value ?? null;
  const rows = (details ?? [])
    .filter((r) => r.label === t.service || r.label === t.request)
    .map((r) => ({ label: r.label, value: r.value }));

  function openReceipt() {
    if (receiptSlot) document.getElementById("receipt-box")?.scrollIntoView({ behavior: "smooth", block: "center" });
    else setDetailsOpen(true);
  }

  return (
    <>
      <ResultScreen
        art={
          <div className="hs-active mx-auto w-fit">
            <ThanksArt className="h-[132px] w-[106px]" />
          </div>
        }
        title={d.title}
        date={dateLine}
        amount={money}
        body={utilityType ? fmt(d.body, { account: d.account[utilityType], outcome: dict.outcome[utilityType] }) : null}
        rows={rows}
        actions={[
          { key: "receipt", label: dict.ux2.check, icon: <FileText size={22} />, onClick: openReceipt },
          { key: "details", label: dict.ux2.details, icon: <ListChecks size={22} />, onClick: () => setDetailsOpen(true) },
          { key: "share", label: dict.ux2.share, icon: <Share2 size={22} />, onClick: () => setShareOpen(true) },
          { key: "again", label: dict.ux2.again, icon: <HeartHandshake size={22} />, href: `/${locale}` },
        ]}
        mainLabel={dict.ux2.done}
        mainHref={`/${locale}`}
      >
        {receiptSlot && <div id="receipt-box" className="scroll-mt-24">{receiptSlot}</div>}

        {/* Private: only this donor sees it. */}
        {familiesThisMonth >= 1 && (
          <div className={`${receiptSlot ? "mt-4 " : ""}flex items-center gap-3 rounded-[20px] bg-white p-3.5 text-left shadow-[var(--lift)]`}>
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
      </ResultScreen>

      <BottomSheet open={detailsOpen} onClose={closeDetails} labelledBy="details-title">
        <h2 id="details-title" className="mb-2 text-[22px] font-extrabold tracking-tight text-[var(--ink)]">
          {t.title}
        </h2>
        <dl className="list m-0">
          {(details ?? []).map((row) => (
            <div key={row.label} className="list-row flex min-w-0 items-center justify-between gap-3">
              <dt className="shrink-0 text-[14px] text-[var(--ink-soft)]">{row.label}</dt>
              <dd
                className={`m-0 min-w-0 text-right text-[14.5px] font-bold break-words ${
                  row.tone === "ok" ? "text-[var(--hope)]" : row.tone === "wait" ? "text-[var(--lamp-deep)]" : "text-[var(--ink)]"
                }`}
              >
                {row.href ? (
                  <Link href={row.href} className="underline decoration-[var(--tone-hover)] underline-offset-4">
                    {row.value}
                  </Link>
                ) : (
                  row.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </BottomSheet>

      {/* What will be shared: nothing about the family; the amount only if switched on. */}
      <BottomSheet open={shareOpen} onClose={closeShare} labelledBy="share-title">
        <h2 id="share-title" className="text-[22px] font-extrabold tracking-tight text-[var(--ink)]">
          {d.shareTitle}
        </h2>
        <figure aria-label={d.shareAria} className="m-0 mt-3 flex items-center gap-3.5 rounded-[20px] hero-mesh p-4 text-[#f6efe3]">
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
        <p className="mx-0.5 mt-1.5 mb-4 text-[13px] text-[var(--ink-soft)]">{d.shareNote}</p>
        <ShareOptions url={shareUrl} text={`${shareText} ${d.cardJoin}`} dict={dict} />
      </BottomSheet>

      {toast && (
        <div role="status" className="toast flex max-w-[90vw] items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-3 text-center text-sm font-bold text-[var(--paper)] shadow-lg">
          <Check size={18} aria-hidden="true" className="shrink-0 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}
    </>
  );
}
