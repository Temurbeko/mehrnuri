"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { REGIONS, UTILITY_ICONS, UTILITY_TYPES, type PublicBill, type Region, type UtilityType } from "@/lib/domain";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";
import { BillCard } from "./BillCard";
import { Combobox } from "./Combobox";

export function LiveFeed({
  initialBills,
  locale,
  dict,
}: {
  initialBills: PublicBill[];
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

  const countByUtility = (u: UtilityType) => bills.filter((b) => b.utilityType === u).length;

  return (
    <section id="feed" className="min-w-0 space-y-3 scroll-mt-20">
      {/* Section Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className="truncate text-lg font-extrabold tracking-tight text-stone-900 sm:text-2xl">
            {dict.home.feedTitle}
          </h2>
          <span className="shrink-0 rounded-full bg-[var(--tone)] px-2.5 py-0.5 text-xs font-extrabold text-stone-700">
            {filtered.length}
          </span>
        </div>

        <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700">
          <span className="relative h-2 w-2 rounded-full bg-emerald-500 live-dot" />
          {dict.bill.live}
        </span>
      </div>

      {/* Region + category chips in one swipeable row */}
      <div className="relative">
        <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <Combobox
            id="regionFilter"
            variant="chip"
            hideLabel
            label={dict.ask.region}
            value={regionFilter}
            onChange={(v) => setRegionFilter(v as Region | "all")}
            options={[
              { value: "all", label: `${dict.ask.region}: —` },
              ...REGIONS.map((r) => ({ value: r, label: dict.region[r] })),
            ]}
            placeholder={dict.ask.region}
            searchPlaceholder={dict.common.search}
            emptyText={dict.common.nothingFound}
            className="shrink-0"
          />

          <button
            type="button"
            onClick={() => setUtilityFilter("all")}
            className={utilityFilter === "all" ? "chip-active" : "chip"}
          >
            ({bills.length})
          </button>

          {UTILITY_TYPES.map((u) => {
            const count = countByUtility(u);
            const active = utilityFilter === u;
            return (
              <button
                key={u}
                type="button"
                onClick={() => setUtilityFilter(active ? "all" : u)}
                className={active ? "chip-active" : "chip"}
              >
                <span>{UTILITY_ICONS[u]}</span>
                <span>{dict.utility[u]}</span>
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 text-xs ${active ? "bg-white/20 text-white" : "bg-white/70 text-stone-600"}`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 -right-4 w-10 bg-gradient-to-r from-transparent to-[var(--paper)] sm:hidden" />
      </div>

      {/* Cards Grid */}
      {filtered.length === 0 ? (
        <div className="card py-12 text-center space-y-2">
          <Sparkles size={32} aria-hidden="true" className="mx-auto text-amber-500" />
          <p className="text-sm font-bold text-stone-600">{dict.home.empty}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((bill) => (
            <BillCard key={bill.id} bill={bill} locale={locale} dict={dict} />
          ))}
        </div>
      )}
    </section>
  );
}
