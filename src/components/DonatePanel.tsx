"use client";

import { Check, Heart, Lightbulb, MapPin, Minus, Plus, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { copyText } from "@/lib/clipboard";
import { digitsOnly, groupDigits, timeAgo } from "@/lib/format";
import { useRouter } from "next/navigation";
import { REACTION_TYPES, type PaymentProviderId, type PublicBill, type ReactionType, type ReviewStatus } from "@/lib/domain";
import { findDistrict, meterUnitFor } from "@/lib/uzbekistan";
import type { Locale } from "@/i18n/config";
import { fmt, formatMoney, type Dictionary } from "@/i18n";
import { HelpersLine, StatusBadge, UtilityTile } from "./BillCard";
import { TrustBadge } from "./DebtCheck";
import { CopyRow } from "./CopyRow";
import { api, errorText } from "./api";

const PRESET_AMOUNTS = [10_000, 25_000, 50_000];
const AMOUNT_STEP = 5_000;
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
  recentHelps = [],
  providers,
  minAmount,
  canReact = false,
  isOwner = false,
  locale,
  dict,
}: {
  initialBill: PublicBill;
  initialReviewStatus: ReviewStatus;
  initialNickname: string | null;
  /** The last few people who paid towards this bill (public nicknames). */
  recentHelps?: Array<{ nickname: string; amount: number; at: string }>;
  providers: PaymentProviderId[];
  minAmount: number;
  canReact?: boolean;
  /** This browser posted the request: show sharing instead of the donate form. */
  isOwner?: boolean;
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
  const [shared, setShared] = useState(false);

  /** Native share sheet on phones; otherwise copy the link. */
  async function shareRequest() {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: dict.bill.ownTitle, url });
      } catch {
        /* the user closed the share sheet */
      }
      return;
    }
    if (await copyText(url)) {
      setShared(true);
      setTimeout(() => setShared(false), 2500);
    }
  }
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

  const remaining = Math.max(0, bill.amountOwed - bill.paidAmount);
  const districtInfo = findDistrict(bill.region, bill.district);
  const meterUnit = meterUnitFor(bill.utilityType);

  /** Set the amount (stepper, presets, "close the debt"): clamped to what can still be donated. */
  function applyAmount(n: number) {
    const clamped = Math.max(Math.min(minAmount, bill.available), Math.min(bill.available, Math.round(n)));
    setAmount(clamped);
    setCustomAmount(String(clamped));
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

  const approved = initialReviewStatus === "approved";
  const reviewBadge =
    initialReviewStatus === "pending_review" ? (
      <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-extrabold whitespace-nowrap text-amber-800">
        {dict.status.pending_review}
      </span>
    ) : initialReviewStatus === "flagged" || initialReviewStatus === "rejected" ? (
      <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-extrabold whitespace-nowrap text-rose-700">
        {initialReviewStatus === "flagged" ? dict.status.flagged : dict.status.rejected}
      </span>
    ) : bill.fundingStatus === "fully_paid" || bill.payoutStatus === "paid_out" ? (
      <StatusBadge bill={bill} dict={dict} />
    ) : null;

  const canDonate = !isOwner && approved && bill.fundingStatus !== "fully_paid" && bill.available > 0;
  const fullyCloses = amount >= bill.available;
  const percent = Math.max(1, Math.round((amount / Math.max(1, bill.amountOwed)) * 100));
  const pct = Math.min(100, Math.round((bill.paidAmount / Math.max(1, bill.amountOwed)) * 100));
  const showReviewRow = reviewBadge !== null || bill.trustLevel !== "new";

  return (
    <div className="space-y-6 pb-4">
      {/* Header sits on the page, not in a box. */}
      <div className="flex min-w-0 items-center gap-4">
        <UtilityTile type={bill.utilityType} big />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
          <div className="flex max-w-full items-center gap-1.5">
            <h1 className="text-2xl leading-[1.15] font-extrabold tracking-tight break-words text-[var(--ink)]">
              {dict.utilityBill[bill.utilityType]}
            </h1>
            {bill.verified && (
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check size={14} aria-hidden="true" />
              </span>
            )}
          </div>
          <p className="flex min-w-0 items-start gap-1.5 text-sm font-semibold text-[var(--ink-soft)]">
            <MapPin size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span suppressHydrationWarning className="min-w-0 break-words">
              {dict.districts[districtInfo.id]} · {timeAgo(bill.createdAt, dict.time)}
            </span>
          </p>
          {showReviewRow && (
            <div className="flex flex-wrap items-center gap-2">
              {reviewBadge}
              {bill.trustLevel !== "new" && <TrustBadge bill={bill} dict={dict} />}
            </div>
          )}
        </div>
      </div>

      {bill.story && (
        <blockquote className="m-0 rounded-[22px] bg-white p-[18px] text-[17px] leading-normal text-[var(--ink)] shadow-[var(--lift)]">
          <span aria-hidden="true" className="font-extrabold text-[var(--lamp-deep)]">“</span>
          {bill.story}
          <span aria-hidden="true" className="font-extrabold text-[var(--lamp-deep)]">”</span>
          <footer className="mt-2.5 text-[13px] font-bold text-[var(--ink-soft)]">
            {bill.familyName ?? dict.pick.family} · {dict.districts[districtInfo.id]}
          </footer>
        </blockquote>
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

      {/* Progress: what is left, how it is going, who helped. */}
      <div className="grid gap-2.5 px-0.5">
        <div className="flex items-baseline justify-between gap-2.5">
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-[var(--ink-soft)]">{dict.bill.remaining}</div>
            <div className="text-[34px] leading-[1.1] font-extrabold tracking-tight whitespace-nowrap text-[var(--ink)]">
              {groupDigits(String(remaining))} <small className="text-base font-bold text-[var(--ink-soft)]">{dict.common.som}</small>
            </div>
          </div>
          <div className="min-w-0 text-right text-sm font-bold text-[var(--ink-soft)]">
            {groupDigits(String(bill.paidAmount))} / {groupDigits(String(bill.amountOwed))} {dict.common.som}
          </div>
        </div>
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--tone)]"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--lamp),#ffc04d)] transition-all duration-700"
            style={{ width: `${Math.max(pct, bill.paidAmount > 0 ? 3 : 0)}%` }}
          />
        </div>
        <HelpersLine bill={bill} dict={dict} />
      </div>

      {/* Latest helps */}
      <div>
        <h2 className="mx-0.5 mb-3 text-[15px] font-extrabold text-[var(--ink)]">{dict.pick.recentTitle}</h2>
        <ul className="list">
          {recentHelps.length > 0 ? (
            recentHelps.map((h, i) => (
              <li key={`${h.at}-${i}`} className="list-row">
                <span aria-hidden="true" className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[var(--glow)] text-sm font-extrabold text-[#3b2508]">
                  {(h.nickname.trim()[0] ?? "?").toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[15px] text-[var(--ink)]">{h.nickname}</b>
                  <small suppressHydrationWarning className="text-[13px] font-semibold text-[var(--ink-soft)]">
                    {timeAgo(h.at, dict.time)}
                  </small>
                </span>
                <span className="font-extrabold whitespace-nowrap text-[var(--ink)]">{formatMoney(h.amount, dict)}</span>
              </li>
            ))
          ) : (
            <li className="list-row">
              <span aria-hidden="true" className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[var(--tone)] text-sm font-extrabold text-[var(--ink-soft)]">
                ?
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] text-[var(--ink)]">{dict.pick.noHelp}</b>
                <small className="text-[13px] font-semibold text-[var(--ink-soft)]">{dict.pick.noHelpSub}</small>
              </span>
            </li>
          )}
        </ul>
      </div>

      {/* Account number + details: tap the first row to copy. */}
      <ul className="list">
        <CopyRow label={bill.holderMasked ? `${dict.bill.account} · ${bill.holderMasked}` : dict.bill.account} value={bill.accountNumber} mono dict={dict} />
        <li className="list-row">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-stone-500">{dict.bill.supplier}</span>
            <span className="block font-bold text-stone-800">{bill.supplier}</span>
          </span>
        </li>
        <li className="list-row">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-stone-500">{dict.bill.code}</span>
            <span className="block tabular-nums font-bold text-stone-800">{bill.code}</span>
          </span>
        </li>
        {bill.addressMasked && (
          <li className="list-row">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-stone-500">{dict.bill.address}</span>
              <span className="block font-bold break-words text-stone-800">{bill.addressMasked}</span>
            </span>
          </li>
        )}
        {bill.meterReading !== null && meterUnit && (
          <li className="list-row">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-stone-500">{dict.bill.meterReading}</span>
              <span className="block tabular-nums font-bold text-stone-800">
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

      {!approved ? (
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
      ) : isOwner ? (
        // The family itself: no donate form (paying your own bill would put you on the
        // leaderboard); sharing the request is what actually helps.
        <div className="space-y-3 rounded-3xl bg-amber-50 px-5 py-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-amber-600 shadow-[var(--lift)]">
            <Share2 size={24} aria-hidden="true" />
          </div>
          <p className="text-lg font-extrabold text-stone-900">{dict.bill.ownTitle}</p>
          <p className="text-sm text-stone-600">{dict.bill.ownText}</p>
          <button type="button" onClick={shareRequest} className="btn-primary w-full">
            <Share2 size={18} aria-hidden="true" />
            {shared ? dict.bill.linkCopied : dict.bill.share}
          </button>
        </div>
      ) : bill.available <= 0 ? (
        // Not paid yet: other donors have the rest reserved and are paying now.
        <div className="space-y-1 rounded-2xl bg-[var(--tone)] px-4 py-8 text-center">
          <div className="text-4xl">⏳</div>
          <p className="text-sm font-extrabold text-stone-700">{dict.donate.reserved}</p>
        </div>
      ) : (
        <div className="pt-2">
          <h2 className="mb-3 text-[17px] font-extrabold text-[var(--ink)]">{dict.pick.title}</h2>

          <div className="flex items-center gap-2 rounded-[20px] bg-white p-2 shadow-[var(--lift)] focus-within:ring-[3px] focus-within:ring-[var(--lamp)]">
            <button
              type="button"
              aria-label={dict.pick.less}
              onClick={() => applyAmount(amount - AMOUNT_STEP)}
              className="grid h-[46px] w-[46px] shrink-0 cursor-pointer place-items-center rounded-[14px] bg-[var(--tone)] text-[var(--ink)] transition active:scale-95"
            >
              <Minus size={20} aria-hidden="true" />
            </button>
            <input
              id="customAmount"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              aria-label={dict.pick.amountLabel}
              value={groupDigits(customAmount)}
              onChange={(e) => {
                const raw = digitsOnly(e.target.value, 7);
                setCustomAmount(raw);
                const v = Number(raw);
                if (Number.isFinite(v) && v > 0) setAmount(Math.min(v, bill.available));
              }}
              onBlur={() => applyAmount(Number(customAmount) || minAmount)}
              className="min-w-0 flex-1 border-0 bg-transparent text-center text-[28px] leading-none font-extrabold tracking-tight text-[var(--ink)] outline-none"
            />
            <span className="mr-1 shrink-0 text-[15px] font-bold text-[var(--ink-soft)]">{dict.common.som}</span>
            <button
              type="button"
              aria-label={dict.pick.more}
              onClick={() => applyAmount(amount + AMOUNT_STEP)}
              className="grid h-[46px] w-[46px] shrink-0 cursor-pointer place-items-center rounded-[14px] bg-[var(--tone)] text-[var(--ink)] transition active:scale-95"
            >
              <Plus size={20} aria-hidden="true" />
            </button>
          </div>

          <div role="group" aria-label={dict.pick.presets} className="mt-3 grid grid-cols-3 gap-2">
            {PRESET_AMOUNTS.filter((p) => p < bill.available).map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={amount === preset}
                onClick={() => applyAmount(preset)}
                className={`h-11 cursor-pointer rounded-[14px] text-[15px] font-extrabold whitespace-nowrap transition active:scale-95 ${
                  amount === preset ? "bg-[var(--ink)] text-[var(--paper)]" : "bg-[var(--tone)] text-[var(--ink)]"
                }`}
              >
                {groupDigits(String(preset))}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={fullyCloses}
              onClick={() => applyAmount(bill.available)}
              className={`col-span-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[14px] px-3 py-2 text-center text-[15px] font-extrabold transition active:scale-95 ${
                fullyCloses ? "bg-[var(--ink)] text-[var(--paper)]" : "bg-[var(--tone)] text-[var(--ink)]"
              }`}
            >
              <Lightbulb size={16} aria-hidden="true" className="shrink-0" />
              <span>{fmt(dict.pick.closeAll, { amount: formatMoney(bill.available, dict) })}</span>
            </button>
          </div>

          <p className="mx-0.5 mt-3 flex items-start gap-2 text-sm text-[var(--ink-soft)]">
            {fullyCloses ? (
              <Check size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--hope)]" />
            ) : (
              <Lightbulb size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--lamp-deep)]" />
            )}
            <span className="min-w-0">
              {fullyCloses ? fmt(dict.pick.impactFull, { outcome: dict.outcome[bill.utilityType] }) : fmt(dict.pick.impactPart, { percent })}
            </span>
          </p>

          {error && (
            <div role="alert" className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-center text-sm font-bold text-rose-700">
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
            className="btn-primary min-h-[58px] w-full rounded-[18px] text-[17px]"
          >
            {paying ? (
              dict.donate.redirecting
            ) : (
              <>
                <Heart size={20} aria-hidden="true" />
                {fmt(dict.pick.cta, { amount: formatMoney(Math.min(amount, bill.available), dict) })}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
