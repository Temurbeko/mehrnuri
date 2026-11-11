"use client";

import { Ban, BadgeCheck, Check, Eye, Sparkles, TriangleAlert, type LucideIcon } from "lucide-react";
import { digitsOnly, groupDigits } from "@/lib/format";
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
      className={`inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold ${badge.className}`}
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
      ? "space-y-4" // the payment page already puts this in a surface
      : "surface space-y-4 p-5";

  if (stage === "sent" && result) {
    const matched = result.kind === "match";
    return (
      <div
        className={`rounded-2xl p-4 text-sm font-bold ${
          matched ? "bg-emerald-50 text-emerald-800" : "bg-amber-100 text-amber-900"
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
        <p className={`text-base leading-relaxed text-stone-600 ${tone === "step" ? "" : "mt-1"}`}>{t.hint}</p>
      </div>

      {stage === "ask" ? (
        <div className="space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => send("match")}
            className="btn-emerald w-full"
          >
            <Check size={18} aria-hidden="true" />{t.match}
          </button>
          {/* Stacked full-width rows: short labels never break mid-word. */}
          <div className="grid gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setStage("amount")}
              className="btn-tonal w-full justify-start px-4"
            >
              <TriangleAlert size={18} aria-hidden="true" />{t.differs}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => send("no_debt")}
              className="btn-tonal w-full justify-start px-4 text-rose-700"
            >
              <Ban size={18} aria-hidden="true" />{t.noDebt}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="label" htmlFor="seenAmount">
            {t.seenLabel}
          </label>
          <input
            id="seenAmount"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={groupDigits(seenAmount)}
            onChange={(e) => setSeenAmount(digitsOnly(e.target.value, 9))}
            placeholder={t.seenPlaceholder}
            className="field text-lg font-bold"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy || seenAmount.trim() === ""}
              onClick={() => send("amount_differs")}
              className="btn-primary w-full"
            >
              {busy ? t.sending : t.send}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setStage("ask")}
              className="btn-ghost w-full"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-700">
          {error}
        </div>
      )}
    </div>
  );
}
