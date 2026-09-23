/** @type {import('next').NextConfig} */

const cabecalhosDeSeguranca = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "usb=(self)" },
];

const nextConfig = {
  env: {
    HEFISTO_ENV: process.env.NEXT_PUBLIC_HEFISTO_ENV || process.env.HEFISTO_ENV || "production",
  },
  async headers() {
    return [{ source: "/:path*", headers: cabecalhosDeSeguranca }];
  },
};

module.exports = nextConfig;
