import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/**
 * This machine's current local-network IPv4 addresses, so phones and other
 * devices on the same Wi-Fi can open the dev server (http://<ip>:3000).
 * Computed at startup because the Wi-Fi address changes; dev-only setting.
 */
function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i!.address);
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://my.click.uz https://checkout.paycom.uz https://test.paycom.uz https://www.apelsin.uz https://uzumbank.uz https://app.paynet.uz" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins: lanAddresses(),
  // No floating "N" badge while developing (it only ever showed locally); build
  // and runtime errors still appear.
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
