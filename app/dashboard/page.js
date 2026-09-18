"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChefHat, Package, Users, DollarSign, AlertTriangle, CheckCircle2,
  Clock, Sparkles, ArrowRight, Plus, Tag, RefreshCw, FileText,
  TrendingUp, ShoppingCart, ShieldCheck, ChevronRight, Layers, Lock,
  Calendar, Coffee, CreditCard, PieChart, Search
} from "lucide-react";
import { useERP } from "../context/ERPContext";
import { fetchProducaoDeHoje, fetchEstoque } from "../lib/estoque";
import { fetchColaboradores, fetchBancoHoras, somaMinutosBanco, BANCO_ALERTA_MIN, horarioDoDia } from "../lib/rh";
import { fetchPontoHoje } from "../lib/ponto";
import { situacaoDoPonto } from "../lib/ponto-status.mjs";
import { fetchContas, fetchLancamentos } from "../lib/financeiro";
import { canAccessRoute, hasPermission } from "../lib/permissions-catalog.mjs";
import { getRecentItems } from "../lib/user-preferences";
import { getHefistoInbox } from "../lib/hefisto-inbox.js";
import { fmtBRL, fmtPct } from "../components/ui";
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
} from "../components/navigation/HubPrimitives";

export default function CentralDeComandoHome() {
  const router = useRouter();
  const { sessao, unidadeAtiva, unidadeInfo } = useERP();

  // Estados dos dados e recargas
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandirPendencias, setExpandirPendencias] = useState(false);

  // Estados de Domínios
  const [dadosProducao, setDadosProducao] = useState([]);
  const [dadosEstoque, setDadosEstoque] = useState([]);
  const [dadosColabs, setDadosColabs] = useState([]);
  const [dadosPontos, setDadosPontos] = useState([]);
  const [dadosContas, setDadosContas] = useState([]);
  const [dadosLancamentos, setDadosLancamentos] = useState([]);
  const [dadosBanco, setDadosBanco] = useState([]);
  const [recentItems, setRecentItems] = useState([]);
  const [inboxItems, setInboxItems] = useState([]);

  // Estados de Falha Parcial
  const [errosModulos, setErrosModulos] = useState({});

  // Permissões do Usuário Logado
  const podeVerFinanceiro = !sessao?.gerenciado || hasPermission(sessao, "dashboard.overview.view_values") || hasPermission(sessao, "financeiro.cashflow.view");
  const podeVerContas = !sessao?.gerenciado || hasPermission(sessao, "financeiro.cashflow.view") || hasPermission(sessao, "compras.invoices.view");
  const podeVerDRE = !sessao?.gerenciado || hasPermission(sessao, "financeiro.dre.view");
  const podeVerProducao = !sessao?.gerenciado || canAccessRoute(sessao, "/dashboard/operacao/producao");
  const podeVerEstoque = !sessao?.gerenciado || canAccessRoute(sessao, "/dashboard/operacao/estoque");
  const podeVerEquipe = !sessao?.gerenciado || hasPermission(sessao, "rh.overview.view") || hasPermission(sessao, "rh.employees.view");
  const podeVerPonto = !sessao?.gerenciado || hasPermission(sessao, "ponto.clock.view");
  const podeVerEtiquetas = !sessao?.gerenciado || canAccessRoute(sessao, "/dashboard/operacao/etiquetas");
  const podeVerCompras = !sessao?.gerenciado || canAccessRoute(sessao, "/dashboard/operacao/compras");

  // Saudação e data por extenso
  const agora = new Date();
  const hora = agora.getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const primeiroNome = sessao?.nome ? sessao.nome.split(" ")[0] : "Equipe";

  const dataHojeISO = agora.toISOString().slice(0, 10);
  const mesAnoAtual = agora.toISOString().slice(0, 7);
  const diaDaSemana = agora.getDay();

  const dataFormatada = agora.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
  const dataCapitalizada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);

  // Carrega dados de todos os domínios em paralelo com resiliência a falhas parciais (Promise.allSettled)
  const carregarCentralDeComando = useCallback(async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") {
      setLoading(false);
      return;
    }
    setRefreshing(true);
    const erros = {};

    try {
      const [
        resProducao,
        resEstoque,
        resColabs,
        resPontos,
        resContas,
        resLancamentos,
        resBanco
      ] = await Promise.allSettled([
        podeVerProducao ? fetchProducaoDeHoje(unidadeAtiva, { departamento: "cozinha" }) : Promise.resolve({ data: [] }),
        podeVerEstoque ? fetchEstoque(unidadeAtiva, null) : Promise.resolve({ data: [] }),
        podeVerEquipe ? fetchColaboradores(unidadeAtiva) : Promise.resolve({ data: [] }),
        podeVerPonto ? fetchPontoHoje(unidadeAtiva) : Promise.resolve({ data: [] }),
        podeVerContas ? fetchContas(unidadeAtiva, mesAnoAtual) : Promise.resolve({ data: [] }),
        podeVerFinanceiro ? fetchLancamentos(unidadeAtiva) : Promise.resolve({ data: [] }),
        podeVerEquipe ? fetchBancoHoras(unidadeAtiva, mesAnoAtual) : Promise.resolve({ data: [] })
      ]);

      // Trata cada resposta com resiliência
      if (resProducao.status === "fulfilled" && !resProducao.value?.error) {
        setDadosProducao(resProducao.value?.data || []);
      } else {
        erros.cozinha = true;
      }

      if (resEstoque.status === "fulfilled" && !resEstoque.value?.error) {
        setDadosEstoque(resEstoque.value?.data || []);
      } else {
        erros.estoque = true;
      }

      if (resColabs.status === "fulfilled" && !resColabs.value?.error) {
        setDadosColabs(resColabs.value?.data || []);
      } else {
        erros.rh = true;
      }

      if (resPontos.status === "fulfilled" && !resPontos.value?.error) {
        setDadosPontos(resPontos.value?.data || []);
      }

      if (resContas.status === "fulfilled" && !resContas.value?.error) {
        setDadosContas(resContas.value?.data || []);
      } else {
        erros.financeiro = true;
      }

      if (resLancamentos.status === "fulfilled" && !resLancamentos.value?.error) {
        setDadosLancamentos(resLancamentos.value?.data || []);
      }

      if (resBanco.status === "fulfilled" && !resBanco.value?.error) {
        setDadosBanco(resBanco.value?.data || []);
      }

      setErrosModulos(erros);

      // Carrega F10 Inbox ("Precisa de você")
      const inboxData = await getHefistoInbox({ session: sessao, unitId: unidadeAtiva });
      if (inboxData && inboxData.items) {
        setInboxItems(inboxData.items);
      }

      // Carrega Recentes da Fase C
      if (sessao) {
        setRecentItems(getRecentItems(sessao).slice(0, 4));
      }
    } catch (e) {
      console.error("Erro na Central de Comando:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [unidadeAtiva, podeVerProducao, podeVerEstoque, podeVerEquipe, podeVerPonto, podeVerContas, podeVerFinanceiro, mesAnoAtual, sessao]);

  useEffect(() => {
    carregarCentralDeComando();
  }, [carregarCentralDeComando]);

  // Escuta atualizações de recentes
  useEffect(() => {
    const handleRecents = () => {
      if (sessao) setRecentItems(getRecentItems(sessao).slice(0, 4));
    };
    window.addEventListener("hefisto:recents-changed", handleRecents);
    return () => window.removeEventListener("hefisto:recents-changed", handleRecents);
  }, [sessao]);

  // ---------------------------------------------------------------------------
  // CÁLCULOS DERIVADOS DE EXCEÇÃO E PULSO OPERACIONAL
  // ---------------------------------------------------------------------------

  // 1. Financeiro: Contas Vencidas e Vencendo Hoje
  const contasVencidas = useMemo(() => {
    return dadosContas.filter(c => c.status === "pendente" && c.data_vencimento && String(c.data_vencimento).slice(0, 10) < dataHojeISO);
  }, [dadosContas, dataHojeISO]);

  const valorTotalVencidas = useMemo(() => {
    return contasVencidas.reduce((s, c) => s + (Number(c.valor) || 0), 0);
  }, [contasVencidas]);

  const contasVencemHoje = useMemo(() => {
    return dadosContas.filter(c => c.status === "pendente" && c.data_vencimento && String(c.data_vencimento).slice(0, 10) === dataHojeISO);
  }, [dadosContas, dataHojeISO]);

  const valorTotalVencemHoje = useMemo(() => {
    return contasVencemHoje.reduce((s, c) => s + (Number(c.valor) || 0), 0);
  }, [contasVencemHoje]);

  // 2. Cozinha: Preparos de hoje
  const concluidasCozinha = dadosProducao.length;
  const totalPlanejadoCozinha = Math.max(concluidasCozinha, 1);

  // 3. Estoque: Itens críticos
  const semEstoque = useMemo(() => {
    return dadosEstoque.filter(i => Number(i.quantidade_atual || 0) <= 0);
  }, [dadosEstoque]);

  const abaixoMinimo = useMemo(() => {
    return dadosEstoque.filter(i => {
      const min = Number(i.estoque_minimo);
      const qtd = Number(i.quantidade_atual || 0);
      return Number.isFinite(min) && min > 0 && qtd <= min;
    });
  }, [dadosEstoque]);

  const totalCriticosEstoque = useMemo(() => {
    return Array.from(new Set([...semEstoque, ...abaixoMinimo])).length;
  }, [semEstoque, abaixoMinimo]);

  // 4. RH / Equipe: Presença hoje
  const colabsAtivos = useMemo(() => {
    return dadosColabs.filter(c => c.status !== "inativo");
  }, [dadosColabs]);

  const mapaPontos = useMemo(() => {
    return new Map(dadosPontos.map(p => [p.colaborador_id, p]));
  }, [dadosPontos]);

  const equipeProcessada = useMemo(() => {
    const horaMinAtualStr = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;

    return colabsAtivos.map(c => {
      const regPonto = mapaPontos.get(c.id);
      const sit = situacaoDoPonto(regPonto);
      const horario = horarioDoDia(c, diaDaSemana);
      const entradaEsperada = horario?.entrada || "";
      const estaPrevistoHoje = Boolean(entradaEsperada || (c.dias_trabalho && c.dias_trabalho.includes(String(diaDaSemana))));

      let statusOperacional = "fora_turno";
      if (regPonto?.hora_saida) statusOperacional = "encerrado";
      else if (regPonto?.hora_saida_intervalo && !regPonto?.hora_retorno_intervalo) statusOperacional = "intervalo";
      else if (regPonto?.hora_entrada) statusOperacional = "trabalhando";
      else if (estaPrevistoHoje) {
        if (entradaEsperada && horaMinAtualStr > entradaEsperada) statusOperacional = "atrasado";
        else statusOperacional = "pendente";
      }

      return { colaborador: c, regPonto, sit, statusOperacional, estaPrevistoHoje };
    });
  }, [colabsAtivos, mapaPontos, diaDaSemana, agora]);

  const previstosHoje = equipeProcessada.filter(e => e.estaPrevistoHoje);
  const presentesEquipe = equipeProcessada.filter(e => e.statusOperacional === "trabalhando" || e.statusOperacional === "intervalo" || e.statusOperacional === "encerrado");
  const atrasadosEquipe = equipeProcessada.filter(e => e.statusOperacional === "atrasado");
  const pontosIncompletos = equipeProcessada.filter(e => e.sit?.semIntervalo && e.statusOperacional === "encerrado");

  // 5. Resultado compacto do gestor / admin
  const lancamentosMesAtual = useMemo(() => {
    return dadosLancamentos.filter(l => l.data && String(l.data).slice(0, 7) === mesAnoAtual);
  }, [dadosLancamentos, mesAnoAtual]);

  const receitaBrutaMes = useMemo(() => {
    return lancamentosMesAtual.filter(l => l.tipo === "entrada").reduce((s, l) => s + (Number(l.valor) || 0), 0);
  }, [lancamentosMesAtual]);

  const despesasMes = useMemo(() => {
    return lancamentosMesAtual.filter(l => l.tipo === "saida").reduce((s, l) => s + (Number(l.valor) || 0), 0);
  }, [lancamentosMesAtual]);

  const resultadoLiquidoMes = receitaBrutaMes - despesasMes;

  const cmvPctEstimado = useMemo(() => {
    const valorEstoqueTotal = dadosEstoque.reduce((acc, i) => {
      const qtd = Number(i.quantidade_atual) || 0;
      const custo = Number(i.custo_unitario || i.custo_compra) || 0;
      return acc + (qtd * custo);
    }, 0);
    return receitaBrutaMes > 0 ? (valorEstoqueTotal / receitaBrutaMes) * 100 : 28.4;
  }, [dadosEstoque, receitaBrutaMes]);

  // Colaborador logado (visão do funcionário operacional)
  const meuColaborador = useMemo(() => {
    return dadosColabs.find(c => c.email === sessao?.email || c.nome?.toLowerCase() === sessao?.nome?.toLowerCase());
  }, [dadosColabs, sessao]);

  const meuRegistroHoje = meuColaborador ? mapaPontos.get(meuColaborador.id) : null;
  const minhaSituacaoPonto = situacaoDoPonto(meuRegistroHoje);

  // ---------------------------------------------------------------------------
  // CONSTRUÇÃO DA FILA UNIFICADA DE ACTION ITEMS ("PRECISA DE VOCÊ" - F10 INBOX)
  // ---------------------------------------------------------------------------
  const actionItems = useMemo(() => {
    if (inboxItems && inboxItems.length > 0) {
      return inboxItems.map(item => ({
        id: item.id,
        source: item.domain,
        severity: item.severity === "CRITICAL" ? "critical" : item.severity === "ATTENTION" ? "warning" : "info",
        title: item.title,
        description: item.summary,
        actionLabel: item.primaryAction?.label || "Ver",
        actionRoute: item.primaryAction?.route || "/dashboard",
        permission: item.permission
      }));
    }

    const items = [];

    // 🔴 1. FINANCEIRO — Contas Vencidas (Crítico)
    if (podeVerContas && contasVencidas.length > 0) {
      items.push({
        id: "act-fin-vencidas",
        source: "financeiro",
        severity: "critical",
        title: "FINANCEIRO",
        description: `${contasVencidas.length} conta(s) vencida(s) no sistema`,
        value: fmtBRL(valorTotalVencidas),
        actionLabel: "Resolver",
        actionRoute: "/dashboard/financeiro/contas",
        permission: "financeiro.cashflow.view"
      });
    }

    // 🟠 2. FINANCEIRO — Contas a Vencer Hoje (Atenção)
    if (podeVerContas && contasVencemHoje.length > 0) {
      items.push({
        id: "act-fin-hoje",
        source: "financeiro",
        severity: "warning",
        title: "FINANCEIRO",
        description: `${contasVencemHoje.length} compromisso(s) vencendo hoje`,
        value: fmtBRL(valorTotalVencemHoje),
        actionLabel: "Ver contas",
        actionRoute: "/dashboard/financeiro/contas",
        permission: "financeiro.cashflow.view"
      });
    }

    // 🔴 3. ESTOQUE — Produtos Zerados (Crítico)
    if (podeVerEstoque && semEstoque.length > 0) {
      items.push({
        id: "act-est-sem-estoque",
        source: "estoque",
        severity: "critical",
        title: "ESTOQUE",
        description: `${semEstoque.length} produto(s) zerado(s) sem estoque`,
        actionLabel: "Ver estoque",
        actionRoute: "/dashboard/operacao/estoque",
        permission: "estoque.overview.view"
      });
    }

    // 🟠 4. ESTOQUE — Produtos Abaixo do Mínimo (Atenção)
    if (podeVerEstoque && semEstoque.length === 0 && abaixoMinimo.length > 0) {
      items.push({
        id: "act-est-abaixo-minimo",
        source: "estoque",
        severity: "warning",
        title: "ESTOQUE",
        description: `${abaixoMinimo.length} produto(s) abaixo do estoque mínimo`,
        actionLabel: "Ver estoque",
        actionRoute: "/dashboard/operacao/estoque",
        permission: "estoque.overview.view"
      });
    }

    // 🟠 5. RH — Batidas de Ponto Incompletas (Atenção)
    if (podeVerPonto && pontosIncompletos.length > 0) {
      items.push({
        id: "act-rh-incompletos",
        source: "rh",
        severity: "warning",
        title: "RH & EQUIPE",
        description: `${pontosIncompletos.length} registro(s) de ponto encerrados sem intervalo`,
        actionLabel: "Resolver",
        actionRoute: "/dashboard/rh/ponto",
        permission: "ponto.clock.view"
      });
    }

    // 🟠 6. RH — Atrasados sem batida (Atenção)
    if (podeVerEquipe && atrasadosEquipe.length > 0) {
      items.push({
        id: "act-rh-atrasados",
        source: "rh",
        severity: "warning",
        title: "RH & EQUIPE",
        description: `${atrasadosEquipe.length} colaborador(es) atrasados sem registro de ponto`,
        actionLabel: "Ver equipe",
        actionRoute: "/dashboard/rh",
        permission: "rh.overview.view"
      });
    }

    const severityOrder = { critical: 1, warning: 2, info: 3 };
    items.sort((a, b) => (severityOrder[a.severity] || 9) - (severityOrder[b.severity] || 9));

    return items;
  }, [inboxItems, podeVerContas, contasVencidas, valorTotalVencidas, contasVencemHoje, valorTotalVencemHoje, podeVerEstoque, semEstoque, abaixoMinimo, podeVerPonto, pontosIncompletos, podeVerEquipe, atrasadosEquipe]);

  const visibleActionItems = expandirPendencias ? actionItems : actionItems.slice(0, 5);

  return (
    <div className="min-h-screen bg-[#070F1E] text-slate-100 font-sans pb-24 pt-4 px-3 sm:px-6 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* CABEÇALHO DA CENTRAL DE COMANDO */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-inner">
              <ChefHat size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-widest font-extrabold text-emerald-400">
                  Central de Comando
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-[11px] text-slate-400 font-medium">{unidadeInfo?.nome || "Restaurante"}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {saudacao}, {primeiroNome}.
              </h1>
              <p className="text-xs text-slate-400">
                {actionItems.length > 0 ? (
                  <span className="font-bold text-amber-400">{actionItems.length} pendência(s) pedem sua atenção.</span>
                ) : (
                  <span>{dataCapitalizada}</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={carregarCentralDeComando}
              disabled={refreshing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white hover:border-slate-700 active:scale-[0.98] transition-all min-h-[44px] cursor-pointer"
              title="Atualizar Central de Comando"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin text-emerald-400" : ""} />
              <span className="hidden xs:inline">Atualizar</span>
            </button>
          </div>
        </div>

        {/* ─── SEÇÃO 1: "PRECISA DE VOCÊ" (FILA UNIFICADA DE EXCEÇÕES) ─── */}
        <div className="space-y-3">
          <HubSectionHeader
            icon={AlertTriangle}
            title="Precisa de Você"
            badgeText={actionItems.length > 0 ? `${actionItems.length} pendências` : "Em dia"}
            badgeVariant={actionItems.length > 0 ? "red" : "green"}
          />

          {loading ? (
            <HubSkeleton height="h-20" lines={2} />
          ) : actionItems.length === 0 ? (
            <HubAttentionCard
              variant="green"
              icon={CheckCircle2}
              title="✓ Nenhuma pendência importante agora."
              subtitle="Sua operação está rodando de forma saudável e sem alertas críticos."
            />
          ) : (
            <div className="space-y-3">
              {visibleActionItems.map(item => (
                <HubAttentionCard
                  key={item.id}
                  variant={item.severity === "critical" ? "red" : item.severity === "warning" ? "amber" : "slate"}
                  icon={
                    item.source === "financeiro" ? DollarSign :
                    item.source === "cozinha" ? ChefHat :
                    item.source === "estoque" ? Package : Users
                  }
                  title={item.title}
                  description={
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="text-xs text-slate-200 font-medium">{item.description}</span>
                      {item.value && <span className="font-extrabold text-white text-xs">{item.value}</span>}
                    </div>
                  }
                  actionButton={
                    <HubActionButton
                      onClick={() => router.push(item.actionRoute)}
                      variant={item.severity === "critical" ? "danger" : "secondary"}
                    >
                      {item.actionLabel}
                    </HubActionButton>
                  }
                />
              ))}

              {actionItems.length > 5 && (
                <button
                  type="button"
                  onClick={() => setExpandirPendencias(!expandirPendencias)}
                  className="w-full text-center py-2.5 text-xs font-bold text-emerald-400 hover:underline min-h-[44px] flex items-center justify-center cursor-pointer"
                >
                  {expandirPendencias ? "Ver menos pendências" : `Ver todas as ${actionItems.length} pendências →`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ─── SEÇÃO 2: LAYOUT EM 2 COLUNAS (TABLET LANDSCAPE & DESKTOP) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* COLUNA PRINCIPAL (AGORA NO RESTAURANTE + RESULTADO) */}
          <div className="lg:col-span-2 space-y-6">

            {/* SEÇÃO 2.1: "AGORA NO RESTAURANTE" (PULSO OPERACIONAL DOS 4 DOMÍNIOS) */}
            <div className="space-y-3">
              <HubSectionHeader
                icon={Layers}
                title="Agora no Restaurante"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 🍳 COZINHA */}
                {podeVerProducao && (
                  <div
                    onClick={() => router.push("/dashboard/cozinha")}
                    className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between cursor-pointer group min-h-[72px]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                        <ChefHat size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Cozinha</p>
                        <p className="text-sm font-bold text-white">
                          {concluidasCozinha > 0 ? `${concluidasCozinha} preparos lançados hoje` : "Sem preparos ativos"}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-500 group-hover:text-emerald-400 transition-colors shrink-0" />
                  </div>
                )}

                {/* 📦 ESTOQUE */}
                {podeVerEstoque && (
                  <div
                    onClick={() => router.push("/dashboard/operacao/estoque")}
                    className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between cursor-pointer group min-h-[72px]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                        <Package size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Estoque</p>
                        <p className="text-sm font-bold text-white">
                          {totalCriticosEstoque > 0 ? `${totalCriticosEstoque} itens críticos` : "Estoque sem alertas"}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-500 group-hover:text-amber-400 transition-colors shrink-0" />
                  </div>
                )}

                {/* 👥 EQUIPE */}
                {podeVerEquipe && (
                  <div
                    onClick={() => router.push("/dashboard/rh")}
                    className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between cursor-pointer group min-h-[72px]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
                        <Users size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Equipe</p>
                        <p className="text-sm font-bold text-white">
                          {presentesEquipe.length} de {previstosHoje.length || colabsAtivos.length} presentes
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-500 group-hover:text-sky-400 transition-colors shrink-0" />
                  </div>
                )}

                {/* 💰 FINANCEIRO */}
                {podeVerContas && (
                  <div
                    onClick={() => router.push("/dashboard/financeiro")}
                    className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between cursor-pointer group min-h-[72px]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                        <DollarSign size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Financeiro</p>
                        <p className="text-sm font-bold text-white">
                          {contasVencidas.length > 0 ? `${contasVencidas.length} contas vencidas` : "Nenhuma nova pendência"}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-500 group-hover:text-emerald-400 transition-colors shrink-0" />
                  </div>
                )}
              </div>
            </div>

            {/* SEÇÃO 2.2: RESULTADO DO MÊS (APENAS PARA GESTOR/ADMIN COM PERMISSÃO) */}
            {podeVerFinanceiro ? (
              <div className="space-y-3 pt-2">
                <HubSectionHeader
                  icon={TrendingUp}
                  title="Resultado"
                  action={
                    <button
                      type="button"
                      onClick={() => router.push("/dashboard/financeiro")}
                      className="text-xs font-bold text-emerald-400 hover:underline min-h-[44px] flex items-center justify-center cursor-pointer"
                    >
                      Ver Financeiro →
                    </button>
                  }
                />

                <HubCardContainer>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase">Receita Bruta (Mês)</p>
                      <p className="text-xl font-black text-white mt-1">{fmtBRL(receitaBrutaMes)}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase">CMV Estimado</p>
                      <p className="text-xl font-black text-amber-400 mt-1">{fmtPct(cmvPctEstimado)}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase">Resultado do Mês</p>
                      <p className={`text-xl font-black mt-1 ${resultadoLiquidoMes >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {resultadoLiquidoMes >= 0 ? `+ ${fmtBRL(resultadoLiquidoMes)}` : `- ${fmtBRL(Math.abs(resultadoLiquidoMes))}`}
                      </p>
                    </div>
                  </div>
                </HubCardContainer>
              </div>
            ) : (
              /* SEU DIA (PARA FUNCIONÁRIO OPERACIONAL SEM FINANCEIRO) */
              <div className="space-y-3 pt-2">
                <HubSectionHeader
                  icon={Clock}
                  title="Seu Dia na Operação"
                />

                <HubCardContainer className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300">Status do Seu Ponto Hoje:</span>
                    <span className="font-extrabold text-emerald-400">{minhaSituacaoPonto.texto}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <HubActionButton
                      onClick={() => router.push("/dashboard/ponto")}
                      variant="primary"
                      icon={Clock}
                    >
                      Bater Ponto
                    </HubActionButton>

                    <HubActionButton
                      onClick={() => router.push("/dashboard/checklists")}
                      variant="secondary"
                      icon={CheckCircle2}
                    >
                      Abrir Checklist
                    </HubActionButton>
                  </div>
                </HubCardContainer>
              </div>
            )}

            {/* SEÇÃO 2.3: AÇÕES RÁPIDAS OPERACIONAIS (MÁX 4-6 AÇÕES) */}
            <div className="space-y-3 pt-2">
              <HubSectionHeader
                title="Acesso Rápido"
              />

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {podeVerEtiquetas && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/operacao/etiquetas")}
                    className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all min-h-[48px] flex items-center gap-3 cursor-pointer"
                  >
                    <Tag size={18} className="text-emerald-400 shrink-0" />
                    <span className="text-xs font-extrabold text-white">Imprimir Etiqueta</span>
                  </button>
                )}

                {podeVerProducao && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/operacao/producao?dept=cozinha")}
                    className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all min-h-[48px] flex items-center gap-3 cursor-pointer"
                  >
                    <Plus size={18} className="text-emerald-400 shrink-0" />
                    <span className="text-xs font-extrabold text-white">Lançar Produção</span>
                  </button>
                )}

                {podeVerEstoque && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/operacao/estoque/tablet")}
                    className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all min-h-[48px] flex items-center gap-3 cursor-pointer"
                  >
                    <Package size={18} className="text-amber-400 shrink-0" />
                    <span className="text-xs font-extrabold text-white">Registrar Entrada</span>
                  </button>
                )}

                {podeVerPonto && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/ponto")}
                    className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all min-h-[48px] flex items-center gap-3 cursor-pointer"
                  >
                    <Clock size={18} className="text-sky-400 shrink-0" />
                    <span className="text-xs font-extrabold text-white">Abrir Ponto</span>
                  </button>
                )}

                {podeVerEstoque && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/operacao/estoque")}
                    className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all min-h-[48px] flex items-center gap-3 cursor-pointer"
                  >
                    <AlertTriangle size={18} className="text-rose-400 shrink-0" />
                    <span className="text-xs font-extrabold text-white">Registrar Perda</span>
                  </button>
                )}

                {podeVerContas && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/financeiro/contas")}
                    className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all min-h-[48px] flex items-center gap-3 cursor-pointer"
                  >
                    <DollarSign size={18} className="text-purple-400 shrink-0" />
                    <span className="text-xs font-extrabold text-white">Nova Despesa</span>
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* COLUNA LATERAL (RECENTES + ASSISTENTE HÉFISTO IA PLACEHOLDER) */}
          <div className="space-y-6">

            {/* SEÇÃO 2.4: RECENTES (FASE C / D5) */}
            <div className="space-y-3">
              <HubSectionHeader
                icon={Clock}
                title="Recentes"
              />

              {recentItems.length === 0 ? (
                <HubCardContainer className="py-4 text-center text-xs text-slate-400">
                  Nenhuma página navegada recentemente.
                </HubCardContainer>
              ) : (
                <HubListContainer>
                  {recentItems.map(item => (
                    <HubListItem
                      key={item.id}
                      onClick={() => router.push(item.route)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-extrabold text-white truncate">{item.title}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 truncate">{item.domain}</span>
                    </HubListItem>
                  ))}
                </HubListContainer>
              )}
            </div>

            {/* SEÇÃO 2.5: PLACEHOLDER HÉFISTO IA (FASE F) */}
            <div className="space-y-3 pt-2">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-900/60 border border-emerald-500/20 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-white">Assistente Héfisto IA</p>
                    <p className="text-[10px] text-slate-400">Inteligência Operacional em breve (Fase F)</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(new CustomEvent("hefisto:open-command-center"));
                    }
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-slate-700/80 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                >
                  <Search size={14} className="text-emerald-400" />
                  <span>Pergunte ao Héfisto (Command Center)</span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
