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
  // Build local em máquina com pouca memória (Windows do dono): HEFISTO_BUILD_LEVE=1 usa um
  // processo só para gerar as páginas. Na Vercel a variável não existe: nada muda.
  ...(process.env.HEFISTO_BUILD_LEVE === "1" ? { experimental: { cpus: 1, workerThreads: false } } : {}),
};

module.exports = nextConfig;
