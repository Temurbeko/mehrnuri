import Link from "next/link";
import { Heart, Home } from "lucide-react";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { fmt, getDictionary } from "@/i18n";
import { listOpenBills } from "@/lib/bills/service";
import { sweepExpired } from "@/lib/payments/core";
import type { PublicBill, Region } from "@/lib/domain";
import { homesLitThisWeek, openBillsByRegion, recentHelps, recentlyClosedWithThanks, type ClosedThanks, type RecentHelp } from "@/lib/community";
import { LiveFeed } from "@/components/LiveFeed";
import { LiveTicker } from "@/components/LiveTicker";
import { ClosedStrip } from "@/components/ClosedStrip";
import { HowItWorks } from "@/components/HowItWorks";
import { BuildingArt } from "@/components/BuildingArt";

export const dynamic = "force-dynamic";

/** A failing side query must never take the whole home page down. */
async function safe<T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (err) {
    console.warn(`[home] ${label} not available:`, err);
    return fallback;
  }
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  await safe("sweep", () => sweepExpired(), undefined);
  const [bills, helps, weekCount, closed, regionCounts] = await Promise.all([
    safe<PublicBill[]>("bills", () => listOpenBills({ limit: 50 }), []),
    safe<RecentHelp[]>("recent helps", () => recentHelps(8), []),
    safe<number>("week count", () => homesLitThisWeek(), 0),
    safe<ClosedThanks[]>("closed", () => recentlyClosedWithThanks(6), []),
    safe<Partial<Record<Region, number>>>("regions", () => openBillsByRegion(), {}),
  ]);

  const waiting = Object.values(regionCounts).reduce((sum, n) => sum + (n ?? 0), 0) || bills.length;

  return (
    <div className="min-w-0">
      <div className="mb-3 flex justify-end">
        <HowItWorks dict={dict} />
      </div>

      {/* Hero: the night building */}
      <section className="hero-mesh relative overflow-hidden rounded-[28px] px-5 py-[22px] text-[#f6efe3]">
        <div className="relative flex items-end gap-3.5">
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-[7px] text-[13px] font-bold text-[var(--glow)]">
              <span aria-hidden="true" className="lamp-dot shrink-0" />
              {fmt(dict.home.stats, { count: waiting })}
            </span>
            <h1 className="mt-2.5 mb-2 text-[25px] leading-[1.12] font-extrabold tracking-tight text-balance min-[380px]:text-[28px]">
              {dict.home.heroTitle}
            </h1>
            <p className="text-[14.5px] text-[#cfc6b8] min-[380px]:text-[15px]">
              {weekCount > 0 ? fmt(dict.feed.heroWeek, { count: weekCount }) : dict.feed.heroWeekNone}
            </p>
          </div>
          <BuildingArt className="-mr-1.5 -mb-1 h-[150px] w-[112px] shrink-0 min-[380px]:h-[168px] min-[380px]:w-[126px]" />
        </div>
        <div className="relative mt-5 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 min-[420px]:gap-2.5">
          <a href="#feed" className="btn-primary min-w-0 px-4">
            <Heart size={20} aria-hidden="true" />
            {dict.home.wantHelp}
          </a>
          <Link href={`/${locale}/ask`} className="btn btn-glass min-w-0 px-4">
            <Home size={20} aria-hidden="true" />
            {dict.home.needHelp}
          </Link>
        </div>
      </section>

      {helps.length > 0 && <LiveTicker helps={helps} dict={dict} />}

      <div className="mt-8">
        <LiveFeed initialBills={bills} regionCounts={regionCounts} locale={locale} dict={dict} />
      </div>

      <ClosedStrip items={closed} dict={dict} />

      <p className="mt-8 text-center text-[13px] text-[var(--ink-soft)]">
        {dict.feed.footNote1}
        <br />
        {fmt(dict.feed.footNote2)}
      </p>
    </div>
  );
}
