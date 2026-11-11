"use client";

import { Clock, Heart, X } from "lucide-react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { PaymentStatus } from "@/lib/domain";
import type { Locale } from "@/i18n/config";
import { formatMoney, type Dictionary } from "@/i18n";

export function PaymentResultClient({
  initialStatus,
  amount,
  billId,
  locale,
  dict,
}: {
  paymentId: string;
  initialStatus: PaymentStatus;
  amount: number;
  billId: string;
  locale: Locale;
  dict: Dictionary;
}) {
  const paid = initialStatus === "paid";
  const pending = initialStatus === "created" || initialStatus === "processing";

  return (
    <div className="mx-auto max-w-md space-y-6 pt-4 text-center">
      <div
        className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full ${
          paid ? "bg-emerald-100 text-emerald-600" : pending ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"
        }`}
      >
        {paid ? <Heart size={44} aria-hidden="true" /> : pending ? <Clock size={44} aria-hidden="true" /> : <X size={44} aria-hidden="true" />}
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">
          {paid ? dict.result.paidTitle : pending ? dict.result.pendingTitle : dict.result.failedTitle}
        </h1>
        <p className="text-4xl font-extrabold tracking-tight whitespace-nowrap text-stone-900">{formatMoney(amount, dict)}</p>
        <p className="text-sm leading-relaxed font-medium text-stone-600">
          {paid ? dict.result.paidBody : pending ? dict.result.pendingBody : dict.result.failedBody}
        </p>
      </div>

      <div className="space-y-2.5 pt-1">
        <Link href={`/${locale}/bill/${billId}`} className="btn-primary">
          <span>{dict.result.backToBill}</span>
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link href={`/${locale}`} className="btn-tonal">
          {dict.result.backToFeed}
        </Link>
      </div>
    </div>
  );
}
