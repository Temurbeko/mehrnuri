import { Check } from "lucide-react";
import { UTILITY_ICONS, type ReactionType, type UtilityType } from "@/lib/domain";
import { fmt, type Dictionary } from "@/i18n";

export interface ClosedItem {
  id: string;
  utilityType: UtilityType;
  reaction: ReactionType;
  helpers: number;
}

/** "Yaqinda yopildi": thank-you notes from families whose bill was fully paid. */
export function ClosedStrip({ items, dict }: { items: ClosedItem[]; dict: Dictionary }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-8 min-w-0">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="min-w-0 text-[22px] font-extrabold tracking-tight text-[var(--ink)]">{dict.feed.closedTitle}</h2>
        <span className="shrink-0 text-sm font-bold text-[var(--ink-soft)]">{dict.feed.closedSub}</span>
      </div>
      <div className="thanks-strip -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-0.5 pb-2">
        {items.map((c) => (
          <figure
            key={c.id}
            className="m-0 flex min-w-0 shrink-0 basis-[min(78%,300px)] snap-start flex-col gap-3 rounded-[20px] bg-white p-4 shadow-[var(--lift)]"
          >
            <blockquote className="m-0 flex-1 text-[15px] leading-snug text-[var(--ink)]">
              <span aria-hidden="true" className="font-extrabold text-[var(--lamp-deep)]">“</span>
              {dict.reactions.items[c.reaction]}
              <span aria-hidden="true" className="font-extrabold text-[var(--lamp-deep)]">”</span>
            </blockquote>
            <figcaption className="flex flex-wrap items-center gap-2 text-[13px] font-bold text-[var(--ink-soft)]">
              <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(46,154,103,0.1)] px-2 py-0.5 font-extrabold text-[var(--hope)]">
                <Check size={14} aria-hidden="true" />
                {dict.feed.closedPill}
              </span>
              <span>
                {UTILITY_ICONS[c.utilityType]} {dict.utility[c.utilityType]} · {fmt(dict.feed.helpersCount, { count: c.helpers })}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
