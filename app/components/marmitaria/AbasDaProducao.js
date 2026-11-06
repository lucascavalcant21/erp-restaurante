"use client";

// A produção da marmitaria em um lugar só: o dia na cozinha e o que apoia ele.

import Link from "next/link";

const ROTA = "/dashboard/marmitaria/estoque";

export const ABAS_DA_PRODUCAO = [
  { id: "hoje", rotulo: "Hoje", href: `${ROTA}/cozinha` },
  { id: "subprodutos", rotulo: "Subprodutos", href: `${ROTA}/producoes?aba=subprodutos` },
  { id: "marmitas", rotulo: "Marmitas feitas", href: `${ROTA}/producoes?aba=marmitas` },
  { id: "planejar", rotulo: "Planejar", href: `${ROTA}/producoes?aba=planejar` },
  { id: "pedidos", rotulo: "Pedidos do iFood", href: `${ROTA}/producoes?aba=pedidos` },
];

export default function AbasDaProducao({ ativa }) {
  return (
    <nav aria-label="Partes da produção" className="flex flex-wrap gap-1 rounded-xl bg-hf-elevated p-1 sm:inline-flex sm:max-w-full">
      {ABAS_DA_PRODUCAO.map((a) => (
        <Link key={a.id} href={a.href} aria-current={ativa === a.id ? "page" : undefined}
          className={`flex min-h-[44px] flex-auto items-center justify-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition sm:min-h-[34px] sm:flex-none sm:px-4 ${ativa === a.id ? "bg-hf-surface text-hf-text shadow-sm" : "text-hf-text-2 hover:text-hf-text"}`}>
          {a.rotulo}
        </Link>
      ))}
    </nav>
  );
}
