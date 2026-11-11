import { NextResponse, type NextRequest } from "next/server";
import { detectAcceptLanguage, isLocale, type Locale } from "@/i18n/config";

const LOCALE_COOKIE = "mn_locale";
const burst = new Map<string, { count: number; resetAt: number }>();
const BURST_LIMIT = 300;
const BURST_WINDOW_MS = 60_000;

function ipOf(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

function burstExceeded(ip: string): boolean {
  const now = Date.now();
  if (burst.size > 20_000) for (const [k, v] of burst) if (v.resetAt < now) burst.delete(k);
  const b = burst.get(ip);
  if (!b || b.resetAt < now) {
    burst.set(ip, { count: 1, resetAt: now + BURST_WINDOW_MS });
    return false;
  }
  b.count++;
  return b.count > BURST_LIMIT;
}

function preferredLocale(req: NextRequest): Locale {
  const fromCookie = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  return detectAcceptLanguage(req.headers.get("accept-language"));
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (burstExceeded(ipOf(req))) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: { "retry-after": "60" } });
    }
    return NextResponse.next();
  }

  const first = pathname.split("/")[1];
  if (isLocale(first)) {
    const res = NextResponse.next();
    if (req.cookies.get(LOCALE_COOKIE)?.value !== first) {
      res.cookies.set(LOCALE_COOKIE, first, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }
    return res;
  }

  const url = req.nextUrl.clone();
  url.pathname = `/${preferredLocale(req)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)"],
};
