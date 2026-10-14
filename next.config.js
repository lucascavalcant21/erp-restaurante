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
  // Marmitaria reorganizada em seis áreas (14/10/2026): endereços antigos
  // (favoritos, links) levam para a área nova em vez de dar 404.
  async redirects() {
    const m = "/dashboard/marmitaria";
    return [
      ["fichas", "marmitas"], ["cardapio", "marmitas"], ["combos", "marmitas"], ["precificacao", "marmitas?aba=precos"],
      ["producao", "estoque?aba=producao"], ["planejamento", "estoque"], ["compras", "estoque"], ["qualidade", "estoque?aba=producao"],
      ["rh", "funcionarios"], ["dre", "financeiro"], ["cmv-cmo", "financeiro"], ["simulador", "financeiro?aba=simulador"],
      ["pedidos", "financeiro?aba=vendas"], ["assinaturas", "financeiro?aba=vendas"], ["ia-otimizador", ""],
    ].map(([de, para]) => ({ source: `${m}/${de}`, destination: para ? `${m}/${para}` : m, permanent: false }));
  },
  // Build local em máquina com pouca memória (Windows do dono): HEFISTO_BUILD_LEVE=1 usa um
  // processo só para gerar as páginas. Na Vercel a variável não existe: nada muda.
  ...(process.env.HEFISTO_BUILD_LEVE === "1" ? { experimental: { cpus: 1, workerThreads: false } } : {}),
};

module.exports = nextConfig;
