import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { BRAND } from "@/config/brand";
import "./globals.css";
import "./motion.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  // One typeface, three weights: medium (text), bold (actions), extrabold (headings, amounts).
  weight: ["500", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});


export const metadata: Metadata = {
  // absolute URLs for link previews (og:image) and the sitemap
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: BRAND.name,
  description: "Kommunal to'lovlarda o'zaro yordam platformasi",
  icons: {
    icon: BRAND.logoUrl,
    shortcut: BRAND.logoUrl,
    apple: "/pwa/180.png",
  },
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "default" },
  openGraph: {
    title: BRAND.name,
    description: "Kommunal to'lovlarda o'zaro yordam platformasi",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#151826",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" data-scroll-behavior="smooth" className={manrope.variable}>
      <body className="antialiased selection:bg-amber-400/30 selection:text-stone-900">{children}</body>
    </html>
  );
}
