"use client";

// JANTA DOS FUNCIONÁRIOS (pedido do dono, 30/10/2026): cardápio por dia da
// semana, o que é servido, o preparo, e a quantidade de cada coisa conforme o
// número de pessoas — o dono só põe quantas gramas por pessoa.
// 14/11/2026: arroz, feijão e salada fixos ("Todo dia"); porção do produto
// pronto em g, unidades ou ml; item ligado à ficha técnica mostra a receita
// refeita para dar as porções do dia, sem sobra. Contas em
// app/lib/janta-funcionarios.mjs; guardado em config_sistema (todos os
// aparelhos da unidade veem o mesmo).
// 24/11/2026 (dono): sem "Ficha do dia". Duas abas: "Montar a semana" e
// "Fichas de produção" (trazidas do restaurante, marmitas ou eventos, ou novas;
// rendem X pronto, por pesagem ou cru × índice de cocção). O item da semana
// liga à ficha de produção e a receita se refaz para o total do dia.

import { useRascunho } from "../../../lib/useRascunho";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Copy, ExternalLink, Loader2, Minus, Plus, Printer, Save, Trash2, UtensilsCrossed, Pin } from "lucide-react";
import FichasProducao, { ReceitaRefeita } from "../../../components/janta/FichasProducao";
import HistoricoJanta from "../../../components/janta/HistoricoJanta";
import { registrarNoHistorico, registroDoDia, tirarDoHistorico } from "../../../lib/janta-historico.mjs";
import { mapaDeInsumos } from "../../../lib/janta-producao.mjs";
import { useERP } from "../../../context/ERPContext";
import { fetchInsumos, fetchFichas } from "../../../lib/operacao";
import { alterarHistoricoJanta, fetchHistoricoJanta, fetchJantaFuncionarios, salvarJantaFuncionarios } from "../../../lib/parametros";
import { DIAS_SEMANA, MODOS_PORCAO, normalizarJanta, cardapioDoDia, novoIdJanta, pessoasDoDia, normalizarItem, pratoDaPessoa, repetirDia } from "../../../lib/janta-funcionarios.mjs";
import { casaBusca } from "../../../lib/busca.mjs";
import { hasPermission } from "../../../lib/permissions-catalog.mjs";

const brl = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
// Campos em "pílula" (padrão visual do dono, 31/10/2026)
const inputCls = "h-11 w-full rounded-full border border-hf-border bg-hf-surface px-4 text-sm font-semibold text-hf-text outline-none focus:border-hf-accent";
const diaDeHoje = () => ["dom", "seg", "ter", "qua", "qui", "sex", "sab"][new Date().getDay()];
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

const vazioItem = () => ({ id: novoIdJanta("i"), nome: "", insumo_id: null, ficha_id: null, producao_id: null, modo: "g", porcao: "", g_pessoa: "" });
const porcaoTexto = (i) => (i.porcaoN ? `${i.porcaoN.toLocaleString("pt-BR")} ${MODOS_PORCAO.find((m) => m.id === i.modo)?.curto || "g"}/pessoa` : "");

