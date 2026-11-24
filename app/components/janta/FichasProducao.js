"use client";

// Fichas de produção da janta (dono, 24/11/2026): trazer do restaurante, das
// marmitas ou dos eventos (cópia), ou criar nova; quanto rende pronto (pesado
// ou cru × índice de cocção) e a receita refeita para o que se precisa.
// Contas em app/lib/janta-producao.mjs.

import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, Download, Loader2, Plus, Scale, Search, Trash2 } from "lucide-react";
import { fetchFichas } from "../../lib/operacao";
import { fetchEventos } from "../../lib/eventos";
import {
  FONTE_INDICES, INDICES_COCCAO, UNIDADES_PRODUCAO, fichasDosEventos, normalizarIngrediente, producaoDaFicha,
  producaoDoEvento, producaoParaTotal, producaoVazia, rendimentoDaProducao, sugestaoIndice, usosDaProducao,
} from "../../lib/janta-producao.mjs";
import { casaBusca } from "../../lib/busca.mjs";

const inputCls = "h-11 w-full rounded-full border border-hf-border bg-hf-surface px-4 text-sm font-semibold text-hf-text outline-none focus:border-hf-accent";
const fmt = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const NOME_DIA = { seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado", dom: "Domingo" };

/** A receita para uma quantidade (bloco reaproveitado no cardápio da semana). */
export function ReceitaRefeita({ r, inicialAberta = false }) {
  const [aberta, setAberta] = useState(inicialAberta);
  if (!r) return null;
  if (r.status === "insuficiente") return <p className="mt-1 text-[12px] font-semibold text-hf-warning">DADOS INSUFICIENTES para a receita: {r.motivo}</p>;
  if (r.status !== "ok") return null;
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setAberta(!aberta)} className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-hf-elevated px-4 text-[14px] font-bold text-hf-text">
        <BookOpen size={16} /> Faça {r.rotuloFator} ({r.fichaNome}) <ChevronDown size={14} className={aberta ? "rotate-180" : ""} />
      </button>
      {aberta && (
        <div className="mt-2 rounded-2xl bg-hf-elevated p-4">
          <ul className="space-y-1">
            {r.ingredientes.map((g, k) => (
              <li key={k} className="flex justify-between gap-3 text-[15px]"><span>{g.nome}{g.principal ? " (cru)" : ""}</span><b className="tabular-nums">{g.quantidade}</b></li>
            ))}
          </ul>
          {r.rendimento && <p className="mt-2 text-[12px] text-hf-muted">A ficha inteira rende {r.rendimento}{r.comoRende === "indice" ? " pelo índice de cocção" : ""}.</p>}
          {r.natureza === "ESTIMATIVA" && <p className="mt-1 text-[12px] font-semibold text-hf-muted">ESTIMATIVA: {r.comoRende === "indice" ? "o rendimento vem do índice de cocção, não de pesagem." : "medida cruzada (1 ml ≈ 1 g)."}</p>}
          {r.preparo && <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-hf-text">{r.preparo}</p>}
        </div>
      )}
    </div>
  );
}

