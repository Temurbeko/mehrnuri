import { Heart, Trophy } from "lucide-react";
import Link from "next/link";
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

  // Podium order on screen: 2nd, 1st, 3rd.
  const podium = [donors[1], donors[0], donors[2]];
  const rest = donors.slice(3);
  const PLACE = [
    { n: 2, ring: "ring-[#c9ced8]", chip: "bg-[#c9ced8] text-[#2b3040]", h: "h-[74px]", size: "h-14 w-14 text-[20px]" },
    { n: 1, ring: "ring-[var(--glow)]", chip: "bg-[var(--glow)] text-[#3b2508]", h: "h-[98px]", size: "h-[68px] w-[68px] text-[24px]" },
    { n: 3, ring: "ring-[#d99a6c]", chip: "bg-[#d99a6c] text-[#3b2508]", h: "h-[58px]", size: "h-14 w-14 text-[20px]" },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-[26px] leading-tight font-extrabold tracking-tight text-[var(--ink)]">{dict.leaders.title}</h1>
        <p className="mt-1 text-[14px] text-[var(--ink-soft)]">{dict.leaders.subtitle}</p>
      </div>

      {donors.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(246,166,35,0.16)] text-[var(--lamp-deep)]">
            <Trophy size={30} aria-hidden="true" />
          </span>
          <p className="text-[17px] font-extrabold text-[var(--ink)]">{dict.leaders.empty}</p>
          <Link href={`/${locale}`} className="btn-primary mt-1 w-auto px-6">
            <Heart size={18} aria-hidden="true" />
            {dict.home.wantHelp}
          </Link>
        </div>
      ) : (
        <>
          {/* Top three on a podium */}
          <ol className="hero-mesh m-0 grid list-none grid-cols-3 items-end gap-2 rounded-[24px] px-3 pt-5 text-[#f6efe3]">
            {podium.map((d, i) => {
              const p = PLACE[i]!;
              return (
                <li key={p.n} className="flex min-w-0 flex-col items-center">
                  {d ? (
                    <>
                      <span className={`flex shrink-0 items-center justify-center rounded-full bg-[#262b47] font-extrabold ring-[3px] ${p.ring} ${p.size}`}>
                        {d.nickname.slice(0, 1).toUpperCase()}
                      </span>
                      <b className="mt-2 block w-full truncate text-center text-[13.5px] leading-tight">{d.nickname}</b>
                      <span className="mt-0.5 block w-full truncate text-center text-[12.5px] font-extrabold text-[var(--glow)] tabular-nums">
                        {formatMoney(d.totalDonated, dict)}
                      </span>
                    </>
                  ) : (
                    <span className={`shrink-0 rounded-full bg-[rgba(255,255,255,0.06)] ${p.size}`} />
                  )}
                  <span className={`mt-2 flex w-full items-start justify-center rounded-t-[14px] bg-[rgba(255,255,255,0.08)] pt-2 ${p.h}`}>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-extrabold ${p.chip}`}>{p.n}</span>
                  </span>
                </li>
              );
            })}
          </ol>

          {rest.length > 0 && (
            <ol start={4} className="list m-0">
              {rest.map((d, idx) => (
                <li key={d.nickname} className="flex min-h-[60px] min-w-0 items-center gap-3 px-4 py-2.5">
                  <span className="w-6 shrink-0 text-center text-[14px] font-extrabold text-[var(--ink-soft)] tabular-nums">{idx + 4}</span>
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--glow)] text-sm font-extrabold text-[#3b2508]"
                  >
                    {d.nickname.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-extrabold text-[var(--ink)]">{d.nickname}</div>
                    <div className="truncate text-[12.5px] font-bold text-[var(--ink-soft)]">{fmt(dict.leaders.donations, { count: d.donationsCount })}</div>
                  </div>
                  <div className="shrink-0 text-right text-[14.5px] font-extrabold whitespace-nowrap text-[var(--hope)] tabular-nums">
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
