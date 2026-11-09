"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PAYMENT_PROVIDERS, UTILITY_ICONS, type PaymentProviderId, type UtilityType } from "@/lib/domain";
import { MERCHANT_APPS, type MerchantId } from "@/lib/merchants";
import { encodeQrMatrix } from "@/lib/qr";
import { decodeQrFromImageFile } from "@/lib/qrDecode";
import type { Locale } from "@/i18n/config";
import { formatMoney, type Dictionary } from "@/i18n";
import { api, errorText } from "./api";

export function DirectPaymentClient({
  paymentId,
  provider,
  amount,
  utilityType,
  supplier,
  accountNumber,
  signature,
  locale,
  dict,
}: {
  paymentId: string;
  provider: PaymentProviderId;
  amount: number;
  utilityType: UtilityType;
  supplier: string;
  accountNumber: string;
  signature: string;
  locale: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeMerchant, setActiveMerchant] = useState<MerchantId>(provider);
  const [isMobile, setIsMobile] = useState(false);
  const [copiedField, setCopiedField] = useState<"account" | "amount" | null>("account");

  const [receiptRaw, setReceiptRaw] = useState("");
  const [scanningQr, setScanningQr] = useState(false);
  const [qrStatus, setQrStatus] = useState<"idle" | "extracted" | "not_found">("idle");

  const [busy, setBusy] = useState<"verified" | "skip" | "failure" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = dict.checkout;
  const merchant = MERCHANT_APPS[activeMerchant];
  const merchantText = dict.merchants[activeMerchant];

  useEffect(() => {
    const ua = navigator.userAgent || "";
    setIsMobile(/Android|iPhone|iPad|iPod|Mobile/i.test(ua));
    if (accountNumber && accountNumber !== "—") {
      navigator.clipboard?.writeText(accountNumber).catch(() => {});
    }
  }, [accountNumber]);

  const qrMatrix = useMemo(() => encodeQrMatrix(merchant.qrUrl), [merchant.qrUrl]);

  function copyValue(val: string, field: "account" | "amount") {
    navigator.clipboard?.writeText(val).catch(() => {});
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
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

  async function submitConfirmation(mode: "verified" | "skip" | "failure") {
    setError(null);
    if (mode === "verified" && !receiptRaw.trim()) {
      setError(t.manualPlaceholder);
      return;
    }

    setBusy(mode);
    let res = await api<{
      status?: string;
      details?: {
        endpoint: string;
        headers: Record<string, string>;
        bodies: Array<Record<string, string>>;
      };
    }>("/api/payments/confirm", {
      body: {
        paymentId,
        outcome: mode === "failure" ? "failure" : "success",
        signature,
        receiptRaw: mode === "verified" ? receiptRaw.trim() : undefined,
        skipLeaderboard: mode === "skip",
      },
    });

    // If cloud server is outside Uzbekistan TAS-IX firewall, execute server-signed Soliq check from user's browser
    if (!res.ok && res.data.error === "soliq_relay_required" && res.data.details) {
      const spec = res.data.details;
      let relayStatus = 404;
      let relayData: Record<string, unknown> | null = null;
      let reachable = false;

      for (const b of spec.bodies) {
        try {
          const soliqRes = await fetch(spec.endpoint, {
            method: "POST",
            headers: spec.headers,
            body: JSON.stringify(b),
          });
          reachable = true;
          relayStatus = soliqRes.status;
          if (soliqRes.ok) {
            const json = (await soliqRes.json().catch(() => null)) as { data?: Record<string, unknown> } | null;
            if (json?.data) {
              relayData = json.data;
              break;
            }
          }
        } catch {
          /* try next or fall through */
        }
      }

      if (!reachable) {
        setBusy(null);
        setError(errorText("soliq_unavailable", dict));
        return;
      }

      res = await api("/api/payments/confirm", {
        body: {
          paymentId,
          outcome: "success",
          signature,
          receiptRaw: receiptRaw.trim(),
          skipLeaderboard: false,
          soliqRelayResult: {
            status: relayStatus,
            data: relayData,
          },
        },
      });
    }

    if (!res.ok) {
      setBusy(null);
      setError(errorText(res.data.error, dict));
      return;
    }
    router.push(`/${locale}/payment/${paymentId}`);
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="card space-y-5 p-5 sm:p-6">
        {/* 4-Merchant Switcher Tabs */}
        <div className="grid grid-cols-4 gap-2">
          {PAYMENT_PROVIDERS.map((mId) => {
            const m = MERCHANT_APPS[mId];
            const active = activeMerchant === mId;
            return (
              <button
                key={mId}
                type="button"
                onClick={() => setActiveMerchant(mId)}
                className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 p-2 text-center transition-all active:scale-95 ${
                  active
                    ? m.activeClass
                    : "border-slate-200/80 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.icon} alt={m.name} className="h-9 w-9 rounded-xl object-cover shadow-2xs" />
                <span className="text-[11px] font-extrabold">{m.name}</span>
              </button>
            );
          })}
        </div>

        {/* STEP 1: Copy Account & Pay in Merchant App / Web */}
        <div className="space-y-3 rounded-2xl border border-slate-200/90 bg-slate-50/90 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-slate-800">{t.step1Title}</span>
            <span className="truncate text-[11px] font-semibold text-slate-400">{supplier}</span>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 shadow-2xs ring-1 ring-slate-200">
            <div>
              <div className="text-[11px] font-bold text-slate-400">
                {UTILITY_ICONS[utilityType]} {dict.utility[utilityType]} · {dict.bill.account}
              </div>
              <div className="font-mono text-xl font-extrabold tracking-wider text-slate-900 select-all">
                {accountNumber}
              </div>
            </div>
            <button
              type="button"
              onClick={() => copyValue(accountNumber, "account")}
              className={`cursor-pointer rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all ${
                copiedField === "account"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              {copiedField === "account" ? t.copiedBtn : `📋 ${t.copyBtn}`}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2.5 shadow-2xs ring-1 ring-slate-200">
            <div>
              <span className="text-[11px] font-bold text-slate-400">{t.amount}: </span>
              <span className="font-extrabold text-slate-900">{formatMoney(amount, dict)}</span>
            </div>
            <button
              type="button"
              onClick={() => copyValue(String(amount), "amount")}
              className="cursor-pointer rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200"
            >
              {copiedField === "amount" ? t.copiedBtn : `📋 ${t.copyBtn}`}
            </button>
          </div>

          <a
            href={isMobile ? merchant.mobileAppUrl : merchant.webCheckoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => copyValue(accountNumber, "account")}
            style={{ backgroundColor: merchant.color }}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm font-extrabold text-white shadow-md transition-transform active:scale-98"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={merchant.icon} alt="" className="h-6 w-6 rounded-lg bg-white/20 p-0.5" />
            <span>
              {merchant.name} · {isMobile ? t.openMobileApp : t.openWebCheckout}
            </span>
            <span>↗</span>
          </a>

          {!isMobile && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-2.5">
              <svg
                viewBox={`0 0 ${qrMatrix.length + 4} ${qrMatrix.length + 4}`}
                className="h-16 w-16 shrink-0"
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
              <div className="text-[11px] text-slate-600">
                <div className="font-extrabold text-slate-900">📱 {t.scanQrTitle}</div>
                <div>{merchantText.utilityPath}</div>
              </div>
            </div>
          )}
        </div>

        {/* STEP 2: Soliq OFD Receipt Verification */}
        <div className="space-y-3 rounded-2xl border-2 border-amber-400/50 bg-amber-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-xs font-extrabold text-slate-900">{t.step2Title}</span>
            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-900">
              {t.step2Badge}
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            type="button"
            disabled={scanningQr}
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-amber-500/60 bg-white px-4 py-3 text-xs font-extrabold text-slate-800 shadow-2xs transition hover:border-amber-500 hover:bg-amber-50/50"
          >
            <span>{scanningQr ? t.scanningReceipt : t.scanReceiptBtn}</span>
          </button>

          {qrStatus === "extracted" && (
            <div className="rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-extrabold text-emerald-800">
              {t.qrExtractedOk}
            </div>
          )}
          {qrStatus === "not_found" && (
            <div className="rounded-xl bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-900">
              {t.qrNotFoundHint}
            </div>
          )}

          <input
            type="text"
            value={receiptRaw}
            onChange={(e) => setReceiptRaw(e.target.value)}
            placeholder={t.manualPlaceholder}
            className="input bg-white py-2.5 font-mono text-xs font-bold"
          />

          <button
            type="button"
            disabled={busy !== null}
            onClick={() => submitConfirmation("verified")}
            className="btn-emerald py-3.5 text-sm font-extrabold"
          >
            {busy === "verified" ? t.processing : t.verifyWithReceiptBtn}
          </button>
        </div>

        {error && (
          <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-center text-xs font-bold text-rose-700">
            {error}
          </div>
        )}

        {/* STEP 3: Optional Skip Receipt or Cancel */}
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => submitConfirmation("skip")}
            className="btn border border-slate-300 bg-white py-3 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
          >
            {busy === "skip" ? t.processing : t.skipReceiptBtn}
          </button>

          <button
            type="button"
            disabled={busy !== null}
            onClick={() => submitConfirmation("failure")}
            className="btn py-2.5 text-xs font-bold text-slate-400 hover:text-slate-600"
          >
            {busy === "failure" ? t.processing : t.cancelBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
