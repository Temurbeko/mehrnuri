"use client";

import { Check, ChevronRight, KeyRound, LogOut, Shield } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicDonor } from "@/lib/domain";
import { formatMoney, type Dictionary } from "@/i18n";
import { api, errorText } from "./api";
import { InstallApp } from "./InstallApp";

export function ProfileClient({
  initialDonor,
  recoveryCode,
  adminHref,
  children,
  dict,
}: {
  initialDonor: PublicDonor | null;
  recoveryCode: string | null;
  adminHref: string;
  children?: React.ReactNode;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [donor, setDonor] = useState<PublicDonor | null>(initialDonor);
  const [code, setCode] = useState<string | null>(recoveryCode);
  const [showCode, setShowCode] = useState(false);

  const [nickname, setNickname] = useState("");
  const [restoreInput, setRestoreInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await api<{ donor?: PublicDonor; recoveryCode?: string }>("/api/donors", {
      body: { nickname: nickname.trim() },
    });
    setBusy(false);
    if (!res.ok || !res.data.donor) {
      setError(errorText(res.data.error, dict, res.data.details));
      return;
    }
    setDonor(res.data.donor);
    setCode(res.data.recoveryCode ?? null);
    router.refresh();
  }

  async function handleRestore(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await api<{ donor?: PublicDonor }>("/api/donors/restore", {
      body: { recoveryCode: restoreInput.trim() },
    });
    setBusy(false);
    if (!res.ok || !res.data.donor) {
      setError(errorText(res.data.error, dict, res.data.details));
      return;
    }
    setDonor(res.data.donor);
    setCode(restoreInput.trim());
    router.refresh();
  }

  async function handleLogout() {
    setBusy(true);
    await api("/api/donors", { method: "DELETE" });
    setBusy(false);
    setDonor(null);
    setCode(null);
    router.refresh();
  }

  const settings = (
    <section>
      <h2 className="mx-1 mb-2 text-[13px] font-extrabold tracking-wide text-[var(--ink-soft)] uppercase">{dict.ux.settings}</h2>
      <ul className="list">
        {donor && code && (
          <li>
            <button
              type="button"
              onClick={() => setShowCode((v) => !v)}
              aria-expanded={showCode}
              className="list-row-tap flex w-full min-w-0 cursor-pointer items-center gap-3 text-left"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--tone)] text-[var(--ink)]">
                <KeyRound size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-[var(--ink)]">{dict.me.recoveryTitle}</span>
              <span className="shrink-0 text-[13px] font-extrabold text-[var(--lamp-deep)]">{showCode ? dict.ux.hide : dict.me.show}</span>
            </button>
            {showCode && (
              <div className="space-y-2 px-4 pb-4">
                <p className="text-[13px] leading-relaxed text-[var(--ink-soft)]">{dict.me.recoveryText}</p>
                <div className="panel tabular-nums text-[13px] break-all font-bold text-[var(--ink)] select-all">{code}</div>
              </div>
            )}
          </li>
        )}
        {donor && (
          <li>
            <button
              type="button"
              onClick={handleLogout}
              disabled={busy}
              className="list-row-tap flex w-full min-w-0 cursor-pointer items-center gap-3 text-left"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--tone)] text-[var(--ink)]">
                <LogOut size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-[var(--ink)]">{dict.me.logout}</span>
            </button>
          </li>
        )}
        <InstallApp dict={dict} />
        <li>
          <Link href={adminHref} className="list-row-tap flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--tone)] text-[var(--ink-soft)]">
              <Shield size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[var(--ink-soft)]">{dict.nav.admin}</span>
            <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-[var(--ink-soft)]" />
          </Link>
        </li>
      </ul>
    </section>
  );

  if (donor) {
    return (
      <div className="space-y-6">
        <div className="surface p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--glow)] text-[22px] font-extrabold text-[#3b2508]">
              {donor.nickname.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[17px] font-extrabold text-[var(--ink)]">{donor.nickname}</h2>
              <span className="inline-flex items-center gap-1 text-[13px] font-bold text-[var(--hope)]">
                <Check size={15} aria-hidden="true" />
                {dict.me.donorBadge}
              </span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="min-w-0 rounded-[14px] bg-[var(--tone)] px-3 py-2.5">
              <div className="truncate text-[13px] font-bold text-[var(--ink-soft)]">{dict.me.total}</div>
              <div className="mt-0.5 truncate text-[17px] font-extrabold whitespace-nowrap text-[var(--ink)] tabular-nums">{formatMoney(donor.totalDonated, dict)}</div>
            </div>
            <div className="min-w-0 rounded-[14px] bg-[var(--tone)] px-3 py-2.5">
              <div className="truncate text-[13px] font-bold text-[var(--ink-soft)]">{dict.me.count}</div>
              <div className="mt-0.5 text-[17px] font-extrabold text-[var(--ink)] tabular-nums">{donor.donationsCount}</div>
            </div>
          </div>
        </div>
        {children}
        {settings}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-5">
        <form onSubmit={handleCreate} className="surface space-y-4 p-4">
          <h2 className="text-[17px] font-extrabold text-[var(--ink)]">{dict.donate.nicknameTitle}</h2>
          <p className="text-[13px] font-medium text-[var(--ink-soft)]">{dict.donate.nicknameHint}</p>
          <input
            type="text"
            required
            minLength={3}
            maxLength={24}
            placeholder={dict.donate.nicknamePlaceholder}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="field"
          />
          <button type="submit" disabled={busy} className="btn-primary">
            {dict.donate.createNickname}
          </button>
        </form>

        <form onSubmit={handleRestore} className="surface space-y-4 p-4">
          <h2 className="text-[17px] font-extrabold text-[var(--ink)]">
            <KeyRound size={18} aria-hidden="true" className="mr-1.5 -mt-0.5 inline" />
            {dict.me.restoreTitle}
          </h2>
          <input
            type="text"
            required
            placeholder={dict.me.restorePlaceholder}
            value={restoreInput}
            onChange={(e) => setRestoreInput(e.target.value)}
            className="field"
          />
          <button type="submit" disabled={busy} className="btn-tonal">
            {dict.me.restore}
          </button>
        </form>

        {error && (
          <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-center text-sm font-bold text-rose-700">
            {error}
          </div>
        )}
      </div>
      {children}
      {settings}
    </div>
  );
}
