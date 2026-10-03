"use client";

// Abas da área de Estoque. Eram duas entradas no menu ("Controle de Estoque" e
// "Inventários / Contagens") que pareciam dois sistemas; agora é uma área só,
// "Estoque": o saldo e os movimentos numa aba, a contagem (inventário) na
// outra — e fechar a contagem atualiza o saldo da primeira.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, ClipboardCheck } from "lucide-react";

const ABAS = [
  { href: "/dashboard/operacao/estoque?gestao=1", rotulo: "Saldos e movimentos", icone: Boxes, ativa: (p) => p === "/dashboard/operacao/estoque" },
  { href: "/dashboard/operacao/estoque/contagens", rotulo: "Contagem (inventário)", icone: ClipboardCheck, ativa: (p) => p.startsWith("/dashboard/operacao/estoque/contagens") },
];

export default function EstoqueAbas() {
  const pathname = usePathname() || "";
  return (
    <nav aria-label="Estoque" className="border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-[1500px] items-center gap-1 overflow-x-auto px-3 sm:px-7">
        <span className="mr-2 hidden py-3 text-xs font-black uppercase tracking-widest text-slate-500 sm:inline">Estoque</span>
        {ABAS.map((a) => {
          const ativa = a.ativa(pathname);
          const Icone = a.icone;
          return (
            <Link key={a.href} href={a.href} aria-current={ativa ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-bold transition-colors ${ativa ? "border-emerald-600 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"}`}>
              <Icone size={16} aria-hidden className={ativa ? "text-emerald-700" : ""} /> {a.rotulo}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
