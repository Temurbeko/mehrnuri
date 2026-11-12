"use client";

import { Check, Copy, Heart, Home, Lightbulb, Minus, Plus, Share2, ShieldCheck, Smartphone, TrendingDown } from "lucide-react";
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
import { ShareOptions } from "./ShareOptions";
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
  // Coming from the swipe feed ("?help=1"): the amount picker opens straight away.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("help") === "1") setSheetOpen(true);
  }, []);

  /** Opens the share options (Telegram, WhatsApp, copy, the phone's own menu). */
  const [shareOpen, setShareOpen] = useState(false);
  const closeShare = useCallback(() => setShareOpen(false), []);
  const [pageUrl, setPageUrl] = useState("");
  useEffect(() => setPageUrl(window.location.href), []);
  function shareRequest() {
    setShareOpen(true);
  }
  const [error, setError] = useState<string | null>(null);

  /** "Qarzim kamaydi": the owner lowers the debt shown (paid outside the app). */
  const [familyOpen, setFamilyOpen] = useState(false);
  const closeFamily = useCallback(() => setFamilyOpen(false), []);
  const [familyInput, setFamilyInput] = useState("");
  const [familySending, setFamilySending] = useState(false);
  const [familyError, setFamilyError] = useState<string | null>(null);
  const [familySaved, setFamilySaved] = useState(false);
  async function sendRemaining(value: number) {
    setFamilyError(null);
    setFamilySending(true);
    const res = await api<{ bill?: PublicBill }>(`/api/bills/${bill.id}/remaining`, { body: { remaining: value } });
    setFamilySending(false);
    if (!res.ok) {
      setFamilyError(errorText(res.data.error, dict, res.data.details));
      return;
    }
    if (res.data.bill) setBill(res.data.bill);
    setFamilyOpen(false);
    setFamilyInput("");
    setFamilySaved(true);
    window.setTimeout(() => setFamilySaved(false), 4000);
    router.refresh();
  }

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
    <div className="pb-2">
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

      <BottomSheet open={shareOpen} onClose={closeShare} labelledBy="share-bill-title">
        <h2 id="share-bill-title" className="mb-1 text-[22px] font-extrabold tracking-tight text-[var(--ink)]">
          {dict.shareTo.title}
        </h2>
        <p className="mb-4 text-[14px] text-[var(--ink-soft)]">{dict.shareTo.billText}</p>
        <ShareOptions url={pageUrl} text={dict.shareTo.billText} dict={dict} />
      </BottomSheet>

      {/* Phone: one column. Desktop: the request on the left, how to pay on the right. */}
      <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_340px] md:items-start md:gap-6">
      <div className="min-w-0 space-y-4 md:col-start-1 md:row-start-1">
      {isOwner && (
        // The family itself: no donate form (paying your own bill would put you on the
        // leaderboard); sharing the request is what actually helps.
        <section className="flex min-w-0 flex-col gap-3 rounded-[20px] bg-[rgba(246,166,35,0.16)] p-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white text-[var(--lamp-deep)] shadow-[var(--lift)]">
              <Share2 size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[17px] leading-snug font-extrabold text-[var(--ink)]">{dict.ux.ownerTitle}</p>
              <p className="mt-0.5 text-[15px] leading-snug text-[var(--ink-soft)]">{dict.ux.ownerText}</p>
            </div>
          </div>
          <button type="button" onClick={shareRequest} className="btn-primary w-full">
            <Share2 size={18} aria-hidden="true" />
            {shared ? dict.bill.linkCopied : dict.bill.share}
          </button>
          {familySaved && (
            <p role="status" className="text-center text-[14px] font-bold text-[var(--hope)]">
              {dict.familyUpdate.saved}
            </p>
          )}
          {bill.fundingStatus !== "fully_paid" && bill.payoutStatus !== "paid_out" && (
            <button type="button" onClick={() => setFamilyOpen(true)} className="btn-tonal w-full">
              <TrendingDown size={18} aria-hidden="true" />
              {dict.familyUpdate.button}
            </button>
          )}
        </section>
      )}

      {isOwner && (
        <BottomSheet open={familyOpen} onClose={closeFamily} labelledBy="family-update-title">
          <h2 id="family-update-title" className="mb-1 text-[22px] font-extrabold tracking-tight text-[var(--ink)]">
            {dict.familyUpdate.title}
          </h2>
          <p className="mb-4 text-[14px] text-[var(--ink-soft)]">{dict.familyUpdate.text}</p>
          <label htmlFor="family-remaining" className="mb-1.5 block text-[13px] font-extrabold text-[var(--ink-soft)]">
            {dict.familyUpdate.label}
          </label>
          <input
            id="family-remaining"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={groupDigits(familyInput)}
            onChange={(e) => setFamilyInput(digitsOnly(e.target.value, 9))}
            className="w-full rounded-[16px] border-0 bg-[var(--paper)] px-4 py-3 text-[22px] font-extrabold tracking-tight text-[var(--ink)] outline-none focus:ring-[3px] focus:ring-[var(--lamp)]"
          />
          {familyError && (
            <div role="alert" className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-center text-sm font-bold text-rose-700">
              {familyError}
            </div>
          )}
          <button
            type="button"
            disabled={familyInput === "" || familySending}
            onClick={() => void sendRemaining(Number(familyInput))}
            className="btn-primary mt-4 w-full"
          >
            {dict.familyUpdate.save}
          </button>
          <button type="button" disabled={familySending} onClick={() => void sendRemaining(0)} className="btn-ghost mt-2 w-full">
            {dict.familyUpdate.allPaid}
          </button>
          <p className="mt-1.5 text-center text-[12.5px] text-[var(--ink-soft)]">{dict.familyUpdate.allPaidNote}</p>
        </BottomSheet>
      )}

      {/* The request at a glance: where, how much is left, how far along, who helps. */}
      <section className="surface min-w-0 p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <UtilityTile type={bill.utilityType} />
          <div className="min-w-0 flex-1">
            <p className="text-[16px] leading-snug font-extrabold break-words text-[var(--ink)]">
              {dict.districts[districtInfo.id]}
              <span className="font-bold text-[var(--ink-soft)]"> · {dict.region[bill.region]}</span>
            </p>
            <p suppressHydrationWarning className="mt-0.5 text-[13px] font-bold text-[var(--ink-soft)]">
              {timeAgo(bill.createdAt, dict.time)} · {bill.code}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {approved && bill.fundingStatus !== "fully_paid" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(246,166,35,0.14)] px-2.5 py-1 text-[12px] font-extrabold tracking-wide text-[var(--lamp-deep)] uppercase">
              <span aria-hidden="true" className="lamp-dot" />
              {dict.ux.asking}
            </span>
          )}
          {reviewBadge}
          {bill.trustLevel !== "new" && <TrustBadge bill={bill} dict={dict} />}
          {bill.verified && (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
              <Check size={12} aria-hidden="true" />
            </span>
          )}
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[34px] leading-none font-extrabold tracking-tight whitespace-nowrap text-[var(--ink)] tabular-nums">
              {groupDigits(String(remaining))} <small className="text-[15px] font-bold text-[var(--ink-soft)]">{dict.common.som}</small>
            </div>
            <div className="mt-1 text-[13px] font-bold text-[var(--ink-soft)]">{dict.ux.needed}</div>
          </div>
          <div className="shrink-0 pb-0.5 text-right">
            <div className="text-[15px] font-extrabold text-[var(--lamp-deep)] tabular-nums">{fmt(dict.details.progressValue, { pct })}</div>
            <div className="text-[12.5px] font-bold whitespace-nowrap text-[var(--ink-soft)]">
              {fmt(dict.app.ofTotal, { total: groupDigits(String(bill.amountOwed)) })}
            </div>
          </div>
        </div>
        <div
          className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[var(--tone)]"
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

        <div className="mt-3 flex min-w-0 items-center">
          <HelpersLine bill={bill} dict={dict} />
        </div>
        {bill.familyPaid > 0 && (
          <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
            {fmt(dict.familyUpdate.publicNote, { amount: formatMoney(bill.familyPaid, dict) })}
          </p>
        )}
      </section>

      {bill.story && (
        <div className="min-w-0 pb-2">
          <blockquote className="bubble m-0 min-w-0 p-4 text-[15px] leading-snug text-[var(--ink)]">
            <p className="mb-1.5 text-[13px] font-extrabold tracking-wide text-[var(--ink-soft)] uppercase">{dict.ux.familyWrote}</p>
            <p className={`m-0 break-words ${storyOpen ? "" : "story-clamp"}`}>{bill.story}</p>
            <footer className="mt-2 flex min-w-0 items-center justify-between gap-3 text-[13px] font-bold text-[var(--ink-soft)]">
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
        </div>
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

      {/* Everything needed to pay: the account (tap to copy), the steps, the button. */}
      <aside className="min-w-0 space-y-4 md:sticky md:top-24 md:col-start-2 md:row-span-2 md:row-start-1">
        <ul className="list">
          <CopyRow compact label={bill.holderMasked ? `${dict.bill.account} · ${bill.holderMasked}` : dict.bill.account} value={bill.accountNumber} mono dict={dict} />
          <li className="list-row min-h-12 justify-between gap-4 py-2.5">
            <span className="shrink-0 text-sm font-medium text-[var(--ink-soft)]">{dict.bill.supplier}</span>
            <span className="min-w-0 text-right text-[15px] font-bold break-words text-[var(--ink)]">{bill.supplier}</span>
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

        {canDonate && (
          <section aria-label={dict.ux.howTitle} className="surface min-w-0 p-4">
            <h3 className="text-[13px] font-extrabold tracking-wide text-[var(--ink-soft)] uppercase">{dict.ux.howTitle}</h3>
            <ol className="m-0 mt-3 grid list-none gap-3 p-0">
              {[
                { Icon: Copy, text: dict.ux.howCopy },
                { Icon: Smartphone, text: dict.ux.howPay },
                { Icon: Home, text: dict.ux.howDirect },
              ].map(({ Icon, text }, i) => (
                <li key={i} className="flex min-w-0 items-center gap-3">
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--tone)] text-[var(--lamp-deep)]">
                    <Icon size={17} aria-hidden="true" />
                    <span
                      aria-hidden="true"
                      className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--ink)] text-[10px] font-extrabold text-[var(--paper)]"
                    >
                      {i + 1}
                    </span>
                  </span>
                  <span className="min-w-0 text-[14.5px] leading-snug font-bold text-[var(--ink)]">{text}</span>
                </li>
              ))}
            </ol>
          </section>
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
        ) : !isOwner && bill.available <= 0 ? (
          // Not paid yet: other donors have the rest reserved and are paying now.
          <div className="space-y-1 rounded-2xl bg-[var(--tone)] px-4 py-6 text-center">
            <div className="text-4xl">⏳</div>
            <p className="text-sm font-extrabold text-stone-700">{dict.donate.reserved}</p>
          </div>
        ) : null}

        {canDonate && (
          <button
            type="button"
            disabled={providers.length === 0}
            onClick={() => setSheetOpen(true)}
            className="btn-primary hidden min-h-[56px] w-full rounded-[18px] text-[17px] md:flex"
          >
            <Heart size={20} aria-hidden="true" />
            {dict.app.helpBtn}
          </button>
        )}
      </aside>

      {/* Latest helps: who, how much, when. Full names, no truncated chips. */}
      <div className="min-w-0 space-y-4 md:col-start-1 md:row-start-2">
        {helpers3.length > 0 ? (
          <section className="surface min-w-0 p-4">
            <h3 className="text-[13px] font-extrabold tracking-wide text-[var(--ink-soft)] uppercase">{dict.pick.recentTitle}</h3>
            <ul className="m-0 mt-2 list-none divide-y divide-[var(--tone)] p-0">
              {helpers3.map((h, i) => (
                <li key={`${h.at}-${i}`} className="flex min-w-0 items-center gap-3 py-2.5">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--glow)] text-sm font-extrabold text-[#3b2508]"
                  >
                    {(h.nickname.trim()[0] ?? "?").toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[14.5px] leading-tight text-[var(--ink)]">{h.nickname}</b>
                    <small suppressHydrationWarning className="block text-[12.5px] font-bold text-[var(--ink-soft)]">
                      {timeAgo(h.at, dict.time)}
                    </small>
                  </span>
                  <span className="shrink-0 text-[14.5px] font-extrabold whitespace-nowrap text-[var(--hope)] tabular-nums">
                    +{formatMoney(h.amount, dict)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="mx-0.5 text-[13px] font-semibold text-[var(--ink-soft)]">{dict.app.noHelpsYet}</p>
        )}

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
      </div>
      </div>

      {canDonate && (
        <>
          {/* Spacer so the pinned button never covers the last row. */}
          <div aria-hidden="true" className="h-20 md:hidden" />
          <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+68px)] z-30 bg-gradient-to-t from-[var(--paper)] via-[var(--paper)] to-transparent pt-6 pb-3 md:hidden">
            <div className="pointer-events-auto mx-auto max-w-lg px-4">
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
