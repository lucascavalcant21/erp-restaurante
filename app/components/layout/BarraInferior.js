"use client";

// Abas fixas do rodapé no celular e no tablet (pedido do dono, 14/11/2026,
// visual inspirado no app da Medway). As regras de onde aparece e de quais
// abas cada pessoa vê ficam em app/lib/barra-inferior.mjs.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ListChecks, Menu, Search, Sparkles } from "lucide-react";
import { canAccessRoute, hasPermission } from "../../lib/permissions-catalog.mjs";
import { homeDoUsuario } from "../../lib/auth";
import { abaAtiva, abasVisiveis } from "../../lib/barra-inferior.mjs";

const ICONES = { Home, ListChecks, Menu, Search, Sparkles };

export default function BarraInferior({ sessao, onOpenSearch }) {
  const pathname = usePathname() || "";
  if (!sessao) return null;

  const inicio = sessao.gerenciado ? homeDoUsuario(sessao) : "/dashboard";
  const podeInteligencia = !sessao.gerenciado || hasPermission(sessao, "dashboard.intelligence.view");
  const abas = abasVisiveis({ podeRota: (r) => canAccessRoute(sessao, r, ""), podeInteligencia });
  const ativa = abaAtiva(pathname, inicio);

  const acao = (tipo) => {
    if (tipo === "pesquisar") onOpenSearch?.();
    if (tipo === "assistente") window.dispatchEvent(new CustomEvent("hefisto:toggle-copilot"));
  };

  return (
    <nav
      aria-label="Navegação principal"
      className="erp-barra-inferior shrink-0 border-t border-hf-border bg-hf-surface/95 backdrop-blur xl:hidden print:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-3xl items-stretch justify-around">
        {abas.map((aba) => {
          const Icone = ICONES[aba.icone];
          const acesa = ativa === aba.id;
          const conteudo = (
            <>
              <span
                aria-hidden="true"
                className={`absolute inset-x-3 top-0 h-[3px] rounded-b-full transition-colors ${acesa ? "bg-hf-accent" : "bg-transparent"}`}
              />
              <Icone size={23} strokeWidth={acesa ? 2.2 : 1.8} aria-hidden="true" />
              <span className={`text-[11px] leading-none ${acesa ? "font-semibold" : "font-medium"}`}>{aba.label}</span>
            </>
          );
          const classe = `relative flex min-h-[60px] w-full flex-col items-center justify-center gap-1 px-1 pt-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-hf-accent ${acesa ? "text-hf-text" : "text-hf-muted hover:text-hf-text-2"}`;
          return (
            <li key={aba.id} className="flex-1">
              {aba.href ? (
                <Link href={aba.id === "inicio" ? inicio : aba.href} aria-current={acesa ? "page" : undefined} className={classe}>
                  {conteudo}
                </Link>
              ) : (
                <button type="button" onClick={() => acao(aba.acao)} className={classe}>
                  {conteudo}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
