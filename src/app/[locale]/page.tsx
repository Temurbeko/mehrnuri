import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";
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
      <section className="hero-mesh relative overflow-hidden rounded-3xl p-5 text-white shadow-[0_16px_40px_-12px_rgba(15,23,42,0.45)] sm:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-amber-300 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span>{fmt(dict.home.stats, { count: bills.length })}</span>
            </div>

            <h1 className="max-w-xl text-2xl font-extrabold tracking-tight leading-tight sm:text-2xl">
              {dict.home.heroTitle}
            </h1>

            <p className="max-w-lg text-sm font-medium text-stone-300 leading-relaxed sm:text-base">
              {dict.home.heroSubtitle}
            </p>

            <div className="flex flex-col gap-1 pt-1 sm:max-w-xs">
              <a href="#feed" className="btn-primary w-full py-3.5 text-sm font-extrabold">
                <Heart size={18} aria-hidden="true" />
                <span>{dict.home.wantHelp}</span>
              </a>
              <Link
                href={`/${locale}/ask`}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 text-sm font-bold text-white/80 hover:text-white"
              >
                <span>{dict.home.needHelp}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Hero Brand Emblem */}
          <div className="hidden shrink-0 sm:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND.logoUrl}
              alt={BRAND.name}
              className="h-28 w-28 rounded-3xl object-cover shadow-2xl md:h-32 md:w-32"
            />
          </div>
        </div>
      </section>

      {/* Real-time Feed */}
      <LiveFeed initialBills={bills} locale={locale} dict={dict} />

      {/* How it works */}
      <section aria-labelledby="how-title" className="panel p-5">
        <h2 id="how-title" className="text-sm font-extrabold text-stone-900">
          {dict.home.howTitle}
        </h2>
        <ol className="mt-3 space-y-2.5">
          {[dict.home.how1, dict.home.how2, dict.home.how3].map((text, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-extrabold text-amber-700">
                {i + 1}
              </span>
              <span className="min-w-0 text-sm font-medium leading-snug text-stone-700">{text}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
