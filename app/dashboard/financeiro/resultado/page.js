"use client";

// RESULTADO DO MÊS (pedido do dono, 27/10/2026: no lugar da Pizza do Lucro).
// O dono põe o faturamento, os custos fixos e variáveis um por um (com
// subcustos que ele cria e apaga), impostos, cartão, depreciação e
// manutenção; o CMO vem do RH e o CMV das contagens de estoque (média mensal).
// Mostra do faturamento ao lucro líquido, com %, custo por dia e o ponto de
// equilíbrio (quanto vender por dia para não ter prejuízo). Contas em
// app/lib/resultado-mes.mjs. Fica em config_sistema.params.resultado_mensal.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { supabase } from "../../../lib/supabase";
import { unidadeValida } from "../../../lib/contas-pagar.mjs";
import { fetchResultadoMensal, salvarParams } from "../../../lib/parametros";
import { fetchColaboradores, fetchRecibosPrestacaoUnidade } from "../../../lib/rh";
import { calcularCMO } from "../../../lib/cmo.mjs";
import { carregarDadosCmv } from "../../../lib/cmv-dados.mjs";
import { periodosEntreContagens, apurarPeriodo } from "../../../lib/cmv-real.mjs";
import { GRUPOS, calcularResultado, cmvDoMes, copiarMes, equipeDoMes, mesHerdado, semanasDoCmv, ticketMedio, depreciacaoMensal, novoIdResultado, valorDoItem } from "../../../lib/resultado-mes.mjs";

const brl = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const pctTxt = (v) => (v == null ? "—" : `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
const mesAtual = () => new Date().toLocaleDateString("sv-SE").slice(0, 7);
const somarMes = (m, d) => { const [a, mm] = m.split("-").map(Number); const x = new Date(a, mm - 1 + d, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; };
const rotuloMes = (m) => { const [a, mm] = m.split("-").map(Number); const t = new Date(a, mm - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); };
const dataBr = (iso) => (iso ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}` : "—");
const limpaNum = (v) => String(v).replace(/[^0-9.,]/g, "").slice(0, 14);
const inputCls = "h-10 w-full min-w-0 rounded-xl border border-hf-border bg-hf-surface px-3 text-sm font-bold text-hf-text outline-none focus:border-hf-accent";
const NAT_COR = { REAL: "bg-hf-accent/10 text-hf-accent", ESTIMATIVA: "bg-amber-100 text-amber-800", INFORMADO: "bg-hf-elevated text-hf-text-2", "DADOS INSUFICIENTES": "bg-hf-danger/10 text-hf-danger" };

