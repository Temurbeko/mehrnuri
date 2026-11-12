import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { LOCALES, LOCALE_HTML_LANG, type Locale } from "@/i18n/config";

/** Same origin the sitemap, robots and metadataBase use. */
export const SITE_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

/** Open Graph locale codes (language_TERRITORY). */
export const OG_LOCALE: Record<Locale, string> = { "uz-latn": "uz_UZ", "uz-cyrl": "uz_UZ", ru: "ru_RU" };

/** hreflang map for one public path, e.g. "/ask", plus x-default. */
export function languageAlternates(path: string): Record<string, string> {
  const langs: Record<string, string> = Object.fromEntries(
    LOCALES.map((l) => [LOCALE_HTML_LANG[l], `/${l}${path}`]),
  );
  langs["x-default"] = `/uz-latn${path}`;
  return langs;
}

/** Metadata for a public, indexable page. The title gets the "— MehrNuri" template. */
export function publicPageMetadata(locale: Locale, path: string, title: string, description: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: `/${locale}${path}`, languages: languageAlternates(path) },
    openGraph: {
      type: "website",
      siteName: BRAND.name,
      locale: OG_LOCALE[locale],
      title: `${title} — ${BRAND.name}`,
      description,
      url: `/${locale}${path}`,
    },
    twitter: { card: "summary_large_image", title: `${title} — ${BRAND.name}`, description },
  };
}

/** Metadata for a private page that must stay out of search results. */
export const PRIVATE_METADATA: Metadata = { robots: { index: false, follow: false } };
