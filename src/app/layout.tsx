import type { Metadata, Viewport } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import { BRAND } from "@/config/brand";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: BRAND.name,
  description: "Kommunal to'lovlarda o'zaro yordam platformasi",
  icons: {
    icon: BRAND.logoUrl,
    shortcut: BRAND.logoUrl,
    apple: BRAND.logoUrl,
  },
  openGraph: {
    title: BRAND.name,
    description: "Kommunal to'lovlarda o'zaro yordam platformasi",
    images: [BRAND.logoUrl],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" data-scroll-behavior="smooth" className={`${manrope.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased selection:bg-amber-400/30 selection:text-slate-900">{children}</body>
    </html>
  );
}
