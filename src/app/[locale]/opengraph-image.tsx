import { ImageResponse } from "next/og";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { OG_SIZE, OgCard, ogFonts, ogLogo } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "MehrNuri";

/** Default preview for every page of a locale (home, bills, leaders...). */
export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = getDictionary(isLocale(locale) ? locale : "uz-latn");
  return new ImageResponse(
    <OgCard logo={await ogLogo()} eyebrow={dict.share.tagline} title={dict.home.heroTitle} sub={dict.share.metaDesc} foot={new URL(process.env.APP_URL || "http://localhost:3000").host} />,
    { ...OG_SIZE, fonts: await ogFonts() },
  );
}
