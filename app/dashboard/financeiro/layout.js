"use client";

// Financeiro: as áreas numa barra só, como Marmitaria e Eventos. Antes cada
// tela tinha um jeito de chegar nas outras (botões soltos, setas de voltar, o
// submenu do topo com só 5 delas) e havia três "fluxos de caixa", duas telas
// de margem e uma de boletos separada de Contas a Pagar. As antigas
// (/fluxo, /documentos, /margem, /custos-fixos, /equilibrio, /recebiveis,
// /conciliacao) redirecionam e não aparecem aqui.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useERP } from "../../context/ERPContext";
import { canAccessRoute } from "../../lib/permissions-catalog.mjs";

const BASE = "/dashboard/financeiro";
const AREAS = [
  { href: BASE, rotulo: "Visão geral", exato: true },
  { href: `${BASE}/contas`, rotulo: "Contas a pagar", curto: "A pagar" },
  { href: `${BASE}/receber`, rotulo: "Contas a receber", curto: "A receber" },
  { href: `${BASE}/caixa`, rotulo: "Caixa e contas", curto: "Caixa" },
  { href: `${BASE}/dre`, rotulo: "DRE" },
  // No lugar da Pizza do Lucro (pedido do dono, 27/10/2026); a pizza do prato segue em /pizza, ligada daqui.
  { href: `${BASE}/resultado`, rotulo: "Resultado do mês", curto: "Resultado" },
  { href: `${BASE}/cmv`, rotulo: "CMV" },
];

export default function FinanceiroLayout({ children }) {
  const pathname = usePathname() || "";
  const { sessao } = useERP();
  const pode = (href) => !sessao?.gerenciado || canAccessRoute(sessao, href);
  const areas = AREAS.filter((a) => pode(a.href));
  const conhecida = AREAS.some((a) => (a.exato ? pathname === a.href : pathname === a.href || pathname.startsWith(`${a.href}/`)));

  return (
    <>
      {areas.length > 1 && conhecida && (
        <div className="bg-hf-bg px-4 pt-3 sm:px-6 lg:px-8 print:hidden">
          {/* Visual do Nina (07/11/2026): uma faixa de pílulas que rola de lado no celular. */}
          <nav aria-label="Áreas do financeiro" className="mx-auto flex max-w-7xl gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {areas.map((a) => {
              const ativo = a.exato ? pathname === a.href : pathname === a.href || pathname.startsWith(`${a.href}/`);
              return (
                <Link key={a.href} href={a.href} aria-current={ativo ? "page" : undefined}
                  className={`flex min-h-[40px] shrink-0 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold transition ${ativo ? "bg-hf-menu text-white" : "border border-hf-border bg-hf-surface text-hf-text-2 hover:bg-hf-elevated hover:text-hf-text"}`}>
                  {a.rotulo}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
      {children}
    </>
  );
}