function Natureza({ n }) {
  return n ? <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase ${NAT_COR[n] || NAT_COR.INFORMADO}`}>{n}</span> : null;
}
function Num({ rotulo, valor, onChange, sufixo, dica, className = "" }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="text-xs font-bold text-hf-text-2">{rotulo}</span>
      <span className="relative">
        <input inputMode="decimal" value={valor ?? ""} onChange={(e) => onChange(limpaNum(e.target.value))} placeholder="0" aria-label={rotulo} className={`${inputCls} ${sufixo ? "pr-9" : ""}`} />
        {sufixo ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-hf-muted">{sufixo}</span> : null}
      </span>
      {dica ? <span className="text-[11px] text-hf-muted">{dica}</span> : null}
    </label>
  );
}

export default function ResultadoDoMes() {
  const { unidadeAtiva } = useERP();
  const [mes, setMes] = useState(mesAtual());
  const [todos, setTodos] = useState({}); // params.resultado_mensal
  const [modelo, setModelo] = useState(null);
  const [mudou, setMudou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [cmoBase, setCmoBase] = useState({ colaboradores: [], recibos: [], erro: "" });
  const [cmvBase, setCmvBase] = useState({ apurados: [], erro: "" });
  const [carregando, setCarregando] = useState(true);
  const [abertos, setAbertos] = useState({});

  const carregar = useCallback(async () => {
    if (!unidadeValida(unidadeAtiva)) return;
    setCarregando(true);
    const [rP, rC, rR, rCmv] = await Promise.all([
      fetchResultadoMensal(unidadeAtiva), fetchColaboradores(unidadeAtiva), fetchRecibosPrestacaoUnidade(unidadeAtiva),
      carregarDadosCmv(supabase, unidadeAtiva).catch((e) => ({ data: null, error: e?.message || "erro" })),
    ]);
    setTodos(rP.data || {});
    setCmoBase({ colaboradores: rC.data || [], recibos: rR.data || [], erro: rC.error ? "Não foi possível ler a equipe do RH." : "" });
    if (rCmv?.data) {
      const hoje = new Date().toLocaleDateString("sv-SE");
      const periodos = periodosEntreContagens(rCmv.data.contagens, hoje);
      setCmvBase({ apurados: periodos.map((p) => apurarPeriodo(p, rCmv.data)), erro: "" });
    } else setCmvBase({ apurados: [], erro: rCmv?.error || "" });
    setCarregando(false);
  }, [unidadeAtiva]);
  useEffect(() => { carregar(); }, [carregar]);

  // Mês escolhido: o salvo, ou o último mês salvo antes dele (custos, faturamento
  // e taxas de serviço valem até o dono lançar os novos), ou o modelo inicial.
  const [herdadoDe, setHerdadoDe] = useState(null);
  useEffect(() => {
    if (carregando) return;
    const h = mesHerdado(todos, mes);
    setModelo(h.modelo); setHerdadoDe(h.herdadoDe); setMudou(false);
  }, [mes, todos, carregando]);

  // Equipe pessoa por pessoa: salário, taxa de serviço e vales do RH + bônus e encargos informados + diárias pagas.
  const cmo = useMemo(() => {
    if (!modelo || (!cmoBase.colaboradores.length && !cmoBase.recibos.length)) return null;
    const [a, m] = mes.split("-").map(Number);
    const extras = calcularCMO({ colaboradores: [], recibos: cmoBase.recibos, referencia: new Date(a, m - 1, 15), modo: "mes" }).extras;
    return equipeDoMes(cmoBase.colaboradores, { bonus: modelo.bonus_funcionario, encargos_pct: modelo.encargos_pct, dias: Math.round(Number(modelo.dias_abertos) || 0), extrasPagos: extras, taxas: modelo.taxas_servico || {} });
  }, [cmoBase, mes, modelo]);
  const cmv = useMemo(() => cmvDoMes(cmvBase.apurados, mes), [cmvBase, mes]);
  const r = useMemo(() => (modelo ? calcularResultado(modelo, { cmv, cmo }) : null), [modelo, cmv, cmo]);
  const semanas = useMemo(() => semanasDoCmv(cmvBase.apurados, { mes, faturamentoMes: modelo?.faturamento }), [cmvBase, mes, modelo]);
  const ticket = useMemo(() => ticketMedio(modelo?.faturamento, modelo?.pedidos, Math.round(Number(modelo?.dias_abertos) || 0)), [modelo]);

  const mudar = (fn) => { setModelo((m) => fn(copiarMes(m))); setMudou(true); };
  const set = (campo, v) => mudar((m) => { m[campo] = v; return m; });
  const setCartao = (campo, v) => mudar((m) => { m.cartao = { ...(m.cartao || {}), [campo]: v }; return m; });

  async function salvar() {
    if (!modelo || salvando) return;
    setSalvando(true);
    // Relê antes de gravar: não apaga o mês que outro aparelho salvou.
    const atual = await fetchResultadoMensal(unidadeAtiva);
    if (atual.error) { setSalvando(false); setAviso(`Não salvou: ${atual.error}`); return; }
    const mapa = { ...(atual.data || {}), [mes]: modelo };
    const { error } = await salvarParams(unidadeAtiva, { resultado_mensal: mapa });
    setSalvando(false);
    if (error) { setAviso(`Não salvou: ${error}`); return; }
    setTodos(mapa); setMudou(false); setAviso("Resultado do mês salvo.");
    setTimeout(() => setAviso(""), 3000);
  }

  if (!unidadeValida(unidadeAtiva)) return <p className="p-8 text-center font-bold text-hf-text-2">Selecione uma unidade.</p>;
  if (carregando || !modelo || !r) return <p className="p-8 text-center font-bold text-hf-text-2"><Loader2 size={16} className="mr-2 inline animate-spin" />Carregando o resultado do mês…</p>;

  const linha = (id) => r.linhas.find((l) => l.id === id);
  const eq = r.equilibrio;
  const lucro = linha("lucro_liquido");
  const alternar = (id) => setAbertos((a) => ({ ...a, [id]: !a[id] }));

  const renderGrupo = (g) => {
    const itens = modelo.itens?.[g.id] || [];
    const calc = linha(g.id);
    const setItens = (fn) => mudar((m) => { m.itens = { ...(m.itens || {}) }; m.itens[g.id] = fn([...(m.itens[g.id] || [])]); return m; });
    return (
      <section key={g.id} className="rounded-2xl border border-hf-border bg-hf-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><h2 className="text-base font-black text-hf-text">{g.rotulo}</h2><p className="text-xs text-hf-muted">{g.ajuda}</p></div>
          <p className="text-right text-sm"><b className="text-hf-text">{brl(calc.valor)}</b> <span className="text-hf-text-2">· {pctTxt(calc.pct)}{calc.porDia != null ? ` · ${brl(calc.porDia)}/dia` : ""}</span></p>
        </div>
        <ul className="mt-3 space-y-2">
          {itens.map((it, idx) => {
            const c = calc.itens.find((x) => x.id === it.id) || {};
            const temSub = (it.subitens || []).length > 0;
            const aberto = abertos[it.id] || temSub;
            return (
              <li key={it.id} className="rounded-xl border border-hf-border p-2">
                <div className="grid grid-cols-[1fr_120px_36px] items-center gap-2 sm:grid-cols-[1fr_140px_150px_36px]">
                  <input value={it.nome} onChange={(e) => setItens((l) => { l[idx] = { ...l[idx], nome: e.target.value }; return l; })} aria-label="Nome do custo" className={`${inputCls} font-semibold`} />
                  {temSub
                    ? <span className="px-2 text-right text-sm font-black text-hf-text" title="Soma dos subcustos">{brl(valorDoItem(it))}</span>
                    : <input inputMode="decimal" value={it.valor} onChange={(e) => setItens((l) => { l[idx] = { ...l[idx], valor: limpaNum(e.target.value) }; return l; })} placeholder="R$ 0" aria-label={`Valor de ${it.nome}`} className={`${inputCls} text-right`} />}
                  <span className="hidden text-right text-xs font-bold text-hf-text-2 sm:block">{pctTxt(c.pct)}{c.porDia != null ? ` · ${brl(c.porDia)}/dia` : ""}</span>
                  <button type="button" onClick={() => setItens((l) => l.filter((x) => x.id !== it.id))} aria-label={`Excluir ${it.nome}`} className="grid h-9 w-9 place-items-center rounded-lg text-hf-muted hover:bg-hf-elevated hover:text-hf-danger"><Trash2 size={16} /></button>
                </div>
                <p className="mt-1 text-[11px] font-bold text-hf-text-2 sm:hidden">{pctTxt(c.pct)}{c.porDia != null ? ` · ${brl(c.porDia)}/dia` : ""}</p>
                {aberto && temSub && (
                  <ul className="mt-2 space-y-1.5 border-l-2 border-hf-border pl-3">
                    {it.subitens.map((s, k) => {
                      const cs = (c.subitens || []).find((x) => x.id === s.id) || {};
                      return (
                        <li key={s.id} className="grid grid-cols-[1fr_110px_32px] items-center gap-2 sm:grid-cols-[1fr_130px_140px_32px]">
                          <input value={s.nome} onChange={(e) => setItens((l) => { const sub = [...l[idx].subitens]; sub[k] = { ...sub[k], nome: e.target.value }; l[idx] = { ...l[idx], subitens: sub }; return l; })} aria-label="Nome do subcusto" className={`${inputCls} h-9 text-xs`} />
                          <input inputMode="decimal" value={s.valor} onChange={(e) => setItens((l) => { const sub = [...l[idx].subitens]; sub[k] = { ...sub[k], valor: limpaNum(e.target.value) }; l[idx] = { ...l[idx], subitens: sub }; return l; })} placeholder="R$ 0" aria-label={`Valor de ${s.nome}`} className={`${inputCls} h-9 text-right text-xs`} />
                          <span className="hidden text-right text-[11px] font-bold text-hf-text-2 sm:block">{pctTxt(cs.pct)}{cs.porDia != null ? ` · ${brl(cs.porDia)}/dia` : ""}</span>
                          <button type="button" onClick={() => setItens((l) => { l[idx] = { ...l[idx], subitens: l[idx].subitens.filter((x) => x.id !== s.id) }; return l; })} aria-label={`Excluir ${s.nome}`} className="grid h-8 w-8 place-items-center rounded-lg text-hf-muted hover:text-hf-danger"><Trash2 size={14} /></button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <button type="button" onClick={() => setItens((l) => { l[idx] = { ...l[idx], subitens: [...(l[idx].subitens || []), { id: novoIdResultado("s"), nome: "Novo subcusto", valor: "" }] }; return l; })}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-hf-accent"><Plus size={13} /> Subcusto</button>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={() => setItens((l) => [...l, { id: novoIdResultado(), nome: "Novo custo", valor: "", subitens: [] }])}
          className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-xl border border-hf-border bg-hf-surface px-3 text-sm font-bold text-hf-text"><Plus size={16} /> Adicionar custo</button>
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-hf-bg">
      <div className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-hf-text sm:text-2xl">Resultado do mês</h1>
            <p className="text-sm text-hf-text-2">Faturamento, custos um por um, do lucro bruto ao lucro líquido, custo por dia e ponto de equilíbrio.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-hf-border bg-hf-surface">
              <button type="button" onClick={() => setMes((m) => somarMes(m, -1))} aria-label="Mês anterior" className="grid h-10 w-10 place-items-center text-hf-text"><ChevronLeft size={18} /></button>
              <span className="min-w-[150px] text-center text-sm font-black text-hf-text">{rotuloMes(mes)}</span>
              <button type="button" onClick={() => setMes((m) => somarMes(m, 1))} aria-label="Próximo mês" className="grid h-10 w-10 place-items-center text-hf-text"><ChevronRight size={18} /></button>
            </div>
            <button type="button" onClick={salvar} disabled={!mudou || salvando} className="inline-flex h-10 items-center gap-2 rounded-xl bg-hf-accent px-4 text-sm font-black text-white disabled:opacity-50">
              {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {mudou ? "Salvar" : "Salvo"}
            </button>
          </div>
        </div>
        {aviso ? <p role="status" className="rounded-xl bg-hf-elevated px-3 py-2 text-sm font-bold text-hf-text">{aviso}</p> : null}
        {herdadoDe ? (
          <p className="flex items-center gap-2 rounded-xl bg-hf-elevated px-3 py-2 text-xs font-semibold text-hf-text-2"><Copy size={14} /> Mês ainda não lançado: valem o faturamento, os custos e as taxas de serviço de {rotuloMes(herdadoDe)} até você lançar os novos. Ajuste e salve.</p>
        ) : null}

        {/* Resumo */}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-hf-border bg-hf-surface p-3"><p className="text-xs font-bold text-hf-text-2">Faturamento</p><p className="text-xl font-black text-hf-text">{brl(r.faturamento)}</p>{r.dias ? <p className="text-xs text-hf-muted">{brl(r.faturamento / r.dias)}/dia em {r.dias} dias</p> : null}</div>
          <div className="rounded-2xl border border-hf-border bg-hf-surface p-3"><p className="text-xs font-bold text-hf-text-2">Lucro líquido</p><p className={`text-xl font-black ${r.prejuizo ? "text-hf-danger" : "text-hf-accent"}`}>{lucro.valor == null ? "DADOS INSUFICIENTES" : brl(lucro.valor)}</p><p className="text-xs text-hf-muted">{lucro.valor == null ? `Falta: ${r.faltam.join(", ")}` : `${pctTxt(lucro.pct)} do faturamento`}</p></div>
          <div className="rounded-2xl border border-hf-border bg-hf-surface p-3"><p className="text-xs font-bold text-hf-text-2">Vender por dia para não ter prejuízo</p><p className="text-xl font-black text-hf-text">{eq.dia != null ? brl(eq.dia) : eq.mes != null ? brl(eq.mes) + "/mês" : "—"}</p><p className="text-xs text-hf-muted">{eq.mes != null ? `${brl(eq.mes)} no mês` : eq.motivo}</p></div>
          <div className="rounded-2xl border border-hf-border bg-hf-surface p-3"><p className="text-xs font-bold text-hf-text-2">Ticket médio</p><p className="text-xl font-black text-hf-text">{ticket.valor != null ? brl(ticket.valor) : "—"}</p><p className="text-xs text-hf-muted">{ticket.valor != null ? `${ticket.pedidosPorDia != null ? `${ticket.pedidosPorDia.toLocaleString("pt-BR")} pedidos/dia` : "informado"}` : "informe os pedidos do mês"}</p></div>
          <div className="col-span-2 rounded-2xl border border-hf-border bg-hf-surface p-3 lg:col-span-1"><p className="text-xs font-bold text-hf-text-2">Custo por dia (sem vender nada)</p><p className="text-xl font-black text-hf-text">{eq.custosFixosDia != null ? brl(eq.custosFixosDia) : "—"}</p><p className="text-xs text-hf-muted">{eq.custosFixosDia != null ? "equipe, fixos, manutenção e depreciação" : r.dias ? eq.motivo : "informe os dias que abre"}</p></div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_500px]">
          <div className="min-w-0 space-y-4">
            <section className="rounded-2xl border border-hf-border bg-hf-surface p-4">
              <h2 className="text-base font-black text-hf-text">Vendas, impostos e cartão</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Num rotulo="Faturamento do mês" valor={modelo.faturamento} onChange={(v) => set("faturamento", v)} className="col-span-2" dica="Tudo o que vendeu no mês (bruto)." />
                <Num rotulo="Dias que abre no mês" valor={modelo.dias_abertos} onChange={(v) => set("dias_abertos", v.replace(/\D/g, "").slice(0, 2))} dica="Base do custo por dia." />
                <Num rotulo="Pedidos no mês" valor={modelo.pedidos} onChange={(v) => set("pedidos", v.replace(/\D/g, "").slice(0, 7))} dica="Ou clientes: base do ticket médio." />
                <Num rotulo="Impostos" sufixo="%" valor={modelo.impostos_pct} onChange={(v) => set("impostos_pct", v)} dica="Simples, ISS…" />
                <Num rotulo="Vendas no crédito" sufixo="%" valor={modelo.cartao?.parte_credito_pct} onChange={(v) => setCartao("parte_credito_pct", v)} dica="Parte do faturamento." />
                <Num rotulo="Taxa do crédito" sufixo="%" valor={modelo.cartao?.taxa_credito_pct} onChange={(v) => setCartao("taxa_credito_pct", v)} />
                <Num rotulo="Vendas no débito" sufixo="%" valor={modelo.cartao?.parte_debito_pct} onChange={(v) => setCartao("parte_debito_pct", v)} />
                <Num rotulo="Taxa do débito" sufixo="%" valor={modelo.cartao?.taxa_debito_pct} onChange={(v) => setCartao("taxa_debito_pct", v)} />
                <Num rotulo="Meta de lucro" sufixo="%" valor={modelo.meta_lucro_pct} onChange={(v) => set("meta_lucro_pct", v)} className="col-span-2" dica="Base do preço sugerido nos eventos, no orçamento rápido e nas marmitas (com os impostos e as taxas acima)." />
              </div>
            </section>

            <section className="rounded-2xl border border-hf-border bg-hf-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-black text-hf-text">CMV (das contagens de estoque)</h2>
                <Natureza n={linha("cmv").natureza} />
              </div>
              <p className="mt-1 text-2xl font-black text-hf-text">{brl(linha("cmv").valor)} <span className="text-sm font-bold text-hf-text-2">{pctTxt(linha("cmv").pct)}</span></p>
              <p className="text-xs text-hf-text-2">{cmv.valor != null ? cmv.motivo : cmv.motivo}{cmvBase.erro ? ` (${cmvBase.erro})` : ""}</p>
              {cmv.valor == null && <Num rotulo="Enquanto não há contagens: CMV do mês (R$)" valor={modelo.cmv_manual} onChange={(v) => set("cmv_manual", v)} className="mt-2 max-w-xs" dica="Fica marcado como INFORMADO." />}
              {semanas.length ? (
                <div className="mt-3 overflow-x-auto rounded-xl border border-hf-border">
                  <table className="w-full min-w-[620px] text-xs">
                    <thead className="bg-hf-elevated text-[11px] uppercase text-hf-muted"><tr><th className="px-2 py-1.5 text-left">Semana (entre contagens)</th><th className="px-2 text-right">Estoque no início</th><th className="px-2 text-right">Entrou</th><th className="px-2 text-right">Estoque no fim</th><th className="px-2 text-right">Saiu (CMV)</th><th className="px-2 text-right">CMV %</th></tr></thead>
                    <tbody>
                      {semanas.map((w) => (
                        <tr key={w.id} className="border-t border-hf-border">
                          <td className="px-2 py-1.5 font-bold text-hf-text">{dataBr(w.de)} a {dataBr(w.ate)} <span className="font-normal text-hf-muted">({w.dias} dias)</span>{w.motivo ? <span className="block text-[11px] font-normal text-hf-muted">{w.motivo}</span> : null}</td>
                          <td className="px-2 text-right tabular-nums">{brl(w.estoqueInicio)}</td>
                          <td className="px-2 text-right tabular-nums text-hf-accent">+{brl(w.entrou)}</td>
                          <td className="px-2 text-right font-bold tabular-nums">{brl(w.estoqueFim)}</td>
                          <td className="px-2 text-right font-black tabular-nums">{brl(w.saiu)}</td>
                          <td className="px-2 text-right font-black tabular-nums">{w.cmvPct != null ? pctTxt(w.cmvPct) : "—"}{w.cmvPct != null && w.naturezaFaturamento === "ESTIMATIVA" ? <span className="block text-[10px] font-normal text-hf-muted">fat. estimado</span> : null}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="px-2 py-1.5 text-[11px] text-hf-muted">Estoque no início + entrou (compras) − estoque no fim = saiu (CMV). % sobre o faturamento da semana; sem o diário, o do mês ÷ dias × dias da semana (estimado).</p>
                </div>
              ) : <p className="mt-2 text-xs text-hf-muted">Nenhuma contagem fechada ainda: as semanas aparecem aqui depois de duas contagens seguidas.</p>}
              <Link href="/dashboard/operacao/estoque/cmv" className="mt-2 inline-block text-xs font-bold text-hf-accent">Ver o CMV por produto</Link>
            </section>

            <section className="rounded-2xl border border-hf-border bg-hf-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-black text-hf-text">CMO (equipe, do RH)</h2>
                <Natureza n={linha("cmo").natureza} />
              </div>
              <p className="mt-1 text-2xl font-black text-hf-text">{brl(linha("cmo").valor)} <span className="text-sm font-bold text-hf-text-2">{pctTxt(linha("cmo").pct)}{linha("cmo").porDia != null ? ` · ${brl(linha("cmo").porDia)}/dia` : ""}</span></p>
              {cmo ? (
                <ul className="mt-1 text-xs text-hf-text-2">{linha("cmo").detalhe.map((d) => <li key={d.id}>{d.nome}: <b className="text-hf-text">{brl(d.valor)}</b></li>)}</ul>
              ) : <p className="text-xs font-bold text-hf-danger">DADOS INSUFICIENTES: nenhum colaborador ativo no RH.{cmoBase.erro ? ` ${cmoBase.erro}` : ""}</p>}
              <div className="mt-2 grid max-w-lg grid-cols-2 gap-3">
                <Num rotulo="Bônus por funcionário (R$/mês)" valor={modelo.bonus_funcionario} onChange={(v) => set("bonus_funcionario", v)} dica="Igual para todos os contratados." />
                <Num rotulo="Encargos sobre o salário" sufixo="%" valor={modelo.encargos_pct} onChange={(v) => set("encargos_pct", v)} dica="FGTS, INSS, férias, 13º." />
              </div>
              {cmo?.pessoas?.length ? (
                <div className="mt-3 overflow-x-auto rounded-xl border border-hf-border">
                  <table className="w-full min-w-[560px] text-xs">
                    <thead className="bg-hf-elevated text-[11px] uppercase text-hf-muted"><tr><th className="px-2 py-1.5 text-left">Funcionário</th><th className="px-2 text-right">Salário</th><th className="px-2 text-right">Taxa serv.</th><th className="px-2 text-right">Bônus</th><th className="px-2 text-right">Vales</th><th className="px-2 text-right">Encargos</th><th className="px-2 text-right">Total/mês</th><th className="px-2 text-right">Por dia</th></tr></thead>
                    <tbody>
                      {cmo.pessoas.map((p) => (
                        <tr key={p.id} className="border-t border-hf-border">
                          <td className="px-2 py-1.5"><b className="text-hf-text">{p.nome}</b>{p.cargo ? <span className="block text-[11px] text-hf-muted">{p.cargo}</span> : null}</td>
                          <td className="px-2 text-right tabular-nums">{brl(p.salario)}</td><td className="px-2 text-right"><input inputMode="decimal" aria-label={`Taxa de serviço de ${p.nome}`} value={modelo.taxas_servico?.[p.id] ?? ""} placeholder={String(p.taxaDoRh ? p.taxaServico : "").replace(".", ",") || "0"}
                            onChange={(e) => mudar((m) => { m.taxas_servico = { ...(m.taxas_servico || {}), [p.id]: limpaNum(e.target.value) }; return m; })}
                            className="h-8 w-24 rounded-lg border border-hf-border bg-hf-surface px-2 text-right text-xs font-bold text-hf-text" />{p.taxaDoRh ? <span className="block text-[10px] text-hf-muted">do RH</span> : null}</td>
                          <td className="px-2 text-right tabular-nums">{brl(p.bonus)}</td><td className="px-2 text-right tabular-nums">{brl(p.vale)}</td>
                          <td className="px-2 text-right tabular-nums">{brl(p.encargos)}</td><td className="px-2 text-right font-black tabular-nums text-hf-text">{brl(p.total)}</td>
                          <td className="px-2 text-right font-bold tabular-nums">{p.porDia == null ? "—" : brl(p.porDia)}</td>
                        </tr>
                      ))}
                      {cmo.extras > 0 && <tr className="border-t border-hf-border text-hf-text-2"><td className="px-2 py-1.5" colSpan={6}>Extras (diárias pagas no mês)</td><td className="px-2 text-right font-black tabular-nums">{brl(cmo.extras)}</td><td className="px-2 text-right tabular-nums">{r.dias ? brl(cmo.extras / r.dias) : "—"}</td></tr>}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {!r.dias ? <p className="mt-1 text-[11px] text-hf-muted">Informe os dias que abre (em Vendas) para ver o custo de cada um por dia.</p> : null}
            </section>

            {GRUPOS.map((g) => renderGrupo(g))}

            <section className="rounded-2xl border border-hf-border bg-hf-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><h2 className="text-base font-black text-hf-text">Depreciação de equipamentos</h2><p className="text-xs text-hf-muted">Valor do equipamento ÷ meses de vida útil = quanto ele "gasta" por mês.</p></div>
                <p className="text-sm"><b>{brl(linha("depreciacao").valor)}</b> <span className="text-hf-text-2">· {pctTxt(linha("depreciacao").pct)}</span></p>
              </div>
              <ul className="mt-3 space-y-2">
                {(modelo.depreciacao || []).map((d, i) => (
                  <li key={d.id} className="grid grid-cols-2 items-end gap-2 rounded-xl border border-hf-border p-2 sm:grid-cols-[1fr_140px_120px_110px_36px]">
                    <input value={d.nome} onChange={(e) => mudar((m) => { m.depreciacao[i].nome = e.target.value; return m; })} aria-label="Equipamento" placeholder="Equipamento" className={`${inputCls} col-span-2 sm:col-span-1`} />
                    <Num rotulo="Valor do bem" valor={d.valor_bem} onChange={(v) => mudar((m) => { m.depreciacao[i].valor_bem = v; return m; })} />
                    <Num rotulo="Vida útil (meses)" valor={d.vida_meses} onChange={(v) => mudar((m) => { m.depreciacao[i].vida_meses = v.replace(/\D/g, "").slice(0, 3); return m; })} />
                    <p className="pb-2 text-right text-sm font-black">{brl(depreciacaoMensal(d))}/mês</p>
                    <button type="button" onClick={() => mudar((m) => { m.depreciacao = m.depreciacao.filter((x) => x.id !== d.id); return m; })} aria-label={`Excluir ${d.nome}`} className="grid h-9 w-9 place-items-center rounded-lg text-hf-muted hover:text-hf-danger"><Trash2 size={16} /></button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => mudar((m) => { m.depreciacao = [...(m.depreciacao || []), { id: novoIdResultado("d"), nome: "", valor_bem: "", vida_meses: "60" }]; return m; })}
                className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-xl border border-hf-border bg-hf-surface px-3 text-sm font-bold text-hf-text"><Plus size={16} /> Adicionar equipamento</button>
            </section>
          </div>

          {/* DRE e equilíbrio */}
          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <section className="rounded-2xl border border-hf-border bg-hf-surface p-4">
              <div className="flex items-center justify-between gap-2"><h2 className="text-base font-black text-hf-text">Do faturamento ao lucro</h2><Natureza n={r.natureza} /></div>
              <table className="mt-2 w-full text-sm">
                <thead><tr className="text-[11px] uppercase text-hf-muted"><th className="py-1 text-left font-bold">Linha</th><th className="text-right font-bold">R$</th><th className="text-right font-bold">%</th><th className="text-right font-bold">Por dia</th></tr></thead>
                <tbody>
                  {r.linhas.map((l) => {
                    const sub = l.itens?.length ? l.itens : l.detalhe?.length ? l.detalhe : null;
                    const forte = l.tipo !== "custo";
                    return [
                      <tr key={l.id} className={`border-t border-hf-border ${forte ? "font-black" : ""} ${l.tipo === "resultado" ? (r.prejuizo ? "text-hf-danger" : "text-hf-accent") : "text-hf-text"}`}>
                        <td className="py-1.5 pr-1">
                          {sub ? <button type="button" onClick={() => alternar(`dre-${l.id}`)} className="inline-flex items-center gap-1 text-left" aria-expanded={!!abertos[`dre-${l.id}`]}>{l.rotulo}{abertos[`dre-${l.id}`] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button> : l.rotulo}
                        </td>
                        <td className="whitespace-nowrap pl-2 text-right tabular-nums">{l.valor == null ? "—" : brl(l.valor)}</td>
                        <td className="whitespace-nowrap pl-3 text-right tabular-nums">{pctTxt(l.pct)}</td>
                        <td className="whitespace-nowrap pl-3 text-right tabular-nums text-hf-text-2">{l.porDia == null ? "—" : brl(l.porDia)}</td>
                      </tr>,
                      ...(sub && abertos[`dre-${l.id}`] ? sub.flatMap((x) => [
                        <tr key={`${l.id}-${x.id}`} className="text-xs text-hf-text-2"><td className="py-1 pl-3">{x.nome}</td><td className="text-right tabular-nums">{brl(x.valor)}</td><td className="text-right tabular-nums">{pctTxt(x.pct)}</td><td className="text-right tabular-nums">{x.porDia == null ? "—" : brl(x.porDia)}</td></tr>,
                        ...(x.subitens || []).map((s) => <tr key={`${l.id}-${x.id}-${s.id}`} className="text-[11px] text-hf-muted"><td className="py-0.5 pl-6">{s.nome}</td><td className="text-right tabular-nums">{brl(s.valor)}</td><td className="text-right tabular-nums">{pctTxt(s.pct)}</td><td className="text-right tabular-nums">{s.porDia == null ? "—" : brl(s.porDia)}</td></tr>),
                      ]) : []),
                    ];
                  })}
                </tbody>
              </table>
              {r.faltam.length ? <p className="mt-2 text-xs font-bold text-hf-danger">DADOS INSUFICIENTES para o lucro: falta {r.faltam.join(", ")}.</p> : null}
            </section>

            {r.fatias.length ? (
              <section className="rounded-2xl border border-hf-border bg-hf-surface p-4">
                <h2 className="text-base font-black text-hf-text">Para onde vai cada R$ 100 vendidos</h2>
                <div className="mt-3 flex h-4 overflow-hidden rounded-full" aria-hidden>
                  {r.fatias.filter((f) => f.valor > 0).map((f, i) => <span key={f.id} style={{ width: `${f.pct}%`, background: f.id === "lucro" ? "rgb(4 120 87)" : ["#0f172a", "#b45309", "#1d4ed8", "#7c3aed", "#64748b", "#94a3b8"][i % 6] }} />)}
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {r.fatias.map((f) => <li key={f.id} className="flex justify-between"><span className="text-hf-text-2">{f.rotulo}</span><b className={f.id === "lucro" ? (f.valor < 0 ? "text-hf-danger" : "text-hf-accent") : "text-hf-text"}>R$ {Number(f.pct || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></li>)}
                </ul>
              </section>
            ) : null}

            <section className="rounded-2xl border border-hf-border bg-hf-surface p-4">
              <div className="flex items-center justify-between gap-2"><h2 className="text-base font-black text-hf-text">Ponto de equilíbrio</h2><Natureza n={eq.natureza} /></div>
              {eq.mes != null ? (
                <>
                  <p className="mt-2 text-sm text-hf-text-2">Para não ter prejuízo, venda pelo menos</p>
                  <p className="text-3xl font-black text-hf-text">{eq.dia != null ? `${brl(eq.dia)} por dia` : `${brl(eq.mes)} no mês`}</p>
                  <p className="text-sm text-hf-text-2">{brl(eq.mes)} no mês{r.dias ? ` · ${r.dias} dias abertos` : ""}</p>
                  <ul className="mt-3 space-y-1 text-xs text-hf-text-2">
                    <li>Custos que não mudam com a venda: <b className="text-hf-text">{brl(eq.custosFixos)}</b>{eq.custosFixosDia != null ? ` (${brl(eq.custosFixosDia)}/dia)` : ""}</li>
                    <li>De cada venda saem {pctTxt(eq.pctQueSai)} (impostos, cartão, CMV e variáveis); sobram <b className="text-hf-text">{pctTxt(eq.margemPct)}</b> para pagar os custos.</li>
                    <li className={eq.folgaMes >= 0 ? "font-bold text-hf-accent" : "font-bold text-hf-danger"}>
                      {eq.folgaMes >= 0 ? `Você vende ${brl(eq.folgaMes)} acima do equilíbrio${eq.folgaDia != null ? ` (${brl(eq.folgaDia)}/dia)` : ""}.` : `Faltam ${brl(-eq.folgaMes)} no mês${eq.folgaDia != null ? ` (${brl(-eq.folgaDia)}/dia)` : ""} para empatar.`}
                    </li>
                  </ul>
                </>
              ) : <p className="mt-2 text-sm font-bold text-hf-danger">DADOS INSUFICIENTES: {eq.motivo}</p>}
            </section>
            <p className="text-center text-xs text-hf-text-2">Preço de cada prato: <Link href="/dashboard/financeiro/pizza" className="font-bold text-hf-accent">Pizza do prato (precificação)</Link></p>
          </aside>
        </div>
      </div>
    </div>
  );
}
