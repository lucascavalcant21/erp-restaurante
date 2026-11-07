"use client";

// Tempo de preparo de todos os produtos de uma vez (07/11/2026). É o tempo que
// a comanda do garçom conta para trás a partir do lançamento. Também dá para
// mudar um a um no cadastro do produto.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Save, Search } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { supabase } from "../../../lib/supabase";
import { fetchProdutos } from "../../../lib/vendas";
import { hasPermission } from "../../../lib/permissions-catalog.mjs";
import { TEMPO_PADRAO_MIN, alteracoesDeTempo, minutosValidos } from "../../../lib/preparo-itens.mjs";

const SETORES = [["todos", "Todos"], ["cozinha", "Cozinha"], ["bar", "Bar"]];

export default function TempoDePreparoPage() {
  const { unidadeAtiva, sessao } = useERP();
  const [produtos, setProdutos] = useState([]);
  const [editados, setEditados] = useState({});
  const [busca, setBusca] = useState("");
  const [setor, setSetor] = useState("todos");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");
  const podeEditar = !sessao?.gerenciado || hasPermission(sessao, "salao.prep_time.edit");

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    setCarregando(true);
    fetchProdutos(unidadeAtiva).then((r) => { setProdutos((r.data || []).filter((p) => p.ativo !== false)); setEditados({}); setCarregando(false); });
  }, [unidadeAtiva]);

  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = produtos.filter((p) => (setor === "todos" || String(p.departamento || "cozinha").toLowerCase().includes(setor)) && (!q || String(p.nome_produto || "").toLowerCase().includes(q)));
    const g = new Map();
    for (const p of lista) { const c = String(p.categoria || "Sem categoria").trim(); if (!g.has(c)) g.set(c, []); g.get(c).push(p); }
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [produtos, busca, setor]);

  const mudancas = alteracoesDeTempo(produtos, editados);
  const todosNoPadrao = produtos.length > 0 && produtos.every((p) => Number(p.tempo_preparo_base) === TEMPO_PADRAO_MIN);

  async function salvar() {
    if (!mudancas.length || salvando) return;
    setSalvando(true); setAviso("");
    let erros = 0;
    for (const m of mudancas) {
      const { error } = await supabase.from("produtos").update({ tempo_preparo_base: m.tempo }).eq("id", m.id).eq("unidade_id", unidadeAtiva);
      if (error) erros += 1;
      else setProdutos((l) => l.map((p) => (p.id === m.id ? { ...p, tempo_preparo_base: m.tempo } : p)));
    }
    setEditados({});
    setAviso(erros ? `${mudancas.length - erros} salvo(s); ${erros} não salvou. Tente de novo.` : `${mudancas.length} produto(s) atualizado(s).`);
    setSalvando(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-28 sm:p-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/salao/caixa" aria-label="Voltar ao painel do caixa" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-hf-border text-hf-text hover:bg-hf-elevated"><ArrowLeft size={18} /></Link>
        <div className="min-w-0">
          <h1 className="text-xl font-black text-hf-text">Tempo de preparo</h1>
          <p className="text-sm text-hf-text-2">Minutos do lançamento até ficar pronto. A comanda do garçom conta para trás.</p>
        </div>
      </div>

      {todosNoPadrao && <p className="rounded-xl border border-hf-warning/40 bg-hf-warning/10 p-3 text-sm font-semibold text-hf-text">Todos os produtos estão com {TEMPO_PADRAO_MIN} minutos, o valor padrão. Ajuste os que demoram mais ou menos.</p>}

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-hf-muted" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto" aria-label="Buscar produto"
            className="min-h-[44px] w-full rounded-xl border border-hf-border bg-hf-surface pl-9 pr-3 text-base text-hf-text outline-none focus:border-hf-accent" />
        </label>
        <div className="flex rounded-xl border border-hf-border bg-hf-surface p-1" role="group" aria-label="Setor">
          {SETORES.map(([id, r]) => (
            <button key={id} type="button" aria-pressed={setor === id} onClick={() => setSetor(id)}
              className={`min-h-[36px] flex-1 rounded-lg px-3 text-sm font-bold ${setor === id ? "bg-hf-accent text-hf-accent-fg" : "text-hf-text-2"}`}>{r}</button>
          ))}
        </div>
      </div>

      {carregando ? <p className="flex items-center gap-2 text-sm text-hf-muted"><Loader2 size={16} className="animate-spin" /> Carregando…</p> : !grupos.length ? (
        <p className="text-sm text-hf-text-2">Nenhum produto encontrado.</p>
      ) : grupos.map(([categoria, lista]) => (
        <section key={categoria} className="rounded-2xl border border-hf-border bg-hf-surface">
          <h2 className="border-b border-hf-border px-4 py-2 text-xs font-black uppercase tracking-wide text-hf-text-2">{categoria}</h2>
          <ul className="divide-y divide-hf-border">
            {lista.map((p) => {
              const valor = p.id in editados ? editados[p.id] : String(p.tempo_preparo_base ?? TEMPO_PADRAO_MIN);
              const invalido = p.id in editados && editados[p.id] !== "" && minutosValidos(editados[p.id]) === null;
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-hf-text">{p.nome_produto}</span>
                  <label className="flex shrink-0 items-center gap-2">
                    <input type="text" inputMode="numeric" value={valor} disabled={!podeEditar} aria-label={`Minutos: ${p.nome_produto}`} aria-invalid={invalido}
                      onChange={(e) => setEditados((x) => ({ ...x, [p.id]: e.target.value.replace(/[^0-9]/g, "").slice(0, 3) }))}
                      className={`h-11 w-16 rounded-xl border bg-hf-bg text-center text-base font-black tabular-nums text-hf-text outline-none ${invalido ? "border-hf-danger" : "border-hf-border focus:border-hf-accent"}`} />
                    <span className="text-xs text-hf-text-2">min</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {podeEditar && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-hf-border bg-hf-surface/95 p-3 backdrop-blur" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto flex max-w-3xl items-center justify-end gap-3">
            {aviso && <span role="status" className="min-w-0 text-sm font-semibold text-hf-text-2">{aviso}</span>}
            <button type="button" onClick={salvar} disabled={!mudancas.length || salvando}
              className="inline-flex min-h-[48px] shrink-0 items-center gap-2 rounded-xl bg-hf-accent px-6 text-sm font-black text-hf-accent-fg disabled:opacity-50">
              {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar{mudancas.length ? ` (${mudancas.length})` : ""}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