/** Tabela de referência: quanto 1 kg cru vira pronto. */
function TabelaIndices() {
  return (
    <details className="rounded-3xl border border-hf-border bg-hf-surface p-4">
      <summary className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-black text-hf-text"><Scale size={16} /> Quanto 1 kg cru vira pronto (referência)</summary>
      <ul className="mt-2 divide-y divide-hf-border text-[14px]">
        {INDICES_COCCAO.map((x) => (
          <li key={x.nome} className="flex justify-between gap-3 py-1.5"><span>{x.nome}</span><b className="tabular-nums">1 kg → {fmt(x.indice)} kg</b></li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-hf-muted">Fonte: {FONTE_INDICES}. É média de laboratório (ESTIMATIVA). Feijão com mais caldo rende bem mais: pese a sua panela uma vez e ponha o número na ficha.</p>
    </details>
  );
}

/** Escolher uma ficha do sistema ou de evento para trazer. */
function TrazerFicha({ unidades, unidadeAtiva, onTrazer, onFechar }) {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState("todos");

  useEffect(() => {
    let vivo = true;
    (async () => {
      const alvo = (unidades || []).filter((u) => u?.id).length ? unidades.filter((u) => u?.id) : [{ id: unidadeAtiva, nome: "" }];
      const itens = [];
      const falhas = [];
      await Promise.all(alvo.map(async (u) => {
        const [rf, re] = await Promise.all([fetchFichas(u.id).catch((e) => ({ data: [], error: e?.message })), fetchEventos(u.id).catch(() => ({ data: [] }))]);
        if (rf?.error) falhas.push(u.nome || "unidade");
        for (const f of rf?.data || []) {
          const marmita = f.departamento === "marmitaria" || /marmit|delivery/i.test(u.nome || "");
          const origem = marmita ? { tipo: "marmita", rotulo: "Marmitas" } : { tipo: "restaurante", rotulo: `${u.nome ? `${u.nome} · ` : ""}${f.departamento === "bar" ? "Bar" : "Cozinha"}` };
          itens.push({ chave: `f-${f.id}`, nome: f.nome_receita || "Ficha", origem, criar: () => producaoDaFicha(f, origem) });
        }
        for (const { item, evento } of fichasDosEventos(re?.data || [])) {
          itens.push({ chave: `e-${u.id}-${item.id}`, nome: item.nome || "Ficha do evento", origem: { tipo: "evento", rotulo: evento ? `Eventos · ${evento}` : "Eventos" }, criar: () => producaoDoEvento(item, evento) });
        }
      }));
      if (!vivo) return;
      itens.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      setLista(itens);
      if (falhas.length) setErro(`Não deu para ler as fichas de: ${falhas.join(", ")}.`);
    })();
    return () => { vivo = false; };
  }, [unidades, unidadeAtiva]);

  const GRUPOS = [["todos", "Todas"], ["restaurante", "Restaurante"], ["marmita", "Marmitas"], ["evento", "Eventos"]];
  const visiveis = (lista || []).filter((x) => (grupo === "todos" || x.origem.tipo === grupo) && (!busca || casaBusca(x.nome, busca)));

  return (
    <div className="rounded-3xl border-2 border-hf-accent/40 bg-hf-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-black text-hf-text">Trazer de outra ficha</p>
        <button type="button" onClick={onFechar} className="min-h-[44px] rounded-full px-3 text-sm font-bold text-hf-text-2">Fechar</button>
      </div>
      <p className="text-[12px] text-hf-muted">Vem uma cópia: mudar aqui não mexe na ficha original.</p>
      <div className="relative mt-2">
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-hf-muted" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar: feijão, arroz…" className={`${inputCls} pl-10`} />
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {GRUPOS.map(([id, rot]) => (
          <button key={id} type="button" aria-pressed={grupo === id} onClick={() => setGrupo(id)}
            className={`min-h-[40px] shrink-0 rounded-full px-4 text-sm font-bold ${grupo === id ? "bg-hf-menu text-white" : "border border-hf-border text-hf-text-2"}`}>{rot}</button>
        ))}
      </div>
      {erro && <p className="mt-2 text-[12px] font-semibold text-hf-warning">{erro}</p>}
      {lista == null ? (
        <p className="py-6 text-center text-sm font-bold text-hf-text-2"><Loader2 size={16} className="mr-2 inline animate-spin" />Buscando as fichas…</p>
      ) : visiveis.length === 0 ? (
        <p className="py-6 text-center text-sm text-hf-muted">Nenhuma ficha encontrada.</p>
      ) : (
        <ul className="mt-2 max-h-[50vh] divide-y divide-hf-border overflow-y-auto">
          {visiveis.slice(0, 200).map((x) => (
            <li key={x.chave}>
              <button type="button" onClick={() => onTrazer(x.criar())} className="flex min-h-[52px] w-full items-center justify-between gap-3 py-2 text-left">
                <span className="min-w-0"><span className="block truncate text-[15px] font-semibold text-hf-text">{x.nome}</span><span className="block text-[12px] text-hf-muted">{x.origem.rotulo}</span></span>
                <Download size={16} className="shrink-0 text-hf-accent" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Editor de uma ficha de produção com o "preciso de X". */
function EditorProducao({ p, usos, onMudar, onApagar }) {
  const [aberto, setAberto] = useState(!p.nome);
  const [preciso, setPreciso] = useState("");
  const [precisoUn, setPrecisoUn] = useState(p.rendimento_unidade === "un" ? "un" : "kg");
  const rend = rendimentoDaProducao(p);
  const principal = p.ingredientes.find((i) => i.principal);
  const sug = sugestaoIndice(principal?.nome) || sugestaoIndice(p.nome);
  const mudar = (fn) => onMudar((x) => { fn(x); return x; });
  const precisoBase = (() => {
    const q = Number(String(preciso).replace(",", "."));
    if (!(q > 0)) return 0;
    return precisoUn === "kg" || precisoUn === "L" ? q * 1000 : q;
  })();
  const medida = precisoUn === "un" ? "un" : precisoUn === "L" || precisoUn === "ml" ? "ml" : "g";
  const refeita = precisoBase > 0 ? producaoParaTotal(p, precisoBase, medida) : null;

  return (
    <article className="rounded-3xl border border-hf-border bg-hf-surface p-4">
      <button type="button" onClick={() => setAberto(!aberto)} className="flex min-h-[48px] w-full items-center gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-black text-hf-text">{p.nome || "Ficha sem nome"}</span>
          <span className="block text-[12px] text-hf-muted">
            {p.origem.rotulo} · {rend.valor != null ? `rende ${rend.rotulo}${rend.natureza === "ESTIMATIVA" ? " (ESTIMATIVA)" : ""}` : "DADOS INSUFICIENTES: falta o rendimento"}
            {usos.length ? ` · usada: ${usos.map((u) => NOME_DIA[u] || u).join(", ")}` : ""}
          </span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-hf-text-2 ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (
        <div className="mt-3 space-y-3">
          <label className="block text-xs font-bold text-hf-text-2">Nome da ficha
            <input value={p.nome} onChange={(e) => mudar((x) => { x.nome = e.target.value; })} placeholder="Ex.: Feijão da janta" className={`${inputCls} mt-1`} />
          </label>

          <div>
            <p className="text-xs font-bold text-hf-text-2">Ingredientes (a ficha inteira)</p>
            <div className="mt-1 space-y-2">
              {p.ingredientes.map((ing) => (
                <div key={ing.id} className="rounded-2xl border border-hf-border p-2">
                  <div className="flex items-center gap-2">
                    <input value={ing.nome} aria-label="Ingrediente" onChange={(e) => mudar((x) => { x.ingredientes.find((y) => y.id === ing.id).nome = e.target.value; })} placeholder="Ex.: Feijão carioca" className={inputCls} />
                    <button type="button" aria-label={`Tirar ${ing.nome || "ingrediente"}`} onClick={() => mudar((x) => { x.ingredientes = x.ingredientes.filter((y) => y.id !== ing.id); })} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-hf-border text-hf-muted hover:text-hf-danger"><Trash2 size={15} /></button>
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                    <input inputMode="decimal" aria-label="Quantidade" value={ing.quantidade} onChange={(e) => mudar((x) => { x.ingredientes.find((y) => y.id === ing.id).quantidade = e.target.value; })} placeholder="1" className={inputCls} />
                    <select aria-label="Medida" value={ing.unidade} onChange={(e) => mudar((x) => { x.ingredientes.find((y) => y.id === ing.id).unidade = e.target.value; })} className="h-11 rounded-full border border-hf-border bg-hf-surface px-3 text-sm font-semibold">
                      {UNIDADES_PRODUCAO.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <label className="mt-2 flex min-h-[40px] items-center gap-2 text-[13px] font-semibold text-hf-text-2">
                    <input type="radio" name={`principal-${p.id}`} checked={ing.principal} onChange={() => mudar((x) => { x.ingredientes.forEach((y) => { y.principal = y.id === ing.id; }); })} className="h-5 w-5 accent-current" />
                    É o principal (cru), o que cresce ou encolhe no cozimento
                  </label>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => mudar((x) => { x.ingredientes.push(normalizarIngrediente({ principal: !x.ingredientes.length })); })} className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-hf-accent"><Plus size={15} /> Ingrediente</button>
          </div>

          <div className="rounded-2xl bg-hf-elevated p-3">
            <p className="text-xs font-black uppercase tracking-wider text-hf-muted">Quanto rende pronto</p>
            <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
              <input inputMode="decimal" aria-label="Rendimento pesado" value={p.rendimento} onChange={(e) => mudar((x) => { x.rendimento = e.target.value; })} placeholder="Pesei: ex. 3" className={inputCls} />
              <select aria-label="Medida do rendimento" value={p.rendimento_unidade} onChange={(e) => mudar((x) => { x.rendimento_unidade = e.target.value; })} className="h-11 rounded-full border border-hf-border bg-hf-surface px-3 text-sm font-semibold">
                {UNIDADES_PRODUCAO.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <p className="mt-1 text-[12px] text-hf-muted">Pesou a panela pronta? Ponha aqui: vale mais que o índice.</p>
            <label className="mt-3 flex flex-wrap items-center gap-2 text-[13px] font-semibold text-hf-text">
              Sem pesar: 1 kg cru vira
              <input inputMode="decimal" aria-label="Índice de cocção" value={p.indice} onChange={(e) => mudar((x) => { x.indice = e.target.value; })} placeholder={sug ? fmt(sug.indice) : "3"} className="h-10 w-20 rounded-full border border-hf-border bg-hf-surface px-3 text-center text-sm font-bold" />
              kg pronto
            </label>
            {sug && String(p.indice) !== String(sug.indice) && (
              <button type="button" onClick={() => mudar((x) => { x.indice = sug.indice; })} className="mt-2 inline-flex min-h-[40px] items-center rounded-full border border-hf-border bg-hf-surface px-3 text-[12px] font-bold text-hf-text">
                Usar a referência: {sug.nome} → {fmt(sug.indice)}
              </button>
            )}
            <p className="mt-2 text-[13px] font-bold text-hf-text">
              {rend.valor != null ? <>A ficha rende <span className="tabular-nums">{rend.rotulo}</span> {rend.natureza === "REAL" ? "(pesado)" : `(ESTIMATIVA: ${fmt(rend.cru / 1000)} kg cru × ${fmt(rend.indice)})`}</> : <span className="text-hf-warning">DADOS INSUFICIENTES: {rend.motivo}</span>}
            </p>
          </div>

          <label className="block text-xs font-bold text-hf-text-2">Como fazer
            <textarea value={p.preparo} onChange={(e) => mudar((x) => { x.preparo = e.target.value; })} rows={4} placeholder="1. Deixe o feijão de molho…&#10;2. Cozinhe na pressão…" className="mt-1 w-full rounded-2xl border border-hf-border bg-hf-surface p-3 text-sm text-hf-text outline-none focus:border-hf-accent" />
          </label>

          <div className="rounded-2xl border border-hf-border p-3">
            <p className="text-sm font-black text-hf-text">Preciso de quanto pronto?</p>
            <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
              <input inputMode="decimal" aria-label="Quanto preciso pronto" value={preciso} onChange={(e) => setPreciso(e.target.value)} placeholder="Ex.: 2,5" className={inputCls} />
              <select aria-label="Medida" value={precisoUn} onChange={(e) => setPrecisoUn(e.target.value)} className="h-11 rounded-full border border-hf-border bg-hf-surface px-3 text-sm font-semibold">
                {UNIDADES_PRODUCAO.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            {refeita ? <ReceitaRefeita r={refeita} inicialAberta /> : <p className="mt-1 text-[12px] text-hf-muted">O sistema refaz a receita para dar exatamente isso, sem sobra.</p>}
          </div>

          <button type="button" onClick={onApagar} className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-hf-border px-4 text-sm font-bold text-hf-text-2 hover:text-hf-danger">
            <Trash2 size={15} /> Apagar esta ficha{usos.length ? " (os itens da semana ficam sem ficha)" : ""}
          </button>
        </div>
      )}
    </article>
  );
}

export default function FichasProducao({ janta, alterar, unidades, unidadeAtiva, avisar }) {
  const [trazendo, setTrazendo] = useState(false);
  const lista = janta.producao || [];

  return (
    <div className="space-y-3">
      <div className="rounded-3xl border border-hf-border bg-hf-surface p-5">
        <h2 className="text-lg font-black text-hf-text">Fichas de produção</h2>
        <p className="mt-1 text-[13px] text-hf-text-2">A receita de cada coisa da janta e quanto ela rende pronta. No cardápio da semana, ligue o item à ficha: o sistema refaz a receita para o total do dia.</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setTrazendo(true)} className="flex h-12 items-center justify-center gap-2 rounded-full border border-hf-border bg-hf-surface text-sm font-black text-hf-text">
            <Download size={16} /> Trazer do restaurante, marmitas ou eventos
          </button>
          <button type="button" onClick={() => alterar((j) => { j.producao = [producaoVazia(), ...(j.producao || [])]; return j; })} className="flex h-12 items-center justify-center gap-2 rounded-full bg-hf-menu text-sm font-black text-white">
            <Plus size={16} /> Nova ficha
          </button>
        </div>
      </div>

      {trazendo && (
        <TrazerFicha unidades={unidades} unidadeAtiva={unidadeAtiva} onFechar={() => setTrazendo(false)}
          onTrazer={(nova) => { alterar((j) => { j.producao = [nova, ...(j.producao || [])]; return j; }); setTrazendo(false); avisar(`"${nova.nome}" trazida. Confira o rendimento e toque em Salvar.`); }} />
      )}

      {lista.length === 0 && !trazendo && (
        <p className="rounded-3xl border border-dashed border-hf-border p-6 text-center text-sm font-semibold text-hf-text-2">Nenhuma ficha de produção ainda.</p>
      )}

      {lista.map((p) => (
        <EditorProducao key={p.id} p={p} usos={usosDaProducao(janta, p.id)}
          onMudar={(fn) => alterar((j) => { const i = j.producao.findIndex((x) => x.id === p.id); if (i >= 0) j.producao[i] = fn(j.producao[i]); return j; })}
          onApagar={() => alterar((j) => { j.producao = j.producao.filter((x) => x.id !== p.id); return j; })} />
      ))}

      <TabelaIndices />
    </div>
  );
}
