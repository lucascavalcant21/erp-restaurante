"use client";

// Atalho global do Héfisto (Alt+H, menu, busca): abre o Assistente Héfisto
// (/dashboard/inteligencia/assistente) levando o contexto da tela atual (rota e,
// quando a tela informa, o registro aberto). Pedido do dono, 07/11/2026: a
// conversa é uma só, a tela estilo WhatsApp; o painel lateral saiu.

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useERP } from "../../context/ERPContext";
import { useHefistoPageContext } from "../../context/HefistoPageContext";
import { hasPermission } from "../../lib/permissions-catalog.mjs";
import { linkDoAssistente } from "./assistente/origem.mjs";

// Tipos de entidade das telas (useContextoInteligencia e telas antigas) → tipos do servidor.
const TIPOS_DA_TELA = {
  produto: "produto", insumo: "produto", product: "produto", ingredient: "produto", item_estoque: "produto",
  compra: "compra", purchase: "compra",
  colaborador: "colaborador", funcionario: "colaborador", employee: "colaborador",
  conta_pagar: "conta_pagar", conta: "conta_pagar", payable: "conta_pagar",
  ficha: "ficha", ficha_tecnica: "ficha", recipe: "ficha",
  fornecedor: "fornecedor", supplier: "fornecedor",
  evento: "evento",
};
const ROTULO_TIPO = { produto: "Produto", compra: "Compra", colaborador: "Funcionário", conta_pagar: "Conta", ficha: "Ficha técnica", fornecedor: "Fornecedor", evento: "Evento" };

export function telaAtual(pathname, search, pageContext) {
  const rota = `${pathname || "/dashboard"}${search ? `?${search}` : ""}`.slice(0, 200);
  const tipo = TIPOS_DA_TELA[String(pageContext?.entityType || "").toLowerCase()] || null;
  const id = pageContext?.entityId != null && /^[A-Za-z0-9_\-]{1,64}$/.test(String(pageContext.entityId)) ? String(pageContext.entityId) : null;
  return {
    rota,
    entidade: tipo && (id || pageContext.entityName)
      ? { tipo, id, nome: pageContext.entityName ? String(pageContext.entityName).slice(0, 80) : null }
      : null,
  };
}

export const rotuloDaEntidade = (e) => (e ? `${ROTULO_TIPO[e.tipo] || "Registro"}: ${e.nome || e.id}` : null);

export default function PainelHefisto() {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const router = useRouter();
  const { sessao } = useERP() || {};
  const { pageContext } = useHefistoPageContext();
  const atual = useRef({ pathname, busca: "", pageContext: null });
  atual.current = { pathname, busca: searchParams?.toString() || "", pageContext };
  const pode = !!sessao && !(sessao.gerenciado && !hasPermission(sessao, "dashboard.intelligence.view"));

  // Alt+H, atalhos do menu e perguntas da busca abrem o Assistente Héfisto (tela estilo
  // WhatsApp), levando a pergunta e o contexto desta tela (rota e registro aberto).
  // Nas telas da Inteligência quem atende é a própria tela (Central ou o assistente).
  const abrir = useCallback((texto = null) => {
    const { pathname: p, busca, pageContext: pc } = atual.current;
    if (p.startsWith("/dashboard/inteligencia")) return;
    router.push(linkDoAssistente({ texto, tela: telaAtual(p, busca, pc) }));
  }, [router]);

  useEffect(() => {
    if (!pode) return undefined;
    const aoPerguntar = (e) => abrir(e?.detail?.texto || null);
    const aoAlternar = () => abrir(null);
    const teclas = (e) => {
      if (e.altKey && (e.key === "h" || e.key === "H")) {
        e.preventDefault();
        if (atual.current.pathname.startsWith("/dashboard/inteligencia/assistente")) window.dispatchEvent(new CustomEvent("hefisto:perguntar", { detail: {} }));
        else abrir(null);
      }
    };
    window.addEventListener("hefisto:perguntar", aoPerguntar);
    window.addEventListener("hefisto:toggle-copilot", aoAlternar);
    window.addEventListener("keydown", teclas);
    return () => {
      window.removeEventListener("hefisto:perguntar", aoPerguntar);
      window.removeEventListener("hefisto:toggle-copilot", aoAlternar);
      window.removeEventListener("keydown", teclas);
    };
  }, [abrir, pode]);

  // Sem botão flutuante (pedido do dono, 28/10/2026) e sem painel: a conversa é uma tela só.
  return null;
}
