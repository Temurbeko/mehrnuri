"use client";

import { Ban, BadgeCheck, Check, Eye, Sparkles, TriangleAlert, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

const BADGES: Record<TrustLevel, { Icon: LucideIcon; className: string; key: "badgeNew" | "badgeChecked" | "badgeProven" }> = {
  new: { Icon: Sparkles, className: "bg-slate-500/10 text-slate-600 ring-slate-500/20", key: "badgeNew" },
  donor_checked: { Icon: Eye, className: "bg-slate-500/10 text-slate-700 ring-slate-500/20", key: "badgeChecked" },
  proven: { Icon: BadgeCheck, className: "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25", key: "badgeProven" },
};

export function TrustBadge({ bill, dict }: { bill: PublicBill; dict: Dictionary }) {
  const badge = BADGES[bill.trustLevel] ?? BADGES.new;
  const label = dict.check[badge.key];
  const title = bill.checkedCount > 0 ? fmt(dict.check.checkedCount, { count: bill.checkedCount }) : label;
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-extrabold ring-1 ${badge.className}`}
    >
      <badge.Icon size={14} aria-hidden="true" />
      <span>{label}</span>
      {bill.checkedCount > 1 && <span className="opacity-70">· {bill.checkedCount}</span>}
    </span>
  );
}

export function DebtCheck({
  billId,
  dict,
  onUpdated,
  onDone,
  tone = "card",
}: {
  billId: string;
  dict: Dictionary;
  onUpdated?: (bill: PublicBill) => void;
  /** Called shortly after the answer was sent (or was already given). */
  onDone?: () => void;
  /** `step` matches the numbered steps on the payment page. */
  tone?: "card" | "step";
}) {
  const t = dict.check;
  const [stage, setStage] = useState<"ask" | "amount" | "sent">("ask");
  const [seenAmount, setSeenAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: VerdictKind; hidden: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (doneTimer.current) clearTimeout(doneTimer.current);
  }, []);

  async function send(kind: VerdictKind) {
    setBusy(true);
    setError(null);
    const res = await api<{ bill?: PublicBill; hidden?: boolean }>(`/api/bills/${billId}/verdict`, {
      body: { kind, seenAmount: kind === "amount_differs" ? seenAmount : null },
    });
    setBusy(false);

    if (!res.ok) {
      // In the guided payment flow a vote that can't count (already given, or
      // this visitor is the family that posted the bill) must not block paying:
      // just move on. Real errors (network, rate limit) stay on screen.
      const notCounted = ["already_voted", "verdict_not_allowed", "donor_required"].includes(res.data.error ?? "");
      if (notCounted && onDone) {
        onDone();
        return;
      }
      setError(res.data.error === "already_voted" ? t.already : errorText(res.data.error, dict, res.data.details));
      return;
    }
    if (res.data.bill && onUpdated) onUpdated(res.data.bill);
    setResult({ kind, hidden: res.data.hidden === true });
    setStage("sent");
    if (onDone) doneTimer.current = setTimeout(onDone, 1200);
  }

  const wrapper =
    tone === "step"
      ? "space-y-3 panel"
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
        {tone !== "step" && <div className="text-xs font-extrabold text-slate-900">{t.title}</div>}
        <p className={`text-sm font-medium leading-relaxed text-slate-600 ${tone === "step" ? "" : "mt-1"}`}>{t.hint}</p>
      </div>

      {stage === "ask" ? (
        <div className="space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => send("match")}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 min-h-12 text-base font-bold text-white transition active:scale-[0.98] hover:bg-emerald-700 disabled:opacity-60"
          >
            <Check size={18} aria-hidden="true" />{t.match}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setStage("amount")}
              className="flex min-h-12 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-slate-800 ring-1 ring-slate-300 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <TriangleAlert size={18} aria-hidden="true" />{t.differs}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => send("no_debt")}
              className="flex min-h-12 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-rose-700 ring-1 ring-rose-300 transition hover:bg-rose-50 disabled:opacity-60"
            >
              <Ban size={18} aria-hidden="true" />{t.noDebt}
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
