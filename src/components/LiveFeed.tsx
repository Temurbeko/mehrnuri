"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { UTILITY_ICONS, UTILITY_TYPES, type PublicBill, type Region, type UtilityType } from "@/lib/domain";
import type { Locale } from "@/i18n/config";
import { fmt, type Dictionary } from "@/i18n";
import { BillCard } from "./BillCard";
import { RegionPicker } from "./RegionPicker";

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

  const totalOpen = Object.values(regionCounts).reduce((sum, n) => sum + (n ?? 0), 0);

  return (
    <section id="feed" className="min-w-0 scroll-mt-20">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="min-w-0 text-[22px] font-extrabold tracking-tight text-[var(--ink)]">{dict.home.feedTitle}</h2>
        <span className="shrink-0 text-sm font-bold whitespace-nowrap text-[var(--ink-soft)]">
          {fmt(dict.feed.familiesCount, { count: filtered.length })}
        </span>
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
          {filtered.map((bill) => (
            <BillCard key={bill.id} bill={bill} locale={locale} dict={dict} />
          ))}
        </div>
      )}
    </section>
  );
}
