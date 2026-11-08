export const LOCALES = ["uz-latn", "uz-cyrl", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "uz-latn";

export const LOCALE_LABELS: Record<Locale, string> = {
  "uz-latn": "O'zbekcha",
  "uz-cyrl": "Ўзбекча",
  ru: "Русский",
};

export const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  "uz-latn": "O'z",
  "uz-cyrl": "Ўз",
  ru: "Ру",
};

/** BCP-47 tags for <html lang> and Intl formatting. */
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  "uz-latn": "uz-Latn",
  "uz-cyrl": "uz-Cyrl",
  ru: "ru",
};

export function isLocale(v: string | undefined | null): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

export function detectAcceptLanguage(acceptLanguageHeader: string | null | undefined): Locale {
  const al = (acceptLanguageHeader ?? "").toLowerCase();
  if (/uz-cyrl/.test(al)) return "uz-cyrl";
  if (/^uz|,\s*uz/.test(al)) return "uz-latn";
  if (/^ru|,\s*ru/.test(al)) return "ru";
  return DEFAULT_LOCALE;
}
