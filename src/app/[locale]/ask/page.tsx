import { ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { AskForm } from "@/components/AskForm";

export default async function AskPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <div className="mx-auto max-w-lg space-y-5">
      {/* The form's step title is the page title; keep only the privacy note here. */}
      <h1 className="sr-only">{dict.ask.title}</h1>
      <p className="flex items-start gap-2.5 rounded-2xl bg-white px-3.5 py-3 text-sm text-[var(--ink-soft)] shadow-[var(--lift)]">
        <ShieldCheck size={20} aria-hidden="true" className="mt-px shrink-0 text-[var(--hope)]" />
        <span className="min-w-0">{dict.ask.trust}</span>
      </p>
      <AskForm locale={locale} dict={dict} />
    </div>
  );
}
