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
import { HeroSlider } from "@/components/HeroSlider";

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
      <HeroSlider locale={locale} dict={dict} waiting={waiting} weekCount={weekCount} closed={closed} />

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
