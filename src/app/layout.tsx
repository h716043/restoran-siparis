import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lezzet Durağı | Online Sipariş & QR Menü Sistemi",
  description: "GloriaFood alternatif yeni nesil restoran online paket, gel-al ve QR masa sipariş sistemi.",
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
