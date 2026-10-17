import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#ea580c",
};

export const metadata: Metadata = {
  title: "Lezzet Durağı | Online Sipariş & QR Menü Sistemi",
  description:
    "GloriaFood alternatif yeni nesil restoran online paket, gel-al ve QR masa sipariş sistemi.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lezzet Durağı",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