// Uma linha do editor (dono): produto, porção pronta por pessoa, medida e ficha.
function LinhaItem({ i, calc, insumos, fichas, producao = [], onMudar, onTirar, onNovaFicha, mostrarCusto = true }) {
  const set = (fn) => onMudar((it) => { fn(it); if (it.modo === "g") it.g_pessoa = it.porcao; else it.g_pessoa = ""; });
  return (
    <div className="rounded-2xl border border-hf-border p-3">
      <div className="flex items-center gap-2">
        <input list="produtos-janta" value={i.nome} placeholder="Ex.: Arroz, Feijão, Almôndega"
          onChange={(e) => { const v = e.target.value; const achado = insumos.find((x) => x.nome === v) || null; set((it) => { it.nome = v; it.insumo_id = achado?.id || null; }); }}
          className={inputCls} />
        <button onClick={onTirar} aria-label="Remover item" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-hf-border text-hf-muted hover:text-hf-danger"><Trash2 size={15} /></button>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_1.4fr] gap-2">
        {i.modo === "geral"
          ? <input aria-label="Quantidade geral" value={i.geral || ""} onChange={(e) => set((it) => { it.geral = e.target.value; })} placeholder="½ pé de alface, 1 tomate" className={inputCls} />
          : <input inputMode="decimal" aria-label="Porção por pessoa" value={i.porcao} onChange={(e) => set((it) => { it.porcao = e.target.value; })} placeholder={i.modo === "un" ? "1" : i.modo === "ml" ? "80" : "200"} className={inputCls} />}
        <select aria-label="Medida da porção" value={i.modo} onChange={(e) => set((it) => { it.modo = e.target.value; })} className={inputCls}>
          {MODOS_PORCAO.map((m) => <option key={m.id} value={m.id}>{m.rotulo}</option>)}
        </select>
      </div>
      <select aria-label="Ficha de produção" value={i.producao_id || (i.ficha_id ? `ficha:${i.ficha_id}` : "")}
        onChange={(e) => { const v = e.target.value; if (v === "__nova") { onNovaFicha?.(); return; } set((it) => { if (v.startsWith("ficha:")) return; it.producao_id = v || null; it.ficha_id = null; const p = producao.find((x) => x.id === v); if (p && !it.nome) it.nome = p.nome; }); }}
        className={`${inputCls} mt-2`}>
        <option value="">Sem ficha de produção (só a quantidade)</option>
        {producao.map((p) => <option key={p.id} value={p.id}>Ficha: {p.nome || "sem nome"}</option>)}
        {i.ficha_id && !i.producao_id && <option value={`ficha:${i.ficha_id}`}>Ficha técnica antiga: {fichas.find((f) => f.id === i.ficha_id)?.nome_receita || "—"}</option>}
        <option value="__nova">+ Nova ficha de produção…</option>
      </select>
      {i.ficha_id && !i.producao_id && (
        <Link href={`/dashboard/operacao/fichas/${i.ficha_id}`} className="mt-1.5 inline-flex min-h-[40px] items-center gap-1.5 text-[13px] font-bold text-hf-accent">
          <ExternalLink size={14} /> Ver a ficha técnica antiga
        </Link>
      )}
      {i.modo === "g" && !i.ficha_id && !i.producao_id && (
        <label className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-hf-text-2">
          1 g cru vira
          <input inputMode="decimal" aria-label="Quanto 1 g cru vira pronto" value={i.rend_cozimento ?? ""} onChange={(e) => set((it) => { it.rend_cozimento = e.target.value; })} placeholder="3" className="h-9 w-20 rounded-full border border-hf-border bg-hf-surface px-3 text-sm font-semibold" />
          g pronto (opcional: diz quanto cozinhar cru)
        </label>
      )}
      <p className="mt-1.5 text-[12px] text-hf-muted">
        Total do dia: <b className="text-hf-text">{calc?.rotulo || "—"}</b>{calc?.cru ? ` · cozinhar ~${calc.cru.rotulo} cru` : ""}
        {calc?.receita?.status === "ok" ? ` · ${calc.receita.rotuloFator}` : calc?.receita?.status === "insuficiente" ? ` · ${calc.receita.motivo}` : ""}
        {mostrarCusto && calc?.custo != null ? ` · ${brl(calc.custo)}` : ""}
      </p>
      {calc?.receita && (i.producao_id || i.ficha_id) && <ReceitaRefeita r={calc.receita} />}
    </div>
  );
}

