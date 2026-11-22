"use client";

// Imprimir ou salvar em PDF a precificação do delivery (dono, 22/11/2026):
// escolhe os apps (um, alguns ou todos, inclusive balcão) e o que entra.
// O relatório usa os mesmos números da tela (relatorio-precificacao.mjs).

import { useState } from "react";
import { FileDown, Printer, X } from "lucide-react";
import { imprimirHtml } from "./imprimirGuia";
import { htmlDoRelatorio, montarRelatorio, secoesComItens } from "../../lib/marmitaria/relatorio-precificacao.mjs";
import { rotuloDoLucro } from "../../lib/marmitaria/cardapio.mjs";

const chip = (ativo) => `min-h-[44px] rounded-full border px-4 text-sm font-bold transition ${ativo ? "border-hf-menu bg-hf-menu text-white" : "border-hf-border bg-hf-surface text-hf-text-2 hover:border-hf-accent"}`;

export default function ImprimirPrecificacao({ canais, porCanal, custos, embutidos, metaPct }) {
  const [aberto, setAberto] = useState(false);
  const [apps, setApps] = useState(() => canais.map((c) => c.id));
  // Só oferece o que existe (sobremesas, se houver).
  const disponiveis = secoesComItens(porCanal?.get(canais[0]?.id)?.linhas || []);
  const [secoes, setSecoes] = useState(() => disponiveis.map((s) => s.id));
  const [comFicha, setComFicha] = useState(true);
  const [erro, setErro] = useState("");
  const todos = apps.length === canais.length;
  const alternar = (lista, set, id) => set(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

  function gerar() {
    setErro("");
    if (!apps.length) { setErro("Escolha pelo menos um app."); return; }
    if (!secoes.length) { setErro("Escolha o que entra no relatório."); return; }
    const rel = montarRelatorio({ canais, escolhidos: todos ? "todos" : apps, secoes, porCanal, custos, embutidos, ingredientes: comFicha });
    if (!rel.itens.length) { setErro("Nenhum produto nas seções escolhidas."); return; }
    imprimirHtml(htmlDoRelatorio(rel, {
      data: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }),
      rotuloLucro: rotuloDoLucro(embutidos),
      meta: metaPct === "" || metaPct == null ? "" : `${metaPct}%`,
    }));
    setAberto(false);
  }

  return (
    <>
      <button type="button" onClick={() => setAberto(true)}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-hf-menu px-4 text-sm font-bold text-white hover:opacity-90">
        <Printer size={16} aria-hidden="true" /> Imprimir ou PDF
      </button>
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-imprimir-prec">
          <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-hf-surface p-5 shadow-xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="titulo-imprimir-prec" className="text-lg font-black text-hf-text">Imprimir a precificação</h2>
                <p className="text-sm text-hf-text-2">Do preço de cada produto até o lucro. Na tela de impressão, escolha a impressora ou "Salvar como PDF".</p>
              </div>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-hf-elevated"><X size={20} /></button>
            </div>

            <p className="mt-4 text-xs font-bold uppercase text-hf-muted">Apps</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" aria-pressed={todos} className={chip(todos)} onClick={() => setApps(todos ? [] : canais.map((c) => c.id))}>Todos</button>
              {canais.map((c) => (
                <button key={c.id} type="button" aria-pressed={apps.includes(c.id)} className={chip(apps.includes(c.id) && !todos)} onClick={() => alternar(apps, setApps, c.id)}>{c.nome}</button>
              ))}
            </div>
            {!canais.some((c) => c.id === "balcao") && <p className="mt-1 text-xs text-hf-muted">O balcão aparece aqui quando estiver ativo em Configurações › Apps.</p>}

            <p className="mt-4 text-xs font-bold uppercase text-hf-muted">O que entra</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {disponiveis.map((s) => (
                <button key={s.id} type="button" aria-pressed={secoes.includes(s.id)} className={chip(secoes.includes(s.id))} onClick={() => alternar(secoes, setSecoes, s.id)}>{s.nome}</button>
              ))}
            </div>
            <label className="mt-3 flex min-h-[44px] cursor-pointer items-center gap-3 rounded-2xl border border-hf-border p-3 text-sm text-hf-text">
              <input type="checkbox" checked={comFicha} onChange={(e) => setComFicha(e.target.checked)} className="h-5 w-5 accent-hf-menu" />
              Ficha de cada prato: ingredientes e embalagens, com quantidade e custo
            </label>

            {erro && <p role="alert" className="mt-3 text-sm font-bold text-hf-danger">{erro}</p>}
            <button type="button" onClick={gerar} className="mt-4 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-hf-menu px-6 text-base font-bold text-white hover:opacity-90">
              <FileDown size={18} aria-hidden="true" /> Gerar para imprimir ou salvar PDF
            </button>
          </div>
        </div>
      )}
    </>
  );
}
