import type { Metadata } from "next";
import { PRIVATE_METADATA } from "@/lib/seo";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { isAdmin } from "@/lib/admin/session";
import { adminQueues, type AdminBill } from "@/lib/admin/service";
import { AdminClient } from "@/components/AdminClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = PRIVATE_METADATA;

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  const authed = await isAdmin();
  let reported: AdminBill[] = [];
  let pending: AdminBill[] = [];
  let payouts: AdminBill[] = [];
  if (authed) {
    try {
      const q = await adminQueues();
      reported = q.reported;
      pending = q.pending;
      payouts = q.payouts;
    } catch {
      /* DB offline */
    }
  }

  return (
    <AdminClient
      authenticated={authed}
      initialReported={reported}
      initialPending={pending}
      initialPayouts={payouts}
      locale={locale}
      dict={dict}
    />
  );
}
