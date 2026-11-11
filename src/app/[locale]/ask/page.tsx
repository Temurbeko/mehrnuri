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
      <p className="text-sm text-stone-500">{dict.ask.intro}</p>
      <AskForm locale={locale} dict={dict} />
    </div>
  );
}
