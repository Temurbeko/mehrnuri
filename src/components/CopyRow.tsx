"use client";

import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";
import { copyText, selectTextOf } from "@/lib/clipboard";
import type { Dictionary } from "@/i18n";

/** Tap-to-copy row for a `.list`: label, value, round copy mark, "copied" toast. */
export function CopyRow({ label, value, mono = false, dict }: { label: string; value: string; mono?: boolean; dict: Dictionary }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const valueRef = useRef<HTMLSpanElement | null>(null);

  async function copy() {
    const ok = await copyText(value);
    if (ok) {
      setFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      setCopied(false);
      setFailed(true);
      selectTextOf(valueRef.current);
    }
  }

  return (
    <li>
      <button type="button" onClick={copy} className="list-row-tap py-4">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-stone-500">{label}</span>
          <span
            ref={valueRef}
            className={`mt-0.5 block font-extrabold break-all text-stone-900 select-all ${
              mono ? "tabular-nums text-2xl leading-tight tracking-wide" : "text-lg"
            }`}
          >
            {value}
          </span>
          {failed && (
            <span role="alert" className="mt-2 block rounded-xl bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900">
              {dict.common.copyFailed}
            </span>
          )}
        </span>
        <span
          aria-hidden="true"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
            copied ? "bg-emerald-100 text-emerald-700" : "bg-[var(--tone)] text-stone-600"
          }`}
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
        </span>
      </button>
      {copied && (
        <div role="status" className="toast flex items-center gap-2 rounded-full bg-stone-900 px-5 py-3 text-sm font-bold text-white shadow-lg">
          <Check size={18} aria-hidden="true" className="text-emerald-400" />
          {dict.checkout.copiedBtn}
        </div>
      )}
    </li>
  );
}
