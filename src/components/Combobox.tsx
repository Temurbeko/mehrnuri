"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export type ComboOption = { value: string; label: string };

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’ʻʼ`´'ʻʼ‘’]/g, "")
    .trim();
}

export function Combobox({
  id,
  label,
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  icon,
  className = "",
  hideLabel = false,
}: {
  id: string;
  label: string;
  value: string;
  options: ComboOption[];
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  icon?: React.ReactNode;
  className?: string;
  hideLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = norm(query);
    return q ? options.filter((o) => norm(o.label).includes(q)) : options;
  }, [options, query]);

  function openPanel() {
    setQuery("");
    const idx = options.findIndex((o) => o.value === value);
    setActive(Math.max(0, idx));
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  }

  function choose(v: string) {
    onChange(v);
    close();
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const isPhone = window.matchMedia("(max-width: 639px)").matches;
    if (!isPhone) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = filtered[active];
      if (o) choose(o.value);
    }
  }

  const activeId = filtered[active] ? `${listId}-${active}` : undefined;

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <label className={hideLabel ? "sr-only" : "label"} id={`${id}-label`} htmlFor={id}>
        {label}
      </label>
      <button
        ref={btnRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${id}-label ${id}`}
        onClick={() => (open ? close(false) : openPanel())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            openPanel();
          }
        }}
        className="input flex cursor-pointer items-center justify-between gap-2 text-left font-semibold active:scale-[0.99]"
      >
        {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
        <span className={`min-w-0 flex-1 truncate ${selected ? "text-slate-900" : "text-slate-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <div
            aria-hidden="true"
            onClick={() => close()}
            className="fixed inset-0 z-40 bg-slate-900/40 sm:hidden"
          />
          <div
            onKeyDown={onKeyDown}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[70vh] flex-col rounded-t-3xl border border-slate-200 bg-white p-3 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:right-0 sm:top-full sm:mt-1.5 sm:max-h-80 sm:rounded-2xl sm:p-2"
          >
            <div aria-hidden="true" className="mx-auto mb-2 h-1.5 w-10 shrink-0 rounded-full bg-slate-300 sm:hidden" />
            <div className="relative shrink-0">
              <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                type="text"
                role="searchbox"
                aria-label={label}
                aria-controls={listId}
                aria-activedescendant={activeId}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                placeholder={searchPlaceholder}
                className="input pl-11"
              />
            </div>
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-labelledby={`${id}-label`}
              className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain"
            >
              {filtered.length === 0 && (
                <li className="px-4 py-6 text-center text-sm font-semibold text-slate-500">{emptyText}</li>
              )}
              {filtered.map((o, i) => {
                const isSel = o.value === value;
                const isAct = i === active;
                return (
                  <li
                    key={o.value}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={isSel}
                    data-active={isAct}
                    onMouseMove={() => setActive(i)}
                    onClick={() => choose(o.value)}
                    className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl px-4 py-2 text-base font-semibold transition-colors ${
                      isAct ? "bg-amber-50" : ""
                    } ${isSel ? "text-slate-900" : "text-slate-700"}`}
                  >
                    <span className="min-w-0">{o.label}</span>
                    {isSel && <Check size={18} aria-hidden="true" className="shrink-0 text-amber-600" />}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
