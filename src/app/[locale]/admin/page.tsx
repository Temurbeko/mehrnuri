import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { isAdmin } from "@/lib/admin/session";
import { adminQueues, type AdminBill } from "@/lib/admin/service";
import { AdminClient } from "@/components/AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  const authed = await isAdmin();
  let pending: AdminBill[] = [];
  let payouts: AdminBill[] = [];
  if (authed) {
    try {
      const q = await adminQueues();
      pending = q.pending;
      payouts = q.payouts;
    } catch {
      /* DB offline */
    }
  }

  return <AdminClient authenticated={authed} initialPending={pending} initialPayouts={payouts} dict={dict} />;
}
