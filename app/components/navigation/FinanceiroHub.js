"use client";

// CENTRAL FINANCEIRA — tela executiva do financeiro. Só exibe: todo número sai
// de app/lib/central-financeira.mjs (motor puro, testado), com o estado de cada
// um (real, zero real, parcial, não apurado, dados insuficientes, erro).
// Faturamento vem da fonte de vendas (fin_faturamento_diario), nunca do caixa.

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet, ArrowDownCircle, ArrowUpCircle, Scale, Receipt, AlertTriangle, AlertCircle, Info,
  RefreshCw, Plus, FileText, CreditCard, ShoppingCart, Landmark, Calculator, PieChart, BarChart3,
  ShieldCheck, Target, Sparkles, ChevronRight, ChevronDown, Banknote, CheckCircle2, Loader2,
} from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { supabase } from "../../lib/supabase";
import { fetchContasPagar, fetchContasReceber, fetchFluxoCaixa, fetchSaldosContasFinanceiras } from "../../lib/financeiro";
import { fetchColaboradores, fetchRecibosPrestacaoUnidade } from "../../lib/rh";
import { fetchCustosFixos } from "../../lib/custos-fixos";
import { carregarDadosCmv } from "../../lib/cmv-dados.mjs";
import { periodosEntreContagens, apurarPeriodo, cmvRealPeriodo } from "../../lib/cmv-real.mjs";
import { hojeLocal } from "../../lib/contas-receber.mjs";
import { montarCentral, intervaloCentral, PERIODOS, ROTAS } from "../../lib/central-financeira.mjs";
import { canAccessRoute, hasPermission } from "../../lib/permissions-catalog.mjs";
import { fmtBRL } from "../ui";

// ─── aparência ────────────────────────────────────────────────────────────────
const TOM = {
  critico: { texto: "text-rose-400", borda: "border-rose-500/40", fundo: "bg-rose-500/10", ponto: "bg-rose-400" },
  atencao: { texto: "text-amber-300", borda: "border-amber-400/40", fundo: "bg-amber-400/10", ponto: "bg-amber-300" },
  positivo: { texto: "text-emerald-400", borda: "border-emerald-500/30", fundo: "bg-emerald-500/10", ponto: "bg-emerald-400" },
  info: { texto: "text-sky-300", borda: "border-sky-500/30", fundo: "bg-sky-500/10", ponto: "bg-sky-300" },
  neutro: { texto: "text-white", borda: "border-slate-700/70", fundo: "bg-slate-800/40", ponto: "bg-slate-400" },
  apagado: { texto: "text-slate-400", borda: "border-slate-700/70", fundo: "bg-slate-800/40", ponto: "bg-slate-500" },
};
const ROTULO_ESTADO = { erro: "Erro ao carregar", nao_apurado: "Não apurado", insuficiente: "Dados insuficientes", nao_calculado: "Não calculado" };
const semValor = (e) => ["erro", "nao_apurado", "insuficiente", "nao_calculado"].includes(e?.estado);
const brl = (v) => fmtBRL(v);
const pct = (v) => `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const sinal = (v) => (v > 0 ? `+ ${brl(v)}` : v < 0 ? `− ${brl(Math.abs(v))}` : brl(0));
const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");

function Card({ titulo, icone: Icone, valor, tom = "neutro", linhas = [], estado, onClick, acao, rodape, alerta = false }) {
  const t = TOM[semValor(estado) ? "apagado" : tom];
  const interativo = onClick ? { role: "button", tabIndex: 0, onClick, onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } } : {};
  return (
    <div {...interativo}
      className={`group flex min-w-0 flex-col gap-2 rounded-2xl border bg-slate-900/70 p-3.5 text-left transition ${alerta && !semValor(estado) ? "border-rose-500/50" : "border-slate-800"} ${onClick ? "cursor-pointer hover:border-slate-600 hover:bg-slate-900" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-bold uppercase tracking-wider text-slate-400">{titulo}</span>
        {Icone && <Icone size={16} className={`shrink-0 ${t.texto}`} />}
      </div>
      <div className={`truncate text-xl font-black tabular-nums sm:text-2xl ${semValor(estado) ? "text-base text-slate-300 sm:text-lg" : t.texto}`}>
        {semValor(estado) ? ROTULO_ESTADO[estado.estado] : valor}
      </div>
      <div className="min-h-[2.25rem] space-y-0.5 text-[11px] leading-snug text-slate-400">
        {semValor(estado) || estado?.estado === "zero"
          ? <p className="line-clamp-2">{estado?.motivo}</p>
          : linhas.filter(Boolean).slice(0, 2).map((l, i) => <p key={i} className="line-clamp-2">{l}</p>)}
      </div>
      {(acao || rodape) && <div className="mt-auto flex items-center justify-between gap-2 pt-1">{rodape}{acao}</div>}
    </div>
  );
}

