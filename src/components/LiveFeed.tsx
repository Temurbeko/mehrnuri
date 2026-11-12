"use client";

import { ArrowDownUp, Check, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { UTILITY_ICONS, UTILITY_TYPES, type PublicBill, type Region, type UtilityType } from "@/lib/domain";
import type { Locale } from "@/i18n/config";
import { fmt, type Dictionary } from "@/i18n";
import { BillCard } from "./BillCard";
import { RegionPicker } from "./RegionPicker";
import { BottomSheet } from "./BottomSheet";

const SORTS = ["oldest", "newest", "least", "largest"] as const;
type Sort = (typeof SORTS)[number];
const PAGE = 12;
const SORT_KEY ="mehrnuri-feed-sort";

export function LiveFeed({
  initialBills,
  regionCounts,
  locale,
  dict,
}: {
  initialBills: PublicBill[];
  /** Open requests per region (for the region picker). */
  regionCounts: Partial<Record<Region, number>>;
  locale: Locale;
  dict: Dictionary;
}) {
  const [bills, setBills] = useState<PublicBill[]>(initialBills);
  const [utilityFilter, setUtilityFilter] = useState<UtilityType | "all">("all");
  const [regionFilter, setRegionFilter] = useState<Region | "all">("all");
  const [sort, setSort] = useState<Sort>("oldest");
  const [visible, setVisible] = useState(PAGE);
  const [sortOpen, setSortOpen] = useState(false);

  // Back to the first page whenever the list is filtered or re-sorted.
  useEffect(() => {
    setVisible(PAGE);
  }, [utilityFilter, regionFilter, sort]);
  const closeSort = useCallback(() => setSortOpen(false), []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SORT_KEY);
      if (saved && (SORTS as readonly string[]).includes(saved)) setSort(saved as Sort);
    } catch {
      /* storage unavailable */
    }
  }, []);

  function chooseSort(next: Sort) {
    setSort(next);
    setSortOpen(false);
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }

  useEffect(() => {
    setBills(initialBills);
  }, [initialBills]);

  useEffect(() => {
    const es = new EventSource("/api/bills/stream");
    const onBills = (ev: MessageEvent<string>) => {
      try {
        const updated = JSON.parse(ev.data) as PublicBill[];
        setBills((prev) => {
          const map = new Map(prev.map((b) => [b.id, b]));
          for (const u of updated) {
            map.set(u.id, u);
          }
          return Array.from(map.values());
        });
      } catch {
        /* ignore malformed event */
      }
    };
    es.addEventListener("bills", onBills as EventListener);
    return () => es.close();
  }, []);

  const filtered = bills.filter((b) => {
    if (utilityFilter !== "all" && b.utilityType !== utilityFilter) return false;
    if (regionFilter !== "all" && b.region !== regionFilter) return false;
    return true;
  });

  const left = (b: PublicBill) => Math.max(0, b.amountOwed - b.paidAmount);
  const created = (b: PublicBill) => new Date(b.createdAt).getTime();
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "oldest") return created(a) - created(b);
    if (sort === "least") return left(a) - left(b) || created(b) - created(a);
    if (sort === "largest") return left(b) - left(a) || created(b) - created(a);
    return created(b) - created(a);
  });
  const sortLabels: Record<Sort, string> = {
    newest: dict.ux.sortNewest,
    oldest: dict.ux.sortOldest,
    least: dict.ux.sortLeast,
    largest: dict.ux.sortLargest,
  };

  const totalOpen = Object.values(regionCounts).reduce((sum, n) => sum + (n ?? 0), 0);

  return (
    <section id="feed" className="min-w-0 scroll-mt-20">
      <h2 className="min-w-0 text-[22px] font-extrabold tracking-tight text-[var(--ink)]">{dict.home.feedTitle}</h2>
      <div className="mt-1 mb-4 flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-[13px] font-bold text-[var(--ink-soft)]">
          {fmt(dict.feed.familiesCount, { count: filtered.length })}
        </span>
        <button
          type="button"
          onClick={() => setSortOpen(true)}
          aria-label={dict.ux.sortLabel}
          aria-haspopup="dialog"
          className="chip max-w-[60%] shrink-0 cursor-pointer"
        >
          <ArrowDownUp size={15} aria-hidden="true" className="shrink-0" />
          <span className="min-w-0 truncate">{sortLabels[sort]}</span>
        </button>
      </div>

      <RegionPicker value={regionFilter} onChange={setRegionFilter} counts={regionCounts} total={totalOpen} dict={dict} />

      <div className="relative">
        <div
          role="group"
          aria-label={dict.ask.utility}
          className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 pt-0.5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          <button
            type="button"
            aria-pressed={utilityFilter === "all"}
            onClick={() => setUtilityFilter("all")}
            className={utilityFilter === "all" ? "chip-active" : "chip"}
          >
            {dict.feed.filterAll}
          </button>
          {UTILITY_TYPES.map((u) => {
            const active = utilityFilter === u;
            return (
              <button
                key={u}
                type="button"
                aria-pressed={active}
                onClick={() => setUtilityFilter(active ? "all" : u)}
                className={active ? "chip-active" : "chip"}
              >
                <span aria-hidden="true">{UTILITY_ICONS[u]}</span>
                <span>{dict.utility[u]}</span>
              </button>
            );
          })}
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 -right-4 w-10 bg-gradient-to-r from-transparent to-[var(--paper)] sm:hidden" />
      </div>

      {filtered.length === 0 ? (
        <div className="card mt-4 space-y-2 py-12 text-center">
          <Sparkles size={32} aria-hidden="true" className="mx-auto text-amber-500" />
          <p className="text-sm font-bold text-stone-600">{dict.home.empty}</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {sorted.slice(0, visible).map((bill) => (
            <BillCard key={bill.id} bill={bill} locale={locale} dict={dict} />
          ))}
        </div>
      )}
      {sorted.length > visible && (
        <button type="button" onClick={() => setVisible((n) => n + PAGE)} className="btn-tonal mt-4 w-full">
          {fmt(dict.ux2.showMore, { count: sorted.length - visible })}
        </button>
      )}

      <BottomSheet open={sortOpen} onClose={closeSort} labelledBy="sort-title">
        <h2 id="sort-title" className="mb-2 text-[22px] font-extrabold tracking-tight text-[var(--ink)]">
          {dict.ux.sortLabel}
        </h2>
        <ul className="list m-0">
          {SORTS.map((o) => (
            <li key={o}>
              <button
                type="button"
                role="radio"
                aria-checked={sort === o}
                onClick={() => chooseSort(o)}
                className="list-row-tap flex w-full min-w-0 cursor-pointer items-center justify-between gap-3 text-left"
              >
                <span className="min-w-0 truncate text-[15px] font-bold text-[var(--ink)]">{sortLabels[o]}</span>
                {sort === o && <Check size={18} aria-hidden="true" className="shrink-0 text-[var(--hope)]" />}
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </section>
  );
}
