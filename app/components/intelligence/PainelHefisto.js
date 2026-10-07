"use client";

// Atalho global do Héfisto: um botão pequeno e discreto que abre a conversa
// num painel lateral (desktop) ou bottom sheet (celular), levando o contexto
// da tela atual (rota e, quando a tela informa, o produto aberto). Não ocupa a
// tela enquanto fechado. Na própria Central de Inteligência ele some (lá a
// conversa já está na página).

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { useHefistoPageContext } from "../../context/HefistoPageContext";
import { hasPermission } from "../../lib/permissions-catalog.mjs";
import ConversaHefisto from "./ConversaHefisto";

const TIPOS_PRODUTO = new Set(["produto", "insumo", "product", "ingredient", "item_estoque"]);

export function telaAtual(pathname, search, pageContext) {
  const rota = `${pathname || "/dashboard"}${search ? `?${search}` : ""}`.slice(0, 200);
  const ehProduto = TIPOS_PRODUTO.has(String(pageContext?.entityType || "").toLowerCase());
  return {
    rota,
    entidade: ehProduto && (pageContext.entityId || pageContext.entityName)
      ? { tipo: "produto", id: pageContext.entityId ? String(pageContext.entityId).slice(0, 64) : null, nome: pageContext.entityName ? String(pageContext.entityName).slice(0, 80) : null }
      : null,
  };
}

export default function PainelHefisto() {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const { unidadeAtiva, sessao } = useERP() || {};
  const { pageContext } = useHefistoPageContext();
  const [aberto, setAberto] = useState(false);
  const conversa = useRef(null);
  const pendente = useRef(null);

  const abrir = useCallback((texto = null) => {
    setAberto(true);
    if (texto) pendente.current = texto;
  }, []);

  useEffect(() => {
    if (aberto && pendente.current && conversa.current) {
      const t = pendente.current;
      pendente.current = null;
      setTimeout(() => conversa.current?.enviar(t), 120);
    }
  }, [aberto]);

  useEffect(() => {
    const aoPerguntar = (e) => abrir(e?.detail?.texto || null);
    const aoAlternar = () => setAberto((v) => !v);
    const teclas = (e) => {
      if (e.altKey && (e.key === "h" || e.key === "H")) { e.preventDefault(); setAberto((v) => !v); }
      if (e.key === "Escape") setAberto(false);
    };
    window.addEventListener("hefisto:perguntar", aoPerguntar);
    window.addEventListener("hefisto:toggle-copilot", aoAlternar);
    window.addEventListener("keydown", teclas);
    return () => {
      window.removeEventListener("hefisto:perguntar", aoPerguntar);
      window.removeEventListener("hefisto:toggle-copilot", aoAlternar);
      window.removeEventListener("keydown", teclas);
    };
  }, [abrir]);

  useEffect(() => { setAberto(false); }, [unidadeAtiva]);

  if (pathname.startsWith("/dashboard/inteligencia")) return null;
  // Só para quem pode usar a inteligência (o servidor confere de novo).
  if (!sessao || (sessao.gerenciado && !hasPermission(sessao, "dashboard.intelligence.view"))) return null;

  const semUnidade = !unidadeAtiva || unidadeAtiva === "todas";
  const tela = telaAtual(pathname, searchParams?.toString() || "", pageContext);

  return (
    <>
      {!aberto && (
        <button type="button" onClick={() => abrir()} aria-label="Pergunte ao Héfisto (Alt+H)" title="Pergunte ao Héfisto (Alt+H)"
          className="fixed right-4 z-[90] grid h-12 w-12 place-items-center rounded-full bg-slate-900 text-emerald-400 shadow-lg shadow-slate-900/20 ring-1 ring-slate-700 transition hover:scale-105 print:hidden"
          style={{ bottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
          <Sparkles size={20} />
        </button>
      )}

      {aberto && (
        <div className="fixed inset-0 z-[150] print:hidden" role="dialog" aria-modal="true" aria-label="Pergunte ao Héfisto">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setAberto(false)} />
          <section className="absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col rounded-t-3xl bg-[#F7F8F7] shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[440px] sm:rounded-none sm:rounded-l-3xl">
            <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden" aria-hidden="true" />
            <header className="flex items-start justify-between gap-3 px-4 pb-2 pt-3 sm:pt-5">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Héfisto</p>
                <h2 className="text-lg font-black text-slate-900">Pergunte ao Héfisto</h2>
                <p className="truncate text-[12px] text-slate-500">
                  Contexto: {tela.entidade?.nome ? `${tela.entidade.nome} · ` : ""}{pathname.replace("/dashboard", "") || "início"}
                </p>
              </div>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-200">
                <X size={20} />
              </button>
            </header>
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-3">
              {semUnidade ? (
                <p className="rounded-2xl bg-white p-4 text-[14px] text-slate-700">Selecione uma unidade para conversar com o Héfisto: as respostas são sempre de uma unidade por vez.</p>
              ) : (
                <ConversaHefisto ref={conversa} unidadeId={unidadeAtiva} tela={tela} autoFoco altura="100%" onNavegar={() => setAberto(false)} />
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
