"use client";

// Barra do Estoque. Uma tela só (pedido do dono, 27/10/2026: "deixe uma coisa
// só, no estoque está cheio de páginas"): Estoque é a tela principal; o resto
// fica no "Mais". Item sem permissão some (Valor do estoque e Produtos e
// locais mostram custo: só quem tem estoque.overview).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronLeft, MoreHorizontal } from "lucide-react";
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

  return (
    <nav aria-label="Estoque" className="sticky top-0 z-20 border-b border-hf-border bg-hf-surface print:hidden">
      <div className="mx-auto flex h-12 max-w-[1500px] items-center gap-2 px-3 sm:px-6">
        {naPrincipal ? (
          <span className="text-sm font-black text-hf-text">Estoque</span>
        ) : (
          <>
            <Link href={PRINCIPAL} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm font-bold text-hf-accent hover:bg-hf-elevated"><ChevronLeft size={16} /> Estoque</Link>
            <span className="truncate text-sm font-black text-hf-text">{atual.rotulo}</span>
          </>
        )}
        {itens.length > 0 && (
          <div ref={caixa} className="relative ml-auto">
            <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} aria-haspopup="menu"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-hf-border bg-hf-surface px-3 text-sm font-bold text-hf-text">
              <MoreHorizontal size={16} /> Mais <ChevronDown size={14} />
            </button>
            {aberto && (
              <div role="menu" className="absolute right-0 top-11 w-64 overflow-hidden rounded-2xl border border-hf-border bg-hf-surface py-1 shadow-xl">
                {itens.map((m) => (
                  <Link key={m.href} role="menuitem" href={m.href} aria-current={atual?.href === m.href ? "page" : undefined}
                    className={`block px-4 py-2.5 text-sm font-bold hover:bg-hf-elevated ${atual?.href === m.href ? "text-hf-accent" : "text-hf-text"}`}>{m.rotulo}</Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
