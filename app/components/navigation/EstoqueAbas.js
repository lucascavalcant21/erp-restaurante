"use client";

// Abas do Estoque (HDEV-EST-001). A primeira é a movimentação — é o que abre
// em Operacional → Estoque. O resto é secundário. Aba sem permissão some
// (Painel e Produtos mostram custo: só quem tem estoque.overview).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useERP } from "../../context/ERPContext";
import { canAccessRoute } from "../../lib/permissions-catalog.mjs";

const ABAS = [
  { href: "/dashboard/operacao/estoque", rotulo: "Movimentar", ativa: (p) => p === "/dashboard/operacao/estoque" || p.startsWith("/dashboard/operacao/estoque/movimentar") },
  { href: "/dashboard/operacao/estoque/contagens", rotulo: "Inventário", ativa: (p) => p.startsWith("/dashboard/operacao/estoque/contagens") },
  { href: "/dashboard/operacao/estoque/historico", rotulo: "Histórico", ativa: (p) => p.startsWith("/dashboard/operacao/estoque/historico") },
  { href: "/dashboard/operacao/estoque/painel", rotulo: "Painel", ativa: (p) => p === "/dashboard/operacao/estoque/painel" },
  { href: "/dashboard/operacao/estoque/painel/produtos", rotulo: "Produtos e locais", ativa: (p) => p.startsWith("/dashboard/operacao/estoque/painel/produtos") },
];

export default function EstoqueAbas() {
  const pathname = usePathname() || "";
  const { sessao } = useERP();
  const visiveis = ABAS.filter((a) => !sessao?.gerenciado || canAccessRoute(sessao, a.href, ""));
  return (
    <nav aria-label="Estoque" className="sticky top-0 z-20 border-b border-hf-border bg-hf-surface print:hidden">
      <div className="mx-auto flex max-w-[1500px] items-center gap-1 overflow-x-auto px-2 [scrollbar-width:none] sm:px-6">
        {visiveis.map((a) => {
          const ativa = a.ativa(pathname);
          return (
            <Link key={a.href} href={a.href} aria-current={ativa ? "page" : undefined}
              className={`inline-flex h-11 shrink-0 items-center border-b-2 px-3 text-sm font-bold transition-colors ${ativa ? "border-hf-accent text-hf-text" : "border-transparent text-hf-text-2 hover:text-hf-text"}`}>
              {a.rotulo}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
