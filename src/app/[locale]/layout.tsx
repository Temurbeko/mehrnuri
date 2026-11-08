import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { isLocale, LOCALE_HTML_LANG, type Locale } from "@/i18n/config";
import { fmt, getDictionary } from "@/i18n";
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
      <Header locale={locale as Locale} dict={dict} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-5 sm:py-8">{children}</main>
      <footer className="border-t border-slate-200/70 bg-white/60 py-6 text-center text-xs text-slate-500">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4">
          <span className="inline-flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND.logoUrl} alt="" className="h-5 w-5 rounded-md object-cover ring-1 ring-slate-300" />
            <span>
              <strong className="text-slate-700">{BRAND.name}</strong> — {dict.common.tagline}
            </span>
          </span>
          <Link href={`/${locale}/admin`} className="font-semibold text-slate-400 hover:text-slate-700 transition">
            {dict.nav.admin}
          </Link>
        </div>
      </footer>
    </div>
  );
}
