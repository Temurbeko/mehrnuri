"use client";

import { Ban, Check, CircleCheck, ExternalLink, Eye, Flag, LogOut, Shield, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { UTILITY_ICONS } from "@/lib/domain";
import type { AdminBill } from "@/lib/admin/service";
import { fmt, formatMoney, type Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { api, errorText } from "./api";
import { AppBar } from "./AppBar";
import { BottomSheet } from "./BottomSheet";

export function AdminClient({
  authenticated,
  initialReported,
  initialPending,
  initialPayouts,
  locale,
  dict,
}: {
  authenticated: boolean;
  initialReported: AdminBill[];
  initialPending: AdminBill[];
  initialPayouts: AdminBill[];
  locale: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [authed, setAuthed] = useState(authenticated);
  const [password, setPassword] = useState("");
  const [reported, setReported] = useState<AdminBill[]>(initialReported);
  const [pending, setPending] = useState<AdminBill[]>(initialPending);
  const [payouts, setPayouts] = useState<AdminBill[]>(initialPayouts);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [blockAccount, setBlockAccount] = useState<Record<string, boolean>>({});
  const [payoutRefs, setPayoutRefs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"reported" | "pending" | "payouts">("reported");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const closeReject = useCallback(() => setRejectId(null), []);

  async function refreshQueues() {
    const res = await api<{ reported?: AdminBill[]; pending?: AdminBill[]; payouts?: AdminBill[] }>("/api/admin/bills");
    if (res.ok) {
      setReported(res.data.reported ?? []);
      setPending(res.data.pending ?? []);
      setPayouts(res.data.payouts ?? []);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await api("/api/admin/session", { body: { password } });
    setBusy(false);
    if (!res.ok) {
      setError(errorText(res.data.error, dict, res.data.details));
      return;
    }
    setAuthed(true);
    await refreshQueues();
    router.refresh();
  }

  async function handleLogout() {
    await api("/api/admin/session", { method: "DELETE" });
    setAuthed(false);
    router.refresh();
  }

  async function act(id: string, body: Record<string, string | boolean>) {
    setError(null);
    setBusy(true);
    const res = await api(`/api/admin/bills?id=${encodeURIComponent(id)}`, { body });
    setBusy(false);
    if (!res.ok) {
      setError(errorText(res.data.error, dict, res.data.details));
      return;
    }
    await refreshQueues();
  }

  const rejecting = rejectId ? [...reported, ...pending].find((b) => b.id === rejectId) ?? null : null;
  const rejectReason = rejectId ? (rejectReasons[rejectId] ?? "").trim() : "";

  /** One card for both exception queues: reported bills and auto-held bills. */
  function reviewCard(b: AdminBill) {
    return (
      <article key={b.id} className="surface min-w-0 overflow-hidden">
        <div className="flex min-w-0 items-start gap-3 p-4 pb-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[var(--tone)] text-xl">
            {UTILITY_ICONS[b.utilityType]}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] leading-snug font-extrabold break-words text-[var(--ink)]">
              {dict.utility[b.utilityType]} · {dict.region[b.region]}
            </h3>
            <p className="mt-0.5 text-[13px] font-bold text-[var(--ink-soft)] tabular-nums">{b.code}</p>
          </div>
          <Link
            href={`/${locale}/bill/${b.id}`}
            aria-label={dict.admin.open}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--tone)] text-[var(--ink)]"
          >
            <ExternalLink size={17} aria-hidden="true" />
          </Link>
        </div>

        {(b.reportCount > 0 || b.accountBlocked || b.checkedCount > 0) && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-3">
            {b.reportCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/12 px-2.5 py-1 text-[12.5px] font-extrabold text-rose-700">
                <Flag size={13} aria-hidden="true" />
                {fmt(dict.admin.reportCount, { count: b.reportCount })}
              </span>
            )}
            {b.accountBlocked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ink)] px-2.5 py-1 text-[12.5px] font-extrabold text-[var(--paper)]">
                <Ban size={13} aria-hidden="true" />
                {dict.admin.accountBlocked}
              </span>
            )}
            {b.checkedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--tone)] px-2.5 py-1 text-[12.5px] font-bold text-[var(--ink-soft)]">
                <Eye size={13} aria-hidden="true" />
                {fmt(dict.check.checkedCount, { count: b.checkedCount })}
              </span>
            )}
          </div>
        )}

        {/* What was asked next to what the donor actually saw. */}
        <div className="grid grid-cols-2 gap-2 px-4">
          <div className="min-w-0 rounded-[14px] bg-[var(--tone)] px-3 py-2.5">
            <div className="truncate text-[12.5px] font-bold text-[var(--ink-soft)]">{dict.admin.entered}</div>
            <div className="mt-0.5 truncate text-[16px] font-extrabold text-[var(--ink)] tabular-nums">{formatMoney(b.amountOwed, dict)}</div>
          </div>
          <div className={`min-w-0 rounded-[14px] px-3 py-2.5 ${b.lastMismatch ? "bg-rose-50" : "bg-[var(--tone)]"}`}>
            <div className="truncate text-[12.5px] font-bold text-[var(--ink-soft)]">{dict.admin.donorSaw}</div>
            <div className={`mt-0.5 truncate text-[16px] font-extrabold tabular-nums ${b.lastMismatch ? "text-rose-700" : "text-[var(--ink-soft)]"}`}>
              {!b.lastMismatch
                ? "—"
                : b.lastMismatch.kind === "no_debt"
                  ? dict.check.noDebt
                  : b.lastMismatch.seenAmount === null
                    ? dict.check.differs
                    : formatMoney(b.lastMismatch.seenAmount, dict)}
            </div>
          </div>
        </div>

        <dl className="m-0 mt-3 border-t border-[var(--tone)]">
          <div className="flex min-w-0 items-center justify-between gap-3 px-4 py-2.5">
            <dt className="shrink-0 text-[14px] text-[var(--ink-soft)]">{dict.bill.account}</dt>
            <dd className="m-0 min-w-0 truncate text-[15px] font-extrabold text-[var(--ink)] tabular-nums">{b.accountNumber}</dd>
          </div>
          {b.phone && (
            <div className="flex min-w-0 items-center justify-between gap-3 border-t border-[var(--tone)] px-4 py-2.5">
              <dt className="shrink-0 text-[14px] text-[var(--ink-soft)]">{dict.admin.phone}</dt>
              <dd className="m-0 min-w-0 truncate text-[15px] font-bold text-[var(--ink)] tabular-nums">{b.phone}</dd>
            </div>
          )}
        </dl>

        {b.story && (
          <p className="mx-4 mt-1 rounded-[14px] bg-[var(--paper)] px-3 py-2.5 text-[14px] leading-snug break-words text-[var(--ink)]">“{b.story}”</p>
        )}

        <div className="grid grid-cols-2 gap-2 p-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => setRejectId(b.id)}
            className="btn-tonal min-h-12 w-full text-[15px] text-rose-700"
          >
            <X size={18} aria-hidden="true" />
            {dict.admin.reject}
          </button>
          <button type="button" disabled={busy} onClick={() => act(b.id, { action: "approve" })} className="btn-emerald min-h-12 w-full text-[15px]">
            <Check size={18} aria-hidden="true" />
            {dict.admin.approve}
          </button>
        </div>
      </article>
    );
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-md">
        <AppBar title={dict.admin.title} locale={locale} backLabel={dict.common.back} />
        <form onSubmit={handleLogin} className="surface mt-6 space-y-4 p-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[var(--ink)] text-[var(--glow)]">
              <Shield size={26} aria-hidden="true" />
            </span>
            <h1 className="text-[20px] font-extrabold tracking-tight text-[var(--ink)]">{dict.admin.title}</h1>
          </div>
          <div>
            <label className="label" htmlFor="admin-pw">
              {dict.admin.password}
            </label>
            <input id="admin-pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="field" />
          </div>
          {error && (
            <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-center text-sm font-bold text-rose-700">
              {error}
            </div>
          )}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {dict.admin.login}
          </button>
        </form>
      </div>
    );
  }

  const queues = [
    { id: "reported" as const, label: dict.admin.tabReported, hint: dict.admin.reportedHint, items: reported, tone: "bg-rose-500 text-white" },
    { id: "pending" as const, label: dict.admin.tabPending, hint: dict.admin.pendingHint, items: pending, tone: "bg-amber-500 text-[#3b2508]" },
    // Money goes straight to the utility, so this queue is normally empty: shown only when it is not.
    ...(payouts.length > 0
      ? [{ id: "payouts" as const, label: dict.admin.tabPayouts, hint: dict.admin.payouts, items: payouts, tone: "bg-emerald-600 text-white" }]
      : []),
  ];
  const current = queues.find((q) => q.id === tab) ?? queues[0]!;

  return (
    <div className="mx-auto max-w-2xl pb-2">
      <AppBar
        title={dict.admin.title}
        locale={locale}
        backLabel={dict.common.back}
        action={
          <button type="button" onClick={handleLogout} aria-label={dict.admin.logout} className="appbar-btn">
            <LogOut size={20} aria-hidden="true" />
          </button>
        }
      />

      <div role="tablist" className="segmented">
        {queues.map((q) => (
          <button key={q.id} type="button" role="tab" aria-selected={current.id === q.id} onClick={() => setTab(q.id)}>
            {q.label}
            {q.items.length > 0 && (
              <span className={`ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 align-middle text-[11.5px] font-extrabold ${q.tone}`}>
                {q.items.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <p className="mx-1 mt-3 text-[13px] leading-snug text-[var(--ink-soft)]">{current.hint}</p>

      {error && (
        <div role="alert" className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-center text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      <div role="tabpanel" className="mt-3 space-y-3">
        {current.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(46,154,103,0.12)] text-[var(--hope)]">
              <CircleCheck size={30} aria-hidden="true" />
            </span>
            <p className="mt-1 text-[17px] font-extrabold text-[var(--ink)]">{dict.admin.emptyTitle}</p>
            <p className="max-w-[30ch] text-[14px] leading-snug text-[var(--ink-soft)]">{dict.admin.empty}</p>
          </div>
        ) : current.id === "payouts" ? (
          current.items.map((b) => (
            <article key={b.id} className="surface min-w-0 space-y-3 p-4">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[16px] leading-snug font-extrabold break-words text-[var(--ink)]">
                    {dict.utility[b.utilityType]} · {dict.region[b.region]}
                  </h3>
                  <p className="mt-0.5 text-[13px] font-bold text-[var(--ink-soft)] tabular-nums">
                    {b.code} · {b.accountNumber}
                  </p>
                </div>
                <span className="shrink-0 text-[16px] font-extrabold whitespace-nowrap text-[var(--hope)] tabular-nums">{formatMoney(b.paidAmount, dict)}</span>
              </div>
              <input
                type="text"
                placeholder={dict.admin.payoutRef}
                value={payoutRefs[b.id] ?? ""}
                onChange={(e) => setPayoutRefs({ ...payoutRefs, [b.id]: e.target.value })}
                className="field"
              />
              <button
                type="button"
                disabled={busy || (payoutRefs[b.id] ?? "").trim().length < 3}
                onClick={() => act(b.id, { action: "payout", reference: (payoutRefs[b.id] ?? "").trim() })}
                className="btn-tonal w-full"
              >
                {dict.admin.payout}
              </button>
            </article>
          ))
        ) : (
          current.items.map(reviewCard)
        )}
      </div>

      {/* Rejecting needs a reason: asked in a sheet, not squeezed into the card. */}
      <BottomSheet open={rejecting !== null} onClose={closeReject} labelledBy="reject-title">
        <h2 id="reject-title" className="text-[22px] font-extrabold tracking-tight text-[var(--ink)]">
          {dict.admin.reject}
        </h2>
        {rejecting && (
          <p className="mt-1 text-[14px] text-[var(--ink-soft)]">
            {dict.utility[rejecting.utilityType]} · {rejecting.code} · {formatMoney(rejecting.amountOwed, dict)}
          </p>
        )}
        <label className="label mt-4" htmlFor="reject-reason">
          {dict.admin.rejectReason}
        </label>
        <input
          id="reject-reason"
          type="text"
          value={rejectId ? (rejectReasons[rejectId] ?? "") : ""}
          onChange={(e) => rejectId && setRejectReasons({ ...rejectReasons, [rejectId]: e.target.value })}
          className="field"
        />
        <label className="relative mt-3 flex cursor-pointer items-center justify-between gap-3 px-0.5 py-1 text-[15px] font-bold text-[var(--ink)]">
          <span className="min-w-0">{dict.admin.blockAccountLabel}</span>
          <input
            type="checkbox"
            role="switch"
            checked={rejectId ? blockAccount[rejectId] === true : false}
            onChange={(e) => rejectId && setBlockAccount({ ...blockAccount, [rejectId]: e.target.checked })}
            className="pointer-events-none absolute opacity-0"
          />
          <span aria-hidden="true" className="switch shrink-0" />
        </label>
        <button
          type="button"
          disabled={busy || rejectReason.length < 3}
          onClick={async () => {
            if (!rejectId) return;
            await act(rejectId, { action: "reject", reason: rejectReason, blockAccount: blockAccount[rejectId] === true });
            setRejectId(null);
          }}
          className="btn-primary mt-4 w-full"
        >
          <X size={18} aria-hidden="true" />
          {dict.admin.reject}
        </button>
      </BottomSheet>
    </div>
  );
}
