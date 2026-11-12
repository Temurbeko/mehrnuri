import type { MetadataRoute } from "next";

const BASE = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

/**
 * Search engines may index the public pages (home, leaderboard, how to ask),
 * but never a family's request, payment pages, profiles or share links:
 * a request page carries an account number and a family's story.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/*/bill/", "/*/pay/", "/*/payment/", "/*/h/", "/*/i/", "/*/me", "/*/admin"],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
