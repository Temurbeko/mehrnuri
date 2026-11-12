import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { isLocale, LOCALE_HTML_LANG, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { OG_LOCALE, SITE_URL } from "@/lib/seo";
import { Suspense } from "react";
import { NavProgress } from "@/components/NavProgress";
import { Header } from "@/components/Header";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return { title: BRAND.name };
  const dict = getDictionary(locale);
  return {
    title: { default: dict.seo.homeTitle, template: `%s — ${BRAND.name}` },
    description: dict.seo.homeDescription,
    openGraph: {
      type: "website",
      siteName: BRAND.name,
      locale: OG_LOCALE[locale],
      title: dict.seo.homeTitle,
      description: dict.seo.homeDescription,
    },
    twitter: { card: "summary_large_image", title: dict.seo.homeTitle, description: dict.seo.homeDescription },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale as Locale);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: BRAND.name, url: SITE_URL, logo: `${SITE_URL}${BRAND.logoUrl}` },
      { "@type": "WebSite", name: BRAND.name, url: SITE_URL, inLanguage: LOCALE_HTML_LANG[locale as Locale] },
    ],
  };

  return (
    <div lang={LOCALE_HTML_LANG[locale as Locale]} className="flex min-h-dvh flex-col pb-20 md:pb-0">
      <Suspense fallback={null}>
        <NavProgress />
      </Suspense>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Header locale={locale as Locale} dict={dict} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-5 sm:py-8">{children}</main>
      <footer className="px-4 py-6 text-center text-xs text-stone-400">
        <p className="font-bold text-stone-500">
          {BRAND.name} — {dict.common.tagline}
        </p>
        <p className="mx-auto mt-1 max-w-sm">{dict.seo.trust}</p>
      </footer>
    </div>
  );
}
