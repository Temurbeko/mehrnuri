"use client";

import { ArrowDownUp, Check, Search, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { UTILITY_ICONS, UTILITY_TYPES, type PublicBill, type Region, type UtilityType } from "@/lib/domain";
import type { Locale } from "@/i18n/config";
import { fmt, type Dictionary } from "@/i18n";
import { BillCard } from "./BillCard";
import { RegionPicker } from "./RegionPicker";
import { findDistrict } from "@/lib/uzbekistan";
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
  const [query, setQuery] = useState("");

  // Back to the first page whenever the list is filtered or re-sorted.
  useEffect(() => {
    setVisible(PAGE);
  }, [utilityFilter, regionFilter, sort, query]);
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

  // Search: request code, account number, district/region, utility, the family's own words.
  const norm = (v: string) => v.toLowerCase().replace(/[`'ʻʼ‘’]/g, "").replace(/\s+/g, " ").trim();
  const q = norm(query);
  const qDigits = query.replace(/\D/g, "");
  const filtered = bills.filter((b) => {
    if (utilityFilter !== "all" && b.utilityType !== utilityFilter) return false;
    if (regionFilter !== "all" && b.region !== regionFilter) return false;
    if (!q) return true;
    if (qDigits.length >= 3 && b.accountNumber.includes(qDigits)) return true;
    const hay = norm(
      [b.code, dict.districts[findDistrict(b.region, b.district).id], dict.region[b.region], dict.utility[b.utilityType], dict.utilityBill[b.utilityType], b.story ?? "", b.familyName ?? ""].join(" "),
    );
    return q.split(" ").every((word) => hay.includes(word));
  });
  const filtersOn = q !== "" || utilityFilter !== "all" || regionFilter !== "all";
  function resetFilters() {
    setQuery("");
    setUtilityFilter("all");
    setRegionFilter("all");
  }

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
      <div className="flex items-end justify-between gap-3">
        <h2 className="min-w-0 text-[22px] font-extrabold tracking-tight text-[var(--ink)]">{dict.home.feedTitle}</h2>
        <span className="shrink-0 pb-1 text-[13px] font-bold whitespace-nowrap text-[var(--ink-soft)]">
          {fmt(dict.feed.familiesCount, { count: filtered.length })}
        </span>
      </div>

      {/* Find a request: search, where, in what order. One row on desktop. */}
      <div className="mt-3 mb-3 grid min-w-0 gap-2.5 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        <div className="flex min-w-0 gap-2">
          <label className="search-field min-w-0 flex-1">
            <Search size={19} aria-hidden="true" className="shrink-0 text-[var(--ink-soft)]" />
            <input
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={dict.feed.searchPlaceholder}
              aria-label={dict.feed.searchPlaceholder}
            />
            {query !== "" && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={dict.feed.searchClear}
                className="-mr-1.5 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--ink-soft)] active:bg-[var(--tone)]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </label>
          <button
            type="button"
            onClick={() => setSortOpen(true)}
            aria-label={`${dict.ux.sortLabel}: ${sortLabels[sort]}`}
            aria-haspopup="dialog"
            title={sortLabels[sort]}
            className="flex h-[52px] w-[52px] shrink-0 cursor-pointer items-center justify-center rounded-[18px] bg-white text-[var(--ink)] shadow-[var(--lift)] transition active:scale-95"
          >
            <ArrowDownUp size={19} aria-hidden="true" />
          </button>
        </div>
        <RegionPicker value={regionFilter} onChange={setRegionFilter} counts={regionCounts} total={totalOpen} dict={dict} />
      </div>

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
          <p className="mx-auto max-w-[32ch] px-4 text-sm font-bold text-stone-600">{filtersOn ? dict.feed.noResults : dict.home.empty}</p>
          {filtersOn && (
            <button type="button" onClick={resetFilters} className="btn-tonal mx-auto mt-2 w-auto px-5">
              {dict.feed.resetFilters}
            </button>
          )}
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
