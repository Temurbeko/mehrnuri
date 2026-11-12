import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { UTILITY_ICONS, type PublicBill, type ReviewStatus } from "@/lib/domain";
import type { Locale } from "@/i18n/config";
import { formatMoney, type Dictionary } from "@/i18n";

export interface MyRequest {
  bill: PublicBill;
  reviewStatus: ReviewStatus;
  isOpen: boolean;
}

/**
 * The requests this browser posted (from the signed owner cookie), with their
 * code and where they stand. Families had no way back to a request after
 * leaving the success screen.
 */
export function MyRequests({ items, locale, dict }: { items: MyRequest[]; locale: Locale; dict: Dictionary }) {
  if (items.length === 0) return null;
  const t = dict.me;

  return (
    <section id="my-requests">
      <ul className="list">
        {items.map(({ bill, reviewStatus, isOpen }) => {
          const remaining = Math.max(0, bill.amountOwed - bill.paidAmount);
          const status = statusText({ bill, reviewStatus, isOpen }, dict);
          return (
            <li key={bill.id}>
              <Link href={`/${locale}/bill/${bill.id}`} className="list-row-tap flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--tone)] text-[19px]">
                  {UTILITY_ICONS[bill.utilityType]}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[15px] text-[var(--ink)]">{dict.utility[bill.utilityType]}</b>
                  <small className="block truncate text-[13px] text-[var(--ink-soft)]">
                    <span className="tabular-nums">{bill.code}</span> · {t.remainingShort} {formatMoney(remaining, dict)}
                  </small>
                </span>
                <span className={`max-w-[40%] shrink-0 truncate text-[12px] font-bold ${status.tone}`}>{status.label}</span>
                <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-[var(--ink-soft)]" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function statusText(item: MyRequest, dict: Dictionary): { label: string; tone: string } {
  const { bill, reviewStatus, isOpen } = item;
  if (reviewStatus === "pending_review") return { label: dict.status.pending_review, tone: "text-[var(--lamp-deep)]" };
  if (reviewStatus === "flagged") return { label: dict.status.flagged, tone: "text-rose-700" };
  if (reviewStatus === "rejected") return { label: dict.status.rejected, tone: "text-rose-700" };
  if (bill.payoutStatus === "paid_out") return { label: dict.status.paid_out, tone: "text-[var(--hope)]" };
  if (bill.fundingStatus === "fully_paid") return { label: dict.status.fully_paid, tone: "text-[var(--hope)]" };
  if (!isOpen) return { label: dict.me.closed, tone: "text-[var(--ink-soft)]" };
  return { label: dict.status[bill.fundingStatus], tone: "text-[var(--ink-soft)]" };
}
