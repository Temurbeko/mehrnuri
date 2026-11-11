"use client";

import { Check, Heart, Lightbulb, Minus, Plus, Share2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { AppBar } from "./AppBar";
import { BottomSheet } from "./BottomSheet";
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

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

  const helpers3 = recentHelps.slice(0, 3);
  const longStory = (bill.story?.length ?? 0) > 150;

  return (
    <div className="space-y-4 pb-2">
      <AppBar
        title={dict.utilityBill[bill.utilityType]}
        locale={locale}
        backLabel={dict.common.back}
        action={
          <button type="button" onClick={shareRequest} aria-label={shared ? dict.bill.linkCopied : dict.bill.share} className="appbar-btn">
            {shared ? <Check size={22} aria-hidden="true" className="text-[var(--hope)]" /> : <Share2 size={21} aria-hidden="true" />}
          </button>
        }
      />

      {/* One compact summary card: what, where, what is left, who helps. */}
      <section className="surface min-w-0 space-y-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <UtilityTile type={bill.utilityType} />
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-[var(--ink-soft)]">
              <span suppressHydrationWarning className="min-w-0 truncate">
                {dict.districts[districtInfo.id]} · {timeAgo(bill.createdAt, dict.time)}
              </span>
              {bill.verified && (
                <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <Check size={11} aria-hidden="true" />
                </span>
              )}
            </p>
            {showReviewRow && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {reviewBadge}
                {bill.trustLevel !== "new" && <TrustBadge bill={bill} dict={dict} />}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold text-[var(--ink-soft)]">{dict.bill.remaining}</div>
            <div className="text-[30px] leading-[1.1] font-extrabold tracking-tight whitespace-nowrap text-[var(--ink)]">
              {groupDigits(String(remaining))} <small className="text-sm font-bold text-[var(--ink-soft)]">{dict.common.som}</small>
            </div>
          </div>
          <div className="min-w-0 pb-1 text-right text-[13px] font-bold whitespace-nowrap text-[var(--ink-soft)]">
            {fmt(dict.app.ofTotal, { total: groupDigits(String(bill.amountOwed)) })}
          </div>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-[var(--tone)]"
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
      </section>

      {bill.story && (
        <blockquote className="min-w-0 border-l-[3px] border-[var(--lamp)] pr-1 pl-3.5 text-[15px] leading-snug text-[var(--ink)]">
          <p className={`m-0 break-words ${storyOpen ? "" : "story-clamp"}`}>{bill.story}</p>
          <footer className="mt-1.5 flex min-w-0 items-center justify-between gap-3 text-[12.5px] font-bold text-[var(--ink-soft)]">
            <span className="min-w-0 truncate">{bill.familyName ?? dict.pick.family}</span>
            {longStory && (
              <button
                type="button"
                onClick={() => setStoryOpen((v) => !v)}
                aria-expanded={storyOpen}
                className="shrink-0 cursor-pointer font-extrabold whitespace-nowrap text-[var(--lamp-deep)]"
              >
                {storyOpen ? dict.app.less : dict.app.more}
              </button>
            )}
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

      {/* Latest helps: one quiet line when empty, otherwise up to three people. */}
      {helpers3.length > 0 ? (
        <div>
          <h3 className="mx-0.5 mb-2 text-[13px] font-extrabold text-[var(--ink-soft)]">{dict.pick.recentTitle}</h3>
          <ul className="m-0 flex list-none gap-2 p-0">
            {helpers3.map((h, i) => (
              <li key={`${h.at}-${i}`} className="surface flex min-w-0 flex-1 items-center gap-2 p-2">
                <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--glow)] text-xs font-extrabold text-[#3b2508]">
                  {(h.nickname.trim()[0] ?? "?").toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[13px] leading-tight text-[var(--ink)]">{h.nickname}</b>
                  <small className="block truncate text-[12px] leading-tight font-bold text-[var(--ink-soft)]">{formatMoney(h.amount, dict)}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mx-0.5 text-[13px] font-semibold text-[var(--ink-soft)]">{dict.app.noHelpsYet}</p>
      )}

      {/* Account number + details: tap the first row to copy. */}
      <ul className="list">
        <CopyRow compact label={bill.holderMasked ? `${dict.bill.account} · ${bill.holderMasked}` : dict.bill.account} value={bill.accountNumber} mono dict={dict} />
        <li className="list-row min-h-12 justify-between gap-4 py-2.5">
          <span className="shrink-0 text-sm font-medium text-[var(--ink-soft)]">{dict.bill.supplier}</span>
          <span className="min-w-0 text-right text-[15px] font-bold break-words text-[var(--ink)]">{bill.supplier}</span>
        </li>
        <li className="list-row min-h-12 justify-between gap-4 py-2.5">
          <span className="shrink-0 text-sm font-medium text-[var(--ink-soft)]">{dict.bill.code}</span>
          <span className="min-w-0 text-right text-[15px] font-bold tabular-nums text-[var(--ink)]">{bill.code}</span>
        </li>
        {bill.addressMasked && (
          <li className="list-row min-h-12 justify-between gap-4 py-2.5">
            <span className="shrink-0 text-sm font-medium text-[var(--ink-soft)]">{dict.bill.address}</span>
            <span className="min-w-0 text-right text-[15px] font-bold break-words text-[var(--ink)]">{bill.addressMasked}</span>
          </li>
        )}
        {bill.meterReading !== null && meterUnit && (
          <li className="list-row min-h-12 justify-between gap-4 py-2.5">
            <span className="shrink-0 text-sm font-medium text-[var(--ink-soft)]">{dict.bill.meterReading}</span>
            <span className="min-w-0 text-right text-[15px] font-bold tabular-nums text-[var(--ink)]">
              {bill.meterReading} {meterUnit}
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
        <div className="space-y-1 rounded-2xl bg-emerald-50 px-4 py-6 text-center">
          <div className="text-4xl">🎉</div>
          <p className="text-base font-extrabold text-emerald-800">{dict.bill.thanks}</p>
        </div>
      ) : isOwner ? (
        // The family itself: no donate form (paying your own bill would put you on the
        // leaderboard); sharing the request is what actually helps.
        <div className="space-y-3 rounded-3xl bg-amber-50 px-5 py-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-amber-600 shadow-[var(--lift)]">
            <Share2 size={22} aria-hidden="true" />
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
        <div className="space-y-1 rounded-2xl bg-[var(--tone)] px-4 py-6 text-center">
          <div className="text-4xl">⏳</div>
          <p className="text-sm font-extrabold text-stone-700">{dict.donate.reserved}</p>
        </div>
      ) : null}

      {canDonate && (
        <>
          <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+68px)] z-30 md:bottom-0 -mx-4 bg-gradient-to-t from-[var(--paper)] via-[var(--paper)] to-transparent px-4 pt-6 pb-3 md:pb-[calc(env(safe-area-inset-bottom)+12px)]">
            <button
              type="button"
              disabled={providers.length === 0}
              onClick={() => setSheetOpen(true)}
              className="btn-primary min-h-[56px] w-full rounded-[18px] text-[17px]"
            >
              <Heart size={20} aria-hidden="true" />
              {dict.app.helpBtn}
            </button>
          </div>

          <BottomSheet open={sheetOpen} onClose={closeSheet} labelledBy="pick-title">
            <h2 id="pick-title" className="mb-3 text-xl font-extrabold tracking-tight text-[var(--ink)]">
              {dict.pick.title}
            </h2>

            <div className="flex items-center gap-2 rounded-[20px] bg-[var(--paper)] p-2 focus-within:ring-[3px] focus-within:ring-[var(--lamp)]">
              <button
                type="button"
                aria-label={dict.pick.less}
                onClick={() => applyAmount(amount - AMOUNT_STEP)}
                className="grid h-[46px] w-[46px] shrink-0 cursor-pointer place-items-center rounded-[14px] bg-white text-[var(--ink)] shadow-[var(--lift)] transition active:scale-95"
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
                className="grid h-[46px] w-[46px] shrink-0 cursor-pointer place-items-center rounded-[14px] bg-white text-[var(--ink)] shadow-[var(--lift)] transition active:scale-95"
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

            {/* Trust, right where the donor decides. */}
            <p className="mt-3 flex items-start gap-2.5 rounded-2xl bg-[rgba(46,154,103,0.1)] px-3.5 py-3 text-left text-[13.5px] leading-snug font-semibold text-[#1f6b47]">
              <ShieldCheck size={18} aria-hidden="true" className="mt-px shrink-0 text-[var(--hope)]" />
              <span className="min-w-0">{dict.app.directNote}</span>
            </p>

            {error && (
              <div role="alert" className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-center text-sm font-bold text-rose-700">
                {error}
              </div>
            )}

            <button
              type="button"
              disabled={paying || providers.length === 0}
              onClick={handlePay}
              className="btn-primary mt-4 min-h-[56px] w-full rounded-[18px] text-[17px]"
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
          </BottomSheet>
        </>
      )}
    </div>
  );
}
