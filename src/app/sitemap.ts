import type { MetadataRoute } from "next";
import { LOCALES } from "@/i18n/config";

const BASE = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

/** The public pages in every language, each pointing at its translations. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: "", priority: 1, changeFrequency: "hourly" as const },
    { path: "/ask", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/leaders", priority: 0.6, changeFrequency: "daily" as const },
  ];
  return pages.flatMap((p) =>
    LOCALES.map((l) => ({
      url: `${BASE}/${l}${p.path}`,
      changeFrequency: p.changeFrequency,
      priority: p.priority,
      alternates: { languages: Object.fromEntries(LOCALES.map((x) => [x, `${BASE}/${x}${p.path}`])) },
    })),
  );
}