function Secao({ titulo, icone: Icone, direita, children, className = "" }) {
  return (
    <section className={`space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-300">
          {Icone && <Icone size={14} className="text-slate-400" />}{titulo}
        </h2>
        {direita}
      </div>
      {children}
    </section>
  );
}

function Indicador({ titulo, estado, principal, secundaria, tom = "info", nota }) {
  const sem = semValor(estado);
  const t = TOM[sem ? "apagado" : tom];
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{titulo}</span>
      <span className={`truncate font-black tabular-nums ${sem ? "text-sm text-slate-300" : `text-lg ${t.texto}`}`}>{sem ? ROTULO_ESTADO[estado.estado] : principal}</span>
      <span className="line-clamp-4 text-[11px] leading-snug text-slate-400" title={sem ? estado.motivo : secundaria}>{sem ? estado.motivo : secundaria}</span>
      {nota && !sem && <span className="line-clamp-3 text-[10px] leading-snug text-slate-500" title={nota}>{nota}</span>}
    </div>
  );
}

const Botao = ({ onClick, icone: Icone, children, variante = "sec", titulo }) => (
  <button type="button" onClick={onClick} title={titulo}
    className={`inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-xs font-bold transition ${
      variante === "pri" ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400" : "border border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-500"}`}>
    {Icone && <Icone size={15} />}{children}
  </button>
);

// ─── tela ─────────────────────────────────────────────────────────────────────
export default function FinanceiroHub({ onAbrirDRE, onPagarConta, atualizacao = 0 }) {
  const router = useRouter();
  const { sessao, unidadeAtiva, unidadeInfo } = useERP();
  const [periodo, setPeriodo] = useState("mes");
  const [pers, setPers] = useState({ de: "", ate: "" });
  const [base, setBase] = useState(null);      // fontes que não dependem do filtro
  const [fluxo, setFluxo] = useState(null);    // vw_fin_fluxo_caixa do período
  const [carregando, setCarregando] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const [menuNovo, setMenuNovo] = useState(false);
  const menuRef = useRef(null);

  const gerenciado = !!sessao?.gerenciado;
  const podeVerFinanceiroTotal = !gerenciado || hasPermission(sessao, "dashboard.overview.view_values") || hasPermission(sessao, "financeiro.cashflow.view") || hasPermission(sessao, "financeiro.dre.view");
  const podeRota = useCallback((rota) => !gerenciado || canAccessRoute(sessao, rota.split("?")[0]), [gerenciado, sessao]);
  const ir = useCallback((rota) => router.push(rota), [router]);

  const hoje = hojeLocal();
  const intervalo = useMemo(() => intervaloCentral(periodo, hoje, pers), [periodo, hoje, pers]);

  const carregarBase = useCallback(async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    setCarregando(true);
    const capturar = (p) => p.then((r) => r, (e) => ({ error: e?.message || "Falha de rede" }));
    const [pagar, receber, saldos, equipe, recibos, custos, cmvDados] = await Promise.all([
      capturar(fetchContasPagar(unidadeAtiva)), capturar(fetchContasReceber(unidadeAtiva)), capturar(fetchSaldosContasFinanceiras(unidadeAtiva)),
      capturar(fetchColaboradores(unidadeAtiva)), capturar(fetchRecibosPrestacaoUnidade(unidadeAtiva)), capturar(fetchCustosFixos(unidadeAtiva)),
      capturar(carregarDadosCmv(supabase, unidadeAtiva)),
    ]);
    let cmv = { error: cmvDados.error || null, periodo: null };
    let faturamento = { erro: cmvDados.error || null };
    if (!cmvDados.error && cmvDados.data) {
      const d = cmvDados.data;
      faturamento = { disponivel: !!d.fonteFaturamento?.disponivel, motivo: d.fonteFaturamento?.motivo, dias: d.fonteFaturamento?.dias || [] };
      const fechados = periodosEntreContagens(d.contagens, hojeLocal()).filter((p) => !p.emAndamento);
      const ultimo = fechados[fechados.length - 1];
      cmv = { error: null, periodo: ultimo ? cmvRealPeriodo(apurarPeriodo(ultimo, d)) : null };
    }
    setBase({
      pagar, receber, saldos, custosFixos: { data: custos.data, incluirFolha: custos.incluirFolha, error: custos.error },
      cmo: { colaboradores: equipe.data || [], recibos: recibos.data || [], error: equipe.error || recibos.error || null },
      faturamento, cmv,
    });
    setAtualizadoEm(new Date());
    setCarregando(false);
  }, [unidadeAtiva]);

  const carregarFluxo = useCallback(async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas" || !intervalo.valido) { setFluxo(null); return; }
    const r = await fetchFluxoCaixa(unidadeAtiva, intervalo.de, intervalo.ate).then((x) => x, (e) => ({ error: e?.message || "Falha de rede" }));
    setFluxo(r);
  }, [unidadeAtiva, intervalo.de, intervalo.ate, intervalo.valido]);

  useEffect(() => { carregarBase(); }, [carregarBase, atualizacao]);
  useEffect(() => { carregarFluxo(); }, [carregarFluxo, atualizacao]);
  useEffect(() => {
    if (!menuNovo) return;
    const fechar = (e) => { if (!menuRef.current?.contains(e.target)) setMenuNovo(false); };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [menuNovo]);

  const atualizar = () => { carregarBase(); carregarFluxo(); };
  const c = useMemo(() => (base && (fluxo || !intervalo.valido) ? montarCentral({ hoje, intervalo, fontes: { ...base, fluxo: fluxo || { error: intervalo.valido ? null : intervalo.motivo, data: [] } } }) : null), [base, fluxo, hoje, intervalo]);

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return <div className="min-h-screen bg-[#070F1E] p-8 text-center text-sm font-bold text-slate-200">Selecione uma unidade para abrir a Central Financeira.</div>;
  }

  const k = c?.cards, ind = c?.indicadores;
  const subtitulo = `${unidadeInfo?.nome || "Unidade"} • ${intervalo.rotulo || "Período"}`;

  return (
    <div className="min-h-screen bg-[#070F1E] px-3 pb-28 pt-4 font-sans text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">

        {/* 1. CABEÇALHO */}
        <header className="flex flex-col gap-3 border-b border-slate-800 pb-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">Central Financeira</h1>
            <p className="truncate text-xs text-slate-400">
              {subtitulo}{atualizadoEm && <span className="text-slate-500"> · atualizado às {atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex max-w-full overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-1" role="tablist" aria-label="Período">
              {PERIODOS.map((p) => (
                <button key={p.id} type="button" role="tab" aria-selected={periodo === p.id} onClick={() => setPeriodo(p.id)}
                  className={`min-h-[34px] whitespace-nowrap rounded-lg px-2.5 text-xs font-bold transition ${periodo === p.id ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"}`}>
                  {p.rotulo}
                </button>
              ))}
            </div>
            <button type="button" onClick={atualizar} aria-label="Atualizar" title="Atualizar"
              className="grid min-h-[40px] min-w-[40px] place-items-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500">
              <RefreshCw size={15} className={carregando ? "animate-spin text-emerald-400" : ""} />
            </button>
            {podeVerFinanceiroTotal && (
              <div className="relative" ref={menuRef}>
                <Botao variante="pri" icone={Plus} onClick={() => setMenuNovo((v) => !v)}>Novo lançamento <ChevronDown size={14} /></Botao>
                {menuNovo && (
                  <div className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                    {[["Conta a pagar", ROTAS.novaContaPagar, CreditCard], ["Conta a receber", ROTAS.contasReceber, Banknote], ["Faturamento do dia", ROTAS.faturamento, Receipt]]
                      .filter(([, r]) => podeRota(r)).map(([rot, r, I]) => (
                        <button key={rot} type="button" onClick={() => { setMenuNovo(false); ir(r); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-bold text-slate-100 hover:bg-slate-800">
                          <I size={14} className="text-slate-400" />{rot}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
            {podeVerFinanceiroTotal && <button type="button" className="inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-bold text-slate-100 hover:border-slate-500" onClick={() => router.push("/dashboard/financeiro/contas")}><Wallet size={15} />Contas a Pagar</button>}
            {podeRota(ROTAS.dre) && <Botao icone={FileText} onClick={() => (onAbrirDRE ? onAbrirDRE() : ir(ROTAS.dre))}>DRE Gerencial</Botao>}
          </div>
        </header>

        {periodo === "personalizado" && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-1.5 text-slate-400">De <input type="date" value={pers.de} max={hoje} onChange={(e) => setPers((p) => ({ ...p, de: e.target.value }))} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100" /></label>
            <label className="flex items-center gap-1.5 text-slate-400">até <input type="date" value={pers.ate} max={hoje} onChange={(e) => setPers((p) => ({ ...p, ate: e.target.value }))} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100" /></label>
            {!intervalo.valido && <span className="font-bold text-amber-300">{intervalo.motivo}</span>}
          </div>
        )}

        {!c ? (
          <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm font-bold text-slate-300"><Loader2 className="animate-spin text-emerald-400" size={20} />Carregando a Central Financeira…</div>
        ) : !podeVerFinanceiroTotal ? (
          /* VISÃO RESTRITA: só custos (CMV), sem valores de caixa */
          <Secao titulo="Custos que você pode ver" icone={Target}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Indicador titulo="CMV realizado" estado={ind.cmv} principal={ind.cmv.pct != null ? pct(ind.cmv.pct) : brl(ind.cmv.valor)}
                secundaria={ind.cmv.periodo ? `${ddmm(ind.cmv.periodo.de)} a ${ddmm(ind.cmv.periodo.ate)} · ${ind.cmv.pct != null ? brl(ind.cmv.valor) : ind.cmv.motivoPct}` : ""} />
              {podeRota(ROTAS.cmvReal) && <Botao icone={ChevronRight} onClick={() => ir(ROTAS.cmvReal)}>Abrir CMV realizado</Botao>}
            </div>
          </Secao>
        ) : (
          <>
            {/* 2. RESUMO EXECUTIVO */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Card titulo="A pagar" icone={Wallet} estado={k.aPagar} tom={k.aPagar.tom} alerta={k.aPagar.vencido > 0} valor={brl(k.aPagar.valor)}
                linhas={[k.aPagar.nVencidas ? `${k.aPagar.nVencidas} vencida(s) · ${brl(k.aPagar.vencido)}` : "Nenhuma vencida", `${brl(k.aPagar.proximos7)} nos próximos 7 dias`]}
                onClick={() => ir(ROTAS.contasPagar)}
                acao={k.aPagar.vencido > 0 ? <button type="button" onClick={(e) => { e.stopPropagation(); router.push("/dashboard/financeiro/contas?situacao=vencido"); }} className="rounded-lg bg-rose-500/15 px-2 py-1 text-[11px] font-black text-rose-300 hover:bg-rose-500/25">Resolver</button> : null}
                rodape={<span className="text-[10px] text-slate-500">posição de hoje</span>} />
              <Card titulo="A receber" icone={Banknote} estado={k.aReceber} tom={k.aReceber.tom} valor={brl(k.aReceber.valor)}
                linhas={[k.aReceber.atrasado ? `${brl(k.aReceber.atrasado)} atrasado` : "Nada atrasado", `${brl(k.aReceber.proximos7)} nos próximos 7 dias`]}
                onClick={podeRota(ROTAS.contasReceber) ? () => ir(ROTAS.contasReceber) : undefined}
                rodape={<span className="text-[10px] text-slate-500">posição de hoje</span>} />
              <Card titulo="Entradas" icone={ArrowDownCircle} estado={k.fluxo} tom="positivo" valor={brl(k.fluxo.entradas)}
                linhas={["Recebimentos efetivos no período", k.fluxo.incluiLegado ? "Inclui pagamentos antigos sem histórico" : null]}
                onClick={podeRota(ROTAS.caixa) ? () => ir(ROTAS.caixa) : undefined} />
              <Card titulo="Saídas" icone={ArrowUpCircle} estado={k.fluxo} tom="critico" valor={brl(k.fluxo.saidas)}
                linhas={["Pagamentos efetivos no período"]} onClick={podeRota(ROTAS.caixa) ? () => ir(ROTAS.caixa) : undefined} />
              <Card titulo="Saldo do período" icone={Scale} estado={k.fluxo} tom={k.fluxo.saldo < 0 ? "critico" : k.fluxo.saldo > 0 ? "positivo" : "neutro"}
                valor={sinal(k.fluxo.saldo)} linhas={["Entradas − saídas realizadas", `${k.fluxo.lancamentos} lançamento(s)`]} />
              <Card titulo="Faturamento" icone={Receipt} estado={k.faturamento} tom={k.faturamento.estado === "parcial" ? "atencao" : "info"}
                valor={brl(k.faturamento.valor)} linhas={[k.faturamento.estado === "parcial" ? `Parcial: ${k.faturamento.lancados} de ${k.faturamento.esperados} dias` : "Vendas − cancelamentos − descontos"]}
                acao={["nao_apurado", "parcial"].includes(k.faturamento.estado) && podeRota(ROTAS.faturamento)
                  ? <button type="button" onClick={(e) => { e.stopPropagation(); ir(ROTAS.faturamento); }} className="rounded-lg bg-sky-500/15 px-2 py-1 text-[11px] font-black text-sky-300 hover:bg-sky-500/25">Lançar faturamento</button> : null} />
            </div>

            {/* 3. PRECISA DA SUA ATENÇÃO + resumo do Héfisto */}
            <Secao titulo="Precisa da sua atenção" icone={AlertTriangle}
              direita={<span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${c.alertas.length ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300"}`}>{c.alertas.length ? `${c.alertas.length} item(ns)` : "tudo em dia"}</span>}>
              {c.alertas.length === 0 ? (
                <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-300"><CheckCircle2 size={16} />Nenhum problema encontrado nos dados disponíveis.</div>
              ) : (
                <div className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
                  {c.alertas.map((a) => {
                    const t = TOM[a.prioridade === "critico" ? "critico" : a.prioridade === "atencao" ? "atencao" : "info"];
                    const Ic = a.prioridade === "critico" ? AlertCircle : a.prioridade === "atencao" ? AlertTriangle : Info;
                    return (
                      <div key={a.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3">
                        <Ic size={18} className={`hidden shrink-0 sm:block ${t.texto}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className={`text-[10px] font-black uppercase tracking-wider ${t.texto}`}>{a.prioridade === "critico" ? "Crítico" : a.prioridade === "atencao" ? "Atenção" : "Informativo"}</span>
                            <span className="text-sm font-bold text-white">{a.titulo}</span>
                            {a.valor != null && <span className={`text-sm font-black tabular-nums ${t.texto}`}>{brl(a.valor)}</span>}
                          </div>
                          <p className="line-clamp-2 text-[11px] text-slate-400">{a.impacto}{a.motivo ? ` ${a.motivo}` : ""}</p>
                        </div>
                        {a.recarregar ? <Botao icone={RefreshCw} onClick={atualizar}>{a.acao}</Botao>
                          : a.href && podeRota(a.href) ? <Botao onClick={() => ir(a.href)}>{a.acao} <ChevronRight size={14} /></Botao> : null}
                      </div>
                    );
                  })}
                </div>
              )}
              {c.resumo.length > 0 && (
                <div className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <Sparkles size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Héfisto identificou</p>
                      <ul className="mt-0.5 space-y-0.5 text-xs text-slate-200">
                        {c.resumo.map((r, i) => <li key={i} className="flex gap-1.5"><span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TOM[r.tom]?.ponto || "bg-slate-400"}`} />{r.texto}</li>)}
                      </ul>
                    </div>
                  </div>
                  {podeRota(ROTAS.inteligencia) && <Botao icone={Sparkles} onClick={() => ir(ROTAS.inteligencia)}>Perguntar ao Héfisto</Botao>}
                </div>
              )}
            </Secao>

            {/* 4 e 5. FLUXO FINANCEIRO + INDICADORES GERENCIAIS */}
            <div className="grid gap-5 lg:grid-cols-5">
              <Secao titulo="Fluxo financeiro" icone={Landmark} className="lg:col-span-2"
                direita={<span className="text-[10px] text-slate-500">{intervalo.rotulo}</span>}>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3.5">
                  {semValor(k.fluxo) ? (
                    <p className="text-sm text-slate-300"><b>{ROTULO_ESTADO[k.fluxo.estado]}.</b> <span className="text-slate-400">{k.fluxo.motivo}</span></p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        {[["Entradas", brl(k.fluxo.entradas), "text-emerald-400"], ["Saídas", brl(k.fluxo.saidas), "text-rose-400"],
                          ["Saldo", sinal(k.fluxo.saldo), k.fluxo.saldo < 0 ? "text-rose-400" : k.fluxo.saldo > 0 ? "text-emerald-400" : "text-white"],
                          ["Lançamentos", String(k.fluxo.lancamentos), "text-white"]].map(([r, v, cls]) => (
                          <div key={r} className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{r}</p><p className={`truncate text-lg font-black tabular-nums ${cls}`}>{v}</p></div>
                        ))}
                      </div>
                      <p className="mt-3 border-t border-slate-800 pt-2 text-[11px] text-slate-400">
                        Caixa realizado (data do dinheiro), registrado no financeiro.{k.fluxo.estado === "zero" ? ` ${k.fluxo.motivo}` : ""}{k.fluxo.incluiLegado ? " Inclui pagamentos antigos sem histórico." : ""} Não é DRE.
                      </p>
                    </>
                  )}
                  {k.saldoGerencial && (
                    <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-slate-950/60 px-3 py-2 text-xs">
                      <span className="text-slate-400">Saldo em caixa/banco (gerencial)</span>
                      <span className={`font-black tabular-nums ${semValor(k.saldoGerencial) ? "text-slate-300" : "text-white"}`}>{semValor(k.saldoGerencial) ? ROTULO_ESTADO[k.saldoGerencial.estado] : brl(k.saldoGerencial.valor)}</span>
                    </div>
                  )}
                </div>
              </Secao>

              <Secao titulo="Indicadores gerenciais" icone={BarChart3} className="lg:col-span-3"
                direita={<span className="text-[10px] text-slate-500">mês atual · CMV pelo último inventário fechado</span>}>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <Indicador titulo="CMV realizado" estado={ind.cmv}
                    tom={ind.cmv.saude === "acima" ? "atencao" : ind.cmv.saude === "saudavel" ? "positivo" : "info"}
                    principal={ind.cmv.pct != null ? pct(ind.cmv.pct) : brl(ind.cmv.valor)}
                    secundaria={ind.cmv.periodo ? `${ddmm(ind.cmv.periodo.de)} a ${ddmm(ind.cmv.periodo.ate)} · ${ind.cmv.pct != null ? brl(ind.cmv.valor) : "valor em R$"}` : ""}
                    nota={ind.cmv.pct == null ? ind.cmv.motivoPct : ind.cmv.meta ? `Meta ≤ ${pct(ind.cmv.meta)} · ${ind.cmv.saude === "acima" ? "acima da meta" : "dentro da meta"}` : "Meta de CMV não configurada"} />
                  <Indicador titulo="CMO (mão de obra)" estado={ind.cmo} tom="info"
                    principal={ind.cmo.pct != null ? pct(ind.cmo.pct) : brl(ind.cmo.valor)}
                    secundaria={`Folha ${brl(ind.cmo.folha || 0)} + extras ${brl(ind.cmo.extras || 0)}`}
                    nota={ind.cmo.pct != null ? brl(ind.cmo.valor) : ind.cmo.motivoPct} />
                  <Indicador titulo="Custos fixos" estado={ind.custosFixos} tom="info"
                    principal={brl(ind.custosFixos.valor)} secundaria={`${ind.custosFixos.itens || 0} item(ns) cadastrados, por mês`}
                    nota={ind.custosFixos.pct != null ? `${pct(ind.custosFixos.pct)} do faturamento` : ind.custosFixos.motivoPct} />
                  <Indicador titulo="Margem operacional" estado={ind.margem} tom={ind.margem.pct < 0 ? "critico" : "positivo"} principal={ind.margem.pct != null ? pct(ind.margem.pct) : ""} secundaria="Lucro ÷ faturamento do mês" />
                  <Indicador titulo="Ponto de equilíbrio" estado={ind.pontoEquilibrio} tom="info" principal={ind.pontoEquilibrio.mensal != null ? brl(ind.pontoEquilibrio.mensal) : ""}
                    secundaria={ind.pontoEquilibrio.diario != null ? `${brl(ind.pontoEquilibrio.diario)}/dia · ${brl(ind.pontoEquilibrio.semanal)}/semana` : ""} />
                  <Indicador titulo="Lucro operacional" estado={ind.lucro} tom={ind.lucro.valor < 0 ? "critico" : "positivo"} principal={ind.lucro.valor != null ? sinal(ind.lucro.valor) : ""}
                    secundaria="Faturamento − CMV − CMO − custos fixos" />
                </div>
              </Secao>
            </div>

            {/* 6. PRÓXIMOS COMPROMISSOS */}
            <Secao titulo="Próximos compromissos" icone={CreditCard}
              direita={<button type="button" onClick={() => ir(ROTAS.contasPagar)} className="inline-flex min-h-[36px] items-center gap-1 text-xs font-bold text-emerald-400 hover:underline">Ver todas as contas <ChevronRight size={14} /></button>}>
              {!c.compromissos ? (
                <p className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300"><b>Erro ao carregar.</b> <button type="button" onClick={atualizar} className="font-bold text-emerald-400 hover:underline">Tentar novamente</button></p>
              ) : c.compromissos.total === 0 ? (
                <p className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-300"><CheckCircle2 size={16} />Nenhuma conta vencida, para hoje ou para os próximos 7 dias.</p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-800 px-3 py-2 text-[11px] text-slate-400">
                    <span><b className="text-rose-300">{c.compromissos.contagem.vencidas}</b> vencida(s)</span>
                    <span><b className="text-amber-300">{c.compromissos.contagem.hoje}</b> vencem hoje</span>
                    <span><b className="text-sky-300">{c.compromissos.contagem.proximos7}</b> nos próximos 7 dias</span>
                    {c.compromissos.total > c.compromissos.linhas.length && <span>· mostrando as {c.compromissos.linhas.length} mais urgentes de {c.compromissos.total}</span>}
                  </div>
                  <ul className="divide-y divide-slate-800">
                    {c.compromissos.linhas.map((l) => {
                      const t = TOM[l.status.tom];
                      return (
                        <li key={l.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_10rem_6rem_7.5rem_13rem]">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-white">{l.descricao}</p>
                            <p className="truncate text-[11px] text-slate-400 sm:hidden">{l.categoria} · {l.vencimentoBr}</p>
                          </div>
                          <span className="hidden truncate text-xs text-slate-400 sm:block">{l.categoria}</span>
                          <span className="hidden text-right text-xs tabular-nums text-slate-300 sm:block">{l.vencimentoBr}</span>
                          <span className="text-right text-sm font-black tabular-nums text-white">{brl(l.valor)}</span>
                          <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:justify-end">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${t.fundo} ${t.texto}`}>{l.status.rotulo}{l.parcial ? " · parcial" : ""}</span>
                            <div className="flex gap-1">
                              {onPagarConta && <button type="button" onClick={() => onPagarConta({ id: l.id })} className="min-h-[32px] rounded-lg bg-emerald-500 px-2.5 text-[11px] font-black text-slate-950 hover:bg-emerald-400">Pagar</button>}
                              <button type="button" onClick={() => ir(l.status.tom === "critico" ? ROTAS.contasVencidas : ROTAS.contasPagar)} className="min-h-[32px] rounded-lg border border-slate-700 px-2.5 text-[11px] font-bold text-slate-200 hover:border-slate-500">Abrir</button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </Secao>

            {/* 8. AÇÕES RÁPIDAS */}
            <Secao titulo="Ações rápidas">
              <div className="flex flex-wrap gap-2">
                {[["Novo lançamento", ROTAS.novaContaPagar, Plus], ["Fluxo de caixa", ROTAS.fluxo, Landmark], ["Contas a pagar", ROTAS.contasPagar, CreditCard],
                  ["Contas a receber", ROTAS.contasReceber, Banknote], ["Compras", ROTAS.compras, ShoppingCart], ["DRE", ROTAS.dre, FileText]]
                  .filter(([, r]) => podeRota(r)).map(([rot, r, I]) => <Botao key={rot} icone={I} onClick={() => ir(r)}>{rot}</Botao>)}
              </div>
            </Secao>

            {/* 9. ANÁLISES E FERRAMENTAS */}
            <Secao titulo="Análises e ferramentas">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {[["CMV realizado", "Inventário + compras", ROTAS.cmvReal, Target], ["Custos e precificação", "CMV teórico das fichas", ROTAS.custosPrecificacao, Calculator],
                  ["Pizza do lucro", "Custos fixos, equilíbrio e margem", ROTAS.pizza, PieChart],
                  ["Relatórios gerenciais", "Exportar PDF/CSV", ROTAS.relatorios, BarChart3], ["Dados fiscais", "Impostos e documentos", ROTAS.fiscal, ShieldCheck]]
                  .filter(([, , r]) => podeRota(r)).map(([rot, desc, r, I]) => (
                    <button key={rot} type="button" onClick={() => ir(r)} className="flex min-h-[52px] min-w-0 items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 text-left transition hover:border-slate-600">
                      <I size={16} className="shrink-0 text-sky-300" />
                      <span className="min-w-0"><span className="block truncate text-xs font-bold text-white">{rot}</span><span className="block truncate text-[10px] text-slate-400">{desc}</span></span>
                    </button>
                  ))}
              </div>
            </Secao>
          </>
        )}
      </div>
    </div>
  );
}
