"use client";

import { Check, ChevronDown, MapPin, Search } from "lucide-react";
import { useCallback, useId, useMemo, useState } from "react";
import { REGIONS, type Region } from "@/lib/domain";
import { fmt, type Dictionary } from "@/i18n";
import { normalizeSearch } from "@/lib/format";
import { BottomSheet } from "./BottomSheet";

/**
 * The "Hudud" field: shows the chosen region and opens a searchable bottom
 * sheet listing every region with the number of waiting families.
 */
export function RegionPicker({
  value,
  onChange,
  counts,
  total,
  dict,
}: {
  value: Region | "all";
  onChange: (v: Region | "all") => void;
  counts: Partial<Record<Region, number>>;
  total: number;
  dict: Dictionary;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const titleId = useId();
  const close = useCallback(() => setOpen(false), []);

  const label = value === "all" ? dict.feed.regionAll : dict.region[value];

  const options = useMemo(() => {
    const all = [{ value: "all" as const, label: dict.feed.regionAll, n: total }];
    const regions = REGIONS.map((r) => ({ value: r, label: dict.region[r], n: counts[r] ?? 0 }));
    const q = normalizeSearch(query);
    return [...all, ...regions].filter((o) => !q || normalizeSearch(o.label).includes(q));
  }, [counts, total, dict, query]);

  function pick(v: Region | "all") {
    onChange(v);
    close();
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
        className="mb-3 flex min-h-[58px] w-full cursor-pointer items-center gap-3 rounded-[18px] bg-white py-2 pr-3.5 pl-2.5 text-left text-[var(--ink)] shadow-[var(--lift)] transition active:scale-[0.99]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(246,166,35,0.15)] text-[var(--lamp-deep)]">
          <MapPin size={20} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold text-[var(--ink-soft)]">{dict.feed.regionLabel}</span>
          <b className="block truncate text-base font-extrabold">{label}</b>
        </span>
        <ChevronDown size={20} aria-hidden="true" className="shrink-0 text-[var(--ink-soft)]" />
      </button>

      <BottomSheet open={open} onClose={close} labelledBy={titleId}>
        <h2 id={titleId} className="text-[22px] font-extrabold tracking-tight text-[var(--ink)]">
          {dict.feed.regionTitle}
        </h2>
        <label className="mt-3.5 mb-2 flex h-[52px] items-center gap-2.5 rounded-2xl bg-[var(--tone)] px-3.5 text-[var(--ink-soft)] focus-within:bg-white focus-within:ring-[3px] focus-within:ring-[var(--lamp)]">
          <Search size={20} aria-hidden="true" className="shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={dict.feed.regionSearch}
            autoComplete="off"
            autoFocus
            className="min-w-0 flex-1 border-0 bg-transparent text-base font-bold text-[var(--ink)] outline-none"
          />
        </label>
        {options.length === 0 ? (
          <p className="px-3 py-4 text-[var(--ink-soft)]">{dict.common.nothingFound}</p>
        ) : (
          <ul role="listbox" aria-label={dict.feed.regionLabel} className="max-h-[min(52vh,420px)] overflow-y-auto overscroll-contain">
            {options.map((o) => {
              const selected = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => pick(o.value)}
                    className={`flex min-h-[52px] w-full cursor-pointer items-center gap-2.5 rounded-[14px] px-3 text-left text-base font-bold text-[var(--ink)] hover:bg-[var(--tone)] focus-visible:bg-[var(--tone)] focus-visible:outline-none ${selected ? "bg-[rgba(246,166,35,0.14)]" : ""}`}
                  >
                    <span className="flex w-4 shrink-0 justify-center text-[var(--lamp-deep)]">
                      {selected && <Check size={16} aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1 break-words">{o.label}</span>
                    <span className="text-[13px] font-bold whitespace-nowrap text-[var(--ink-soft)]">
                      {fmt(dict.feed.familiesCount, { count: o.n })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </BottomSheet>
    </>
  );
}
