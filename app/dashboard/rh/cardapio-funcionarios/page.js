"use client";

// JANTA DOS FUNCIONÁRIOS (pedido do dono, 30/10/2026): cardápio por dia da
// semana, o que é servido, o preparo, e a quantidade de cada coisa conforme o
// número de pessoas — o dono só põe quantas gramas por pessoa. Contas em
// app/lib/janta-funcionarios.mjs; guardado em config_sistema (todos os
// aparelhos da unidade veem o mesmo).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, Loader2, Plus, Printer, Save, Trash2, Users, UtensilsCrossed } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchInsumos } from "../../../lib/operacao";
import { fetchJantaFuncionarios, salvarJantaFuncionarios } from "../../../lib/parametros";
import { fetchColaboradores, fetchAllFolgasDaUnidade } from "../../../lib/rh";
import { DIAS_SEMANA, normalizarJanta, cardapioDoDia, novoIdJanta, escalaDaJanta, pessoasDaJanta } from "../../../lib/janta-funcionarios.mjs";
import { casaBusca } from "../../../lib/busca.mjs";

const brl = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
// Campos em "pílula" (padrão visual do dono, 31/10/2026)
const inputCls = "h-11 w-full rounded-full border border-hf-border bg-hf-surface px-4 text-sm font-semibold text-hf-text outline-none focus:border-hf-accent";
const diaDeHoje = () => ["dom", "seg", "ter", "qua", "qui", "sex", "sab"][new Date().getDay()];
const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const ORIGEM = { manual: "número fixo deste dia", escala: "pela escala do dia", padrao: "padrão da casa (sem escala no cadastro)", sem_dado: "" };

// Círculo de seleção com ✓ (como no simulador)
function Marca({ marcado }) {
  return marcado
    ? <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-hf-text text-white"><Check size={15} strokeWidth={3} /></span>
    : <span className="h-6 w-6 shrink-0 rounded-full border-2 border-hf-border-strong" />;
}

// Semana antiga (só no navegador, com fichas por dia) vira pratos com o nome da ficha.
function semanaAntiga(unidade) {
  try {
    const v = JSON.parse(localStorage.getItem(`cardapio_rh_${unidade}`) || "null");
    if (!v) return null;
    const mapa = { Segunda: "seg", Terça: "ter", Quarta: "qua", Quinta: "qui", Sexta: "sex", Sábado: "sab", Domingo: "dom" };
    const dias = {};
    for (const [rot, id] of Object.entries(mapa)) dias[id] = { pessoas: "", pratos: (v[rot] || []).map((f) => ({ nome: f?.nome_receita || "", preparo: f?.modo_preparo || "", itens: [] })) };
    return { dias };
  } catch { return null; }
}

