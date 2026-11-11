"use client";

import { Home, Plus, Trophy, User } from "lucide-react";
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
        <Home size={22} aria-hidden="true" strokeWidth={active ? 2.5 : 2} />
      ),
    },
    {
      href: `/${locale}/ask`,
      label: dict.nav.ask,
      match: (p: string) => p.startsWith(`/${locale}/ask`),
      icon: (active: boolean) => (
        <Plus size={22} aria-hidden="true" strokeWidth={active ? 2.5 : 2} />
      ),
    },
    {
      href: `/${locale}/leaders`,
      label: dict.nav.leaders,
      match: (p: string) => p.startsWith(`/${locale}/leaders`),
      icon: (active: boolean) => (
        <Trophy size={22} aria-hidden="true" strokeWidth={active ? 2.5 : 2} />
      ),
    },
    {
      href: `/${locale}/me`,
      label: dict.nav.me,
      match: (p: string) => p.startsWith(`/${locale}/me`),
      icon: (active: boolean) => (
        <User size={22} aria-hidden="true" strokeWidth={active ? 2.5 : 2} />
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

      {/* Focus mode: no tab bar while paying, so the donor's only way forward
          is the payment step itself (its main button is pinned to the bottom). */}
      {!/\/pay\//.test(pathname) && (
      <nav
        aria-label="Mobile Navigation"
        className="fixed inset-x-0 bottom-0 z-40 bg-white/90 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgba(28,25,23,0.25)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1 py-1.5">
          {navItems.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-xs font-bold transition-all active:scale-90 ${
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
      )}
    </>
  );
}
