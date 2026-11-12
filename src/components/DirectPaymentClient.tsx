"use client";

import { ArrowRight, Ban, RotateCcw, Camera, Check, ChevronLeft, ChevronRight, Copy, FlaskConical, ShieldCheck, Smartphone, TriangleAlert, Trophy, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PAYMENT_PROVIDERS, UTILITY_ICONS, type PaymentProviderId, type UtilityType, type VerdictKind } from "@/lib/domain";
import { MERCHANT_APPS } from "@/lib/merchants";
import { encodeQrMatrix } from "@/lib/qr";
import { decodeQrFromImageFile } from "@/lib/qrDecode";
import { copyText, selectTextOf } from "@/lib/clipboard";
import type { Locale } from "@/i18n/config";
import { fmt, formatMoney, type Dictionary } from "@/i18n";
import { digitsOnly, groupDigits } from "@/lib/format";
import { api, errorText } from "./api";
import { ResultScreen, StatusIcon } from "./ResultScreen";

export function DirectPaymentClient({
  paymentId,
  billId,
  amount,
  utilityType,
  supplier,
  accountNumber,
  area = null,
  nickname,
  signature,
  testMode = false,
  locale,
  dict,
}: {
  paymentId: string;
  billId: string | null;
  provider: PaymentProviderId;
  amount: number;
  utilityType: UtilityType;
  supplier: string;
  accountNumber: string;
  /** "Region · District" display text: payment apps ask for it next to the account. */
  area?: string | null;
  /** Leaderboard name of this donor. */
  nickname: string;
  signature: string;
  /** SOLIQ_MODE=mock (test hosting only): offers a sample receipt so the flow can be finished without paying. */
  testMode?: boolean;
  locale: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pageUrl, setPageUrl] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  // Only set after a copy really succeeded (it used to start as "copied" before any tap).
  const [copiedField, setCopiedField] = useState<"account" | "amount" | null>(null);
  const [copyFailed, setCopyFailed] = useState<"account" | "amount" | null>(null);
  const accountRef = useRef<HTMLDivElement | null>(null);
  const amountRef = useRef<HTMLSpanElement | null>(null);

  const [receiptRaw, setReceiptRaw] = useState("");
  const [scanningQr, setScanningQr] = useState(false);
  const [qrStatus, setQrStatus] = useState<"idle" | "extracted" | "not_found">("idle");

  const [step, setStep] = useState<"check" | "pay" | "receipt">(billId ? "check" : "pay");
  const [verdictBusy, setVerdictBusy] = useState<VerdictKind | null>(null);
  const [amountOpen, setAmountOpen] = useState(false);
  const [seenAmount, setSeenAmount] = useState("");
  const [reportSaved, setReportSaved] = useState(false);
  const [noDebtDone, setNoDebtDone] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [busy, setBusy] = useState<"verified" | "skip" | "failure" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = dict.checkout;

  useEffect(() => {
    const ua = navigator.userAgent || "";
    setIsMobile(/Android|iPhone|iPad|iPod|Mobile/i.test(ua));
    setPageUrl(window.location.href);
    // No automatic copy on page load: browsers refuse it without a tap, and
    // the page then claimed "copied" while the clipboard was empty.
  }, []);

  // On a computer, the QR lets the donor continue THIS payment on their phone
  // (where the payment apps are), instead of opening a generic app page.
  const qrMatrix = useMemo(() => (pageUrl ? encodeQrMatrix(pageUrl) : []), [pageUrl]);

  async function copyValue(val: string, field: "account" | "amount"): Promise<boolean> {
    const ok = await copyText(val);
    if (ok) {
      setCopyFailed(null);
      setCopiedField(field);
      setTimeout(() => setCopiedField((f) => (f === field ? null : f)), 2500);
    } else {
      // Say so honestly and highlight the number so a long-press copies it.
      setCopiedField(null);
      setCopyFailed(field);
      selectTextOf(field === "account" ? accountRef.current : amountRef.current);
    }
    return ok;
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setScanningQr(true);
    const res = await decodeQrFromImageFile(file);
    setScanningQr(false);

    if (res.status === "found") {
      setReceiptRaw(res.rawValue);
      setQrStatus("extracted");
    } else {
      setQrStatus("not_found");
    }
  }

  /**
   * Test hosting only (SOLIQ_MODE=mock, where the server accepts any
   * well-formed receipt link): fills a unique sample link so testers can finish
   * the flow without a real payment. Unique each time, because a receipt link
   * can only be used once.
   */
  function fillSampleReceipt() {
    // receipt times are Tashkent time (UTC+5), whatever the tester's time zone
    const d = new Date(Date.now() + 5 * 60 * 60_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
    const rand = () => Math.floor(Math.random() * 1e9).toString().padStart(9, "0");
    setReceiptRaw(`https://ofd.soliq.uz/epi?t=EP000000TEST&r=${rand()}&c=${stamp}&s=${rand()}${rand().slice(0, 3)}`);
    setQrStatus("extracted");
    setError(null);
  }

  async function submitConfirmation(mode: "verified" | "skip" | "failure") {
    setError(null);
    if (mode === "verified" && !receiptRaw.trim()) {
      // Say what is missing, not show the example link as if it were an error.
      setError(qrStatus === "not_found" ? t.qrNotFoundHint : t.receiptMissing);
      return;
    }

    setBusy(mode);
    const res = await api("/api/payments/confirm", {
      body: {
        paymentId,
        outcome: mode === "failure" ? "failure" : "success",
        signature,
        receiptRaw: mode === "verified" ? receiptRaw.trim() : undefined,
        skipLeaderboard: mode === "skip",
      },
    });

    if (!res.ok) {
      setBusy(null);
      setError(errorText(res.data.error, dict, res.data.details));
      return;
    }
    router.push(`/${locale}/payment/${paymentId}`);
  }

  const f = dict.flow;
  const hasCheck = billId !== null;
  const stepNo = step === "check" ? 1 : step === "pay" ? 2 : 3;
  const stepTitle = step === "check" ? f.stepCheck : step === "pay" ? f.stepPay : f.stepReceipt;
  const billHref = billId ? `/${locale}/bill/${billId}` : `/${locale}`;

  function goBack() {
    setError(null);
    if (step === "receipt") setStep("pay");
    else if (step === "pay" && hasCheck) setStep("check");
    else router.back();
  }

  /** Record what the donor saw in their app. A vote that can't count never blocks the flow. */
  async function sendVerdict(kind: VerdictKind): Promise<boolean> {
    if (!billId) return true;
    const res = await api(`/api/bills/${billId}/verdict`, {
      body: { kind, seenAmount: kind === "amount_differs" ? seenAmount : null },
    });
    if (res.ok) return true;
    if (["already_voted", "verdict_not_allowed", "donor_required"].includes(res.data.error ?? "")) return true;
    setError(errorText(res.data.error, dict, res.data.details));
    return false;
  }

  async function answer(kind: VerdictKind) {
    setError(null);
    setVerdictBusy(kind);
    const ok = await sendVerdict(kind);
    if (!ok) {
      setVerdictBusy(null);
      return;
    }
    if (kind === "no_debt") {
      // Nothing was paid: close this payment, then show a friendly end screen.
      const res = await api("/api/payments/confirm", {
        body: { paymentId, outcome: "failure", signature },
      });
      setVerdictBusy(null);
      if (!res.ok) {
        setError(errorText(res.data.error, dict, res.data.details));
        return;
      }
      setNoDebtDone(true);
      return;
    }
    setVerdictBusy(null);
    setReportSaved(kind === "amount_differs");
    setStep("pay");
  }

  const appTiles = (compact: boolean) => (
    <div className="grid grid-cols-4 gap-2">
      {PAYMENT_PROVIDERS.map((mId) => {
        const m = MERCHANT_APPS[mId];
        return (
          <a
            key={mId}
            href={isMobile ? m.mobileAppUrl : m.webCheckoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void copyValue(accountNumber, "account")}
            className="flex min-w-0 flex-col items-center gap-1.5 rounded-[16px] bg-white px-1 py-2.5 shadow-[var(--lift)] transition-all active:scale-[0.96]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.icon} alt="" className={`${compact ? "h-9 w-9" : "h-11 w-11"} rounded-[12px] object-cover ring-1 ring-[var(--hairline)]`} />
            <span className="w-full truncate text-center text-[12.5px] font-extrabold text-[var(--ink)]">{m.name}</span>
          </a>
        );
      })}
    </div>
  );

  if (noDebtDone) {
    return (
      <ResultScreen
        art={
          <StatusIcon tone="ok">
            <ShieldCheck size={40} aria-hidden="true" />
          </StatusIcon>
        }
        title={f.endTitle}
        body={f.endBody}
        actions={[{ key: "back", label: dict.ux2.backToRequest, icon: <RotateCcw size={22} />, href: billHref }]}
        mainLabel={dict.ux2.done}
        mainHref={`/${locale}`}
      />
    );
  }

  const answers: { kind: VerdictKind; label: string; Icon: LucideIcon; tile: string }[] = [
    { kind: "match", label: f.yes, Icon: Check, tile: "bg-[rgba(46,154,103,0.13)] text-[var(--hope)]" },
    { kind: "amount_differs", label: f.differs, Icon: TriangleAlert, tile: "bg-[rgba(246,166,35,0.18)] text-[var(--lamp-deep)]" },
    { kind: "no_debt", label: f.noDebt, Icon: Ban, tile: "bg-[var(--tone)] text-[var(--ink-soft)]" },
  ];

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 pb-2">
      {/* Compact app-style header: back, title, progress. */}
      <div className="flex min-h-11 items-center gap-1">
        <button
          type="button"
          onClick={goBack}
          disabled={busy !== null || verdictBusy !== null}
          aria-label={dict.common.back}
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--ink)] active:bg-[var(--tone)]"
        >
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[20px] font-extrabold tracking-tight text-[var(--ink)]">{stepTitle}</h1>
        <span className="shrink-0 text-sm font-extrabold whitespace-nowrap text-[var(--ink-soft)]">{fmt(t.stepOf, { n: stepNo })}</span>
      </div>
      <div className="flex gap-1.5" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`h-1 flex-1 rounded-full transition-colors ${n <= stepNo ? "bg-[var(--lamp)]" : "bg-[var(--tone)]"}`} />
        ))}
      </div>

      {step === "check" && (
        <div key="check" className="flow-step flex flex-col gap-3.5">
          <ul className="list">
            <li>
              <button type="button" onClick={() => copyValue(accountNumber, "account")} className="list-row-tap py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-[var(--ink-soft)]">
                    {UTILITY_ICONS[utilityType]} {dict.utility[utilityType]} · {dict.bill.account}
                  </span>
                  <span ref={accountRef} className="block text-[22px] leading-tight font-extrabold tracking-wide break-all text-[var(--ink)] tabular-nums select-all">
                    {accountNumber}
                  </span>
                </span>
                <CopyMark done={copiedField === "account"} />
              </button>
            </li>
            {area && (
              <li className="list-row justify-between gap-4 py-3">
                <span className="shrink-0 text-[13px] font-medium text-[var(--ink-soft)]">{dict.ux2.area}</span>
                <span className="min-w-0 text-right text-[15px] font-bold break-words text-[var(--ink)]">{area}</span>
              </li>
            )}
            <li className="list-row">
              <span className="min-w-0 flex-1 text-[13px] font-medium text-[var(--ink-soft)]">{t.amount}</span>
              <span ref={amountRef} className="text-lg font-extrabold whitespace-nowrap text-[var(--ink)] select-all">{formatMoney(amount, dict)}</span>
            </li>
          </ul>
          {copyFailed && (
            <p role="alert" className="rounded-2xl bg-amber-100 px-4 py-2.5 text-sm font-medium text-amber-900">{dict.common.copyFailed}</p>
          )}

          {appTiles(false)}
          <p className="px-0.5 text-[14px] leading-snug text-[var(--ink-soft)]">{f.appsHint}</p>

          {!isMobile && qrMatrix.length > 0 && (
            <div>
              <button type="button" onClick={() => setShowQr((v) => !v)} className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--ink-soft)] underline-offset-2 hover:underline">
                <Smartphone size={16} aria-hidden="true" />
                {f.phoneLink}
              </button>
              {showQr && (
                <div className="flow-step surface mt-2 flex items-center gap-4 p-3">
                  <svg viewBox={`0 0 ${qrMatrix.length + 4} ${qrMatrix.length + 4}`} className="h-28 w-28 shrink-0 rounded-xl" shapeRendering="crispEdges" aria-hidden="true">
                    <rect width="100%" height="100%" fill="#ffffff" />
                    {qrMatrix.map((row, r) =>
                      row.map((cell, c) => (cell ? <rect key={`${r}-${c}`} x={c + 2} y={r + 2} width={1} height={1} fill="#1c1917" /> : null)),
                    )}
                  </svg>
                  <p className="text-sm font-medium text-[var(--ink-soft)]">{t.scanQrTitle}</p>
                </div>
              )}
            </div>
          )}

          <h2 className="mt-1 px-0.5 text-[17px] font-extrabold text-[var(--ink)]">{f.question}</h2>
          {amountOpen ? (
            <div className="surface space-y-2.5 p-4">
              <label className="label" htmlFor="seenAmount">{dict.check.seenLabel}</label>
              <input
                id="seenAmount"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                value={groupDigits(seenAmount)}
                onChange={(e) => setSeenAmount(digitsOnly(e.target.value, 9))}
                placeholder={dict.check.seenPlaceholder}
                className="field text-lg font-bold"
              />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={verdictBusy !== null || seenAmount.trim() === ""} onClick={() => answer("amount_differs")} className="btn-primary w-full">
                  {verdictBusy ? dict.check.sending : f.seenSent}
                </button>
                <button type="button" disabled={verdictBusy !== null} onClick={() => setAmountOpen(false)} className="btn-ghost w-full">
                  {dict.check.cancel}
                </button>
              </div>
            </div>
          ) : (
            <ul className="list">
              {answers.map(({ kind, label, Icon, tile }) => (
                <li key={kind}>
                  <button
                    type="button"
                    disabled={verdictBusy !== null}
                    onClick={() => (kind === "amount_differs" ? setAmountOpen(true) : void answer(kind))}
                    className="list-row-tap min-h-[60px]"
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tile}`}>
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 text-left text-[17px] font-extrabold text-[var(--ink)]">{label}</span>
                    <ChevronRight size={20} aria-hidden="true" className="shrink-0 text-[var(--ink-soft)]" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="text-center">
            <button type="button" disabled={verdictBusy !== null} onClick={() => setStep("pay")} className="text-sm font-bold text-[var(--ink-soft)] underline underline-offset-2">
              {f.continueUnchecked}
            </button>
          </div>
        </div>
      )}

      {step === "pay" && (
        <div key="pay" className="flow-step flex flex-col gap-4">
          {reportSaved && (
            <p className="rounded-2xl bg-[rgba(246,166,35,0.13)] px-4 py-2.5 text-sm font-bold text-[var(--ink)]">{f.reportSaved}</p>
          )}
          <div className="pt-4 pb-2 text-center">
            <div className="text-[30px] leading-tight font-extrabold text-balance text-[var(--ink)]">
              {fmt(f.payBig, { amount: formatMoney(amount, dict) })}
            </div>
            <button type="button" onClick={() => copyValue(accountNumber, "account")} className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--tone)] px-4 py-2 text-[15px] font-extrabold text-[var(--ink)] tabular-nums">
              <span ref={accountRef}>{accountNumber}</span>
              {copiedField === "account" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            </button>
            {area && <p className="mt-2 text-[13px] font-semibold break-words text-[var(--ink-soft)]">{area}</p>}
          </div>
          {appTiles(true)}
          <p className=" flex items-start gap-2.5 rounded-2xl bg-[rgba(46,154,103,0.1)] px-3.5 py-3 text-left text-[13.5px] leading-snug font-semibold text-[#1f6b47]">
              <ShieldCheck size={18} aria-hidden="true" className="mt-px shrink-0 text-[var(--hope)]" />
              <span className="min-w-0">{dict.app.directNote}</span>
            </p>
          <div className="sticky bottom-0 z-30 -mx-4 mt-auto space-y-1 bg-gradient-to-t from-[var(--paper)] via-[var(--paper)] to-transparent px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+12px)]">
            <button type="button" onClick={() => setStep("receipt")} className="btn-primary w-full text-lg">
              {f.paid}
              <ArrowRight size={20} aria-hidden="true" />
            </button>
            <button type="button" disabled={busy !== null} onClick={() => submitConfirmation("failure")} className="btn-ghost w-full">
              {busy === "failure" ? t.processing : f.notPaid}
            </button>
          </div>
        </div>
      )}

      {step === "receipt" && (
        <div key="receipt" className="flow-step space-y-4">
          <p className="flex items-start gap-2.5 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-relaxed font-medium text-amber-950">
            <Trophy size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-600" />
            <span>{fmt(t.leaderboardAs, { nickname })}</span>
          </p>

          <div className="surface space-y-3 p-5">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            <button type="button" disabled={scanningQr} onClick={() => fileInputRef.current?.click()} className="btn-tonal w-full">
              <Camera size={20} aria-hidden="true" />
              <span>{scanningQr ? t.scanningReceipt : t.scanReceiptBtn}</span>
            </button>

            {qrStatus === "extracted" && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-800">
                <Check size={18} aria-hidden="true" />
                {t.qrExtractedOk}
              </div>
            )}
            {qrStatus === "not_found" && (
              <div className="rounded-xl bg-amber-100 px-3 py-2.5 text-sm font-medium text-amber-900">{t.qrNotFoundHint}</div>
            )}

            <input
              type="text"
              value={receiptRaw}
              onChange={(e) => setReceiptRaw(e.target.value)}
              placeholder={t.manualPlaceholder}
              className="field tabular-nums text-sm"
            />

            {testMode && (
              <button type="button" onClick={fillSampleReceipt} className="btn-ghost w-full text-sm">
                <FlaskConical size={18} aria-hidden="true" />
                {t.testReceiptBtn}
              </button>
            )}
          </div>

          <div className="sticky bottom-0 z-30 -mx-4 space-y-2.5 bg-gradient-to-t from-[var(--paper)] via-[var(--paper)] to-transparent px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+12px)]">
            <button type="button" disabled={busy !== null} onClick={() => submitConfirmation("verified")} className="btn-primary w-full">
              {busy === "verified" ? t.processing : <><Trophy size={18} aria-hidden="true" />{t.verifyWithReceiptBtn}</>}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => submitConfirmation("skip")} className="btn-tonal w-full">
              {busy === "skip" ? t.processing : t.skipReceiptBtn}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-center text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      {copiedField && (
        <div role="status" className="toast flex items-center gap-2 rounded-full bg-stone-900 px-5 py-3 text-sm font-bold text-white shadow-lg">
          <Check size={18} aria-hidden="true" className="text-emerald-400" />
          {t.copiedBtn}
        </div>
      )}
    </div>
  );
}

/** Copy affordance at the end of a tappable row; turns into a check once copied. */
function CopyMark({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
        done ? "bg-emerald-100 text-emerald-700" : "bg-[var(--tone)] text-stone-600"
      }`}
    >
      {done ? <Check size={18} /> : <Copy size={18} />}
    </span>
  );
}
