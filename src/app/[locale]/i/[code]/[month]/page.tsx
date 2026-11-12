import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import { notFound } from "next/navigation";
import { isLocale, LOCALE_HTML_LANG, type Locale } from "@/i18n/config";
import { fmt, formatMoney, getDictionary } from "@/i18n";
import { UTILITY_ICONS } from "@/lib/domain";
import { getSharedImpact, monthLabel, parseMonthParam } from "@/lib/impact";
import { ThanksArt } from "@/components/HeroArt";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ locale: string; code: string; month: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, code, month: raw } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  const { month, withAmount } = parseMonthParam(raw);
  const impact = await getSharedImpact(code, month).catch(() => null);
  if (!impact) return { title: dict.share.tagline, robots: { index: false } };
  const vars = { nickname: impact.nickname, month: monthLabel(month, LOCALE_HTML_LANG[locale]), count: impact.families, amount: formatMoney(impact.total, dict) };
  const title = fmt(withAmount ? dict.impact.headlineSum : dict.impact.headline, vars);
  return {
    title: `${title} — MehrNuri`,
    description: dict.share.metaDesc,
    robots: { index: false, follow: true },
    openGraph: { title, description: dict.share.metaDesc, type: "article", siteName: "MehrNuri" },
    twitter: { card: "summary_large_image", title, description: dict.share.metaDesc },
  };
}

/** A donor's monthly impact: nickname, how many families, optional total, utility icons. Nothing about the families. */
export default async function SharedImpactPage({ params }: Params) {
  const { locale, code, month: raw } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale as Locale);
  const t = dict.impact;
  const { month, withAmount } = parseMonthParam(raw);
  const impact = await getSharedImpact(code, month).catch(() => null);
  if (!impact) notFound();

  const vars = { nickname: impact.nickname, month: monthLabel(month, LOCALE_HTML_LANG[locale as Locale]), count: impact.families, amount: formatMoney(impact.total, dict) };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <section className="hero-mesh hs-warm relative overflow-hidden rounded-[28px] px-5 py-6 text-[#f6efe3] md:px-8 md:py-8">
        <div className="flex items-center gap-3 md:gap-6">
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-[7px] text-[13px] font-bold text-[var(--glow)]">
              <span aria-hidden="true" className="lamp-dot shrink-0" />
              {t.eyebrow}
            </span>
            <h1 className="mt-2.5 text-[24px] leading-[1.15] font-extrabold tracking-tight text-balance break-words md:text-[30px]">
              {fmt(withAmount ? t.headlineSum : t.headline, vars)}
            </h1>
            <p className="mt-3 flex flex-wrap gap-2 text-[22px]" aria-label={impact.utilities.map((u) => dict.utilityBill[u]).join(", ")}>
              {impact.utilities.map((u) => (
                <span key={u} title={dict.utilityBill[u]} className="rounded-full bg-[rgba(255,255,255,0.12)] px-3 py-1">
                  {UTILITY_ICONS[u]}
                </span>
              ))}
            </p>
          </div>
          <ThanksArt className="h-[150px] w-[112px] shrink-0 md:h-[200px] md:w-[150px]" />
        </div>
        <Link href={`/${locale}`} className="btn-primary mt-6">
          <Heart size={20} aria-hidden="true" />
          {t.cta}
        </Link>
      </section>
      <p className="text-[13px] text-[var(--ink-soft)]">{t.note}</p>
    </div>
  );
}
