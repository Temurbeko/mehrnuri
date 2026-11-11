"use client";

import { Check, MapPin, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { copyText } from "@/lib/clipboard";
import { useRouter } from "next/navigation";
import { REACTION_TYPES, UTILITY_ICONS, type PaymentProviderId, type PublicBill, type ReactionType, type ReviewStatus } from "@/lib/domain";
import { findDistrict, meterUnitFor } from "@/lib/uzbekistan";
import type { Locale } from "@/i18n/config";
import { fmt, formatMoney, type Dictionary } from "@/i18n";
import { StatusBadge, UTILITY_THEMES } from "./BillCard";
import { TrustBadge } from "./DebtCheck";
import { CopyRow } from "./CopyRow";
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

    // Best effort inside the tap; the payment page has its own copy button.
    void copyText(bill.accountNumber);

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

  const reviewBadge =
    initialReviewStatus === "pending_review" ? (
      <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-extrabold whitespace-nowrap text-amber-800">
        {dict.status.pending_review}
      </span>
    ) : initialReviewStatus === "flagged" || initialReviewStatus === "rejected" ? (
      <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-extrabold whitespace-nowrap text-rose-700">
        {initialReviewStatus === "flagged" ? dict.status.flagged : dict.status.rejected}
      </span>
    ) : (
      <StatusBadge bill={bill} dict={dict} />
    );

  const canDonate = initialReviewStatus === "approved" && bill.fundingStatus !== "fully_paid" && bill.available > 0;

  return (
    <div className="space-y-5 pb-4">
      {/* Header sits on the page, not in a box. */}
      <div className="space-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ${theme.bg} ${theme.text}`}
            aria-hidden="true"
          >
            {UTILITY_ICONS[bill.utilityType]}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-2xl font-extrabold tracking-tight text-stone-900">{dict.utility[bill.utilityType]}</h1>
              {bill.verified && (
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <Check size={14} aria-hidden="true" />
                </span>
              )}
            </div>
            <p className="flex min-w-0 items-center gap-1 text-sm font-medium text-stone-500">
              <MapPin size={16} aria-hidden="true" className="shrink-0" />
              <span className="min-w-0 truncate">
                {dict.region[bill.region]} · {dict.districts[districtInfo.id]}
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {reviewBadge}
          {bill.trustLevel !== "new" && <TrustBadge bill={bill} dict={dict} />}
        </div>
      </div>

      {/* Hero: the amount left, with progress. */}
      <div className="surface space-y-3 p-5">
        <div>
          <div className="text-sm font-semibold text-stone-500">{dict.bill.remaining}</div>
          <div className="text-[2.25rem] leading-tight font-extrabold tracking-tight whitespace-nowrap text-stone-900">
            {formatMoney(remaining, dict)}
          </div>
          <div className="mt-0.5 text-sm font-semibold text-stone-500">
            {formatMoney(bill.paidAmount, dict)} / {formatMoney(bill.amountOwed, dict)} · {pct}%
          </div>
        </div>
        <div
          className="h-4 w-full overflow-hidden rounded-full bg-[var(--tone)]"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`h-full rounded-full bg-gradient-to-r ${theme.bar} transition-all duration-500`}
            style={{ width: `${Math.max(pct, bill.paidAmount > 0 ? 6 : 0)}%` }}
          />
        </div>
        {bill.story && (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-relaxed font-medium text-amber-950 italic">“{bill.story}”</p>
        )}
        {bill.thanksReactions && bill.thanksReactions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {bill.thanksReactions.map((r) => (
              <span key={r} className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-800">
                {dict.reactions.items[r]}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Account number + details: tap the first row to copy. */}
      <ul className="list">
        <CopyRow label={bill.holderMasked ? `${dict.bill.account} · ${bill.holderMasked}` : dict.bill.account} value={bill.accountNumber} mono dict={dict} />
        <li className="list-row">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-stone-500">{dict.bill.supplier}</span>
            <span className="block font-bold text-stone-800">{bill.supplier}</span>
          </span>
        </li>
        <li className="list-row">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-stone-500">{dict.bill.code}</span>
            <span className="block font-mono font-bold text-stone-800">{bill.code}</span>
          </span>
        </li>
        {bill.addressMasked && (
          <li className="list-row">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-stone-500">{dict.bill.address}</span>
              <span className="block font-bold break-words text-stone-800">{bill.addressMasked}</span>
            </span>
          </li>
        )}
        {bill.meterReading !== null && meterUnit && (
          <li className="list-row">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-stone-500">{dict.bill.meterReading}</span>
              <span className="block font-mono font-bold text-stone-800">
                {bill.meterReading} {meterUnit}
              </span>
            </span>
          </li>
        )}
      </ul>

      {canReact && (
        <div className="panel space-y-2.5">
          <div className="text-sm font-extrabold text-amber-900">{dict.reactions.panelTitle}</div>
          <div className="flex flex-wrap gap-2">
            {REACTION_TYPES.map((r) => {
              const active = bill.thanksReactions?.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => sendReaction(r)}
                  className={`inline-flex min-h-10 cursor-pointer items-center rounded-full px-4 text-sm font-bold transition-all active:scale-95 ${
                    active ? "bg-emerald-600 text-white" : "bg-white text-stone-800 shadow-[var(--lift)] hover:bg-stone-50"
                  }`}
                >
                  {dict.reactions.items[r]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {initialReviewStatus !== "approved" ? (
        <div className="rounded-2xl bg-amber-50 px-4 py-4 text-center text-sm font-bold text-amber-950">
          {initialReviewStatus === "pending_review"
            ? dict.ask.heldText
            : initialReviewStatus === "flagged"
              ? dict.check.flaggedNotice
              : dict.status.rejected}
        </div>
      ) : bill.fundingStatus === "fully_paid" ? (
        <div className="space-y-1 rounded-2xl bg-emerald-50 px-4 py-8 text-center">
          <div className="text-4xl">🎉</div>
          <p className="text-base font-extrabold text-emerald-800">{dict.bill.thanks}</p>
        </div>
      ) : bill.available <= 0 ? (
        // Not paid yet: other donors have the rest reserved and are paying now.
        <div className="space-y-1 rounded-2xl bg-[var(--tone)] px-4 py-8 text-center">
          <div className="text-4xl">⏳</div>
          <p className="text-sm font-extrabold text-stone-700">{dict.donate.reserved}</p>
        </div>
      ) : (
        <div className="surface space-y-4 p-5">
          <label className="block text-sm font-extrabold text-stone-600" htmlFor="customAmount">
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
              className="field min-h-16 pr-16 text-2xl font-extrabold text-stone-900"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-stone-400">
              {dict.common.som}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESET_AMOUNTS.filter((p) => p < bill.available).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setAmount(preset);
                  setCustomAmount(String(preset));
                }}
                className={amount === preset ? "chip-active" : "chip"}
              >
                {formatMoney(preset, dict)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setAmount(bill.available);
                setCustomAmount(String(bill.available));
              }}
              className={amount === bill.available ? "chip-active" : "chip"}
            >
              <Sparkles size={16} aria-hidden="true" />
              {fmt(dict.donate.all, { amount: formatMoney(bill.available, dict) })}
            </button>
          </div>

          {error && (
            <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-center text-sm font-bold text-rose-700">
              {error}
            </div>
          )}
        </div>
      )}

      {canDonate && (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+68px)] z-30 md:bottom-0 -mx-4 bg-gradient-to-t from-[var(--paper)] via-[var(--paper)] to-transparent px-4 pt-6 pb-3 md:pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <button
            type="button"
            disabled={paying || providers.length === 0}
            onClick={handlePay}
            className="btn-primary w-full text-lg"
          >
            {paying ? dict.donate.redirecting : fmt(dict.donate.continue, { amount: formatMoney(Math.min(amount, bill.available), dict) })}
          </button>
        </div>
      )}
    </div>
  );
}
