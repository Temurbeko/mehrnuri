import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import { notFound } from "next/navigation";
import { isLocale, LOCALE_HTML_LANG, type Locale } from "@/i18n/config";
import { fmt, formatMoney, getDictionary } from "@/i18n";
import { UTILITY_ICONS } from "@/lib/domain";
import { getSharedHelp } from "@/lib/payments/core";
import { openBillsByRegion } from "@/lib/community";
import { HowItWorks } from "@/components/HowItWorks";
import { ThanksArt } from "@/components/HeroArt";
import { parseShareParam } from "./share";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ locale: string; code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, code: raw } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  const { code, withAmount } = parseShareParam(raw);
  const help = await getSharedHelp(code).catch(() => null);
  if (!help) return { title: dict.share.tagline, robots: { index: false } };
  const title = withAmount
    ? fmt(dict.share.metaTitleSum, { nickname: help.nickname, amount: formatMoney(help.amount, dict) })
    : fmt(dict.share.metaTitle, { nickname: help.nickname });
  return {
    title: `${title} — MehrNuri`,
    description: dict.share.metaDesc,
    // a personal share page: fine to preview, no need to be in search results
    robots: { index: false, follow: true },
    openGraph: { title, description: dict.share.metaDesc, type: "article", siteName: "MehrNuri" },
    twitter: { card: "summary_large_image", title, description: dict.share.metaDesc },
  };
}

/**
 * What friends see when a donor shares their help: who helped (their public
 * nickname), for which kind of bill, when, and the amount only if the donor
 * chose to show it. Nothing about the family.
 */
export default async function SharedHelpPage({ params }: Params) {
  const { locale, code: raw } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale as Locale);
  const t = dict.share;
  const { code, withAmount } = parseShareParam(raw);
  const [help, regions] = await Promise.all([getSharedHelp(code).catch(() => null), openBillsByRegion().catch(() => ({}))]);
  const waiting = Object.values(regions).reduce<number>((sum, n) => sum + (n ?? 0), 0);

  if (!help) {
    return (
      <div className="mx-auto max-w-md space-y-4 pt-6 text-center">
        <p className="font-bold text-[var(--ink)]">{t.notFound}</p>
        <Link href={`/${locale}`} className="btn-primary">
          {t.cta}
        </Link>
      </div>
    );
  }

  const date = new Intl.DateTimeFormat(LOCALE_HTML_LANG[locale as Locale], { dateStyle: "long", timeZone: "Asia/Tashkent" }).format(new Date(help.at));
  const headline = withAmount
    ? fmt(t.headlineSum, { nickname: help.nickname, amount: formatMoney(help.amount, dict) })
    : fmt(t.headline, { nickname: help.nickname });

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <section className="hero-mesh hs-warm relative overflow-hidden rounded-[28px] px-5 py-6 text-[#f6efe3] md:px-8 md:py-8">
        <div className="flex items-center gap-3 md:gap-6">
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-[7px] text-[13px] font-bold text-[var(--glow)]">
              <span aria-hidden="true" className="lamp-dot shrink-0" />
              {t.eyebrow}
            </span>
            <h1 className="mt-2.5 text-[24px] leading-[1.15] font-extrabold tracking-tight text-balance break-words md:text-[30px]">{headline}</h1>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-[rgba(255,255,255,0.12)] px-3 py-1 text-[13px] font-bold">
              <span aria-hidden="true">{UTILITY_ICONS[help.utilityType]}</span>
              {dict.utilityBill[help.utilityType]} · {date}
            </p>
          </div>
          <ThanksArt className="h-[150px] w-[112px] shrink-0 md:h-[200px] md:w-[150px]" />
        </div>
        <Link href={`/${locale}`} className="btn-primary mt-6">
          <Heart size={20} aria-hidden="true" />
          {t.cta}
        </Link>
      </section>

      {waiting > 0 && (
        <p className="surface flex items-center gap-2.5 p-4 text-[15px] font-bold text-[var(--ink)]">
          <span aria-hidden="true" className="lamp-dot shrink-0" />
          {fmt(dict.home.stats, { count: waiting })}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-[13px] text-[var(--ink-soft)]">{t.note}</p>
        <HowItWorks dict={dict} />
      </div>
    </div>
  );
}
