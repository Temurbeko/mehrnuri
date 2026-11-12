"use client";

import { ChevronUp, MapPin, Quote } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { UTILITY_ICONS, type PublicBill } from "@/lib/domain";
import { findDistrict } from "@/lib/uzbekistan";
import { groupDigits } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";

/**
 * Home entry to the swipe feed: a small live deck of real requests. The front
 * card lifts away every few seconds and the next one comes up, so it is obvious
 * what a tap opens. One link; the whole deck is the button.
 */
export function DiscoverTeaser({ bills, locale, dict }: { bills: PublicBill[]; locale: Locale; dict: Dictionary }) {
  const t = dict.discover;
  const deck = bills.slice(0, 5);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (deck.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      if (!document.hidden) setI((n) => (n + 1) % deck.length);
    }, 3800);
    return () => clearInterval(timer);
  }, [deck.length]);

  if (deck.length === 0) return null;
  const b = deck[i % deck.length]!;
  const remaining = Math.max(0, b.amountOwed - b.paidAmount);
  const district = findDistrict(b.region, b.district);

  return (
    <Link href={`/${locale}/discover`} aria-label={t.open} className="pd group mt-4 block min-w-0">
      <div className="mb-2.5 flex items-end justify-between gap-3 px-0.5">
        <h2 className="min-w-0 text-[20px] leading-tight font-extrabold tracking-tight text-balance text-[var(--ink)]">{t.teaserTitle}</h2>
        <span className="shrink-0 pb-0.5 text-[13px] font-extrabold text-[var(--lamp-deep)]">{t.open}</span>
      </div>

      <div className="relative pt-4">
        {/* the cards waiting behind */}
        <span aria-hidden="true" className="pd-back pd-back-2" />
        <span aria-hidden="true" className="pd-back pd-back-1" />

        <div key={b.id} className="pd-front relative flex min-w-0 items-center gap-3.5 rounded-[24px] bg-[var(--night)] p-4 text-[#f6efe3]">
          <span className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[18px] bg-[rgba(255,201,79,0.16)] text-[28px]">
            {UTILITY_ICONS[b.utilityType]}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 text-[13px] font-bold text-[#cfc6b8]">
              <MapPin size={13} aria-hidden="true" className="shrink-0" />
              <span className="min-w-0 truncate">
                {dict.utility[b.utilityType]} · {dict.districts[district.id]}
              </span>
            </span>
            <b className="mt-0.5 block text-[22px] leading-tight font-extrabold whitespace-nowrap text-[var(--glow)] tabular-nums">
              {groupDigits(String(remaining))} <small className="text-[13px] font-bold text-[#e6dccb]">{dict.common.som}</small>
            </b>
            <span className="pd-story mt-0.5 block text-[13.5px] leading-snug text-[#e6dccb]">{b.story ? `“${b.story}”` : t.noStory}</span>
          </span>
          <span aria-hidden="true" className="pd-go flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full bg-[var(--glow)] text-[#3b2508]">
            <ChevronUp size={18} className="pd-chev" />
            <ChevronUp size={18} className="pd-chev pd-chev-2 -mt-3" />
          </span>
        </div>
      </div>
      <p className="mt-2 px-0.5 text-[13px] text-[var(--ink-soft)]">{t.teaserText}</p>
    </Link>
  );
}

/** A quiet line about kindness that changes every few seconds. */
export function WisdomLine({ lines, className = "" }: { lines: readonly string[]; className?: string }) {
  const [i, setI] = useState(0);
  const [out, setOut] = useState(false);
  useEffect(() => {
    if (lines.length < 2) return;
    let swap: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(() => {
      setOut(true);
      swap = setTimeout(() => {
        setI((n) => (n + 1) % lines.length);
        setOut(false);
      }, 400);
    }, 6500);
    return () => {
      clearInterval(timer);
      if (swap) clearTimeout(swap);
    };
  }, [lines.length]);

  return (
    <figure className={`m-0 flex min-h-[92px] flex-col items-center justify-center px-4 text-center ${className}`}>
      <Quote size={20} aria-hidden="true" className="text-[var(--lamp)]" />
      <blockquote className={`ticker-text m-0 mt-1.5 max-w-[30ch] text-[17px] leading-snug font-extrabold text-balance text-[var(--ink)] ${out ? "out" : ""}`}>
        {lines[i % lines.length]}
      </blockquote>
    </figure>
  );
}
