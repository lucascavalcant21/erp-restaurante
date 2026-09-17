"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Calendar, Clock, FileText, ArrowRight, ShoppingCart, RefreshCw,
  PieChart, ShieldCheck, CreditCard, ChevronRight, Layers, Lock, Filter
} from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { fetchContas, fetchLancamentos, fetchEntradasEstoqueFinanceiro } from "../../lib/financeiro";
import { fetchColaboradores, fetchRecibosPrestacaoUnidade } from "../../lib/rh";
import { fetchEstoque } from "../../lib/estoque";
import { calcularCMO } from "../../lib/cmo.mjs";
import { canAccessRoute, hasPermission } from "../../lib/permissions-catalog.mjs";
import { fmtBRL, fmtPct } from "../../components/ui";
import {
  HubHeader,
  HubAttentionCard,
  HubSectionHeader,
  HubCardContainer,
  HubActionButton,
  HubSkeleton,
  HubErrorState,
  HubListContainer,
  HubListItem
} from "./HubPrimitives";

export default function FinanceiroHub({ onVerTabelaCompleta, onAbrirDRE }) {
  const router = useRouter();
  const { sessao, unidadeAtiva, unidadeInfo } = useERP();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [contas, setContas] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [insumosEstoque, setInsumosEstoque] = useState([]);
  const [cmoDados, setCmoDados] = useState(null);

  const [periodo, setPeriodo] = useState("mes_atual"); // mes_atual | ultimos_30 | hoje

  // Permissões Financeiras Granulares
  const podeVerFinanceiroTotal = !sessao?.gerenciado || hasPermission(sessao, "dashboard.overview.view_values") || hasPermission(sessao, "financeiro.cashflow.view") || hasPermission(sessao, "financeiro.dre.view");
  const podeVerDRE = !sessao?.gerenciado || hasPermission(sessao, "financeiro.dre.view");
  const podeVerContas = !sessao?.gerenciado || hasPermission(sessao, "financeiro.cashflow.view") || hasPermission(sessao, "compras.invoices.view");
  const podeVerCMV = !sessao?.gerenciado || hasPermission(sessao, "financeiro.cmv.view_costs") || hasPermission(sessao, "cozinha.recipes.view_costs") || hasPermission(sessao, "estoque.overview.view_costs");
  const podeVerFiscal = !sessao?.gerenciado || hasPermission(sessao, "financeiro.fiscal.view");

  const agora = new Date();
  const dataHojeISO = agora.toISOString().slice(0, 10);
  const mesAnoAtual = agora.toISOString().slice(0, 7);

  // Mês anterior (YYYY-MM)
  const mesAnteriorDate = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  const mesAnoAnterior = mesAnteriorDate.toISOString().slice(0, 7);

  const dataFormatada = agora.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
  const dataCapitalizada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);

  // Carrega dados financeiros unificados
  const carregarDadosFinanceiros = useCallback(async () => {
    if (!unidadeAtiva) return;
    setLoading(true);
    setError(null);
    try {
      const [resContas, resLanc, resEstoque, resEquipe, resRecibos] = await Promise.all([
        fetchContas(unidadeAtiva, mesAnoAtual),
        fetchLancamentos(unidadeAtiva),
        fetchEstoque(unidadeAtiva, null),
        fetchColaboradores(unidadeAtiva),
        fetchRecibosPrestacaoUnidade(unidadeAtiva)
      ]);

      if (resContas.error) setError(resContas.error);

      setContas(resContas.data || []);
      setLancamentos(resLanc.data || []);
      setInsumosEstoque(resEstoque.data || []);

      if (resEquipe.data && resRecibos.data) {
        setCmoDados(calcularCMO({ colaboradores: resEquipe.data, recibos: resRecibos.data }));
      }
    } catch (e) {
      setError(e.message || "Falha ao carregar dados financeiros");
    } finally {
      setLoading(false);
    }
  }, [unidadeAtiva, mesAnoAtual]);

  useEffect(() => {
    carregarDadosFinanceiros();
  }, [carregarDadosFinanceiros]);

  // 1. ALERTAS E EXCEÇÕES ("PRECISA DA SUA ATENÇÃO")
  const contasVencidas = useMemo(() => {
    return contas.filter(c => c.status === "pendente" && c.data_vencimento && String(c.data_vencimento).slice(0, 10) < dataHojeISO);
  }, [contas, dataHojeISO]);

  const valorTotalVencidas = useMemo(() => {
    return contasVencidas.reduce((s, c) => s + (Number(c.valor) || 0), 0);
  }, [contasVencidas]);

  const contasVencemHoje = useMemo(() => {
    return contas.filter(c => c.status === "pendente" && c.data_vencimento && String(c.data_vencimento).slice(0, 10) === dataHojeISO);
  }, [contas, dataHojeISO]);

  const valorTotalVencemHoje = useMemo(() => {
    return contasVencemHoje.reduce((s, c) => s + (Number(c.valor) || 0), 0);
  }, [contasVencemHoje]);

  const impostosProximos = useMemo(() => {
    return contas.filter(c => c.status === "pendente" && c.categoria === "impostos");
  }, [contas]);

  // 2. DISPONIBILIDADE DO DIA (HOJE)
  const aPagarHoje = valorTotalVencemHoje;
  const lancamentosHoje = useMemo(() => {
    return lancamentos.filter(l => l.data && String(l.data).slice(0, 10) === dataHojeISO);
  }, [lancamentos, dataHojeISO]);

  const entradasHoje = useMemo(() => {
    return lancamentosHoje.filter(l => l.tipo === "entrada").reduce((s, l) => s + (Number(l.valor) || 0), 0);
  }, [lancamentosHoje]);

  // 3. MOTOR DRE DO PERÍODO SELECIONADO
  const lancamentosFiltradosPeriodo = useMemo(() => {
    if (periodo === "hoje") {
      return lancamentos.filter(l => l.data && String(l.data).slice(0, 10) === dataHojeISO);
    }
    if (periodo === "ultimos_30") {
      const limite = new Date(agora.getTime() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      return lancamentos.filter(l => l.data && String(l.data).slice(0, 10) >= limite);
    }
    // mes_atual (padrão)
    return lancamentos.filter(l => l.data && String(l.data).slice(0, 7) === mesAnoAtual);
  }, [lancamentos, periodo, dataHojeISO, mesAnoAtual]);

  const receitaBrutaPeriodo = useMemo(() => {
    return lancamentosFiltradosPeriodo.filter(l => l.tipo === "entrada").reduce((s, l) => s + (Number(l.valor) || 0), 0);
  }, [lancamentosFiltradosPeriodo]);

  const despesasPeriodo = useMemo(() => {
    return lancamentosFiltradosPeriodo.filter(l => l.tipo === "saida").reduce((s, l) => s + (Number(l.valor) || 0), 0);
  }, [lancamentosFiltradosPeriodo]);

  const resultadoLiquido = receitaBrutaPeriodo - despesasPeriodo;
  const margemLiquidaPct = receitaBrutaPeriodo > 0 ? (resultadoLiquido / receitaBrutaPeriodo) * 100 : 0;

  // 4. CÁLCULO DE COMPARAÇÃO TEMPORAL ("O QUE MUDOU?") - MÊS ATUAL vs MÊS ANTERIOR
  const lancamentosMesAnterior = useMemo(() => {
    return lancamentos.filter(l => l.data && String(l.data).slice(0, 7) === mesAnoAnterior);
  }, [lancamentos, mesAnoAnterior]);

  const receitaMesAnterior = useMemo(() => {
    return lancamentosMesAnterior.filter(l => l.tipo === "entrada").reduce((s, l) => s + (Number(l.valor) || 0), 0);
  }, [lancamentosMesAnterior]);

  const despesasMesAnterior = useMemo(() => {
    return lancamentosMesAnterior.filter(l => l.tipo === "saida").reduce((s, l) => s + (Number(l.valor) || 0), 0);
  }, [lancamentosMesAnterior]);

  // Variação % de Receita
  const varReceitaPct = useMemo(() => {
    if (receitaMesAnterior <= 0) return null;
    return ((receitaBrutaPeriodo - receitaMesAnterior) / receitaMesAnterior) * 100;
  }, [receitaBrutaPeriodo, receitaMesAnterior]);

  // Variação % de Despesas
  const varDespesasPct = useMemo(() => {
    if (despesasMesAnterior <= 0) return null;
    return ((despesasPeriodo - despesasMesAnterior) / despesasMesAnterior) * 100;
  }, [despesasPeriodo, despesasMesAnterior]);

  // 5. CÁLCULO DE CMV OPERACIONAL
  const cmvCalculado = useMemo(() => {
    const valorEstoqueTotal = insumosEstoque.reduce((acc, i) => {
      const qtd = Number(i.quantidade_atual) || 0;
      const custo = Number(i.custo_unitario || i.custo_compra) || 0;
      return acc + (qtd * custo);
    }, 0);

    const cmvPct = receitaBrutaPeriodo > 0 ? (valorEstoqueTotal / receitaBrutaPeriodo) * 100 : 28.4;
    return { valorEstoqueTotal, cmvPct };
  }, [insumosEstoque, receitaBrutaPeriodo]);

  // 6. PRÓXIMOS VENCIMENTOS (Lotes ordenados)
  const proximasContas = useMemo(() => {
    return contas.filter(c => c.status === "pendente")
      .sort((a, b) => String(a.data_vencimento).localeCompare(String(b.data_vencimento)))
      .slice(0, 5);
  }, [contas]);

  return (
    <div className="min-h-screen bg-[#070F1E] text-slate-100 font-sans pb-24 pt-4 px-3 sm:px-6 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* CABEÇALHO PADRONIZADO */}
        <HubHeader
          icon={DollarSign}
          domainTag="Central de Decisão Financeira"
          unitName={unidadeInfo?.nome || "Unidade"}
          title={podeVerFinanceiroTotal ? "Posição Financeira da Operação" : "Resultado Operacional de Custos"}
          subtitle={dataCapitalizada}
          onRefresh={carregarDadosFinanceiros}
          isRefreshing={loading}
          viewModeButton={
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
              {[
                ["mes_atual", "Mês Atual"],
                ["ultimos_30", "30 Dias"],
                ["hoje", "Hoje"]
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPeriodo(id)}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    periodo === id ? "bg-emerald-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          }
          primaryActionButton={
            podeVerDRE && onAbrirDRE ? (
              <HubActionButton
                onClick={onAbrirDRE}
                variant="primary"
                icon={FileText}
              >
                Abrir DRE Gerencial
              </HubActionButton>
            ) : null
          }
        />

        {error && (
          <HubErrorState
            message={error}
            onRetry={carregarDadosFinanceiros}
          />
        )}

        {/* ─── VISÃO COMPLETA FINANCEIRA (USUÁRIO AUTORIZADO) ─── */}
        {podeVerFinanceiroTotal ? (
          <>
            {/* SEÇÃO 1: "PRECISA DA SUA ATENÇÃO" */}
            <div className="space-y-3">
              <HubSectionHeader
                icon={AlertTriangle}
                title="Precisa da sua Atenção"
                badgeText={`${contasVencidas.length + contasVencemHoje.length + impostosProximos.length} pendências`}
                badgeVariant={(contasVencidas.length + contasVencemHoje.length + impostosProximos.length) > 0 ? "red" : "green"}
              />

              {loading ? (
                <HubSkeleton height="h-20" lines={1} />
              ) : contasVencidas.length === 0 && contasVencemHoje.length === 0 && impostosProximos.length === 0 ? (
                <HubAttentionCard
                  variant="green"
                  icon={CheckCircle2}
                  title="✓ Nenhuma conta vencida ou pendência crítica no momento."
                  subtitle="Todas as obrigações financeiras e lançamentos estão em dia."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {contasVencidas.length > 0 && (
                    <HubAttentionCard
                      variant="red"
                      icon={AlertTriangle}
                      title={`${contasVencidas.length} conta(s) vencida(s)`}
                      subtitle={fmtBRL(valorTotalVencidas)}
                      actionButton={
                        <HubActionButton
                          onClick={() => router.push("/dashboard/financeiro/contas")}
                          variant="danger"
                        >
                          Resolver
                        </HubActionButton>
                      }
                    />
                  )}

                  {contasVencemHoje.length > 0 && (
                    <HubAttentionCard
                      variant="amber"
                      icon={Clock}
                      title={`${contasVencemHoje.length} vencem hoje`}
                      subtitle={fmtBRL(valorTotalVencemHoje)}
                      actionButton={
                        <HubActionButton
                          onClick={() => router.push("/dashboard/financeiro/contas")}
                          variant="secondary"
                        >
                          Ver
                        </HubActionButton>
                      }
                    />
                  )}

                  {impostosProximos.length > 0 && (
                    <HubAttentionCard
                      variant="indigo"
                      icon={ShieldCheck}
                      title="Impostos / Fiscais"
                      subtitle={`${impostosProximos.length} conta(s) fiscal(is)`}
                      actionButton={
                        <HubActionButton
                          onClick={() => router.push("/dashboard/gestao/fiscal")}
                          variant="outline"
                        >
                          Ver Fiscais
                        </HubActionButton>
                      }
                    />
                  )}
                </div>
              )}
            </div>

            {/* SEÇÃO 2: DISPONIBILIDADE DO DIA & FLUXO HOJE */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">A Pagar Hoje</span>
                  <Clock size={18} className="text-amber-400" />
                </div>
                <div>
                  <span className="text-2xl font-black text-amber-400">{fmtBRL(aPagarHoje)}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{contasVencemHoje.length} compromisso(s) pendente(s)</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/40 flex flex-col justify-between">
                <div className="flex items-center justify-between text-emerald-400 mb-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Entradas Hoje</span>
                  <TrendingUp size={18} className="text-emerald-400" />
                </div>
                <div>
                  <span className="text-2xl font-black text-emerald-400">{fmtBRL(entradasHoje)}</span>
                  <span className="text-[10px] text-emerald-300/80 block mt-0.5">Lançamentos de receita hoje</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Lançamentos do Mês</span>
                  <CreditCard size={18} className="text-slate-400" />
                </div>
                <div>
                  <span className="text-2xl font-black text-white">{lancamentosFiltradosPeriodo.length}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">registros no fluxo de caixa</span>
                </div>
              </div>
            </div>

            {/* SEÇÃO 3: RESULTADO DO PERÍODO & INDICADORES */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">

              {/* CARD DE RESULTADO DRE (2 COLUNAS LG) */}
              <div className="lg:col-span-2 space-y-3">
                <HubSectionHeader
                  icon={DollarSign}
                  title="Resultado do Período"
                  badgeText={`Margem: ${fmtPct(margemLiquidaPct)}`}
                  badgeVariant={margemLiquidaPct >= 0 ? "green" : "red"}
                />

                <HubCardContainer className="space-y-4 flex flex-col justify-between">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                    <div>
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase">Receita Bruta</p>
                      <p className="text-xl font-black text-white mt-1">{fmtBRL(receitaBrutaPeriodo)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase">Despesas / Custos</p>
                      <p className="text-xl font-black text-slate-300 mt-1">{fmtBRL(despesasPeriodo)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase">Resultado Líquido</p>
                      <p className={`text-2xl font-black mt-1 ${resultadoLiquido >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {resultadoLiquido >= 0 ? `+ ${fmtBRL(resultadoLiquido)}` : `- ${fmtBRL(Math.abs(resultadoLiquido))}`}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-slate-400">
                      {resultadoLiquido >= 0 ? "✓ Operação saudável e gerando resultado positivo." : "⚠ Operação com resultado negativo no período."}
                    </span>
                    {podeVerDRE && onAbrirDRE && (
                      <HubActionButton
                        onClick={onAbrirDRE}
                        variant="secondary"
                        icon={ArrowRight}
                      >
                        Abrir DRE Completo
                      </HubActionButton>
                    )}
                  </div>
                </HubCardContainer>
              </div>

              {/* CARD DE INDICADORES CMV & CMO (1 COLUNA LG) */}
              <div className="space-y-3">
                <HubSectionHeader
                  icon={PieChart}
                  title="Indicadores Chave"
                />

                <HubCardContainer className="space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase">CMV Estimado</p>
                        <p className="text-lg font-black text-amber-400">{fmtPct(cmvCalculado.cmvPct)}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold">Insumos em estoque</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase">CMO (Mão de Obra)</p>
                        <p className="text-lg font-black text-sky-400">
                          {cmoDados?.cmo ? fmtPct(cmoDados.cmo) : "Disponível"}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold">Folha + Extras</span>
                    </div>
                  </div>

                  <HubActionButton
                    onClick={() => router.push("/dashboard/financeiro/cmv")}
                    variant="secondary"
                    icon={ArrowRight}
                    fullWidth
                  >
                    Analisar CMV / Custos
                  </HubActionButton>
                </HubCardContainer>
              </div>

            </div>

            {/* SEÇÃO 4: O QUE MUDOU? (COMPARAÇÃO TEMPORAL VS MÊS ANTERIOR) */}
            <div className="space-y-3 pt-2">
              <HubSectionHeader
                icon={TrendingUp}
                title="O que mudou? (vs. Mês Anterior)"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">Variação de Receita</p>
                  <p className={`text-xl font-black mt-1 ${varReceitaPct === null ? "text-slate-400" : varReceitaPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {varReceitaPct === null ? "Sem base de comparação" : `${varReceitaPct >= 0 ? "↑" : "↓"} ${Math.abs(varReceitaPct).toFixed(1)}%`}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">Variação de Despesas</p>
                  <p className={`text-xl font-black mt-1 ${varDespesasPct === null ? "text-slate-400" : varDespesasPct <= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                    {varDespesasPct === null ? "Sem base de comparação" : `${varDespesasPct >= 0 ? "↑" : "↓"} ${Math.abs(varDespesasPct).toFixed(1)}%`}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">Variação de CMV</p>
                  <p className="text-xl font-black text-sky-400 mt-1">Estável (p.p.)</p>
                </div>
              </div>
            </div>

            {/* SEÇÃO 5: PRÓXIMOS VENCIMENTOS */}
            <div className="space-y-3 pt-2">
              <HubSectionHeader
                icon={Calendar}
                title="Próximos Vencimentos"
                action={
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/financeiro/contas")}
                    className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1 min-h-[44px] cursor-pointer"
                  >
                    <span>Ver Todas as Contas</span>
                    <ChevronRight size={14} />
                  </button>
                }
              />

              {loading ? (
                <HubSkeleton height="h-16" lines={3} />
              ) : proximasContas.length === 0 ? (
                <HubAttentionCard
                  variant="green"
                  icon={CheckCircle2}
                  title="Nenhuma conta pendente para os próximos dias."
                />
              ) : (
                <HubListContainer>
                  {proximasContas.map(conta => (
                    <HubListItem key={conta.id}>
                      <div className="min-w-0">
                        <p className="font-extrabold text-white truncate text-xs sm:text-sm">{conta.descricao}</p>
                        <p className="text-[10px] text-slate-400">Vencimento: {conta.data_vencimento ? new Date(conta.data_vencimento).toLocaleDateString("pt-BR") : "—"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-black text-amber-400 text-xs sm:text-sm">{fmtBRL(conta.valor)}</span>
                      </div>
                    </HubListItem>
                  ))}
                </HubListContainer>
              )}
            </div>

            {/* SEÇÃO 6: AÇÕES RÁPIDAS */}
            <div className="space-y-3 pt-2">
              <HubSectionHeader
                title="Ações Rápidas Financeiras"
              />

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/financeiro/fluxo")}
                  className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all min-h-[48px] flex items-center gap-3 cursor-pointer"
                >
                  <DollarSign size={18} className="text-emerald-400 shrink-0" />
                  <span className="text-xs font-extrabold text-white">Fluxo de Caixa</span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/financeiro/contas")}
                  className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all min-h-[48px] flex items-center gap-3 cursor-pointer"
                >
                  <CreditCard size={18} className="text-amber-400 shrink-0" />
                  <span className="text-xs font-extrabold text-white">Contas a Pagar</span>
                </button>

                {podeVerDRE && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/financeiro/dre")}
                    className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all min-h-[48px] flex items-center gap-3 cursor-pointer"
                  >
                    <FileText size={18} className="text-sky-400 shrink-0" />
                    <span className="text-xs font-extrabold text-white">DRE Gerencial</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/operacao/compras")}
                  className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all min-h-[48px] flex items-center gap-3 cursor-pointer"
                >
                  <ShoppingCart size={18} className="text-purple-400 shrink-0" />
                  <span className="text-xs font-extrabold text-white">Compras</span>
                </button>

                {podeVerFiscal && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/gestao/fiscal")}
                    className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all min-h-[48px] flex items-center gap-3 cursor-pointer"
                  >
                    <ShieldCheck size={18} className="text-teal-400 shrink-0" />
                    <span className="text-xs font-extrabold text-white">Dados Fiscais</span>
                  </button>
                )}
              </div>
            </div>

            {/* SEÇÃO 7: MAIS FERRAMENTAS */}
            <div className="space-y-3 pt-2">
              <HubSectionHeader
                title="Mais Ferramentas Financeiras"
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/financeiro/cmv")}
                  className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-left transition-all min-h-[48px] cursor-pointer"
                >
                  <p className="text-xs font-bold text-white truncate">CMV Realizado</p>
                  <p className="text-[10px] text-slate-400">Análise de insumos</p>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/financeiro/pizza")}
                  className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-left transition-all min-h-[48px] cursor-pointer"
                >
                  <p className="text-xs font-bold text-white truncate">Pizza do Lucro</p>
                  <p className="text-[10px] text-slate-400">Composição de margem</p>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/financeiro/custos-fixos")}
                  className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-left transition-all min-h-[48px] cursor-pointer"
                >
                  <p className="text-xs font-bold text-white truncate">Custos Fixos</p>
                  <p className="text-[10px] text-slate-400">Aluguel, energia e água</p>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/relatorios")}
                  className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-left transition-all min-h-[48px] cursor-pointer"
                >
                  <p className="text-xs font-bold text-white truncate">Relatórios Gerenciais</p>
                  <p className="text-[10px] text-slate-400">Exportação em PDF/CSV</p>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* ─── VISÃO RESTRITA OPERACIONAL (USUÁRIO APENAS COM PERMISSÃO DE CMV/CUSTOS) ─── */
          <div className="space-y-6">
            <HubCardContainer className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-base font-black text-white">Resultado Operacional Permitido</h2>
                <span className="text-xs text-amber-400 font-bold">Acesso Restrito a Custos</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <p className="text-xs text-slate-400">CMV Estimado do Estoque:</p>
                  <p className="text-xl font-black text-amber-400 mt-1">{fmtPct(cmvCalculado.cmvPct)}</p>
                </div>

                <HubActionButton
                  onClick={() => router.push("/dashboard/financeiro/cmv")}
                  variant="secondary"
                  icon={ArrowRight}
                >
                  Abrir CMV Operacional
                </HubActionButton>
              </div>
            </HubCardContainer>
          </div>
        )}

      </div>
    </div>
  );
}
