"use client";

import { Sparkles, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { REGIONS, UTILITY_ICONS, UTILITY_TYPES, type PublicBill, type Region, type UtilityType } from "@/lib/domain";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";
import { BillCard } from "./BillCard";

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
    <section id="feed" className="space-y-4 scroll-mt-20">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
            {dict.home.feedTitle}
          </h2>
          <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-extrabold text-slate-700">
            {filtered.length}
          </span>
        </div>

        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700">
          <span className="relative h-2 w-2 rounded-full bg-emerald-500 live-dot" />
          {dict.bill.live}
        </span>
      </div>

      {/* Horizontal Swipeable Category Chips + Region Select */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:contents">
        <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <button
            type="button"
            onClick={() => setUtilityFilter("all")}
            className={`shrink-0 cursor-pointer rounded-2xl px-3.5 py-2 text-xs font-extrabold transition-all active:scale-95 ${
              utilityFilter === "all"
                ? "bg-slate-900 text-white shadow-sm"
                : "border border-slate-200/90 bg-white text-slate-700 hover:border-slate-300"
            }`}
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
                className={`shrink-0 cursor-pointer inline-flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-extrabold transition-all active:scale-95 ${
                  active
                    ? "bg-slate-900 text-white shadow-sm"
                    : "border border-slate-200/90 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <span>{UTILITY_ICONS[u]}</span>
                <span>{dict.utility[u]}</span>
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 -right-4 w-10 bg-gradient-to-r from-transparent to-[#f4f6fb] sm:hidden" />
        </div>

        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value as Region | "all")}
          aria-label={dict.ask.region}
          className="h-10 shrink-0 cursor-pointer rounded-2xl border border-slate-200/90 bg-white px-3.5 text-xs font-bold text-slate-700 outline-none focus:border-amber-500"
        >
          <option value="all">{dict.ask.region}: —</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {dict.region[r]}
            </option>
          ))}
        </select>
      </div>

      {/* Cards Grid */}
      {filtered.length === 0 ? (
        <div className="card py-12 text-center space-y-2">
          <Sparkles size={32} aria-hidden="true" className="mx-auto text-amber-500" />
          <p className="text-sm font-bold text-slate-600">{dict.home.empty}</p>
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
