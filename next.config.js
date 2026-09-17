/** @type {import('next').NextConfig} */

const cabecalhosDeSeguranca = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "usb=(self)" },
];

const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: cabecalhosDeSeguranca }];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination:
          process.env.NODE_ENV === "development"
            ? "http://localhost:3001/api/:path*"
            : "/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
