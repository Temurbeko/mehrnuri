"use client";

import { Check, ChevronDown, ChevronUp, Copy, MapPin, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { REACTION_TYPES, UTILITY_ICONS, type PaymentProviderId, type PublicBill, type ReactionType, type ReviewStatus } from "@/lib/domain";
import { findDistrict, meterUnitFor } from "@/lib/uzbekistan";
import type { Locale } from "@/i18n/config";
import { fmt, formatMoney, type Dictionary } from "@/i18n";
import { StatusBadge, UTILITY_THEMES } from "./BillCard";
import { TrustBadge } from "./DebtCheck";
import { api, errorText } from "./api";

const PRESET_AMOUNTS = [10_000, 25_000, 50_000, 100_000];
const KIND_PREFIXES = ["Mehribon", "Saxiy", "Iliq_Nur", "Ezgu_Qalb", "Umid_Nuri", "Saxovat", "Yaxshi_Inson"];

function randomKindNickname(): string {
  const prefix = KIND_PREFIXES[Math.floor(Math.random() * KIND_PREFIXES.length)] ?? "Saxiy";
  const num = Math.floor(100 + Math.random() * 900);
  return `${prefix}_${num}`;
}

export function DonatePanel({
  initialBill,
  initialReviewStatus,
  initialNickname,
  providers,
  minAmount,
  canReact = false,
  locale,
  dict,
}: {
  initialBill: PublicBill;
  initialReviewStatus: ReviewStatus;
  initialNickname: string | null;
  providers: PaymentProviderId[];
  minAmount: number;
  canReact?: boolean;
  locale: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [bill, setBill] = useState<PublicBill>(initialBill);
  const [nickname, setNickname] = useState<string | null>(initialNickname);
  const [nicknameInput, setNicknameInput] = useState<string>(() => initialNickname ?? randomKindNickname());
  const [showDetails, setShowDetails] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);

  const defaultAmt = Math.min(50_000, Math.max(minAmount, initialBill.available || initialBill.amountOwed));
  const [amount, setAmount] = useState<number>(defaultAmt);
  const [customAmount, setCustomAmount] = useState<string>(String(defaultAmt));
  const provider: PaymentProviderId = providers[0] ?? "click";
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/bills/stream");
    const onBills = (ev: MessageEvent<string>) => {
      try {
        const list = JSON.parse(ev.data) as PublicBill[];
        const found = list.find((b) => b.id === bill.id);
        if (found) setBill(found);
      } catch {
        /* ignore */
      }
    };
    es.addEventListener("bills", onBills as EventListener);
    return () => es.close();
  }, [bill.id]);

  const pct = Math.min(100, Math.round((bill.paidAmount / Math.max(1, bill.amountOwed)) * 100));
  const remaining = Math.max(0, bill.amountOwed - bill.paidAmount);
  const theme = UTILITY_THEMES[bill.utilityType];
  const districtInfo = findDistrict(bill.region, bill.district);
  const meterUnit = meterUnitFor(bill.utilityType);

  function copyAccountNumber() {
    navigator.clipboard?.writeText(bill.accountNumber).catch(() => {});
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  }

  async function sendReaction(reaction: ReactionType) {
    const res = await api<{ bill?: PublicBill }>(`/api/bills/${bill.id}/react`, {
      body: { reaction },
    });
    if (res.ok && res.data.bill) {
      setBill(res.data.bill);
    }
  }

  async function handlePay() {
    setError(null);
    const chosen = Math.min(amount, bill.available);
    if (chosen <= 0) {
      setError(dict.donate.full);
      return;
    }

    navigator.clipboard?.writeText(bill.accountNumber).catch(() => {});

    setPaying(true);

    if (!nickname) {
      const cleanNick = nicknameInput.trim() || randomKindNickname();
      let donorRes = await api<{ donor?: { nickname: string } }>("/api/donors", {
        body: { nickname: cleanNick },
      });
      if (!donorRes.ok && donorRes.data.error === "nickname_taken") {
        donorRes = await api<{ donor?: { nickname: string } }>("/api/donors", {
          body: { nickname: `${cleanNick.slice(0, 18)}_${Math.floor(10 + Math.random() * 89)}` },
        });
      }
      if (!donorRes.ok || !donorRes.data.donor) {
        setPaying(false);
        setError(errorText(donorRes.data.error, dict, donorRes.data.details));
        return;
      }
      setNickname(donorRes.data.donor.nickname);
    }

    const res = await api<{ redirectUrl?: string }>("/api/payments/checkout", {
      body: {
        billId: bill.id,
        amount: chosen,
        provider,
        locale,
      },
    });
    if (!res.ok || !res.data.redirectUrl) {
      setPaying(false);
      setError(errorText(res.data.error, dict, res.data.details));
      return;
    }
    const url = res.data.redirectUrl;
    if (url.startsWith("/")) {
      router.push(url);
    } else {
      window.location.href = url;
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="card space-y-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ring-1 ${theme.bg} ${theme.text} ${theme.ring}`}
              aria-hidden="true"
            >
              {UTILITY_ICONS[bill.utilityType]}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-lg font-extrabold text-slate-900">{dict.utility[bill.utilityType]}</h1>
                {bill.verified && (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <Check size={14} aria-hidden="true" />
                  </span>
                )}
              </div>
              <p className="flex items-center gap-1 text-sm text-slate-500">
                <MapPin size={16} aria-hidden="true" className="shrink-0" />{dict.region[bill.region]} · {dict.districts[districtInfo.id]}
              </p>
              <div className="mt-1.5">
                <TrustBadge bill={bill} dict={dict} />
              </div>
            </div>
          </div>

          {initialReviewStatus === "pending_review" ? (
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-extrabold text-amber-800">
              {dict.status.pending_review}
            </span>
          ) : initialReviewStatus === "flagged" ? (
            <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-extrabold text-rose-700">
              {dict.status.flagged}
            </span>
          ) : initialReviewStatus === "rejected" ? (
            <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-extrabold text-rose-700">
              {dict.status.rejected}
            </span>
          ) : (
            <StatusBadge bill={bill} dict={dict} />
          )}
        </div>

        <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200/90 bg-slate-50 px-3.5 py-2.5">
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-400">
              {dict.bill.account} · {bill.holderMasked ?? bill.code}
            </div>
            <div className="font-mono text-base font-extrabold tracking-wide text-slate-900 select-all">
              {bill.accountNumber}
            </div>
          </div>
          <button
            type="button"
            onClick={copyAccountNumber}
            className={`shrink-0 cursor-pointer rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all ${
              copiedAccount
                ? "bg-emerald-600 text-white"
                : "bg-white text-slate-800 shadow-2xs ring-1 ring-slate-200 hover:bg-slate-100"
            }`}
          >
            {copiedAccount ? <span className="inline-flex items-center gap-1.5"><Check size={18} aria-hidden="true" />{dict.donate.copied}</span> : <span className="inline-flex items-center gap-1.5"><Copy size={18} aria-hidden="true" />{dict.donate.copy}</span>}
          </button>
        </div>

        {bill.story && (
          <div className="rounded-2xl bg-amber-50/70 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-700 italic">
            “{bill.story}”
          </div>
        )}

        {bill.thanksReactions && bill.thanksReactions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {bill.thanksReactions.map((r) => (
              <span
                key={r}
                className="inline-flex items-center rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-extrabold text-emerald-800 ring-1 ring-emerald-500/25"
              >
                {dict.reactions.items[r]}
              </span>
            ))}
          </div>
        )}

        {canReact && (
          <div className="panel space-y-2">
            <div className="text-[11px] font-extrabold text-amber-900">
              {dict.reactions.panelTitle}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {REACTION_TYPES.map((r) => {
                const active = bill.thanksReactions?.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => sendReaction(r)}
                    className={`cursor-pointer rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all active:scale-95 ${
                      active
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-slate-800 shadow-2xs ring-1 ring-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {dict.reactions.items[r]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400">{dict.bill.remaining}: </span>
              <span className="text-lg font-extrabold text-slate-900">{formatMoney(remaining, dict)}</span>
            </div>
            <span className="text-xs font-extrabold text-emerald-600">
              {pct}% ({formatMoney(bill.paidAmount, dict)})
            </span>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${theme.bar} transition-all duration-500`}
              style={{ width: `${Math.max(pct, bill.paidAmount > 0 ? 6 : 0)}%` }}
            />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-2">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="flex w-full cursor-pointer items-center justify-between text-xs font-bold text-slate-500 hover:text-slate-800"
          >
            <span>{dict.donate.moreDetails}</span>
            {showDetails ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
          </button>
          {showDetails && (
            <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
              <div className="col-span-2">
                <span className="text-slate-400">{dict.bill.supplier}: </span>
                <strong className="text-slate-800">{bill.supplier}</strong>
              </div>
              <div>
                <span className="text-slate-400">{dict.bill.code}: </span>
                <strong className="font-mono text-slate-800">{bill.code}</strong>
              </div>
              {bill.addressMasked && (
                <div className="col-span-2">
                  <span className="text-slate-400">{dict.bill.address}: </span>
                  <strong className="text-slate-700">{bill.addressMasked}</strong>
                </div>
              )}
              {bill.meterReading !== null && meterUnit && (
                <div className="col-span-2">
                  <span className="text-slate-400">{dict.bill.meterReading}: </span>
                  <strong className="font-mono text-slate-800">
                    {bill.meterReading} {meterUnit}
                  </strong>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {initialReviewStatus !== "approved" ? (
        <div className="card text-center text-sm font-bold text-slate-600 p-5">
          {initialReviewStatus === "pending_review"
            ? dict.ask.heldText
            : initialReviewStatus === "flagged"
              ? dict.check.flaggedNotice
              : dict.status.rejected}
        </div>
      ) : bill.fundingStatus === "fully_paid" ? (
        <div className="card space-y-2 text-center py-8">
          <div className="text-4xl">🎉</div>
          <p className="text-base font-extrabold text-emerald-700">{dict.bill.thanks}</p>
        </div>
      ) : bill.available <= 0 ? (
        // Not paid yet: other donors have the rest reserved and are paying now.
        <div className="card space-y-2 text-center py-8">
          <div className="text-4xl">⏳</div>
          <p className="text-sm font-extrabold text-slate-700">{dict.donate.reserved}</p>
        </div>
      ) : (
        <div className="card space-y-4 p-5">
          <label className="block text-sm font-extrabold text-slate-600" htmlFor="customAmount">
            {dict.donate.chooseAmount}
          </label>

          <div className="relative">
            <input
              id="customAmount"
              type="number"
              inputMode="numeric"
              min={Math.min(minAmount, bill.available)}
              max={bill.available}
              step={500}
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v > 0) setAmount(Math.min(v, bill.available));
              }}
              className="input pr-16 font-mono text-2xl font-extrabold text-slate-900"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400">
              {dict.common.som}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PRESET_AMOUNTS.filter((p) => p < bill.available).map((preset) => {
              const active = amount === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setAmount(preset);
                    setCustomAmount(String(preset));
                  }}
                  className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-extrabold transition-all active:scale-95 ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {formatMoney(preset, dict)}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setAmount(bill.available);
                setCustomAmount(String(bill.available));
              }}
              className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-extrabold transition-all active:scale-95 ${
                amount === bill.available
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20"
              }`}
            >
              <Sparkles size={16} aria-hidden="true" className="mr-1 inline" />{fmt(dict.donate.all, { amount: formatMoney(bill.available, dict) })}
            </button>
          </div>

          {error && (
            <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-center text-xs font-bold text-rose-700">
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={paying || providers.length === 0}
            onClick={handlePay}
            className="btn-primary w-full"
          >
            {paying ? dict.donate.redirecting : fmt(dict.donate.continue, { amount: formatMoney(Math.min(amount, bill.available), dict) })}
          </button>
        </div>
      )}
    </div>
  );
}
