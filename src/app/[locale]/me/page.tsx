import { notFound } from "next/navigation";
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
  try {
    [donor, code] = await Promise.all([currentDonor(), currentRecoveryCode()]);
  } catch {
    /* DB offline */
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{dict.me.title}</h1>
      <ProfileClient
        initialDonor={
          donor ? { nickname: donor.nickname, totalDonated: donor.totalDonated, donationsCount: donor.donationsCount } : null
        }
        recoveryCode={code}
        dict={dict}
      />
    </div>
  );
}
