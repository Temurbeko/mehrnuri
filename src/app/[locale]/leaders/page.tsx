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
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{dict.leaders.title}</h1>
        <p className="text-xs font-semibold text-slate-500">{dict.leaders.subtitle}</p>
      </div>

      {donors.length === 0 ? (
        <div className="card py-12 text-center font-bold text-slate-500">{dict.leaders.empty}</div>
      ) : (
        <>
          {/* Top 3 Highlight Cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            {donors.slice(0, 3).map((d, idx) => (
              <div
                key={d.nickname}
                className={`card flex flex-col justify-between gap-3 p-4 ${
                  idx === 0 ? "border-amber-400/80 bg-gradient-to-b from-amber-50/70 to-white ring-1 ring-amber-400/30" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl" aria-hidden="true">{medals[idx]}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-extrabold text-slate-600">
                    #{idx + 1}
                  </span>
                </div>
                <div>
                  <div className="truncate text-base font-extrabold text-slate-900">{d.nickname}</div>
                  <div className="text-xs font-semibold text-slate-400">
                    {fmt(dict.leaders.donations, { count: d.donationsCount })}
                  </div>
                </div>
                <div className="whitespace-nowrap text-base font-extrabold text-emerald-600">{formatMoney(d.totalDonated, dict)}</div>
              </div>
            ))}
          </div>

          {/* Full Leaderboard List */}
          {donors.length > 3 && (
            <ol className="space-y-2.5">
              {donors.slice(3).map((d, idx) => (
                <li key={d.nickname} className="card flex items-center justify-between gap-3 px-4 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-extrabold text-slate-600">
                      {idx + 4}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-slate-900">{d.nickname}</div>
                      <div className="text-xs font-semibold text-slate-400">
                        {fmt(dict.leaders.donations, { count: d.donationsCount })}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 whitespace-nowrap text-right text-sm font-extrabold text-emerald-600">
                    {formatMoney(d.totalDonated, dict)}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