/** Repetir o cardápio do dia em outros dias (dono, 22/11/2026). */
function RepetirDia({ dia, rotDia, janta, onRepetir }) {
  const [aberto, setAberto] = useState(false);
  const [para, setPara] = useState([]);
  const outros = DIAS_SEMANA.filter((d) => d.id !== dia);
  const temPrato = (id) => (janta.dias[id]?.pratos || []).some((p) => p.nome || (p.itens || []).length);
  const vaiTrocar = para.filter(temPrato).map((id) => DIAS_SEMANA.find((d) => d.id === id)?.rotulo);
  const semPrato = !(janta.dias[dia]?.pratos || []).length;
  if (!aberto) {
    return (
      <button type="button" disabled={semPrato} onClick={() => { setAberto(true); setPara([]); }}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-hf-border bg-hf-surface text-sm font-black text-hf-text disabled:opacity-40">
        <Copy size={16} /> Repetir o cardápio da {rotDia} em outros dias
      </button>
    );
  }
  const todos = para.length === outros.length;
  return (
    <div className="rounded-3xl border border-hf-border bg-hf-surface p-4">
      <p className="text-sm font-black text-hf-text">Repetir o cardápio da {rotDia} em:</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => setPara(todos ? [] : outros.map((d) => d.id))} aria-pressed={todos}
          className={`min-h-[44px] rounded-full px-4 text-sm font-bold ${todos ? "bg-hf-menu text-white" : "border border-hf-border text-hf-text-2"}`}>Todos os dias</button>
        {outros.map((d) => {
          const ativo = para.includes(d.id);
          return (
            <button key={d.id} type="button" aria-pressed={ativo} onClick={() => setPara(ativo ? para.filter((x) => x !== d.id) : [...para, d.id])}
              className={`min-h-[44px] rounded-full px-4 text-sm font-bold ${ativo ? "bg-hf-menu text-white" : "border border-hf-border text-hf-text-2"}`}>{d.rotulo}</button>
          );
        })}
      </div>
      {vaiTrocar.length > 0 && <p className="mt-2 text-[13px] font-semibold text-hf-warning">Vai substituir o cardápio de: {vaiTrocar.join(", ")}.</p>}
      <p className="mt-2 text-[12px] text-hf-muted">O número de pessoas de cada dia não muda. A semana já se repete sozinha toda semana.</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => setAberto(false)} className="h-11 flex-1 rounded-full border border-hf-border text-sm font-bold text-hf-text-2">Cancelar</button>
        <button type="button" disabled={!para.length} onClick={() => { onRepetir(para); setAberto(false); }}
          className="h-11 flex-1 rounded-full bg-hf-menu text-sm font-black text-white disabled:opacity-40">{vaiTrocar.length ? "Repetir e substituir" : "Repetir"}</button>
      </div>
    </div>
  );
}

