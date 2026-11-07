"use client";

// Observações prontas do garçom: lista da cozinha, do bar e de cada categoria.

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { LIMITE_DO_TEXTO, LIMITE_POR_LISTA, limparLista } from "../../lib/observacoes-prontas.mjs";

const inputCls = "min-h-[44px] w-full rounded-xl border border-hf-border bg-hf-surface px-3 text-sm text-hf-text outline-none focus:border-hf-accent";

function Lista({ titulo, ajuda, itens, onChange, podeEditar }) {
  const [novo, setNovo] = useState("");
  const adicionar = () => {
    if (!novo.trim()) return;
    onChange(limparLista([...itens, novo]));
    setNovo("");
  };
  return (
    <section className="rounded-2xl border border-hf-border bg-hf-surface p-4">
      <h3 className="text-sm font-black text-hf-text">{titulo}</h3>
      {ajuda && <p className="text-xs text-hf-text-2">{ajuda}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {!itens.length && <span className="text-sm text-hf-muted">Nenhuma.</span>}
        {itens.map((o) => (
          <span key={o} className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-hf-border bg-hf-elevated pl-3 pr-1 text-sm font-semibold text-hf-text">
            {o}
            {podeEditar && (
              <button type="button" aria-label={`Tirar ${o}`} onClick={() => onChange(itens.filter((x) => x !== o))} className="grid h-8 w-8 place-items-center rounded-full text-hf-text-2 hover:bg-hf-border"><X size={14} /></button>
            )}
          </span>
        ))}
      </div>
      {podeEditar && itens.length < LIMITE_POR_LISTA && (
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); adicionar(); }}>
          <input className={inputCls} value={novo} maxLength={LIMITE_DO_TEXTO} placeholder="Nova observação" onChange={(e) => setNovo(e.target.value)} aria-label={`Nova observação: ${titulo}`} />
          <button type="submit" className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-xl border border-hf-border px-4 text-sm font-bold text-hf-text hover:bg-hf-elevated"><Plus size={16} /> Incluir</button>
        </form>
      )}
    </section>
  );
}

export default function EditorDeObservacoes({ obs, onChange, categorias = [], podeEditar }) {
  const [categoria, setCategoria] = useState("");
  const comLista = Object.keys(obs.categoria);
  const mudarCategoria = (nome, lista) => {
    const nova = { ...obs.categoria };
    if (lista.length) nova[nome] = lista; else delete nova[nome];
    onChange({ ...obs, categoria: nova });
  };
  const opcoes = [...new Set([...categorias, ...comLista])].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-hf-elevated p-3 text-sm text-hf-text">
        Viram botões no item, na tela do garçom e no balcão. Aparecem primeiro as da categoria do produto e depois as do setor. O garçom ainda pode escrever o que quiser.
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        <Lista titulo="Cozinha" ajuda="Para todo produto da cozinha." itens={obs.setor.cozinha} podeEditar={podeEditar} onChange={(l) => onChange({ ...obs, setor: { ...obs.setor, cozinha: l } })} />
        <Lista titulo="Bar" ajuda="Para toda bebida do bar." itens={obs.setor.bar} podeEditar={podeEditar} onChange={(l) => onChange({ ...obs, setor: { ...obs.setor, bar: l } })} />
      </div>
      <section className="space-y-3 rounded-2xl border border-hf-border bg-hf-surface p-4">
        <div>
          <h3 className="text-sm font-black text-hf-text">Por categoria</h3>
          <p className="text-xs text-hf-text-2">Ex.: Carnes: Mal passada, Ao ponto, Bem passada. As categorias vêm do cadastro de produtos.</p>
        </div>
        <select className={inputCls} value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoria">
          <option value="">Escolha a categoria</option>
          {opcoes.map((c) => <option key={c} value={c}>{c}{obs.categoria[c] ? ` (${obs.categoria[c].length})` : ""}</option>)}
        </select>
        {categoria && <Lista titulo={categoria} itens={obs.categoria[categoria] || []} podeEditar={podeEditar} onChange={(l) => mudarCategoria(categoria, l)} />}
        {!!comLista.length && <p className="text-xs text-hf-text-2">Com observações: {comLista.join(", ")}.</p>}
      </section>
    </div>
  );
}
