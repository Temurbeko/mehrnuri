"use client";

import { Check, KeyRound } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicDonor } from "@/lib/domain";
import { formatMoney, type Dictionary } from "@/i18n";
import { api, errorText } from "./api";

export function ProfileClient({
  initialDonor,
  recoveryCode,
  dict,
}: {
  initialDonor: PublicDonor | null;
  recoveryCode: string | null;
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

  if (donor) {
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <div className="surface space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-xl font-extrabold text-amber-700">
                {donor.nickname.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-extrabold text-stone-900">{donor.nickname}</h2>
                <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-600"><Check size={16} aria-hidden="true" />{dict.me.donorBadge}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={busy}
              className="btn-tonal w-auto shrink-0 whitespace-nowrap px-3"
            >
              {dict.me.logout}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="panel bg-emerald-50">
              <div className="text-xs font-bold text-emerald-800">{dict.me.total}</div>
              <div className="mt-1 text-lg font-extrabold text-emerald-700">{formatMoney(donor.totalDonated, dict)}</div>
            </div>
            <div className="panel">
              <div className="text-[11px] font-bold text-stone-500">{dict.me.count}</div>
              <div className="mt-1 text-lg font-extrabold text-stone-900">{donor.donationsCount}</div>
            </div>
          </div>
        </div>

        {code && (
          <div className="surface space-y-3 p-5">
            <h3 className="text-base font-extrabold text-stone-900"><KeyRound size={18} aria-hidden="true" className="mr-1.5 -mt-0.5 inline" />{dict.me.recoveryTitle}</h3>
            <p className="text-xs font-medium text-stone-500 leading-relaxed">{dict.me.recoveryText}</p>
            {showCode ? (
              <div className="panel font-mono text-xs break-all font-bold text-stone-800 select-all">
                {code}
              </div>
            ) : (
              <button type="button" onClick={() => setShowCode(true)} className="btn-tonal">
                {dict.me.show}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <form onSubmit={handleCreate} className="surface space-y-4 p-5">
        <h2 className="text-lg font-extrabold text-stone-900">{dict.donate.nicknameTitle}</h2>
        <p className="text-xs font-medium text-stone-500">{dict.donate.nicknameHint}</p>
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

      <form onSubmit={handleRestore} className="surface space-y-4 p-5">
        <h2 className="text-lg font-extrabold text-stone-900"><KeyRound size={18} aria-hidden="true" className="mr-1.5 -mt-0.5 inline" />{dict.me.restoreTitle}</h2>
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
  );
}
