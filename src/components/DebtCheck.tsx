"use client";

import { useState } from "react";
import type { PublicBill, TrustLevel, VerdictKind } from "@/lib/domain";
import { fmt, type Dictionary } from "@/i18n";
import { api, errorText } from "./api";

/**
 * The donor is the verifier.
 *
 * Nobody at MehrNuri can read a utility debt, but the donor sees the real
 * balance in their own payment app the moment they paste the account number.
 * So we ask them what it said. Enough reports hide the request automatically —
 * which is why no admin has to approve anything.
 */

const BADGES: Record<TrustLevel, { emoji: string; className: string; key: "badgeNew" | "badgeChecked" | "badgeProven" }> = {
  new: { emoji: "🆕", className: "bg-slate-500/10 text-slate-600 ring-slate-500/20", key: "badgeNew" },
  donor_checked: { emoji: "👀", className: "bg-sky-500/12 text-sky-700 ring-sky-500/25", key: "badgeChecked" },
  proven: { emoji: "✅", className: "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25", key: "badgeProven" },
};

export function TrustBadge({ bill, dict }: { bill: PublicBill; dict: Dictionary }) {
  const badge = BADGES[bill.trustLevel] ?? BADGES.new;
  const label = dict.check[badge.key];
  const title = bill.checkedCount > 0 ? fmt(dict.check.checkedCount, { count: bill.checkedCount }) : label;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold ring-1 ${badge.className}`}
    >
      <span aria-hidden="true">{badge.emoji}</span>
      <span>{label}</span>
      {bill.checkedCount > 1 && <span className="opacity-70">· {bill.checkedCount}</span>}
    </span>
  );
}

export function DebtCheck({
  billId,
  dict,
  onUpdated,
  tone = "card",
}: {
  billId: string;
  dict: Dictionary;
  onUpdated?: (bill: PublicBill) => void;
  /** `step` matches the numbered steps on the payment page. */
  tone?: "card" | "step";
}) {
  const t = dict.check;
  const [stage, setStage] = useState<"ask" | "amount" | "sent">("ask");
  const [seenAmount, setSeenAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: VerdictKind; hidden: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(kind: VerdictKind) {
    setBusy(true);
    setError(null);
    const res = await api<{ bill?: PublicBill; hidden?: boolean }>(`/api/bills/${billId}/verdict`, {
      body: { kind, seenAmount: kind === "amount_differs" ? seenAmount : null },
    });
    setBusy(false);

    if (!res.ok) {
      setError(res.data.error === "already_voted" ? t.already : errorText(res.data.error, dict, res.data.details));
      return;
    }
    if (res.data.bill && onUpdated) onUpdated(res.data.bill);
    setResult({ kind, hidden: res.data.hidden === true });
    setStage("sent");
  }

  const wrapper =
    tone === "step"
      ? "space-y-3 rounded-2xl border border-sky-300/70 bg-sky-50/50 p-4"
      : "space-y-3 rounded-2xl border border-slate-200/90 bg-white p-4";

  if (stage === "sent" && result) {
    const matched = result.kind === "match";
    return (
      <div
        className={`rounded-2xl p-4 text-xs font-bold ${
          matched ? "bg-emerald-500/12 text-emerald-800" : "bg-amber-500/15 text-amber-900"
        }`}
      >
        {matched ? t.thanksMatch : result.hidden ? t.thanksReportHidden : t.thanksReport}
      </div>
    );
  }

  return (
    <div className={wrapper}>
      <div>
        <div className="text-xs font-extrabold text-slate-900">{tone === "step" ? t.stepTitle : t.title}</div>
        <p className="mt-1 text-[11px] font-medium text-slate-600 leading-relaxed">{t.hint}</p>
      </div>

      {stage === "ask" ? (
        <div className="space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => send("match")}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-extrabold text-white transition active:scale-98 hover:bg-emerald-700 disabled:opacity-60"
          >
            ✅ {t.match}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setStage("amount")}
              className="cursor-pointer rounded-xl bg-white px-3 py-2.5 text-[11px] font-extrabold text-amber-900 shadow-2xs ring-1 ring-amber-400/50 transition hover:bg-amber-50 disabled:opacity-60"
            >
              ⚠️ {t.differs}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => send("no_debt")}
              className="cursor-pointer rounded-xl bg-white px-3 py-2.5 text-[11px] font-extrabold text-rose-700 shadow-2xs ring-1 ring-rose-400/50 transition hover:bg-rose-50 disabled:opacity-60"
            >
              🚫 {t.noDebt}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block text-[11px] font-extrabold text-slate-700" htmlFor="seenAmount">
            {t.seenLabel}
          </label>
          <input
            id="seenAmount"
            type="number"
            inputMode="numeric"
            min={0}
            value={seenAmount}
            onChange={(e) => setSeenAmount(e.target.value)}
            placeholder={t.seenPlaceholder}
            className="input bg-white py-2.5 text-sm font-bold"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy || seenAmount.trim() === ""}
              onClick={() => send("amount_differs")}
              className="cursor-pointer rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? t.sending : t.send}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setStage("ask")}
              className="cursor-pointer rounded-xl bg-white px-3 py-2.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-[11px] font-bold text-rose-700">
          {error}
        </div>
      )}
    </div>
  );
}
