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
    <div className="card mx-auto max-w-md space-y-6 text-center p-7">
      <div
        className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-3xl ring-1 ${
          paid
            ? "bg-emerald-500/15 text-emerald-600 ring-emerald-500/25"
            : pending
              ? "bg-amber-500/15 text-amber-600 ring-amber-500/25"
              : "bg-rose-500/15 text-rose-600 ring-rose-500/25"
        }`}
      >
        {paid ? <Heart size={32} aria-hidden="true" /> : pending ? <Clock size={32} aria-hidden="true" /> : <X size={32} aria-hidden="true" />}
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          {paid ? dict.result.paidTitle : pending ? dict.result.pendingTitle : dict.result.failedTitle}
        </h1>
        <p className="text-xl font-extrabold text-emerald-600">{formatMoney(amount, dict)}</p>
        <p className="text-sm font-medium text-slate-600 leading-relaxed">
          {paid ? dict.result.paidBody : pending ? dict.result.pendingBody : dict.result.failedBody}
        </p>
      </div>

      <div className="space-y-2.5 pt-1">
        <Link href={`/${locale}/bill/${billId}`} className="btn-primary">
          <span>{dict.result.backToBill}</span>
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link href={`/${locale}`} className="btn-outline">
          {dict.result.backToFeed}
        </Link>
      </div>
    </div>
  );
}
