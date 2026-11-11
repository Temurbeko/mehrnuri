"use client";

import { ArrowRight, Camera, Check, ChevronLeft, Copy, FlaskConical, Lightbulb, Smartphone, Trophy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PAYMENT_PROVIDERS, UTILITY_ICONS, type PaymentProviderId, type UtilityType } from "@/lib/domain";
import { MERCHANT_APPS } from "@/lib/merchants";
import { encodeQrMatrix } from "@/lib/qr";
import { decodeQrFromImageFile } from "@/lib/qrDecode";
import { copyText, selectTextOf } from "@/lib/clipboard";
import type { Locale } from "@/i18n/config";
import { fmt, formatMoney, type Dictionary } from "@/i18n";
import { DebtCheck } from "./DebtCheck";
import { api, errorText } from "./api";

export function DirectPaymentClient({
  paymentId,
  billId,
  amount,
  utilityType,
  supplier,
  accountNumber,
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

  const [step, setStep] = useState<"pay" | "check" | "receipt">("pay");
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
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
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

  const hasDebtStep = billId !== null;
  const stepNo = step === "pay" ? 1 : step === "check" ? 2 : 3;
  const stepTitle = step === "pay" ? t.stepPayTitle : step === "check" ? t.stepCheckTitle : t.stepReceiptTitle;

  function goBack() {
    setError(null);
    if (step === "receipt") setStep(hasDebtStep ? "check" : "pay");
    else if (step === "check") setStep("pay");
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-4">
      {/* Header sits on the page, not in a box: progress, back, title. */}
      <div className="space-y-3">
        <div className="flex min-h-10 items-center gap-3">
          {step !== "pay" && (
            <button
              type="button"
              onClick={goBack}
              disabled={busy !== null}
              className="btn-ghost -ml-2 w-auto shrink-0 whitespace-nowrap px-2"
            >
              <ChevronLeft size={20} aria-hidden="true" />
              {dict.common.back}
            </button>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-2.5">
            <div className="flex gap-1.5" aria-hidden="true">
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className={`h-1.5 rounded-full transition-all ${n === stepNo ? "w-8 bg-amber-500" : n < stepNo ? "w-4 bg-amber-500/50" : "w-4 bg-stone-300"}`}
                />
              ))}
            </div>
            <span className="text-sm font-extrabold whitespace-nowrap text-stone-500">{fmt(t.stepOf, { n: stepNo })}</span>
          </div>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">{stepTitle}</h1>
      </div>

      {step === "pay" && (
        <>
          {/* Banking-app style details: tap a row to copy it. */}
          <div className="space-y-2">
            <ul className="list">
              <li>
                <button type="button" onClick={() => copyValue(accountNumber, "account")} className="list-row-tap py-4">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-stone-500">
                      {UTILITY_ICONS[utilityType]} {dict.utility[utilityType]} · {dict.bill.account}
                    </span>
                    <span
                      ref={accountRef}
                      className="mt-0.5 block tabular-nums text-2xl leading-tight font-extrabold tracking-wide break-all text-stone-900 select-all"
                    >
                      {accountNumber}
                    </span>
                  </span>
                  <CopyMark done={copiedField === "account"} />
                </button>
              </li>
              <li>
                <button type="button" onClick={() => copyValue(String(amount), "amount")} className="list-row-tap">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-stone-500">{t.amount}</span>
                    <span ref={amountRef} className="block text-lg font-extrabold whitespace-nowrap text-stone-900 select-all">
                      {formatMoney(amount, dict)}
                    </span>
                  </span>
                  <CopyMark done={copiedField === "amount"} />
                </button>
              </li>
              <li className="list-row">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-stone-500">{dict.bill.supplier}</span>
                  <span className="block font-bold text-stone-800">{supplier}</span>
                </span>
              </li>
            </ul>
            {copyFailed ? (
              <p role="alert" className="rounded-2xl bg-amber-100 px-4 py-3 text-sm font-medium text-amber-900">
                {dict.common.copyFailed}
              </p>
            ) : (
              <p className="px-1 text-sm text-stone-500">{t.tapToCopy}</p>
            )}
          </div>

          <p className="flex items-start gap-2.5 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-relaxed font-medium text-amber-950">
            <Lightbulb size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-600" />
            <span>{t.payHint}</span>
          </p>

          {/* Four equal launch buttons — opening an app, not choosing one. */}
          <div className="space-y-2.5">
            <h2 className="px-1 text-base font-extrabold text-stone-900">{t.openApp}</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {PAYMENT_PROVIDERS.map((mId) => {
                const m = MERCHANT_APPS[mId];
                return (
                  <a
                    key={mId}
                    href={isMobile ? m.mobileAppUrl : m.webCheckoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => void copyValue(accountNumber, "account")}
                    className="surface flex min-h-16 min-w-0 items-center gap-2.5 px-3 py-3 transition-all hover:shadow-[var(--lift-hover)] active:scale-[0.97]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.icon} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
                    <span className="min-w-0 flex-1 truncate text-base font-extrabold text-stone-900">{m.name}</span>
                  </a>
                );
              })}
            </div>
          </div>

          {!isMobile && qrMatrix.length > 0 && (
            <div className="surface flex items-center gap-4 p-4">
              <svg
                viewBox={`0 0 ${qrMatrix.length + 4} ${qrMatrix.length + 4}`}
                className="h-24 w-24 shrink-0 rounded-xl"
                shapeRendering="crispEdges"
                aria-hidden="true"
              >
                <rect width="100%" height="100%" fill="#ffffff" />
                {qrMatrix.map((row, r) =>
                  row.map((cell, c) =>
                    cell ? <rect key={`${r}-${c}`} x={c + 2} y={r + 2} width={1} height={1} fill="#1c1917" /> : null,
                  ),
                )}
              </svg>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 font-extrabold text-stone-900">
                  <Smartphone size={18} aria-hidden="true" />
                  {t.scanQrTitle}
                </div>
                <p className="text-sm text-stone-500">{t.continueOnPhone}</p>
              </div>
            </div>
          )}

          {/* The one main action stays reachable while scrolling. */}
          <div className="sticky bottom-0 z-30 -mx-4 bg-gradient-to-t from-[var(--paper)] via-[var(--paper)] to-transparent px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+12px)]">
            <button type="button" onClick={() => setStep(hasDebtStep ? "check" : "receipt")} className="btn-primary w-full text-lg">
              {t.paidBtn}
              <ArrowRight size={20} aria-hidden="true" />
            </button>
          </div>
        </>
      )}

      {step === "check" && billId && (
        <div className="space-y-3">
          <div className="surface p-5">
            <DebtCheck billId={billId} dict={dict} tone="step" onDone={() => setStep("receipt")} />
          </div>
          <button type="button" onClick={() => setStep("receipt")} className="btn-ghost w-full">
            {t.skipStep}
          </button>
        </div>
      )}

      {step === "receipt" && (
        <div className="space-y-4">
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

          <div className="space-y-2.5">
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

      <div className="text-center">
        <button type="button" disabled={busy !== null} onClick={() => submitConfirmation("failure")} className="btn-ghost w-auto text-sm text-stone-500">
          {busy === "failure" ? t.processing : t.cancelBtn}
        </button>
      </div>

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
