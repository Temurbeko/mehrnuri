"use client";

import { Camera, Check, ChevronLeft, Copy, FlaskConical, Lightbulb, Smartphone, Trophy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PAYMENT_PROVIDERS, UTILITY_ICONS, type PaymentProviderId, type UtilityType } from "@/lib/domain";
import { MERCHANT_APPS, type MerchantId } from "@/lib/merchants";
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
  provider,
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
  const [activeMerchant, setActiveMerchant] = useState<MerchantId>(provider);
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
  const merchant = MERCHANT_APPS[activeMerchant];
  const merchantText = dict.merchants[activeMerchant];

  useEffect(() => {
    const ua = navigator.userAgent || "";
    setIsMobile(/Android|iPhone|iPad|iPod|Mobile/i.test(ua));
    // No automatic copy on page load: browsers refuse it without a tap, and
    // the page then claimed "copied" while the clipboard was empty.
  }, []);

  const qrMatrix = useMemo(() => encodeQrMatrix(merchant.qrUrl), [merchant.qrUrl]);

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
    <div className="mx-auto max-w-lg space-y-4">
      <div className="card space-y-5 p-5 sm:p-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {step !== "pay" && (
              <button
                type="button"
                onClick={goBack}
                disabled={busy !== null}
                className="btn-ghost w-auto shrink-0 whitespace-nowrap px-2"
              >
                <ChevronLeft size={18} aria-hidden="true" />
                {dict.common.back}
              </button>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <div className="flex gap-1.5" aria-hidden="true">
                {[1, 2, 3].map((n) => (
                  <span key={n} className={`h-2 w-6 rounded-full ${n <= stepNo ? "bg-amber-500" : "bg-slate-200"}`} />
                ))}
              </div>
              <span className="text-sm font-extrabold whitespace-nowrap text-slate-500">{fmt(t.stepOf, { n: stepNo })}</span>
            </div>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">{stepTitle}</h1>
        </div>

        {step === "pay" && (
          <div className="space-y-4">
            <div className="panel space-y-3">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-500">
                  {UTILITY_ICONS[utilityType]} {dict.utility[utilityType]} · {dict.bill.account}
                </div>
                <div
                  ref={accountRef}
                  className="mt-1 w-full font-mono text-2xl font-extrabold tracking-wide break-all text-slate-900 select-all"
                >
                  {accountNumber}
                </div>
              </div>
              <button type="button" onClick={() => copyValue(accountNumber, "account")} className="btn-secondary w-full whitespace-nowrap">
                {copiedField === "account" ? <><Check size={18} aria-hidden="true" />{t.copiedBtn}</> : <><Copy size={18} aria-hidden="true" />{t.copyBtn}</>}
              </button>
              {copyFailed === "account" && (
                <p role="alert" className="rounded-xl bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-900">
                  {dict.common.copyFailed}
                </p>
              )}

              <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-500">{t.amount}: </span>
                  <span ref={amountRef} className="font-extrabold whitespace-nowrap text-slate-900 select-all">
                    {formatMoney(amount, dict)}
                  </span>
                  {copyFailed === "amount" && (
                    <p role="alert" className="mt-1 text-xs font-semibold text-amber-800">
                      {dict.common.copyFailed}
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => copyValue(String(amount), "amount")} className="btn-secondary w-auto shrink-0 whitespace-nowrap px-3 py-1.5 text-sm">
                  {copiedField === "amount" ? <><Check size={16} aria-hidden="true" />{t.copiedBtn}</> : <><Copy size={16} aria-hidden="true" />{t.copyBtn}</>}
                </button>
              </div>
              <p className="text-xs font-semibold text-slate-500">{supplier}</p>
            </div>

            <p className="flex items-start gap-2 text-sm font-medium leading-relaxed text-slate-600">
              <Lightbulb size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-600" />
              <span>{t.payHint}</span>
            </p>

            <div className="space-y-2">
              <div className="text-sm font-extrabold text-slate-700">{t.openApp}</div>
              <div className="grid grid-cols-2 gap-2.5">
                {PAYMENT_PROVIDERS.map((mId) => {
                  const m = MERCHANT_APPS[mId];
                  return (
                    <a
                      key={mId}
                      href={isMobile ? m.mobileAppUrl : m.webCheckoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        copyValue(accountNumber, "account");
                        setActiveMerchant(mId);
                      }}
                      className={`flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-2xl border-2 px-2 py-2.5 transition-all active:scale-95 ${
                        activeMerchant === mId ? m.activeClass : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.icon} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover shadow-2xs" />
                      <span className="truncate text-sm font-extrabold">{m.name}</span>
                    </a>
                  );
                })}
              </div>
            </div>

            {!isMobile && (
              <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                <svg
                  viewBox={`0 0 ${qrMatrix.length + 4} ${qrMatrix.length + 4}`}
                  className="h-20 w-20 shrink-0"
                  shapeRendering="crispEdges"
                  aria-label={`${merchant.name} QR`}
                >
                  <rect width="100%" height="100%" fill="#ffffff" />
                  {qrMatrix.map((row, r) =>
                    row.map((cell, c) =>
                      cell ? <rect key={`${r}-${c}`} x={c + 2} y={r + 2} width={1} height={1} fill="#0f172a" /> : null,
                    ),
                  )}
                </svg>
                <div className="min-w-0 text-xs text-slate-600">
                  <div className="inline-flex items-center gap-1.5 font-extrabold text-slate-900"><Smartphone size={18} aria-hidden="true" />{t.scanQrTitle}</div>
                  <div>{merchantText.utilityPath}</div>
                </div>
              </div>
            )}

            <button type="button" onClick={() => setStep(hasDebtStep ? "check" : "receipt")} className="btn-primary w-full">
              {t.paidBtn}
            </button>
          </div>
        )}

        {step === "check" && billId && (
          <div className="space-y-3">
            <DebtCheck billId={billId} dict={dict} tone="step" onDone={() => setStep("receipt")} />
            <button type="button" onClick={() => setStep("receipt")} className="btn-ghost w-full">
              {t.skipStep}
            </button>
          </div>
        )}

        {step === "receipt" && (
          <div className="space-y-4">
            <p className="flex items-start gap-2 text-sm font-medium leading-relaxed text-slate-600">
              <Trophy size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-600" />
              <span>{fmt(t.leaderboardAs, { nickname })}</span>
            </p>

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

            <button
              type="button"
              disabled={scanningQr}
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary w-full border-dashed"
            >
              <Camera size={18} aria-hidden="true" />
              <span>{scanningQr ? t.scanningReceipt : t.scanReceiptBtn}</span>
            </button>

            {qrStatus === "extracted" && (
              <div className="rounded-xl bg-emerald-500/15 px-3 py-2 text-sm font-extrabold text-emerald-800">{t.qrExtractedOk}</div>
            )}
            {qrStatus === "not_found" && (
              <div className="rounded-xl bg-amber-500/15 px-3 py-2 text-sm font-bold text-amber-900">{t.qrNotFoundHint}</div>
            )}

            <input
              type="text"
              value={receiptRaw}
              onChange={(e) => setReceiptRaw(e.target.value)}
              placeholder={t.manualPlaceholder}
              className="input py-2.5 font-mono text-xs font-bold"
            />

            {testMode && (
              <button type="button" onClick={fillSampleReceipt} className="btn-secondary w-full border-dashed">
                <FlaskConical size={18} aria-hidden="true" />{t.testReceiptBtn}
              </button>
            )}

            <button type="button" disabled={busy !== null} onClick={() => submitConfirmation("verified")} className="btn-primary w-full">
              {busy === "verified" ? t.processing : <><Trophy size={18} aria-hidden="true" />{t.verifyWithReceiptBtn}</>}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => submitConfirmation("skip")} className="btn-secondary w-full">
              {busy === "skip" ? t.processing : t.skipReceiptBtn}
            </button>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-center text-sm font-bold text-rose-700">
            {error}
          </div>
        )}

        <div className="border-t border-slate-100 pt-2 text-center">
          <button type="button" disabled={busy !== null} onClick={() => submitConfirmation("failure")} className="btn-ghost w-auto text-sm text-slate-500">
            {busy === "failure" ? t.processing : t.cancelBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
