import { ImageResponse } from "next/og";
import { getDictionary, fmt, formatMoney } from "@/i18n";
import { isLocale, LOCALE_HTML_LANG } from "@/i18n/config";
import { UTILITY_ICONS } from "@/lib/domain";
import { getSharedImpact, monthLabel, parseMonthParam } from "@/lib/impact";
import { OG_SIZE, OgCard, ogFonts, ogLogo } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "MehrNuri";

/** The picture Telegram/WhatsApp/Facebook show for a shared monthly impact link. */
export default async function Image({ params }: { params: Promise<{ locale: string; code: string; month: string }> }) {
  const { locale: rawLocale, code, month: raw } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : "uz-latn";
  const dict = getDictionary(locale);
  const { month, withAmount } = parseMonthParam(raw);
  const impact = await getSharedImpact(code, month).catch(() => null);
  const t = dict.impact;

  const title = impact
    ? fmt(withAmount ? t.headlineSum : t.headline, {
        nickname: impact.nickname,
        month: monthLabel(month, LOCALE_HTML_LANG[locale]),
        count: impact.families,
        amount: formatMoney(impact.total, dict),
      })
    : dict.share.tagline;

  return new ImageResponse(
    (
      <OgCard
        logo={await ogLogo()}
        eyebrow={t.eyebrow}
        title={title}
        sub={impact ? impact.utilities.map((u) => dict.utilityBill[u]).join(" · ") : undefined}
        foot={dict.share.tagline}
      />
    ),
    { ...OG_SIZE, fonts: await ogFonts() },
  );
}
