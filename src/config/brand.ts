/**
 * BRAND CONFIG — the single source of truth for the product name & logo.
 *
 * To rename the whole app or swap the logo:
 *   1. Change NEXT_PUBLIC_BRAND_NAME or NEXT_PUBLIC_BRAND_LOGO in .env.local
 *      (or replace /public/brand/logo.jpg), OR
 *   2. Edit the fallback values below.
 * Every page, header, hero, footer, browser tab favicon, and notification reads from here.
 */
export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || "MehrNuri",
  /** Main brand logo image path (in /public/brand/). Alternative ready: "/brand/logo-minimal.jpg" */
  logoUrl: process.env.NEXT_PUBLIC_BRAND_LOGO?.trim() || "/brand/logo.jpg",
  /** Fallback text/emoji glyph used in plain-text notifications. */
  logo: "🕯️",
  supportTelegram: process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM?.trim() || "",
} as const;
