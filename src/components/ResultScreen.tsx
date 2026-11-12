import Link from "next/link";
import type { ReactNode } from "react";

export interface ResultAction {
  key: string;
  label: string;
  icon: ReactNode;
  /** A link when `href` is set, otherwise a button. */
  href?: string;
  onClick?: () => void;
}

export interface ResultRow {
  label: string;
  value: string;
}

/** Tinted rounded-square status icon (amber clock, rose X, green shield ...). */
export function StatusIcon({ tone, children }: { tone: "ok" | "wait" | "fail"; children: ReactNode }) {
  const tint =
    tone === "ok"
      ? "bg-[rgba(46,154,103,0.14)] text-[var(--hope)]"
      : tone === "wait"
        ? "bg-[rgba(246,166,35,0.2)] text-[var(--lamp-deep)]"
        : "bg-rose-100 text-rose-600";
  return <span className={`mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] ${tint}`}>{children}</span>;
}

/**
 * A full-screen result (payment done, pending, failed, request sent) in the
 * style of a banking app: status card on top, round quick actions and one big
 * main button pinned to the bottom. No tab bar: the caller hides it.
 */
export function ResultScreen({
  art,
  title,
  date,
  amount,
  body,
  rows,
  actions = [],
  mainLabel,
  mainHref,
  children,
}: {
  /** Status illustration or icon (ThanksArt inside `.hs-active`, or a StatusIcon). */
  art: ReactNode;
  title: string;
  date?: string | null;
  amount?: string | null;
  body?: string | null;
  rows?: ResultRow[];
  actions?: ResultAction[];
  mainLabel: string;
  mainHref: string;
  /** Rendered under the status card (e.g. the receipt box). */
  children?: ReactNode;
}) {
  const round = "flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[var(--tone)] text-[var(--ink)] transition active:scale-95";
  const cell = "flex min-w-0 flex-col items-center gap-1.5 text-[12.5px] leading-tight font-bold text-[var(--ink)]";

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-6">
      <div className="surface px-5 pt-6 pb-5 text-center">
        <div>{art}</div>
        <h1 className="mt-3 text-[24px] leading-tight font-extrabold tracking-tight text-balance break-words text-[var(--ink)]">{title}</h1>
        {date && <p className="mt-1 text-[13.5px] font-semibold text-[var(--ink-soft)]">{date}</p>}
        {amount && <p className="mt-1.5 text-[30px] leading-tight font-extrabold tracking-tight break-words text-[var(--ink)] tabular-nums">{amount}</p>}
        {body && <p className="mx-auto mt-2 max-w-[36ch] text-[14.5px] leading-snug text-balance break-words text-[var(--ink-soft)]">{body}</p>}
        {rows && rows.length > 0 && (
          <dl className="m-0 mt-4 divide-y divide-[var(--hairline)] border-t border-[var(--hairline)] text-left">
            {rows.map((r) => (
              <div key={r.label} className="flex min-w-0 items-start justify-between gap-3 py-2.5">
                <dt className="shrink-0 text-[14px] text-[var(--ink-soft)]">{r.label}</dt>
                <dd className="m-0 min-w-0 text-right text-[14.5px] font-bold break-words text-[var(--ink)]">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {children && <div className="mt-4 min-w-0">{children}</div>}

      <div className="sticky bottom-0 z-30 -mx-4 mt-auto bg-gradient-to-t from-[var(--paper)] via-[var(--paper)] to-transparent px-4 pt-8 pb-[calc(env(safe-area-inset-bottom)+14px)]">
        {actions.length > 0 && (
          <div className="mb-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(actions.length, 4)}, minmax(0, 1fr))` }}>
            {actions.slice(0, 4).map((a) =>
              a.href ? (
                <Link key={a.key} href={a.href} className={cell}>
                  <span className={round} aria-hidden="true">{a.icon}</span>
                  <span className="w-full truncate text-center">{a.label}</span>
                </Link>
              ) : (
                <button key={a.key} type="button" onClick={a.onClick} className={`${cell} cursor-pointer`}>
                  <span className={round} aria-hidden="true">{a.icon}</span>
                  <span className="w-full truncate text-center">{a.label}</span>
                </button>
              ),
            )}
          </div>
        )}
        <Link href={mainHref} className="btn-primary w-full text-lg">
          {mainLabel}
        </Link>
      </div>
    </div>
  );
}
