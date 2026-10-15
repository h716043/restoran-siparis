/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["node:sqlite"],
  env: {
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL || "",
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN || "",
    NEXT_PUBLIC_CUSTOMER_ONLY: process.env.NEXT_PUBLIC_CUSTOMER_ONLY || "",
  },
};

export default nextConfig;