export default function JantaFuncionarios() {
  const { unidadeAtiva } = useERP();
  const [janta, setJanta] = useState(normalizarJanta(null));
  const [insumos, setInsumos] = useState([]);
  const [equipe, setEquipe] = useState([]);
  const [folgas, setFolgas] = useState([]);
  const [dia, setDia] = useState(diaDeHoje());
  const [carregando, setCarregando] = useState(true);
  const [mudou, setMudou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setCarregando(false); return; }
    let vivo = true;
    (async () => {
      setCarregando(true);
      const [rJ, rI, rC, rF] = await Promise.all([fetchJantaFuncionarios(unidadeAtiva), fetchInsumos(unidadeAtiva, "cozinha"), fetchColaboradores(unidadeAtiva), fetchAllFolgasDaUnidade(unidadeAtiva)]);
      if (!vivo) return;
      setEquipe(rC.data || []);
      setFolgas(rF.data || []);
      setJanta(normalizarJanta(rJ.data || semanaAntiga(unidadeAtiva)));
      setInsumos((rI.data || []).filter((i) => !i.arquivado_em));
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [unidadeAtiva]);

  const mapaInsumos = useMemo(() => new Map(insumos.map((i) => [i.id, i])), [insumos]);
  // Pessoas de cada dia: escala da janta (cadastro + folgas), número fixo do dia ou padrão
  const semana = useMemo(() => DIAS_SEMANA.map((d) => {
    const esc = escalaDaJanta(janta, d.id, { colaboradores: equipe, folgas, hojeIso: hojeIso() });
    const pessoas = pessoasDaJanta(janta, d.id, esc);
    return { ...d, esc, pessoas, r: cardapioDoDia(janta, d.id, { pessoas: pessoas.total, insumos: mapaInsumos }) };
  }), [janta, equipe, folgas, mapaInsumos]);
  const doSel = semana.find((x) => x.id === dia);
  const doDia = doSel.r;
  const esc = doSel.esc;

  const alterar = (fn) => { setJanta((j) => fn(structuredClone(j))); setMudou(true); };
  const alterarDia = (fn) => alterar((j) => { fn(j.dias[dia]); return j; });
  const alterarPrato = (pid, fn) => alterarDia((d) => { const p = d.pratos.find((x) => x.id === pid); if (p) fn(p); });

  async function salvar() {
    setSalvando(true);
    const r = await salvarJantaFuncionarios(unidadeAtiva, janta);
    setSalvando(false);
    if (r?.error) setAviso(`Não salvou: ${r.error}`);
    else { setMudou(false); setAviso("Janta da semana salva."); setTimeout(() => setAviso(""), 3000); }
  }

  function imprimir(lista) {
    const html = `<html><head><meta charset="utf-8"><title>Janta dos funcionários</title><style>
      body{font-family:system-ui,sans-serif;padding:24px;color:#111827} h1{font-size:20px;margin:0 0 16px} h2{font-size:16px;margin:18px 0 6px;border-bottom:2px solid #C5A15A;padding-bottom:4px}
      h3{font-size:14px;margin:10px 0 4px} table{width:100%;border-collapse:collapse;font-size:13px} td,th{border-bottom:1px solid #e5e7eb;padding:4px;text-align:left} td.n{text-align:right}
      p{white-space:pre-line;font-size:13px;margin:4px 0} .s{color:#4b5563;font-size:12px}</style></head><body>
      <h1>Janta dos funcionários</h1>
      ${lista.map(({ rotulo, r }) => `<h2>${rotulo} · ${r.pessoas || "?"} pessoa(s)</h2>${r.pratos.length ? r.pratos.map((p) => `
        <h3>${p.nome || "Prato"}</h3>
        <table><tr><th>Item</th><th class="n">Por pessoa</th><th class="n">Total</th></tr>
        ${p.itens.map((i) => `<tr><td>${i.nome}</td><td class="n">${i.gPessoa ? `${i.gPessoa} g` : "—"}</td><td class="n"><b>${i.rotulo}</b></td></tr>`).join("")}</table>
        ${p.preparo ? `<p><b>Preparo:</b> ${p.preparo.replace(/</g, "&lt;")}</p>` : ""}`).join("") : `<p class="s">Sem prato cadastrado.</p>`}`).join("")}
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html); w.document.close(); w.focus(); w.print();
  }

  if (carregando) return <div className="p-8 text-center font-bold text-hf-text-2"><Loader2 className="mr-2 inline animate-spin" size={18} />Carregando a janta…</div>;
  const d = janta.dias[dia];
  const rotDia = DIAS_SEMANA.find((x) => x.id === dia)?.rotulo;

  const alternarFora = (id) => alterarDia((x) => { const s = new Set(x.fora || []); s.has(String(id)) ? s.delete(String(id)) : s.add(String(id)); x.fora = [...s]; });
  const comJanta = [...esc.jantam, ...esc.tirados].sort((a, b) => a.entrada.localeCompare(b.entrada) || String(a.nome).localeCompare(String(b.nome)));
  const foraSet = new Set(d.fora || []);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-center gap-3">
        <Link href="/dashboard/rh" aria-label="Voltar ao RH" className="grid h-11 w-11 place-items-center rounded-full border border-hf-border bg-hf-surface text-hf-text-2"><ArrowLeft size={18} /></Link>
        <div className="min-w-0 flex-1 basis-[calc(100%-60px)] sm:basis-auto">
          <p className="text-[11px] font-black uppercase tracking-wider text-hf-muted">Héfisto · Equipe</p>
          <h1 className="text-xl font-black text-hf-text">Janta dos funcionários</h1>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button onClick={() => imprimir(semana)} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-hf-border bg-hf-surface px-4 text-sm font-bold text-hf-text sm:flex-none"><Printer size={16} /> Imprimir semana</button>
          <button onClick={salvar} disabled={!mudou || salvando} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-hf-accent px-5 text-sm font-black text-hf-accent-fg disabled:opacity-50 sm:flex-none">{salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar</button>
        </div>
      </header>
      {aviso && <p role="status" className="rounded-full bg-hf-elevated px-4 py-2 text-sm font-bold text-hf-text">{aviso}</p>}

      {/* Semana: cada dia com quantas pessoas jantam e o prato */}
      <div role="tablist" aria-label="Dia da semana" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {semana.map((x) => (
          <button key={x.id} role="tab" aria-selected={dia === x.id} onClick={() => setDia(x.id)}
            className={`shrink-0 rounded-2xl border px-4 py-2 text-left transition ${dia === x.id ? "border-hf-text bg-hf-text text-white" : "border-hf-border bg-hf-surface text-hf-text"}`}>
            <span className="block text-sm font-black">{x.rotulo}{x.id === diaDeHoje() ? " · hoje" : ""}</span>
            <span className={`block text-[11px] font-semibold ${dia === x.id ? "text-white/75" : "text-hf-muted"}`}>
              {x.pessoas.total ? `${x.pessoas.total} pessoa(s)` : "sem pessoas"} · {x.r.pratos.length ? x.r.pratos.map((p) => p.nome || "Prato").join(", ").slice(0, 22) : "sem prato"}
            </span>
          </button>
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(300px,380px)_1fr]">
        {/* ESCALA DA JANTA */}
        <section className="rounded-3xl border border-hf-border bg-hf-surface p-5">
          <p className="text-[11px] font-black uppercase tracking-wider text-hf-muted">Escala da janta · {rotDia} {ddmm(esc.data)}</p>
          <div className="mt-2 flex items-end gap-2">
            <p className="text-4xl font-black tabular-nums text-hf-text">{doSel.pessoas.total || "—"}</p>
            <p className="pb-1.5 text-sm font-bold text-hf-text-2">pessoa(s) jantam</p>
          </div>
          <p className="text-xs text-hf-muted">{doSel.pessoas.total ? ORIGEM[doSel.pessoas.origem] : "DADOS INSUFICIENTES: ninguém com horário neste dia no cadastro do RH. Ponha um número fixo abaixo."}</p>

          {comJanta.length > 0 && (
            <ul className="mt-4 divide-y divide-hf-border">
              {comJanta.map((p) => {
                const janta = !foraSet.has(String(p.id));
                return (
                  <li key={p.id}>
                    <button onClick={() => alternarFora(p.id)} aria-pressed={janta} className="flex w-full items-center gap-3 py-2.5 text-left">
                      <Marca marcado={janta} />
                      <span className={`min-w-0 flex-1 truncate text-[15px] ${janta ? "font-semibold text-hf-text" : "text-hf-muted line-through"}`}>{p.nome}</span>
                      <span className="text-xs tabular-nums text-hf-muted">{p.entrada}–{p.saida}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {(esc.semJanta.length > 0 || esc.folgas.length > 0) && (
            <div className="mt-3 space-y-1 rounded-2xl bg-hf-elevated p-3 text-xs text-hf-text-2">
              {esc.folgas.length > 0 && <p><b>De folga:</b> {esc.folgas.map((f) => f.nome).join(", ")}</p>}
              {esc.semJanta.length > 0 && <p><b>Trabalham sem janta</b> (cadastro): {esc.semJanta.map((f) => f.nome).join(", ")}</p>}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-xs font-bold text-hf-text-2">Extras (visitas, freelas)
              <input inputMode="numeric" value={d.extras} onChange={(e) => alterarDia((x) => { x.extras = e.target.value; })} placeholder="0" className={`${inputCls} mt-1`} />
            </label>
            <label className="text-xs font-bold text-hf-text-2">Número fixo do dia
              <input inputMode="numeric" value={d.pessoas} onChange={(e) => alterarDia((x) => { x.pessoas = e.target.value; })} placeholder="pela escala" className={`${inputCls} mt-1`} />
            </label>
          </div>
          <details className="mt-3 text-xs text-hf-text-2">
            <summary className="flex cursor-pointer items-center gap-1 font-bold"><ChevronDown size={14} /> Padrão quando não há escala</summary>
            <input inputMode="numeric" value={janta.pessoas_padrao} onChange={(e) => alterar((j) => { j.pessoas_padrao = e.target.value; return j; })} placeholder="Ex.: 12" className={`${inputCls} mt-2`} />
          </details>
        </section>

        {/* FICHA DA JANTA */}
        <section className="space-y-3">
          <div className="rounded-3xl border border-hf-border bg-hf-surface p-5">
            <p className="text-[11px] font-black uppercase tracking-wider text-hf-muted">Ficha da janta · {rotDia}</p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div><p className="text-xs text-hf-text-2">Pessoas</p><p className="text-xl font-black tabular-nums text-hf-text">{doDia.pessoas || "—"}</p></div>
              <div><p className="text-xs text-hf-text-2">Custo da janta</p><p className="text-xl font-black tabular-nums text-hf-text">{doDia.custo > 0 ? brl(doDia.custo) : "—"}</p></div>
              <div><p className="text-xs text-hf-text-2">Por pessoa</p><p className="text-xl font-black tabular-nums text-hf-text">{brl(doDia.custoPorPessoa)}</p></div>
            </div>
            <p className="mt-2 text-xs text-hf-muted">{doDia.semCusto ? `ESTIMATIVA: ${doDia.semCusto} item(ns) sem produto com preço no cadastro.` : doDia.custo > 0 ? "Custo pelos preços do cadastro. As quantidades mudam sozinhas com o número de pessoas." : "Você põe os gramas por pessoa de cada item; o total muda sozinho com o número de pessoas do dia."}</p>
            <button onClick={() => imprimir([{ rotulo: rotDia, r: doDia }])} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-hf-elevated text-sm font-black text-hf-text hover:bg-hf-border"><Printer size={16} /> Imprimir a ficha da janta de {rotDia}</button>
          </div>

      <datalist id="produtos-janta">{insumos.map((i) => <option key={i.id} value={i.nome} />)}</datalist>
      <div className="space-y-3">
        {doDia.pratos.map((p) => (
          <article key={p.id} className="rounded-3xl border border-hf-border bg-hf-surface p-5">
            <div className="flex items-center gap-2">
              <UtensilsCrossed size={18} className="shrink-0 text-hf-accent" />
              <input value={p.nome} onChange={(e) => alterarPrato(p.id, (x) => { x.nome = e.target.value; })} placeholder="Nome do prato (ex.: Macarronada)" className={`${inputCls} text-base font-black`} />
              <button onClick={() => alterarDia((x) => { x.pratos = x.pratos.filter((y) => y.id !== p.id); })} aria-label={`Remover ${p.nome || "prato"}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-hf-border text-hf-text-2 hover:text-hf-danger"><Trash2 size={16} /></button>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead><tr className="text-left text-[11px] font-black uppercase tracking-wide text-hf-muted"><th className="pb-1">Item</th><th className="w-28 pb-1">g por pessoa</th><th className="w-28 pb-1 text-right">Total ({doDia.pessoas || "?"})</th><th className="w-24 pb-1 text-right">Custo</th><th className="w-10" /></tr></thead>
                <tbody>
                  {janta.dias[dia].pratos.find((x) => x.id === p.id).itens.map((i) => {
                    const calc = p.itens.find((x) => x.id === i.id);
                    return (
                      <tr key={i.id} className="border-t border-hf-border">
                        <td className="py-1.5 pr-2">
                          <input list="produtos-janta" value={i.nome} placeholder="Produto (ex.: Macarrão)"
                            onChange={(e) => { const v = e.target.value; const achado = insumos.find((x) => x.nome === v) || null; alterarPrato(p.id, (x) => { const it = x.itens.find((y) => y.id === i.id); it.nome = v; it.insumo_id = achado?.id || null; }); }}
                            className={inputCls} />
                          {i.nome && !i.insumo_id && <span className="text-[11px] text-hf-muted">{insumos.some((x) => casaBusca(x.nome, i.nome)) ? "Escolha da lista para ligar ao cadastro e ver o custo." : "Fora do cadastro: entra na quantidade, sem custo."}</span>}
                        </td>
                        <td className="py-1.5 pr-2"><input inputMode="decimal" value={i.g_pessoa} onChange={(e) => alterarPrato(p.id, (x) => { x.itens.find((y) => y.id === i.id).g_pessoa = e.target.value; })} placeholder="120" className={inputCls} /></td>
                        <td className="py-1.5 text-right font-black tabular-nums text-hf-text">{calc?.rotulo || "—"}</td>
                        <td className="py-1.5 text-right tabular-nums text-hf-text-2">{calc?.custo != null ? brl(calc.custo) : "—"}</td>
                        <td className="py-1.5 text-right"><button onClick={() => alterarPrato(p.id, (x) => { x.itens = x.itens.filter((y) => y.id !== i.id); })} aria-label="Remover item" className="text-hf-muted hover:text-hf-danger"><Trash2 size={15} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button onClick={() => alterarPrato(p.id, (x) => { x.itens.push({ id: novoIdJanta("i"), nome: "", insumo_id: null, g_pessoa: "" }); })} className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-hf-accent"><Plus size={15} /> Item</button>
            <label className="mt-3 block text-xs font-bold text-hf-text-2">Como fazer (preparo)
              <textarea value={p.preparo} onChange={(e) => alterarPrato(p.id, (x) => { x.preparo = e.target.value; })} rows={4} placeholder="1. Cozinhe o macarrão em água com sal…&#10;2. Refogue a carne com alho e cebola…" className="mt-1 w-full rounded-2xl border border-hf-border bg-hf-surface p-3 text-sm text-hf-text outline-none focus:border-hf-accent" />
            </label>
          </article>
        ))}
        <button onClick={() => alterarDia((x) => { x.pratos.push({ id: novoIdJanta("p"), nome: "", preparo: "", itens: [{ id: novoIdJanta("i"), nome: "", insumo_id: null, g_pessoa: "" }] }); })}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-dashed border-hf-border text-sm font-black text-hf-text-2 hover:border-hf-accent hover:text-hf-accent">
          <Plus size={16} /> Adicionar prato na {rotDia}
        </button>
      </div>
        </section>
      </div>
    </div>
  );
}
