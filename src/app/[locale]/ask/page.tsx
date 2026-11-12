import type { Metadata } from "next";
import { publicPageMetadata, PRIVATE_METADATA } from "@/lib/seo";
import { ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { AskForm } from "@/components/AskForm";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { seo } = getDictionary(locale);
  return publicPageMetadata(locale, "/ask", seo.askTitle, seo.askDescription);
}

export default async function AskPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <div className="mx-auto max-w-lg">
      {/* The form renders the app bar (step-aware back); its step title is the page title. */}
      <AskForm
        locale={locale}
        dict={dict}
        intro={
          <p className="flex items-start gap-2.5 rounded-2xl bg-white px-3.5 py-2.5 text-[13px] text-[var(--ink-soft)] shadow-[var(--lift)]">
            <ShieldCheck size={18} aria-hidden="true" className="mt-px shrink-0 text-[var(--hope)]" />
            <span className="min-w-0">{dict.ask.trust}</span>
          </p>
        }
      />
    </div>
  );
}
