"use client";

import { ArrowRight, Quote } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { UTILITY_ICONS, type UtilityType } from "@/lib/domain";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";

/** Home entry to the swipe feed: a fanned stack of the first requests, one tap opens it. */
export function DiscoverTeaser({ types, locale, dict }: { types: UtilityType[]; locale: Locale; dict: Dictionary }) {
  const t = dict.discover;
  const stack = types.slice(0, 3);
  if (stack.length === 0) return null;
  return (
    <Link
      href={`/${locale}/discover`}
      className="group mt-3 flex min-w-0 items-center gap-4 rounded-[24px] bg-[var(--night)] p-4 text-[#f6efe3] shadow-[var(--lift)] transition active:scale-[0.99]"
    >
      <span aria-hidden="true" className="relative h-[72px] w-[64px] shrink-0">
        {stack.map((type, i) => (
          <span
            key={i}
            className="dt-card absolute inset-0 flex items-center justify-center rounded-[16px] text-[26px]"
            style={{ ["--i" as string]: i, zIndex: 3 - i }}
          >
            {UTILITY_ICONS[type]}
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[17px] leading-snug font-extrabold text-balance">{t.teaserTitle}</b>
        <span className="mt-0.5 block text-[13.5px] leading-snug text-[#cfc6b8]">{t.teaserText}</span>
      </span>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--glow)] text-[#3b2508] transition-transform group-hover:translate-x-0.5">
        <ArrowRight size={20} aria-hidden="true" />
      </span>
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
