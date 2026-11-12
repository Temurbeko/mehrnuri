"use client";

import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import type { Region, UtilityType } from "@/lib/domain";
import { findDistrict } from "@/lib/uzbekistan";
import { fmt, formatMoney, type Dictionary } from "@/i18n";
import { timeAgo } from "@/lib/format";

export interface TickerHelp {
  nickname: string;
  amount: number;
  utilityType: UtilityType;
  region: Region;
  district: string | null;
  at: string;
}

/** One line that rotates through the latest real payments: "who helped, how much, where, when". */
export function LiveTicker({ helps, dict }: { helps: TickerHelp[]; dict: Dictionary }) {
  const [i, setI] = useState(0);
  const [out, setOut] = useState(false);

  useEffect(() => {
    if (helps.length < 2) return;
    let swap: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(() => {
      setOut(true);
      swap = setTimeout(() => {
        setI((n) => (n + 1) % helps.length);
        setOut(false);
      }, 350);
    }, 3600);
    return () => {
      clearInterval(timer);
      if (swap) clearTimeout(swap);
    };
  }, [helps.length]);

  const h = helps[i % helps.length];
  if (!h) return null;
  const where = h.district ? dict.districts[findDistrict(h.region, h.district).id] : dict.region[h.region];

  return (
    <div
      aria-live="polite"
      className="mt-3 flex min-h-[64px] items-center gap-2.5 rounded-2xl bg-white px-3.5 py-2.5 text-sm shadow-[var(--lift)]"
    >
      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[rgba(46,154,103,0.12)] text-[var(--hope)]">
        <Heart size={16} aria-hidden="true" />
      </span>
      <span className={`ticker-text min-w-0 text-[var(--ink)] ${out ? "out" : ""}`}>
        <b className="font-extrabold">{h.nickname}</b> {fmt(dict.feed.helped, { amount: formatMoney(h.amount, dict) })}{" "}
        <small suppressHydrationWarning className="text-[13px] text-[var(--ink-soft)]">
          · {where} · {timeAgo(h.at, dict.time)}
        </small>
      </span>
    </div>
  );
}
