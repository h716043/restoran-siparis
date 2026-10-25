/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  serverExternalPackages: ["node:sqlite"],
  onDemandEntries: {
    // Derlenen sayfaları 24 saat boyunca bellekte tut (sayfalar arası geçişte tekrar derleme yapmasın)
    maxInactiveAge: 1000 * 60 * 60 * 24,
    pagesBufferLength: 100,
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  env: {
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL || "",
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN || "",
    NEXT_PUBLIC_CUSTOMER_ONLY: process.env.NEXT_PUBLIC_CUSTOMER_ONLY || "",
  },
};

export default nextConfig;
