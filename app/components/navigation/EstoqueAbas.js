"use client";

// Barra do Estoque. Uma tela só (pedido do dono, 27/10/2026: "deixe uma coisa
// só, no estoque está cheio de páginas"): Estoque é a tela principal; o resto
// fica no "Mais". Item sem permissão some (Valor do estoque e Produtos e
// locais mostram custo: só quem tem estoque.overview).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import CabecalhoTela from "../ui/CabecalhoTela";
import { useERP } from "../../context/ERPContext";
import { canAccessRoute } from "../../lib/permissions-catalog.mjs";

const PRINCIPAL = "/dashboard/operacao/estoque";
const MAIS = [
  { href: "/dashboard/operacao/estoque/historico", rotulo: "Histórico de movimentos" },
  { href: "/dashboard/operacao/estoque/contagens", rotulo: "Inventário (contagem)" },
  { href: "/dashboard/operacao/estoque/painel/produtos", rotulo: "Produtos e locais (cadastro)" },
  { href: "/dashboard/operacao/estoque/painel", rotulo: "Valor do estoque", exato: true },
];
const ehDe = (p, m) => (m.exato ? p === m.href : p.startsWith(m.href));

export default function EstoqueAbas() {
  const pathname = usePathname() || "";
  const { sessao } = useERP();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef(null);
  const itens = MAIS.filter((a) => !sessao?.gerenciado || canAccessRoute(sessao, a.href, ""));
  const atual = MAIS.find((m) => ehDe(pathname, m) && !(m.href === "/dashboard/operacao/estoque/painel" && pathname.startsWith("/dashboard/operacao/estoque/painel/")));
  const naPrincipal = !atual;
  useEffect(() => {
    if (!aberto) return;
    const fora = (e) => { if (!caixa.current?.contains(e.target)) setAberto(false); };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);
  useEffect(() => { setAberto(false); }, [pathname]);

  // Visual do Nina (07/11/2026): o cabeçalho padrão das telas, com o "Mais" como ação.
  return (
    <div className="border-b border-hf-border print:hidden">
      <div className="mx-auto max-w-[1500px]">
        <CabecalhoTela titulo={naPrincipal ? null : atual.rotulo} voltarPara={naPrincipal ? null : PRINCIPAL} className="!pb-3">
          {itens.length > 0 && (
            <div ref={caixa} className="relative">
              <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} aria-haspopup="menu"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-hf-border bg-hf-surface px-4 text-sm font-semibold text-hf-text shadow-none hover:bg-hf-elevated">
                <MoreHorizontal size={16} /> Mais <ChevronDown size={14} />
              </button>
              {aberto && (
                <div role="menu" className="absolute right-0 top-12 z-30 w-64 overflow-hidden rounded-2xl border border-hf-border bg-hf-surface py-1 shadow-xl">
                  {itens.map((m) => (
                    <Link key={m.href} role="menuitem" href={m.href} aria-current={atual?.href === m.href ? "page" : undefined}
                      className={`block px-4 py-3 text-sm font-semibold hover:bg-hf-elevated ${atual?.href === m.href ? "text-hf-accent" : "text-hf-text"}`}>{m.rotulo}</Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </CabecalhoTela>
      </div>
    </div>
  );
}
