"use client";

import { Ban, Check, Eye, Flag, Shield, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UTILITY_ICONS } from "@/lib/domain";
import type { AdminBill } from "@/lib/admin/service";
import { fmt, formatMoney, type Dictionary } from "@/i18n";
import { api, errorText } from "./api";

export function AdminClient({
  authenticated,
  initialReported,
  initialPending,
  initialPayouts,
  dict,
}: {
  authenticated: boolean;
  initialReported: AdminBill[];
  initialPending: AdminBill[];
  initialPayouts: AdminBill[];
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

  /** One card for both exception queues: reported bills and auto-held bills. */
  function reviewCard(b: AdminBill) {
    const reason = (rejectReasons[b.id] ?? "").trim();
    return (
      <div key={b.id} className="card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xl">
              {UTILITY_ICONS[b.utilityType]}
            </span>
            <div>
              <div className="font-mono text-[11px] font-bold text-slate-400">{b.code}</div>
              <h3 className="text-base font-extrabold text-slate-900">
                {dict.utility[b.utilityType]} · {dict.region[b.region]}
              </h3>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {b.reportCount > 0 && (
              <span className="rounded-full bg-rose-500/12 px-2.5 py-1 text-xs font-extrabold text-rose-700">
                <Flag size={14} aria-hidden="true" className="mr-1 inline" />{fmt(dict.admin.reportCount, { count: b.reportCount })}
              </span>
            )}
            {b.accountBlocked && (
              <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-extrabold text-white">
                <Ban size={14} aria-hidden="true" className="mr-1 inline" />{dict.admin.accountBlocked}
              </span>
            )}
            {b.checkedCount > 0 && (
              <span className="rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-bold text-slate-700">
                <Eye size={14} aria-hidden="true" className="mr-1 inline" />{fmt(dict.check.checkedCount, { count: b.checkedCount })}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3.5 text-xs">
          <div>
            <span className="text-slate-400 font-semibold">{dict.bill.account}: </span>
            <span className="font-mono font-extrabold text-slate-900">{b.accountNumber}</span>
          </div>
          <div>
            <span className="text-slate-400 font-semibold">{dict.admin.phone}: </span>
            <span className="font-mono font-bold text-slate-800">{b.phone}</span>
          </div>
          <div>
            <span className="text-slate-400 font-semibold">{dict.admin.entered}: </span>
            <span className="font-extrabold text-slate-900">{formatMoney(b.amountOwed, dict)}</span>
          </div>
          {b.lastMismatch && (
            <div>
              <span className="text-slate-400 font-semibold">{dict.admin.donorSaw}: </span>
              <span className="font-extrabold text-rose-700">
                {b.lastMismatch.kind === "no_debt"
                  ? dict.check.noDebt
                  : b.lastMismatch.seenAmount === null
                    ? dict.check.differs
                    : formatMoney(b.lastMismatch.seenAmount, dict)}
              </span>
            </div>
          )}
        </div>

        {b.story && <p className="text-xs italic text-slate-600">“{b.story}”</p>}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={busy}
            onClick={() => act(b.id, { action: "approve" })}
            className="btn-emerald sm:w-auto sm:px-6 text-xs"
          >
            <Check size={18} aria-hidden="true" />{dict.admin.approve}
          </button>
          <div className="flex flex-1 gap-2">
            <input
              type="text"
              placeholder={dict.admin.rejectReason}
              value={rejectReasons[b.id] ?? ""}
              onChange={(e) => setRejectReasons({ ...rejectReasons, [b.id]: e.target.value })}
              className="input text-xs"
            />
            <button
              type="button"
              disabled={busy || reason.length < 3}
              onClick={() =>
                act(b.id, { action: "reject", reason, blockAccount: blockAccount[b.id] === true })
              }
              className="btn border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 w-auto px-4 text-xs"
            >
              <X size={18} aria-hidden="true" />{dict.admin.reject}
            </button>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-[11px] font-bold text-slate-600">
          <input
            type="checkbox"
            checked={blockAccount[b.id] === true}
            onChange={(e) => setBlockAccount({ ...blockAccount, [b.id]: e.target.checked })}
            className="h-4 w-4 cursor-pointer rounded border-slate-300"
          />
          {dict.admin.blockAccountLabel}
        </label>
      </div>
    );
  }

  if (!authed) {
    return (
      <form onSubmit={handleLogin} className="card mx-auto max-w-md space-y-4 p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white"><Shield size={20} aria-hidden="true" /></span>
          <h1 className="text-xl font-extrabold text-slate-900">{dict.admin.title}</h1>
        </div>
        <div>
          <label className="label" htmlFor="admin-pw">
            {dict.admin.password}
          </label>
          <input
            id="admin-pw"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </div>
        {error && <div className="text-xs font-bold text-rose-600">{error}</div>}
        <button type="submit" disabled={busy} className="btn-primary">
          {dict.admin.login}
        </button>
      </form>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{dict.admin.title}</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          {dict.admin.logout}
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-center text-xs font-bold text-rose-700">
          {error}
        </div>
      )}

      {/* Reported by donors — the only queue that normally has anything in it. */}
      <section className="space-y-3.5">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-extrabold text-slate-900">{dict.admin.reported}</h2>
          <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-extrabold text-rose-700">
            {reported.length}
          </span>
        </div>
        <p className="text-xs font-medium text-slate-500">{dict.admin.reportedHint}</p>

        {reported.length === 0 ? (
          <div className="card py-8 text-center text-sm font-semibold text-slate-400">{dict.admin.empty}</div>
        ) : (
          reported.map(reviewCard)
        )}
      </section>

      {/* Held automatically (an amount no household could owe). */}
      <section className="space-y-3.5">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-extrabold text-slate-900">{dict.admin.pending}</h2>
          <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-extrabold text-amber-800">
            {pending.length}
          </span>
        </div>
        <p className="text-xs font-medium text-slate-500">{dict.admin.pendingHint}</p>

        {pending.length === 0 ? (
          <div className="card py-8 text-center text-sm font-semibold text-slate-400">{dict.admin.empty}</div>
        ) : (
          pending.map(reviewCard)
        )}
      </section>

      {/* Payout queue */}
      <section className="space-y-3.5">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-extrabold text-slate-900">{dict.admin.payouts}</h2>
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800">
            {payouts.length}
          </span>
        </div>

        {payouts.length === 0 ? (
          <div className="card py-8 text-center text-sm font-semibold text-slate-400">{dict.admin.empty}</div>
        ) : (
          payouts.map((b) => (
            <div key={b.id} className="card space-y-3.5">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-mono text-[11px] font-bold text-slate-400">{b.code}</span>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {dict.utility[b.utilityType]} · {dict.region[b.region]}
                  </h3>
                </div>
                <span className="text-base font-extrabold text-emerald-600">{formatMoney(b.paidAmount, dict)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold">{dict.bill.account}: </span>
                  <span className="font-mono font-bold text-slate-900">{b.accountNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold">{dict.admin.phone}: </span>
                  <span className="font-mono font-bold text-slate-800">{b.phone}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={dict.admin.payoutRef}
                  value={payoutRefs[b.id] ?? ""}
                  onChange={(e) => setPayoutRefs({ ...payoutRefs, [b.id]: e.target.value })}
                  className="input text-xs"
                />
                <button
                  type="button"
                  disabled={busy || (payoutRefs[b.id] ?? "").trim().length < 3}
                  onClick={() => act(b.id, { action: "payout", reference: (payoutRefs[b.id] ?? "").trim() })}
                  className="btn-primary w-auto px-5 text-xs"
                >
                  {dict.admin.payout}
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
