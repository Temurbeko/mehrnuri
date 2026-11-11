import Link from "next/link";
import { Shield } from "lucide-react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { OWNER_COOKIE, ownedBillIds } from "@/lib/bills/owner";
import { getBillsByIds, toPublicBill } from "@/lib/bills/service";
import { MyRequests, type MyRequest } from "@/components/MyRequests";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { currentDonor, currentRecoveryCode } from "@/lib/donors/session";
import { ProfileClient } from "@/components/ProfileClient";

export const dynamic = "force-dynamic";

export default async function MePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  let donor = null;
  let code = null;
  let myRequests: MyRequest[] = [];
  try {
    const jar = await cookies();
    const [d, c, owned] = await Promise.all([
      currentDonor(),
      currentRecoveryCode(),
      getBillsByIds(ownedBillIds(jar.get(OWNER_COOKIE)?.value)),
    ]);
    donor = d;
    code = c;
    myRequests = owned.map((b) => ({ bill: toPublicBill(b), reviewStatus: b.reviewStatus, isOpen: b.isOpen }));
  } catch {
    /* DB offline */
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">{dict.me.title}</h1>
      <MyRequests items={myRequests} locale={locale} dict={dict} />
      <ProfileClient
        initialDonor={
          donor ? { nickname: donor.nickname, totalDonated: donor.totalDonated, donationsCount: donor.donationsCount } : null
        }
        recoveryCode={code}
        dict={dict}
      />
      <div className="pt-4 text-center">
        <Link href={`/${locale}/admin`} className="text-xs font-medium text-stone-400 hover:text-stone-600">
          <span className="inline-flex items-center gap-1.5"><Shield size={16} aria-hidden="true" />{dict.nav.admin}</span>
        </Link>
      </div>
    </div>
  );
}
