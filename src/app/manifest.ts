import type { MetadataRoute } from "next";
import { BRAND } from "@/config/brand";

// Colours mirror --paper / --night in globals.css.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    start_url: "/",
    display: "standalone",
    background_color: "#f6f1e8",
    theme_color: "#151826",
    icons: [
      { src: "/pwa/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
