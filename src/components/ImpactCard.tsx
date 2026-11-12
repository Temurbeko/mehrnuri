"use client";

import { Share2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import { fmt, formatMoney, type Dictionary } from "@/i18n";
import { UTILITY_ICONS, type UtilityType } from "@/lib/domain";
import { BottomSheet } from "./BottomSheet";
import { ShareOptions } from "./ShareOptions";

/** "End of the month" card on the History tab, with a share sheet (no family details, amount optional). */
export function ImpactCard({
  code,
  month,
  monthText,
  families,
  total,
  utilities,
  locale,
  dict,
}: {
  code: string;
  month: string;
  monthText: string;
  families: number;
  total: number;
  utilities: UtilityType[];
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.impact;
  const [open, setOpen] = useState(false);
  const [withAmount, setWithAmount] = useState(false);
  const [origin, setOrigin] = useState("");
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => setOrigin(window.location.origin), []);

  const money = formatMoney(total, dict);
  const line = fmt(t.families, { month: monthText, count: families });
  const url = `${origin}/${locale}/i/${code}/${month}${withAmount ? "-a" : ""}`;
  const text = fmt(t.shareText, { month: monthText, count: families });

  return (
    <section className="hero-mesh rounded-[22px] p-4 text-[#f6efe3]">
      <h2 className="text-[13px] font-extrabold tracking-wide text-[var(--glow)] uppercase">{t.cardTitle}</h2>
      <p className="mt-1.5 text-[17px] leading-snug font-extrabold">{line}</p>
      <p className="mt-1 text-[14px] text-[#d2c9bb]">{fmt(t.total, { amount: money })}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span aria-hidden="true" className="flex gap-1.5 text-[20px]">
          {utilities.map((u) => (
            <span key={u}>{UTILITY_ICONS[u]}</span>
          ))}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-[38px] items-center gap-2 rounded-full bg-[var(--tone)] px-4 text-[14px] font-extrabold text-[var(--ink)]"
        >
          <Share2 size={16} aria-hidden="true" />
          {t.share}
        </button>
      </div>

      <BottomSheet open={open} onClose={close} labelledBy="impact-share-title">
        <h2 id="impact-share-title" className="text-[22px] font-extrabold tracking-tight text-[var(--ink)]">
          {t.shareTitle}
        </h2>
        <figure className="m-0 mt-3 grid gap-1 rounded-[20px] hero-mesh p-4 text-[#f6efe3]">
          <b className="text-base leading-snug break-words">{withAmount ? `${line} · ${money}` : line}</b>
          <span aria-hidden="true" className="text-[22px]">
            {utilities.map((u) => UTILITY_ICONS[u]).join(" ")}
          </span>
        </figure>
        <label className="relative mt-3 flex cursor-pointer items-center justify-between gap-3 px-0.5 py-1 text-[15px] font-bold text-[var(--ink)]">
          <span className="min-w-0">{t.showAmount}</span>
          <input
            type="checkbox"
            role="switch"
            checked={withAmount}
            onChange={(e) => setWithAmount(e.target.checked)}
            className="pointer-events-none absolute opacity-0"
          />
          <span aria-hidden="true" className="switch" />
        </label>
        <p className="mx-0.5 mt-1.5 mb-4 text-[13px] text-[var(--ink-soft)]">{t.shareNote}</p>
        <ShareOptions url={url} text={text} dict={dict} />
      </BottomSheet>
    </section>
  );
}
