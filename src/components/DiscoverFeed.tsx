"use client";

import { ChevronDown, ChevronUp, Heart, MapPin, Quote, Share2, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { UTILITY_ICONS, type PublicBill, type UtilityType } from "@/lib/domain";
import { findDistrict } from "@/lib/uzbekistan";
import { groupDigits, timeAgo } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import { fmt, type Dictionary } from "@/i18n";
import { BottomSheet } from "./BottomSheet";
import { ShareOptions } from "./ShareOptions";

/** The glow behind each request: what the money turns back on. */
const GLOW: Record<UtilityType, string> = {
  electricity: "255, 190, 70",
  gas: "255, 130, 70",
  water: "80, 170, 255",
  heating: "255, 110, 90",
  hot_water: "255, 140, 110",
  waste: "70, 200, 140",
};

type Slide = { kind: "bill"; bill: PublicBill } | { kind: "wisdom"; text: string } | { kind: "end" };

/**
 * One family per screen, swiped vertically (CSS scroll-snap: no library, works
 * with touch, wheel and keyboard). Every fourth screen is a quiet line about
 * kindness; the last one invites to share.
 */
export function DiscoverFeed({ bills, locale, dict }: { bills: PublicBill[]; locale: Locale; dict: Dictionary }) {
  const t = dict.discover;
  const slides: Slide[] = [];
  bills.forEach((bill, i) => {
    slides.push({ kind: "bill", bill });
    if ((i + 1) % 3 === 0 && i < bills.length - 1) {
      slides.push({ kind: "wisdom", text: dict.wisdom[Math.floor(i / 3) % dict.wisdom.length]! });
    }
  });
  slides.push({ kind: "end" });

  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [shareBill, setShareBill] = useState<PublicBill | null>(null);
  const closeShare = useCallback(() => setShareBill(null), []);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  // Drawn straight under <body>, above the page, its footer and its bars.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Which screen is in view (for the counter and the keyboard / arrow buttons).
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setIndex(Number((e.target as HTMLElement).dataset.i));
        }
      },
      { root: el, threshold: 0.6 },
    );
    el.querySelectorAll("[data-i]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [slides.length, mounted]);

  const go = useCallback((to: number) => {
    const el = trackRef.current;
    if (!el) return;
    const n = Math.max(0, Math.min(to, el.children.length - 1));
    (el.children[n] as HTMLElement | undefined)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        go(index + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        go(index - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  // The page behind must not scroll while the feed is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const billCount = bills.length;
  const current = slides[index];
  const position = current?.kind === "bill" ? bills.indexOf(current.bill) + 1 : null;

  if (!mounted) return <div className="fixed inset-0 z-50 bg-[var(--night)]" />;

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-[var(--night)] text-[#f6efe3]">
      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto flex max-w-md items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <Link
          href={`/${locale}`}
          aria-label={t.close}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(255,255,255,0.12)] backdrop-blur"
        >
          <X size={22} aria-hidden="true" />
        </Link>
        {position !== null && (
          <span className="rounded-full bg-[rgba(255,255,255,0.12)] px-3 py-1.5 text-[13px] font-extrabold tabular-nums backdrop-blur">
            {position} / {billCount}
          </span>
        )}
        <span className="w-11" />
      </div>

      {/* desktop arrows */}
      <div className="absolute top-1/2 right-[max(16px,calc(50%-300px))] z-10 hidden -translate-y-1/2 flex-col gap-2 md:flex">
        <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label={t.prev} className="dv-arrow">
          <ChevronUp size={22} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => go(index + 1)} disabled={index >= slides.length - 1} aria-label={t.next} className="dv-arrow">
          <ChevronDown size={22} aria-hidden="true" />
        </button>
      </div>

      <div ref={trackRef} className="dv-track">
        {slides.map((s, i) => {
          if (s.kind === "wisdom") {
            return (
              <section key={`w${i}`} data-i={i} className="dv-slide">
                <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center px-8 text-center">
                  <Quote size={34} aria-hidden="true" className="text-[var(--glow)] opacity-80" />
                  <p className="mt-5 text-[28px] leading-[1.2] font-extrabold tracking-tight text-balance">{s.text}</p>
                  <span className="mt-6 text-[13px] font-extrabold tracking-[0.18em] text-[var(--glow)] uppercase">MehrNuri</span>
                </div>
              </section>
            );
          }
          if (s.kind === "end") {
            return (
              <section key="end" data-i={i} className="dv-slide">
                <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-3 px-8 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(255,201,79,0.16)] text-[var(--glow)]">
                    <Heart size={30} aria-hidden="true" />
                  </span>
                  <h2 className="mt-1 text-[26px] leading-tight font-extrabold tracking-tight text-balance">
                    {billCount === 0 ? t.empty : t.endTitle}
                  </h2>
                  <p className="text-[15px] leading-snug text-[#cfc6b8]">{t.endText}</p>
                  <Link href={`/${locale}`} className="btn-primary mt-3 w-full">
                    {t.backHome}
                  </Link>
                </div>
              </section>
            );
          }

          const b = s.bill;
          const remaining = Math.max(0, b.amountOwed - b.paidAmount);
          const pct = Math.min(100, Math.round((b.paidAmount / Math.max(1, b.amountOwed)) * 100));
          const district = findDistrict(b.region, b.district);
          const helpers = b.helpers?.count ?? 0;
          const checked = b.trustLevel === "donor_checked" || b.trustLevel === "proven";
          return (
            <section
              key={b.id}
              data-i={i}
              className="dv-slide"
              style={{
                background: `radial-gradient(120% 60% at 50% 0%, rgba(${GLOW[b.utilityType]}, 0.30), transparent 70%), radial-gradient(90% 40% at 50% 100%, rgba(${GLOW[b.utilityType]}, 0.14), transparent 70%)`,
              }}
            >
              <div className="mx-auto flex h-full max-w-md flex-col px-6 pt-[calc(env(safe-area-inset-top)+76px)] pb-[calc(env(safe-area-inset-bottom)+20px)]">
                {/* what and where */}
                <div className="flex items-center gap-3.5">
                  <span
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] text-[32px]"
                    style={{ background: `rgba(${GLOW[b.utilityType]}, 0.22)`, boxShadow: `0 0 40px rgba(${GLOW[b.utilityType]}, 0.35)` }}
                  >
                    {UTILITY_ICONS[b.utilityType]}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-[22px] leading-tight font-extrabold tracking-tight break-words">{dict.utilityBill[b.utilityType]}</h2>
                    <p className="mt-1 flex items-center gap-1 text-[14px] font-bold text-[#cfc6b8]">
                      <MapPin size={14} aria-hidden="true" className="shrink-0" />
                      <span suppressHydrationWarning className="min-w-0 truncate">
                        {dict.districts[district.id]} · {timeAgo(b.createdAt, dict.time)}
                      </span>
                    </p>
                  </div>
                </div>

                {/* the family's own words */}
                <div className="flex min-h-0 flex-1 flex-col justify-center py-4">
                  {b.story ? (
                    <>
                      <p className="text-[12.5px] font-extrabold tracking-[0.14em] text-[var(--glow)] uppercase">{t.familyWrote}</p>
                      <blockquote className="dv-story m-0 mt-2 text-[22px] leading-[1.3] font-bold text-balance break-words">“{b.story}”</blockquote>
                      {b.familyName && <p className="mt-2 text-[14px] font-bold text-[#cfc6b8]">— {b.familyName}</p>}
                    </>
                  ) : (
                    <p className="text-[22px] leading-[1.3] font-bold text-balance text-[#e6dccb]">{t.noStory}</p>
                  )}
                </div>

                {/* how much is left */}
                <div>
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[40px] leading-none font-extrabold tracking-tight whitespace-nowrap text-[var(--glow)] tabular-nums">
                        {groupDigits(String(remaining))} <small className="text-[16px] font-bold text-[#e6dccb]">{dict.common.som}</small>
                      </div>
                      <div className="mt-1.5 text-[14px] font-bold text-[#cfc6b8]">{t.needed}</div>
                    </div>
                    {checked && (
                      <span className="mb-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-[rgba(46,154,103,0.22)] px-2.5 py-1 text-[12.5px] font-extrabold text-[#8fe0b6]">
                        <ShieldCheck size={14} aria-hidden="true" />
                        {b.trustLevel === "proven" ? dict.check.badgeProven : dict.check.badgeChecked}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.14)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--lamp),#ffc04d)]" style={{ width: `${Math.max(pct, b.paidAmount > 0 ? 4 : 0)}%` }} />
                  </div>
                  <p className="mt-2 flex items-center justify-between gap-3 text-[13.5px] font-bold text-[#cfc6b8]">
                    <span className="min-w-0 truncate">{helpers > 0 ? fmt(t.helpers, { count: helpers }) : t.firstHelper}</span>
                    <span className="shrink-0 tabular-nums">{fmt(t.collected, { pct })}</span>
                  </p>

                  <div className="mt-4 flex gap-2.5">
                    <Link href={`/${locale}/bill/${b.id}?help=1`} className="btn-primary min-h-[56px] min-w-0 flex-1 rounded-[18px] text-[17px]">
                      <Heart size={20} aria-hidden="true" />
                      {t.help}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setShareBill(b)}
                      aria-label={dict.bill.share}
                      className="flex h-[56px] w-[56px] shrink-0 cursor-pointer items-center justify-center rounded-[18px] bg-[rgba(255,255,255,0.12)]"
                    >
                      <Share2 size={22} aria-hidden="true" />
                    </button>
                  </div>

                  <button type="button" onClick={() => go(i + 1)} className={`dv-hint ${i === 0 ? "dv-hint-on" : ""}`}>
                    <ChevronUp size={18} aria-hidden="true" />
                    {t.swipeHint}
                  </button>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <BottomSheet open={shareBill !== null} onClose={closeShare} labelledBy="dv-share-title">
        <h2 id="dv-share-title" className="mb-1 text-[22px] font-extrabold tracking-tight text-[var(--ink)]">
          {dict.shareTo.title}
        </h2>
        <p className="mb-4 text-[14px] text-[var(--ink-soft)]">{dict.shareTo.billText}</p>
        {shareBill && <ShareOptions url={`${origin}/${locale}/bill/${shareBill.id}`} text={dict.shareTo.billText} dict={dict} />}
      </BottomSheet>
    </div>,
    document.body,
  );
}