export default function JantaFuncionarios() {
  const { unidadeAtiva, unidades, sessao } = useERP();
  // Custo e histórico só para quem monta a janta (conta rápida do RH só vê o cardápio)
  const podeVerCusto = !sessao?.gerenciado || hasPermission(sessao, "rh.staff_menu.edit");
  const [janta, setJanta] = useState(normalizarJanta(null));
  const [insumos, setInsumos] = useState([]);
  const [fichas, setFichas] = useState([]);
  const [dia, setDia] = useState(diaDeHoje());
  // "montar": o cardápio da semana; "producao": as fichas de produção da janta
  const [modo, setModo] = useState("montar");
  const [historico, setHistorico] = useState([]);
  const [carregandoHist, setCarregandoHist] = useState(true);
  const [dataRegistro, setDataRegistro] = useState(() => new Date().toLocaleDateString("sv-SE"));
  const [registrando, setRegistrando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [mudou, setMudou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");
  // Mudança não salva sobrevive ao recarregar (dono, 24/11/2026)
  const rascunhoJanta = useRascunho({
    chave: unidadeAtiva ? `janta:${unidadeAtiva}` : "", pronto: !!unidadeAtiva && !carregando, ativo: mudou, unidadeId: unidadeAtiva,
    estado: { janta, modo, dia },
    aplicar: (d) => { if (!d?.janta) return; setJanta(normalizarJanta(d.janta)); if (d.modo) setModo(d.modo); if (d.dia) setDia(d.dia); setMudou(true); setAviso("Voltei para o que você estava fazendo. Toque em Salvar para gravar."); },
  });

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setCarregando(false); return; }
    let vivo = true;
    (async () => {
      setCarregando(true);
      const [rJ, rI, rF] = await Promise.all([fetchJantaFuncionarios(unidadeAtiva), fetchInsumos(unidadeAtiva, "cozinha"), fetchFichas(unidadeAtiva, "cozinha").catch(() => ({ data: [] }))]);
      if (!vivo) return;
      setFichas((rF?.data || []).sort((a, b) => String(a.nome_receita).localeCompare(String(b.nome_receita), "pt-BR")));
      setJanta(normalizarJanta(rJ.data || semanaAntiga(unidadeAtiva)));
      setInsumos((rI.data || []).filter((i) => !i.arquivado_em));
      setCarregando(false);
    })();
    fetchHistoricoJanta(unidadeAtiva).then((r) => { if (vivo) { setHistorico(r.data || []); setCarregandoHist(false); } });
    return () => { vivo = false; };
  }, [unidadeAtiva]);

  const mapaInsumos = useMemo(() => mapaDeInsumos(insumos), [insumos]);
  const mapaFichas = useMemo(() => new Map(fichas.map((f) => [f.id, f])), [fichas]);
  // Pessoas de cada dia: o número que o dono informa (sem número no dia, o padrão)
  const semana = useMemo(() => DIAS_SEMANA.map((d) => ({ ...d, pessoas: pessoasDoDia(janta, d.id), r: cardapioDoDia(janta, d.id, { insumos: mapaInsumos, fichas: mapaFichas }) })), [janta, mapaInsumos, mapaFichas]);
  const doSel = semana.find((x) => x.id === dia);
  const doDia = doSel.r;

  const alterar = (fn) => { setJanta((j) => fn(structuredClone(j))); setMudou(true); };
  const alterarDia = (fn) => alterar((j) => { fn(j.dias[dia]); return j; });
  const alterarPrato = (pid, fn) => alterarDia((d) => { const p = d.pratos.find((x) => x.id === pid); if (p) fn(p); });

  async function salvar() {
    setSalvando(true);
    const r = await salvarJantaFuncionarios(unidadeAtiva, janta);
    setSalvando(false);
    if (r?.error) setAviso(`Não salvou: ${r.error}`);
    else { setMudou(false); rascunhoJanta.descartar(); setAviso("Janta da semana salva."); setTimeout(() => setAviso(""), 3000); }
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
        ${p.itens.map((i) => `<tr><td>${String(i.nome).replace(/</g, "&lt;")}</td><td class="n">${porcaoTexto(i) || "—"}</td><td class="n"><b>${i.rotulo}</b></td></tr>`).join("")}</table>
        ${p.itens.filter((i) => i.receita?.status === "ok").map((i) => `<p><b>${String(i.nome).replace(/</g, "&lt;")}: ${i.receita.rotuloFator}</b> · ${i.receita.ingredientes.map((g) => `${String(g.nome).replace(/</g, "&lt;")} ${g.quantidade}`).join(", ")}</p>`).join("")}
        ${p.preparo ? `<p><b>Preparo:</b> ${p.preparo.replace(/</g, "&lt;")}</p>` : ""}`).join("") : `<p class="s">Sem prato cadastrado.</p>`}`).join("")}
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html); w.document.close(); w.focus(); w.print();
  }

  if (carregando) return <div className="p-8 text-center font-bold text-hf-text-2"><Loader2 className="mr-2 inline animate-spin" size={18} />Carregando a janta…</div>;
  const d = janta.dias[dia];
  const rotDia = DIAS_SEMANA.find((x) => x.id === dia)?.rotulo;

  const mudarPessoas = (delta) => alterarDia((x) => { const atual = Number(x.pessoas) || Number(janta.pessoas_padrao) || 0; x.pessoas = String(Math.max(0, atual + delta)); });

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
      <div className={`grid ${podeVerCusto ? "grid-cols-3" : "grid-cols-2"} gap-1 rounded-full bg-hf-elevated p-1 sm:inline-grid sm:w-auto`}>
        {[["montar", "Montar a semana"], ["producao", "Fichas de produção"], ...(podeVerCusto ? [["historico", "Histórico"]] : [])].map(([id, rot]) => (
          <button key={id} onClick={() => setModo(id)} aria-pressed={modo === id}
            className={`min-h-[44px] rounded-full px-5 text-sm font-black transition ${modo === id ? "bg-hf-menu text-white" : "text-hf-text-2"}`}>{rot}</button>
        ))}
      </div>

      {modo === "historico" && podeVerCusto ? (
        <HistoricoJanta historico={historico} carregando={carregandoHist}
          onRemover={async (data) => { const r = await alterarHistoricoJanta(unidadeAtiva, (l) => tirarDoHistorico(l, data)); if (r.error) setAviso(`Não tirou: ${r.error}`); else setHistorico(r.data); }} />
      ) : modo === "producao" ? (
        <FichasProducao janta={janta} alterar={alterar} unidades={unidades} unidadeAtiva={unidadeAtiva} insumos={insumos} mostrarCusto={podeVerCusto}
          avisar={(t) => { setAviso(t); setTimeout(() => setAviso(""), 4000); }} />
      ) : (<>
      <div role="tablist" aria-label="Dia da semana" className="flex w-full min-w-0 max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {semana.map((x) => (
          <button key={x.id} role="tab" aria-selected={dia === x.id} onClick={() => setDia(x.id)}
            className={`shrink-0 rounded-2xl border px-4 py-2 text-left transition ${dia === x.id ? "border-hf-text bg-hf-text text-white" : "border-hf-border bg-hf-surface text-hf-text"}`}>
            <span className="block text-sm font-black">{x.rotulo}{x.id === diaDeHoje() ? " · hoje" : ""}</span>
            <span className={`block text-[11px] font-semibold ${dia === x.id ? "text-white/75" : "text-hf-muted"}`}>
              {x.pessoas ? `${x.pessoas} pessoa(s)` : "quantas pessoas?"} · {x.r.pratos.length ? x.r.pratos.map((p) => p.nome || "Prato").join(", ").slice(0, 22) : "sem prato"}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(300px,380px)_1fr]">
        {/* QUANTAS PESSOAS JANTAM (o dono informa) */}
        <section className="rounded-3xl border border-hf-border bg-hf-surface p-5">
          <p className="text-[11px] font-black uppercase tracking-wider text-hf-muted">Quantas pessoas jantam · {rotDia}</p>
          <div className="mt-3 flex items-center gap-3">
            <button onClick={() => mudarPessoas(-1)} aria-label="Uma pessoa a menos" className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-hf-border bg-hf-surface text-hf-text"><Minus size={20} /></button>
            <input inputMode="numeric" aria-label={`Pessoas que jantam na ${rotDia}`} value={d.pessoas} onChange={(e) => alterarDia((x) => { x.pessoas = e.target.value.replace(/\D/g, ""); })}
              placeholder={janta.pessoas_padrao ? String(janta.pessoas_padrao) : "0"}
              className="h-14 min-w-0 flex-1 rounded-full border border-hf-border bg-hf-surface text-center text-3xl font-black tabular-nums text-hf-text outline-none focus:border-hf-accent" />
            <button onClick={() => mudarPessoas(1)} aria-label="Uma pessoa a mais" className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-hf-border bg-hf-surface text-hf-text"><Plus size={20} /></button>
          </div>
          <p className="mt-2 text-xs text-hf-muted">{d.pessoas ? "A ficha da janta já está calculada para esse número." : janta.pessoas_padrao ? `Sem número neste dia: usando o padrão de ${janta.pessoas_padrao}.` : "Diga quantas pessoas jantam: as quantidades da ficha saem desse número."}</p>
          <details className="mt-3 text-xs text-hf-text-2">
            <summary className="flex cursor-pointer items-center gap-1 font-bold"><ChevronDown size={14} /> Número padrão (quando o dia fica em branco)</summary>
            <input inputMode="numeric" value={janta.pessoas_padrao} onChange={(e) => alterar((j) => { j.pessoas_padrao = e.target.value.replace(/\D/g, ""); return j; })} placeholder="Ex.: 12" className={`${inputCls} mt-2`} />
          </details>
        </section>

        {/* FICHA DA JANTA */}
        <section className="space-y-3">
          <div className="rounded-3xl border border-hf-border bg-hf-surface p-5">
            <p className="text-[11px] font-black uppercase tracking-wider text-hf-muted">Ficha da janta · {rotDia}</p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div><p className="text-xs text-hf-text-2">Pessoas</p><p className="text-xl font-black tabular-nums text-hf-text">{doDia.pessoas || "—"}</p></div>
              {podeVerCusto && <><div><p className="text-xs text-hf-text-2">Custo da janta</p><p className="text-xl font-black tabular-nums text-hf-text">{doDia.custo > 0 ? brl(doDia.custo) : "—"}</p></div>
              <div><p className="text-xs text-hf-text-2">Por pessoa</p><p className="text-xl font-black tabular-nums text-hf-text">{brl(doDia.custoPorPessoa)}</p></div></>}
            </div>
            <p className="mt-2 text-xs text-hf-muted">{doDia.semCusto ? `ESTIMATIVA: ${doDia.semCusto} item(ns) sem produto com preço no cadastro.` : doDia.custo > 0 ? "Custo pelos preços do cadastro. As quantidades mudam sozinhas com o número de pessoas." : "Você põe a porção pronta por pessoa (g, unidades ou ml); o total e a receita mudam sozinhos com o número de pessoas do dia."}</p>
            <button onClick={() => imprimir([{ rotulo: rotDia, r: doDia }])} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-hf-elevated text-sm font-black text-hf-text hover:bg-hf-border"><Printer size={16} /> Imprimir a ficha da janta de {rotDia}</button>
            {/* Histórico: quanto custou cada dia e por pessoa (dono, 24/11/2026) */}
            {podeVerCusto && <div className="mt-3 rounded-2xl border border-hf-border p-3">
              <p className="text-sm font-black text-hf-text">Registrar no histórico</p>
              <p className="text-[12px] text-hf-muted">Confira quantas pessoas jantaram e registre: fica guardado o custo do dia e por pessoa.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input type="date" aria-label="Data da janta" value={dataRegistro} max={new Date().toLocaleDateString("sv-SE")} onChange={(e) => setDataRegistro(e.target.value)}
                  className="h-11 rounded-full border border-hf-border bg-hf-surface px-4 text-sm font-semibold text-hf-text" />
                <button type="button" disabled={registrando || !(doDia.pessoas > 0) || !dataRegistro}
                  onClick={async () => {
                    setRegistrando(true);
                    const reg = registroDoDia(dataRegistro, dia, doDia);
                    const r = await alterarHistoricoJanta(unidadeAtiva, (l) => registrarNoHistorico(l, reg));
                    setRegistrando(false);
                    if (r.error) { setAviso(`Não registrou: ${r.error}`); return; }
                    setHistorico(r.data);
                    setAviso(`Janta de ${new Date(`${dataRegistro}T12:00:00`).toLocaleDateString("pt-BR")} registrada: ${reg.pessoas} pessoa(s)${reg.custo != null ? `, ${brl(reg.custo)} (${brl(reg.custoPorPessoa)} por pessoa)` : ", sem custo (falta preço)"}.`);
                    setTimeout(() => setAviso(""), 5000);
                  }}
                  className="h-11 flex-1 rounded-full bg-hf-menu px-4 text-sm font-black text-white disabled:opacity-40">
                  {registrando ? "Registrando…" : `Registrar ${doDia.pessoas || 0} pessoa(s) · ${doDia.custo > 0 ? brl(doDia.custo) : "sem custo"}`}
                </button>
              </div>
              {historico.some((h) => h.data === dataRegistro) && <p className="mt-1 text-[12px] font-semibold text-hf-warning">Esta data já está no histórico: registrar de novo substitui.</p>}
            </div>}
          </div>

      {doDia.pessoas > 0 && pratoDaPessoa(doDia).length > 0 && (
        <article className="rounded-3xl border border-hf-border bg-hf-surface p-5">
          <h2 className="text-lg font-black text-hf-text">Prato de cada pessoa</h2>
          <ul className="mt-2 divide-y divide-hf-border">
            {pratoDaPessoa(doDia).map((x, k) => (
              <li key={k} className="flex justify-between gap-3 py-2 text-[15px]"><span className="font-semibold text-hf-text">{x.nome}</span><b className="tabular-nums text-hf-text">{x.texto}</b></li>
            ))}
          </ul>
        </article>
      )}
      <>
      <datalist id="produtos-janta">{insumos.map((i) => <option key={i.id} value={i.nome} />)}</datalist>
      <div className="space-y-3">
        <article className="rounded-3xl border-2 border-hf-accent/40 bg-hf-surface p-5">
          <h2 className="flex items-center gap-2 text-lg font-black text-hf-text"><Pin size={18} className="text-hf-accent" /> Todo dia (fixos)</h2>
          <p className="mt-1 text-[13px] text-hf-text-2">Vale para todos os dias da semana (ex.: arroz, feijão, salada). A porção é do produto <b>pronto</b>: feijão já com caldo.</p>
          <div className="mt-3 space-y-2">
            {(janta.fixos || []).map((i) => (
              <LinhaItem key={i.id} i={i} calc={doDia.pratos.find((x) => x.fixo)?.itens.find((x) => x.id === i.id)} insumos={insumos} fichas={fichas} producao={janta.producao || []} onNovaFicha={() => setModo("producao")} mostrarCusto={podeVerCusto}
                onMudar={(fn) => alterar((j) => { const it = j.fixos.find((y) => y.id === i.id); if (it) fn(it); return j; })}
                onTirar={() => alterar((j) => { j.fixos = j.fixos.filter((y) => y.id !== i.id); return j; })} />
            ))}
          </div>
          <button onClick={() => alterar((j) => { j.fixos = [...(j.fixos || []), vazioItem()]; return j; })} className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-hf-accent"><Plus size={15} /> Item fixo</button>
        </article>
        {doDia.pratos.filter((p) => !p.fixo).map((p) => (
          <article key={p.id} className="rounded-3xl border border-hf-border bg-hf-surface p-5">
            <div className="flex items-center gap-2">
              <UtensilsCrossed size={18} className="shrink-0 text-hf-accent" />
              <input value={p.nome} onChange={(e) => alterarPrato(p.id, (x) => { x.nome = e.target.value; })} placeholder="Prato do dia (ex.: Almôndegas ao molho)" className={`${inputCls} text-base font-black`} />
              <button onClick={() => alterarDia((x) => { x.pratos = x.pratos.filter((y) => y.id !== p.id); })} aria-label={`Remover ${p.nome || "prato"}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-hf-border text-hf-text-2 hover:text-hf-danger"><Trash2 size={16} /></button>
            </div>
            <div className="mt-3 space-y-2">
              {janta.dias[dia].pratos.find((x) => x.id === p.id).itens.map((i) => (
                <LinhaItem key={i.id} i={normalizarItem(i)} calc={p.itens.find((x) => x.id === i.id)} insumos={insumos} fichas={fichas} producao={janta.producao || []} onNovaFicha={() => setModo("producao")} mostrarCusto={podeVerCusto}
                  onMudar={(fn) => alterarPrato(p.id, (x) => { const it = x.itens.find((y) => y.id === i.id); if (it) fn(it); })}
                  onTirar={() => alterarPrato(p.id, (x) => { x.itens = x.itens.filter((y) => y.id !== i.id); })} />
              ))}
            </div>
            <button onClick={() => alterarPrato(p.id, (x) => { x.itens.push(vazioItem()); })} className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-hf-accent"><Plus size={15} /> Item</button>
            <label className="mt-3 block text-xs font-bold text-hf-text-2">Como fazer (preparo)
              <textarea value={p.preparo} onChange={(e) => alterarPrato(p.id, (x) => { x.preparo = e.target.value; })} rows={4} placeholder="1. Modele as almôndegas…&#10;2. Doure e junte o molho…" className="mt-1 w-full rounded-2xl border border-hf-border bg-hf-surface p-3 text-sm text-hf-text outline-none focus:border-hf-accent" />
            </label>
          </article>
        ))}
        <button onClick={() => alterarDia((x) => { x.pratos.push({ id: novoIdJanta("p"), nome: "", preparo: "", itens: [vazioItem()] }); })}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-dashed border-hf-border text-sm font-black text-hf-text-2 hover:border-hf-accent hover:text-hf-accent">
          <Plus size={16} /> Adicionar prato na {rotDia}
        </button>
        <RepetirDia dia={dia} rotDia={rotDia} janta={janta}
          onRepetir={(para) => { const r = repetirDia(janta, dia, para); setJanta(r.janta); setMudou(true); setAviso(`Cardápio da ${rotDia} repetido. Toque em Salvar.`); setTimeout(() => setAviso(""), 4000); }} />
      </div>
      </>
        </section>
      </div>
      </>)}
    </div>
  );
}
