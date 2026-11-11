import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { isLocale, LOCALE_HTML_LANG, type Locale } from "@/i18n/config";
import { fmt, getDictionary } from "@/i18n";
import { Suspense } from "react";
import { NavProgress } from "@/components/NavProgress";
import { Header } from "@/components/Header";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return { title: BRAND.name };
  const dict = getDictionary(locale);
  return {
    title: fmt(dict.meta.title),
    description: dict.meta.description,
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

  return (
    <div lang={LOCALE_HTML_LANG[locale as Locale]} className="flex min-h-dvh flex-col pb-20 md:pb-0">
      <Suspense fallback={null}>
        <NavProgress />
      </Suspense>
      <Header locale={locale as Locale} dict={dict} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-5 sm:py-8">{children}</main>
      <footer className="px-4 py-6 text-center text-xs text-stone-400">
        {BRAND.name} — {dict.common.tagline}
      </footer>
    </div>
  );
}
