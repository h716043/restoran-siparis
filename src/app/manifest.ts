import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lezzet Durağı | Online Sipariş & QR Menü",
    short_name: "Lezzet Durağı",
    description:
      "Mobil uyumlu online paket servis, gel-al, QR masa siparişi, garson ve kurye terminali.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#ea580c",
    orientation: "portrait",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
