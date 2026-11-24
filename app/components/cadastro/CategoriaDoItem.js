"use client";

// Categoria de um item do cadastro (ingrediente, bebida, embalagem) e a lista
// dividida por categoria. Regras: app/lib/categorias-itens.mjs.

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { SEM_CATEGORIA, agruparItens, categoriaDoItem, nomeCategoria, opcoesCategoria } from "../../lib/categorias-itens.mjs";
import { atualizarCategoriaInsumo } from "../../lib/marmitaria/dados";

/** Botão "Proteínas ▾" no item; abre as categorias e grava ao tocar. */
export function TrocarCategoria({ item, todos = [], tipo = "ingrediente", onSalvo }) {
  const [aberto, setAberto] = useState(false);
  const [nova, setNova] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const atual = categoriaDoItem(item);

  async function escolher(c) {
    setSalvando(true); setErro("");
    const r = await atualizarCategoriaInsumo({ id: item.id, categoria: c });
    setSalvando(false);
    if (r?.error) { setErro(r.error); return; }
    setAberto(false); setNova("");
    await onSalvo?.();
  }

  return (
    <div className="mt-1">
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto}
        className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-hf-border px-2.5 text-xs font-semibold text-hf-text-2">
        {atual || "Pôr categoria"} <ChevronDown size={13} className={aberto ? "rotate-180" : ""} />
      </button>
      {aberto && (
        <div className="mt-2 rounded-xl bg-hf-elevated/60 p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {opcoesCategoria(todos, tipo).map((c) => (
              <button key={c} type="button" disabled={salvando} onClick={() => escolher(c)}
                className={`min-h-[36px] rounded-full px-3 text-xs font-bold ${c === atual ? "bg-hf-menu text-white" : "border border-hf-border bg-hf-surface text-hf-text-2"}`}>{c}</button>
            ))}
            {atual && <button type="button" disabled={salvando} onClick={() => escolher("")} className="min-h-[36px] rounded-full px-3 text-xs font-semibold text-hf-muted">Tirar categoria</button>}
          </div>
          <div className="mt-2 flex gap-1.5">
            <input value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Nova categoria" aria-label="Nova categoria"
              className="h-10 min-w-0 flex-1 rounded-full border border-hf-border bg-hf-surface px-3 text-sm outline-none focus:border-hf-accent" />
            <button type="button" disabled={salvando || !nomeCategoria(nova)} onClick={() => escolher(nomeCategoria(nova))}
              className="inline-flex h-10 items-center gap-1 rounded-full bg-hf-menu px-3 text-xs font-bold text-white disabled:opacity-40"><Plus size={14} /> Criar</button>
          </div>
          {erro && <p className="mt-1.5 text-xs font-semibold text-hf-danger">{erro}</p>}
        </div>
      )}
    </div>
  );
}

/** Lista com um título por categoria. `renderItem(item)` desenha o <li>. */
export function ListaPorCategoria({ itens = [], renderItem }) {
  const grupos = agruparItens(itens);
  const soSem = grupos.length === 1 && grupos[0].categoria === SEM_CATEGORIA;
  return (
    <div className="space-y-4">
      {grupos.map((g) => (
        <section key={g.categoria} aria-label={g.categoria}>
          {!soSem && <h3 className="border-b border-hf-border pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-hf-muted">{g.categoria} · {g.itens.length}</h3>}
          <ul className="divide-y divide-hf-border">{g.itens.map(renderItem)}</ul>
        </section>
      ))}
    </div>
  );
}
