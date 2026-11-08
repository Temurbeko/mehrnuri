"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND } from "@/config/brand";
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT_LABELS, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";

export function Header({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const pathname = usePathname() || `/${locale}`;

  function pathForLocale(target: Locale): string {
    const parts = pathname.split("/");
    if (parts.length > 1 && (LOCALES as readonly string[]).includes(parts[1] ?? "")) {
      parts[1] = target;
      return parts.join("/") || `/${target}`;
    }
    return `/${target}`;
  }

  const navItems = [
    {
      href: `/${locale}`,
      label: dict.nav.home,
      match: (p: string) =>
        p === `/${locale}` ||
        p.startsWith(`/${locale}/bill/`) ||
        p.startsWith(`/${locale}/pay/`) ||
        p.startsWith(`/${locale}/payment/`),
      icon: (active: boolean) => (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5.5v-6h-5v6H4a1 1 0 01-1-1v-9.5z" />
        </svg>
      ),
    },
    {
      href: `/${locale}/ask`,
      label: dict.nav.ask,
      match: (p: string) => p.startsWith(`/${locale}/ask`),
      icon: (active: boolean) => (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
    {
      href: `/${locale}/leaders`,
      label: dict.nav.leaders,
      match: (p: string) => p.startsWith(`/${locale}/leaders`),
      icon: (active: boolean) => (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15l-3.5 2 1-4L6 10l4-.3L12 6l2 3.7 4 .3-3.5 3 1 4-3.5-2z" />
        </svg>
      ),
    },
    {
      href: `/${locale}/me`,
      label: dict.nav.me,
      match: (p: string) => p.startsWith(`/${locale}/me`),
      icon: (active: boolean) => (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-15 max-w-4xl items-center justify-between gap-2 px-4">
          <Link
            href={`/${locale}`}
            className="group flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-slate-900 transition active:scale-95"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND.logoUrl}
              alt={BRAND.name}
              className="h-9 w-9 rounded-xl object-cover shadow-[0_3px_10px_-2px_rgba(15,23,42,0.35)] ring-1 ring-amber-400/40 transition-transform group-hover:scale-105"
            />
            <span className="text-lg font-extrabold tracking-tight">{BRAND.name}</span>
          </Link>

          <nav className="hidden items-center gap-1 rounded-2xl bg-slate-100/90 p-1 md:flex">
            {navItems.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-sm font-bold transition-all active:scale-95 ${
                    active
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div
            className="flex items-center rounded-xl border border-slate-200/80 bg-slate-100/80 p-0.5"
            role="group"
            aria-label={dict.common.language}
          >
            {LOCALES.map((loc) => {
              const active = loc === locale;
              return (
                <Link
                  key={loc}
                  href={pathForLocale(loc)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-extrabold transition-all active:scale-95 ${
                    active
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span className="sm:hidden">{LOCALE_SHORT_LABELS[loc]}</span>
                  <span className="hidden sm:inline">{LOCALE_LABELS[loc]}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <nav
        aria-label="Mobile Navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1 py-1.5">
          {navItems.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-bold transition-all active:scale-90 ${
                  active ? "text-amber-600" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                    active ? "bg-amber-500/15 text-amber-600" : ""
                  }`}
                >
                  {item.icon(active)}
                </span>
                <span className="truncate max-w-[76px]">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
