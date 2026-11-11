import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { fmt, formatMoney, getDictionary } from "@/i18n";
import { topDonors } from "@/lib/donors/leaderboard";
import type { PublicDonor } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function LeadersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  let donors: PublicDonor[] = [];
  try {
    donors = await topDonors(50);
  } catch {
    /* DB offline */
  }

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">{dict.leaders.title}</h1>
        <p className="text-sm font-medium text-stone-500">{dict.leaders.subtitle}</p>
      </div>

      {donors.length === 0 ? (
        <div className="surface py-12 text-center font-bold text-stone-500">{dict.leaders.empty}</div>
      ) : (
        <ol className="list">
          {donors.map((d, idx) => {
            const top = idx < 3;
            return (
              <li key={d.nickname} className={`flex min-h-16 items-center gap-3 px-4 py-3 ${top ? "bg-amber-50/60" : ""}`}>
                <span
                  className={`flex shrink-0 items-center justify-center ${
                    top ? "w-10 text-3xl" : "h-8 w-10 rounded-xl bg-[var(--tone)] text-xs font-extrabold text-stone-600"
                  }`}
                  aria-hidden={top ? "true" : undefined}
                >
                  {top ? medals[idx] : idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`truncate font-extrabold text-stone-900 ${top ? "text-base" : "text-sm"}`}>{d.nickname}</div>
                  <div className="truncate text-xs font-semibold text-stone-400">
                    {fmt(dict.leaders.donations, { count: d.donationsCount })}
                  </div>
                </div>
                <div className="shrink-0 text-right text-sm font-extrabold whitespace-nowrap text-emerald-700">
                  {formatMoney(d.totalDonated, dict)}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
