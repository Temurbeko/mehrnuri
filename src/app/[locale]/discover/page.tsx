import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { listOpenBills } from "@/lib/bills/service";
import type { PublicBill } from "@/lib/domain";
import { DiscoverFeed } from "@/components/DiscoverFeed";

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
    bills = await listOpenBills({ limit: 30 });
  } catch {
    /* DB offline: the feed shows its empty screen */
  }
  // Requests with a story first (they are what people stop for), then the ones closest to done.
  const left = (b: PublicBill) => b.amountOwed - b.paidAmount;
  bills = bills
    .filter((b) => b.available > 0)
    .sort((a, b) => Number(Boolean(b.story)) - Number(Boolean(a.story)) || left(a) - left(b));

  return <DiscoverFeed bills={bills} locale={locale} dict={dict} />;
}
