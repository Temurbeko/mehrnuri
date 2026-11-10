import Link from "next/link";
import { notFound } from "next/navigation";
import { BRAND } from "@/config/brand";
import { isLocale } from "@/i18n/config";
import { fmt, getDictionary } from "@/i18n";
import { listOpenBills } from "@/lib/bills/service";
import { sweepExpired } from "@/lib/payments/core";
import type { PublicBill } from "@/lib/domain";
import { LiveFeed } from "@/components/LiveFeed";

export const dynamic = "force-dynamic";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  let bills: PublicBill[] = [];
  try {
    await sweepExpired();
    bills = await listOpenBills({ limit: 50 });
  } catch (err) {
    console.warn("[home] DB not reachable yet:", err);
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero Banner */}
      hello world
      <section className="hero-mesh relative overflow-hidden rounded-3xl p-5 text-white shadow-[0_16px_40px_-12px_rgba(15,23,42,0.45)] sm:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-amber-300 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span>{fmt(dict.home.stats, { count: bills.length })}</span>
            </div>

            <h1 className="max-w-xl text-2xl font-extrabold tracking-tight leading-tight sm:text-3xl">
              {dict.home.heroTitle}
            </h1>

            <p className="max-w-lg text-sm font-medium text-slate-300 leading-relaxed sm:text-base">
              {dict.home.heroSubtitle}
            </p>

            <div className="grid gap-2.5 pt-2 sm:max-w-md sm:grid-cols-2">
              <a href="#feed" className="btn-primary py-3.5 text-sm font-extrabold">
                <span>💛</span>
                <span>{dict.home.wantHelp}</span>
              </a>
              <Link
                href={`/${locale}/ask`}
                className="btn border border-white/20 bg-white/10 py-3.5 text-sm font-extrabold text-white backdrop-blur-md hover:bg-white/20"
              >
                <span>🏠</span>
                <span>{dict.home.needHelp}</span>
              </Link>
            </div>
          </div>

          {/* Hero Brand Emblem */}
          <div className="hidden shrink-0 sm:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND.logoUrl}
              alt={BRAND.name}
              className="h-28 w-28 rounded-3xl object-cover shadow-2xl ring-2 ring-amber-400/40 md:h-32 md:w-32"
            />
          </div>
        </div>
      </section>

      {/* Compact 3-Step Explainer Strip */}
      <section aria-label={dict.home.howTitle} className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-2xs">
          <div className="mb-1.5 inline-flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/15 text-xs font-extrabold text-amber-700">
            1
          </div>
          <p className="text-xs font-bold text-slate-700 leading-snug sm:text-sm">{dict.home.how1}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-2xs">
          <div className="mb-1.5 inline-flex h-7 w-7 items-center justify-center rounded-xl bg-sky-500/15 text-xs font-extrabold text-sky-700">
            2
          </div>
          <p className="text-xs font-bold text-slate-700 leading-snug sm:text-sm">{dict.home.how2}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-2xs">
          <div className="mb-1.5 inline-flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/15 text-xs font-extrabold text-emerald-700">
            3
          </div>
          <p className="text-xs font-bold text-slate-700 leading-snug sm:text-sm">{dict.home.how3}</p>
        </div>
      </section>

      {/* Real-time Feed */}
      <LiveFeed initialBills={bills} locale={locale} dict={dict} />
    </div>
  );
}
