import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { AskForm } from "@/components/AskForm";

export default async function AskPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{dict.ask.title}</h1>
        <p className="text-xs font-semibold text-slate-500">{dict.ask.intro}</p>
      </div>
      <AskForm locale={locale} dict={dict} />
    </div>
  );
}
