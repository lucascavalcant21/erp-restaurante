"use client";

// Excluir uma base ou um ingrediente que está em fichas (dono, 24/11/2026):
// o sistema mostra quais fichas usam e pergunta: tirar de todas e excluir, ou
// trocar por outro item. Nada acontece sem o toque do usuário.

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Replace, Search, Trash2, X } from "lucide-react";
import { casaBusca } from "../../lib/busca.mjs";

/**
 * itens: [{ id, nome }] a excluir; usos: { [id]: [{ ficha_id, nome }] }
 * opcoesTroca: [{ id, nome, detalhe? }] (só quando é 1 item); rotulo: "base" | "ingrediente"
 * onExcluir(): Promise; onTrocar(paraId): Promise
 */
export default function ExcluirEmUso({ itens, usos, opcoesTroca = [], rotulo = "item", onExcluir, onTrocar, onFechar }) {
  const [modo, setModo] = useState("escolher");
  const [busca, setBusca] = useState("");
  const [para, setPara] = useState("");
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState("");
  const fichas = useMemo(() => {
    const m = new Map();
    for (const it of itens) for (const u of usos?.[it.id] || []) m.set(u.ficha_id, u.nome);
    return [...m.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [itens, usos]);
  const umSo = itens.length === 1;
  const candidatos = opcoesTroca.filter((o) => !itens.some((i) => i.id === o.id) && (!busca || casaBusca(o.nome, busca))).slice(0, 80);
  const nomeItens = umSo ? `"${itens[0].nome}"` : `${itens.length} ${rotulo === "base" ? "bases" : "itens"}`;

  const executar = async (fn) => {
    setRodando(true); setErro("");
    try {
      const r = await fn();
      if (r?.error) setErro(r.error);
    } catch (e) { setErro(e?.message || "Não deu certo. Tente de novo."); }
    finally { setRodando(false); }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={`Excluir ${nomeItens}`}>
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-hf-surface p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-hf-warning/15 text-hf-warning"><AlertTriangle size={20} /></span>
            <div>
              <p className="text-[17px] font-black text-hf-text">{nomeItens} está em {fichas.length} ficha{fichas.length === 1 ? "" : "s"}</p>
              <p className="mt-0.5 text-[13px] text-hf-text-2">O que você quer fazer?</p>
            </div>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-hf-text-2 hover:bg-hf-elevated"><X size={18} /></button>
        </div>

        <ul className="mt-3 max-h-40 overflow-y-auto rounded-2xl bg-hf-elevated px-4 py-2 text-[14px] text-hf-text">
          {fichas.map((n) => <li key={n} className="py-0.5">• {n}</li>)}
        </ul>

        {modo === "escolher" && (
          <div className="mt-4 grid gap-2">
            <button type="button" disabled={rodando} onClick={() => setModo("excluir")}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-hf-danger/40 px-4 text-[15px] font-bold text-hf-danger">
              <Trash2 size={17} /> Tirar de todas as fichas e excluir
            </button>
            {umSo && onTrocar && (
              <button type="button" disabled={rodando} onClick={() => setModo("trocar")}
                className="flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-hf-menu px-4 text-[15px] font-bold text-white">
                <Replace size={17} /> Trocar por {rotulo === "base" ? "outra base" : "outro ingrediente"}
              </button>
            )}
            <button type="button" onClick={onFechar} className="min-h-[48px] rounded-full text-sm font-bold text-hf-text-2">Cancelar</button>
          </div>
        )}

        {modo === "excluir" && (
          <div className="mt-4 rounded-2xl border border-hf-danger/30 p-4">
            <p className="text-[14px] font-bold text-hf-text">Estas {fichas.length} fichas vão ficar sem {nomeItens}. A quantidade dele sai da receita e do custo.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setModo("escolher")} className="min-h-[48px] rounded-full border border-hf-border text-sm font-bold text-hf-text">Voltar</button>
              <button type="button" disabled={rodando} onClick={() => executar(onExcluir)}
                className="hf-manter-dourado flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-hf-danger text-sm font-bold text-white disabled:opacity-60">
                {rodando ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Excluir
              </button>
            </div>
          </div>
        )}

        {modo === "trocar" && (
          <div className="mt-4">
            <p className="text-[14px] font-bold text-hf-text">Colocar no lugar de {nomeItens}, com a mesma quantidade:</p>
            <div className="relative mt-2">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-hf-muted" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className="h-11 w-full rounded-full border border-hf-border bg-hf-surface pl-10 pr-4 text-sm font-semibold outline-none focus:border-hf-accent" />
            </div>
            <ul className="mt-2 max-h-56 divide-y divide-hf-border overflow-y-auto rounded-2xl border border-hf-border">
              {candidatos.length === 0 && <li className="p-3 text-sm text-hf-muted">Nada encontrado.</li>}
              {candidatos.map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => setPara(o.id)} aria-pressed={para === o.id}
                    className={`flex min-h-[48px] w-full items-center justify-between gap-2 px-4 text-left text-[14px] ${para === o.id ? "bg-hf-menu font-bold text-white" : "text-hf-text"}`}>
                    <span className="truncate">{o.nome}</span>{o.detalhe && <span className="shrink-0 text-[12px] opacity-70">{o.detalhe}</span>}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setModo("escolher")} className="min-h-[48px] rounded-full border border-hf-border text-sm font-bold text-hf-text">Voltar</button>
              <button type="button" disabled={!para || rodando} onClick={() => executar(() => onTrocar(para))}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-hf-menu text-sm font-bold text-white disabled:opacity-50">
                {rodando ? <Loader2 size={16} className="animate-spin" /> : <Replace size={16} />} Trocar e excluir
              </button>
            </div>
          </div>
        )}

        {erro && <p className="mt-3 text-[13px] font-semibold text-hf-danger">{erro}</p>}
      </div>
    </div>
  );
}
