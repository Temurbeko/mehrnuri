import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { listOpenBills } from "@/lib/bills/service";
import type { PublicBill } from "@/lib/domain";
import { DiscoverFeed } from "@/components/DiscoverFeed";
import { spotlightOrder } from "@/lib/bills/spotlight";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).discover.metaTitle, robots: { index: false } };
}

/** One family per screen, swiped vertically. */
export default async function DiscoverPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  let bills: PublicBill[] = [];
  try {
    bills = await listOpenBills({ limit: 50 });
  } catch {
    /* DB offline: the feed shows its empty screen */
  }
  // Random on every visit, tilted to the most urgent requests (see spotlight.ts).
  bills = spotlightOrder(bills.filter((b) => b.available > 0)).slice(0, 30);

  return <DiscoverFeed bills={bills} locale={locale} dict={dict} />;
}
