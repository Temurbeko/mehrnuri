"use client";

import { Camera, Check, Clock, Trophy } from "lucide-react";
import { useRef, useState } from "react";
import type { Dictionary } from "@/i18n";
import { decodeQrFromImageFile } from "@/lib/qrDecode";
import { api, errorText } from "./api";

/**
 * On a paid payment that has no fiscal receipt yet: lets the donor add one
 * later (from the success page or their profile). If Soliq has not registered
 * the receipt yet, it is kept and re-checked in the background.
 */
export function AddReceipt({
  paymentId,
  signature,
  pending,
  dict,
}: {
  paymentId: string;
  signature: string;
  /** A receipt was already sent and is waiting for Soliq. */
  pending: boolean;
  dict: Dictionary;
}) {
  const t = dict.addReceipt;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [raw, setRaw] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState<"none" | "found" | "missing">("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "verified">(pending ? "pending" : "idle");
  const [open, setOpen] = useState(!pending);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setScanning(true);
    const res = await decodeQrFromImageFile(file);
    setScanning(false);
    if (res.status === "found") {
      setRaw(res.rawValue);
      setScan("found");
    } else setScan("missing");
  }

  async function submit() {
    if (!raw.trim()) {
      setError(dict.checkout.receiptMissing);
      return;
    }
    setError(null);
    setBusy(true);
    const res = await api<{ result?: "verified" | "pending" }>("/api/payments/receipt", {
      body: { paymentId, signature, receiptRaw: raw.trim() },
    });
    setBusy(false);
    if (!res.ok) {
      setError(errorText(res.data.error, dict, res.data.details));
      return;
    }
    if (res.data.result === "verified") {
      setState("verified");
    } else {
      setState("pending");
      setOpen(false);
    }
  }

  if (state === "verified") {
    return (
      <p className="flex items-center gap-2.5 rounded-[20px] bg-emerald-50 p-3.5 text-left text-sm font-bold text-emerald-800">
        <Check size={18} aria-hidden="true" className="shrink-0" />
        {t.verified}
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-[20px] bg-white p-4 text-left shadow-[var(--lift)]">
      {state === "pending" ? (
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-amber-100 text-[var(--lamp-deep)]">
            <Clock size={20} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <b className="block text-[15px] text-[var(--ink)]">{t.pendingTitle}</b>
            <span className="text-sm text-[var(--ink-soft)]">{t.pendingText}</span>
          </span>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-amber-100 text-[var(--lamp-deep)]">
            <Trophy size={20} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <b className="block text-[15px] text-[var(--ink)]">{t.title}</b>
            <span className="text-sm text-[var(--ink-soft)]">{t.text}</span>
          </span>
        </div>
      )}

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost w-full text-sm">
          {t.other}
        </button>
      ) : (
        <>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          <button type="button" disabled={scanning} onClick={() => fileRef.current?.click()} className="btn-tonal w-full">
            <Camera size={20} aria-hidden="true" />
            <span>{scanning ? dict.checkout.scanningReceipt : dict.checkout.scanReceiptBtn}</span>
          </button>
          {scan === "found" && (
            <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-800">
              <Check size={18} aria-hidden="true" />
              {dict.checkout.qrExtractedOk}
            </p>
          )}
          {scan === "missing" && (
            <p className="rounded-xl bg-amber-100 px-3 py-2.5 text-sm font-medium text-amber-900">{dict.checkout.qrNotFoundHint}</p>
          )}
          <input
            type="text"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={dict.checkout.manualPlaceholder}
            className="field text-sm tabular-nums"
          />
          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-center text-sm font-bold text-rose-700">
              {error}
            </p>
          )}
          <button type="button" disabled={busy} onClick={submit} className="btn-tonal w-full">
            {busy ? dict.checkout.processing : t.submit}
          </button>
        </>
      )}
    </div>
  );
}
