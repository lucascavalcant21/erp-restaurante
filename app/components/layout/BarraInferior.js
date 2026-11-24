"use client";

// Abas fixas do rodapé no celular e no tablet (pedido do dono, 14/11/2026,
// visual inspirado no app da Medway). As regras de onde aparece e de quais
// abas cada pessoa vê ficam em app/lib/barra-inferior.mjs.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bike, BrainCircuit, Home, Menu, Search } from "lucide-react";
import { canAccessRoute, hasPermission } from "../../lib/permissions-catalog.mjs";
import { homeDoUsuario } from "../../lib/auth";
import { abaAtiva, abasVisiveis } from "../../lib/barra-inferior.mjs";
import { assistenteDaSessao } from "../../lib/assistentes.mjs";

// Ícones como os da Medway: casa, cérebro (assistente), lupa, quadrado com check e menu.
const ICONES = { Bike, Home, Menu, Search, Sparkles: BrainCircuit };

// Campo que abre o teclado do celular/tablet (texto, número, busca…).
const SEM_TECLADO = new Set(["checkbox", "radio", "button", "submit", "reset", "range", "color", "file", "image", "hidden"]);
function abreTeclado(el) {
  if (!el || el.disabled || el.readOnly) return false;
  if (el.isContentEditable || el.tagName === "TEXTAREA") return true;
  return el.tagName === "INPUT" && !SEM_TECLADO.has(String(el.type || "text").toLowerCase());
}

// Com o teclado aberto a barra some: ela não sobe junto e não tampa o que se
// digita (dono, 24/11/2026, tablet Android). Só em tela de toque.
function useTecladoAberto() {
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    const toque = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    if (!toque) return undefined;
    let espera;
    const conferir = () => { clearTimeout(espera); espera = setTimeout(() => setAberto(abreTeclado(document.activeElement)), 60); };
    document.addEventListener("focusin", conferir);
    document.addEventListener("focusout", conferir);
    return () => { clearTimeout(espera); document.removeEventListener("focusin", conferir); document.removeEventListener("focusout", conferir); };
  }, []);
  return aberto;
}

export default function BarraInferior({ sessao, onOpenSearch }) {
  const pathname = usePathname() || "";
  const tecladoAberto = useTecladoAberto();
  if (!sessao || tecladoAberto) return null;

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
      className="erp-barra-inferior shrink-0 border-t border-mw-borda bg-mw-card xl:hidden print:hidden"
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
                className={`absolute inset-x-2 top-0 h-[3px] rounded-b-full transition-colors ${acesa ? "bg-mw-agua" : "bg-transparent"}`}
              />
              <Icone size={26} strokeWidth={1.6} aria-hidden="true" />
              <span className="text-[12px] font-medium leading-none">{aba.id === "assistente" ? assistenteDaSessao(sessao).nome : aba.label}</span>
            </>
          );
          const classe = `relative flex min-h-[64px] w-full flex-col items-center justify-center gap-1 px-1 pt-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mw-agua ${acesa ? "text-mw-agua" : "text-mw-texto hover:text-mw-marinho"}`;
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
