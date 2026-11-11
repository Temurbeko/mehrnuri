import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
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
    <section id="my-requests" className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-stone-900">
        <FileText size={20} aria-hidden="true" className="text-amber-600" />
        {t.myRequests}
      </h2>
      <ul className="list">
        {items.map(({ bill, reviewStatus, isOpen }) => {
          const remaining = Math.max(0, bill.amountOwed - bill.paidAmount);
          const status = statusText({ bill, reviewStatus, isOpen }, dict);
          return (
            <li key={bill.id}>
              <Link href={`/${locale}/bill/${bill.id}`} className="list-row-tap min-w-0">
                <span className="text-2xl" aria-hidden="true">
                  {UTILITY_ICONS[bill.utilityType]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-sm font-extrabold whitespace-nowrap text-stone-900">{bill.code}</span>
                    <span className={`truncate text-xs font-bold ${status.tone}`}>{status.label}</span>
                  </span>
                  <span className="block truncate text-sm text-stone-600">
                    {dict.utility[bill.utilityType]} · {t.remainingShort} {formatMoney(remaining, dict)}
                  </span>
                </span>
                <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-stone-400" />
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
  if (reviewStatus === "pending_review") return { label: dict.status.pending_review, tone: "text-amber-700" };
  if (reviewStatus === "flagged") return { label: dict.status.flagged, tone: "text-rose-700" };
  if (reviewStatus === "rejected") return { label: dict.status.rejected, tone: "text-rose-700" };
  if (bill.payoutStatus === "paid_out") return { label: dict.status.paid_out, tone: "text-emerald-700" };
  if (bill.fundingStatus === "fully_paid") return { label: dict.status.fully_paid, tone: "text-emerald-700" };
  if (!isOpen) return { label: dict.me.closed, tone: "text-stone-500" };
  return { label: dict.status[bill.fundingStatus], tone: "text-stone-600" };
}
