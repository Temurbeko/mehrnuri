import { ImageResponse } from "next/og";
import { getDictionary, fmt, formatMoney } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getSharedHelp } from "@/lib/payments/core";
import { OG_SIZE, OgCard, ogFonts, ogLogo } from "@/lib/og";
import { parseShareParam } from "./share";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "MehrNuri";

/** The picture Telegram/WhatsApp/Facebook show for a shared help link. */
export default async function Image({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code: raw } = await params;
  const dict = getDictionary(isLocale(locale) ? locale : "uz-latn");
  const { code, withAmount } = parseShareParam(raw);
  const help = await getSharedHelp(code).catch(() => null);
  const t = dict.share;

  const title = help
    ? withAmount
      ? fmt(t.headlineSum, { nickname: help.nickname, amount: formatMoney(help.amount, dict) })
      : fmt(t.headline, { nickname: help.nickname })
    : t.tagline;

  return new ImageResponse(
    (
      <OgCard
        logo={await ogLogo()}
        eyebrow={t.eyebrow}
        title={title}
        sub={help ? dict.utilityBill[help.utilityType] : undefined}
        foot={t.tagline}
      />
    ),
    { ...OG_SIZE, fonts: await ogFonts() },
  );
}
