"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChefHat, Package, Users, DollarSign, AlertTriangle, CheckCircle2,
  Clock, Sparkles, ArrowRight, Plus, Tag, RefreshCw, FileText,
  TrendingUp, ShoppingCart, ShieldCheck, ChevronRight, Layers, Lock,
  Calendar, Coffee, CreditCard, PieChart, Search, Scale, AlertCircle, ArrowUpRight, ArrowDownLeft, XCircle
} from "lucide-react";
import { useERP } from "../context/ERPContext";
import { fetchEstoque } from "../lib/estoque";
import { fetchContas, fetchLancamentos } from "../lib/financeiro";
import { fetchContasReceber } from "../lib/recebiveis";
import { fetchCentralDeComandoResumo } from "../lib/central-comando";
import { 
  arredondar2, 
  avaliarSinaisEstoque, 
  avaliarSinaisFinanceiros, 
  analisarImpactoCustoInsumo, 
  simularPrecoVendaAlvo 
} from "../lib/sinais-domain";
import { hasPermission, canAccessRoute } from "../lib/permissions-catalog.mjs";

export default function CentralDeComandoHome() {
  const router = useRouter();
  const { sessao, unidadeAtiva, unidadeInfo } = useERP();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dados do Resumo Agregado
  const [resumoCentral, setResumoCentral] = useState(null);
  const [dadosEstoque, setDadosEstoque] = useState([]);
  const [dadosContasPagar, setDadosContasPagar] = useState([]);
  const [dadosContasReceber, setDadosContasReceber] = useState([]);

  // Modal Impacto Custo Insumo
  const [modalImpacto, setModalImpacto] = useState(false);
  const [impactoInsumo, setImpactoInsumo] = useState(null);

  // Modal Simulador de Preço
  const [modalSimulador, setModalSimulador] = useState(false);
  const [simulacaoPrato, setSimulacaoPrato] = useState({ nome: 'Picanha Grelhada Especial', custo: 42.00, vendaAtual: 89.90, cmvAlvo: 35.0 });

  // Permissões de Perfil
  const podeVerFinanceiro = !sessao?.gerenciado || hasPermission(sessao, "dashboard.overview.view_values") || hasPermission(sessao, "financeiro.cashflow.view");
  const podeVerEstoque = !sessao?.gerenciado || canAccessRoute(sessao, "/dashboard/operacao/estoque");
  const podeVerProducao = !sessao?.gerenciado || canAccessRoute(sessao, "/dashboard/operacao/producao");
  const podeVerCompras = !sessao?.gerenciado || canAccessRoute(sessao, "/dashboard/operacao/compras");

  const agora = new Date();
  const hora = agora.getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const primeiroNome = sessao?.nome ? sessao.nome.split(" ")[0] : "Gestor";

  const dataFormatada = agora.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
  const dataCapitalizada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);

  const carregarCentral = useCallback(async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") {
      setLoading(false);
      return;
    }
    setRefreshing(true);

    try {
      const [res, { data: est }, { data: cp }, rec] = await Promise.all([
        fetchCentralDeComandoResumo(unidadeAtiva, podeVerFinanceiro),
        fetchEstoque(unidadeAtiva, null),
        podeVerFinanceiro ? fetchContas(unidadeAtiva) : Promise.resolve({ data: [] }),
        podeVerFinanceiro ? fetchContasReceber(unidadeAtiva) : Promise.resolve([])
      ]);

      setResumoCentral(res);
      setDadosEstoque(est || []);
      setDadosContasPagar(cp || []);
      setDadosContasReceber(rec || []);
    } catch (err) {
      console.error("Erro ao carregar Central de Comando:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [unidadeAtiva, podeVerFinanceiro]);

  useEffect(() => {
    carregarCentral();
  }, [carregarCentral]);

  // Geração de Sinais de Decisão
  const sinaisAtivos = useMemo(() => {
    const sinaisEstoque = avaliarSinaisEstoque(dadosEstoque);
    const sinaisFin = podeVerFinanceiro ? avaliarSinaisFinanceiros(dadosContasPagar, dadosContasReceber) : [];

    // Exemplo de Insight de Custo que Subiu (Picanha +11.4%)
    const sinalCusto = {
      id: 'cost-picanha-increase',
      tipo_sinal: 'COST_INCREASE',
      severidade: 'ATENCAO',
      titulo: 'Custo da Picanha subiu 11,4%',
      descricao: 'De R$ 72,00/kg para R$ 80,20/kg. Afeta 8 fichas técnicas.',
      entidade_tipo: 'insumo',
      acao_rotulo: 'Ver Impacto',
      onAction: () => {
        const imp = analisarImpactoCustoInsumo({
          insumoId: 'ins-picanha',
          insumoNome: 'Picanha Grill',
          precoAnterior: 72.00,
          precoAtual: 80.20,
          fichasTecnicas: [
            { id: 'f1', nome_receita: 'Picanha Grelhada 300g', custo_total: 21.60, fichas_ingredientes: [{ insumo_id: 'ins-picanha', quantidade: 0.3 }] },
            { id: 'f2', nome_receita: 'Espetinho Picanha', custo_total: 14.40, fichas_ingredientes: [{ insumo_id: 'ins-picanha', quantidade: 0.2 }] }
          ]
        });
        setImpactoInsumo(imp);
        setModalImpacto(true);
      }
    };

    return [...sinaisFin, ...sinaisEstoque, sinalCusto];
  }, [dadosEstoque, dadosContasPagar, dadosContasReceber, podeVerFinanceiro]);

  const simulacaoCalculada = useMemo(() => {
    return simularPrecoVendaAlvo(simulacaoPrato.custo, simulacaoPrato.cmvAlvo);
  }, [simulacaoPrato]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ─── TOPO DA CENTRAL DE COMANDO ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 rounded-full uppercase tracking-wider">
              {unidadeInfo?.nome || "Restaurante Matriz"}
            </span>
            <span className="text-xs text-slate-400">• {dataCapitalizada}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            {saudacao}, {primeiroNome}!
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Central de Comando Operacional • O que precisa da sua atenção agora.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={carregarCentral}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>

      {/* ─── BLOCO 1: PRECISA DA SUA ATENÇÃO (AÇÕES CONTEXTUAIS OBRIGATÓRIAS) ───── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Precisa da Sua Atenção Agora ({sinaisAtivos.length})
          </h2>
          <span className="text-xs text-slate-400">Priorizado por Severidade Operacional</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sinaisAtivos.map((sinal) => (
            <div
              key={sinal.id}
              className={`p-4 rounded-xl border flex flex-col justify-between transition shadow-sm ${
                sinal.severidade === "CRITICO"
                  ? "bg-rose-50/70 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/50"
                  : sinal.severidade === "ATENCAO"
                  ? "bg-amber-50/70 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50"
                  : "bg-blue-50/70 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      sinal.severidade === "CRITICO"
                        ? "bg-rose-600 animate-pulse"
                        : sinal.severidade === "ATENCAO"
                        ? "bg-amber-500"
                        : "bg-blue-500"
                    }`}
                  />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">{sinal.titulo}</h3>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {sinal.severidade}
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 my-2">{sinal.descricao}</p>

              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => {
                    if (sinal.onAction) sinal.onAction();
                    else if (sinal.acao_url) router.push(sinal.acao_url);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 transition shadow-sm"
                >
                  {sinal.acao_rotulo || "Ver Detalhes"}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── BLOCO 2: OPERAÇÃO DE HOJE ───────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-emerald-600" />
          Operação de Hoje
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card Produção */}
          <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Produção do Dia</span>
              <button
                onClick={() => router.push("/dashboard/operacao/producao")}
                className="text-xs text-emerald-600 font-semibold hover:underline"
              >
                Ver Produção →
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <p className="text-xs text-slate-500">Concluídas</p>
                <p className="text-xl font-bold text-emerald-600">{resumoCentral?.operacional?.producoes_concluidas_hoje || 0}</p>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <p className="text-xs text-slate-500">Pendentes</p>
                <p className="text-xl font-bold text-amber-600">{resumoCentral?.operacional?.producoes_pendentes_hoje || 0}</p>
              </div>
            </div>
          </div>

          {/* Card Compras */}
          <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Compras & Pedidos</span>
              <button
                onClick={() => router.push("/dashboard/operacao/compras")}
                className="text-xs text-emerald-600 font-semibold hover:underline"
              >
                Ver Compras →
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <p className="text-xs text-slate-500">Abaixo do Mínimo</p>
                <p className="text-xl font-bold text-rose-600">{resumoCentral?.operacional?.estoque_abaixo_minimo || 0}</p>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <p className="text-xs text-slate-500">Pedidos Pendentes</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{resumoCentral?.operacional?.compras_pendentes || 0}</p>
              </div>
            </div>
          </div>

          {/* Card Estoque Crítico */}
          <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Estoque & Saldo</span>
              <button
                onClick={() => router.push("/dashboard/operacao/estoque")}
                className="text-xs text-emerald-600 font-semibold hover:underline"
              >
                Ver Estoque →
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <p className="text-xs text-slate-500">Sem Saldo (Zero)</p>
                <p className="text-xl font-bold text-rose-600">{resumoCentral?.operacional?.estoque_sem_saldo || 0}</p>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <p className="text-xs text-slate-500">Total Itens</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{dadosEstoque.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── BLOCO 3: FINANCEIRO & VENDAS ─────────────────────────────────────── */}
      {podeVerFinanceiro && (
        <div className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-indigo-600" />
            Financeiro & Entradas de Hoje
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Vendas Hoje (Bruto)</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                R$ {resumoCentral?.financeiro?.vendas_hoje_bruto?.toFixed(2) || "0.00"}
              </p>
              <p className="text-xs text-slate-400 mt-1">{resumoCentral?.financeiro?.vendas_hoje_qtd || 0} vendas registradas</p>
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-500">Contas Atrasadas</p>
              <p className="text-2xl font-bold text-rose-600 mt-1">
                R$ {resumoCentral?.financeiro?.contas_vencidas_valor?.toFixed(2) || "0.00"}
              </p>
              <button
                onClick={() => router.push("/dashboard/financeiro/contas?status=VENCIDA")}
                className="text-xs text-rose-600 hover:underline mt-1 font-semibold block"
              >
                Cuidar das Contas →
              </button>
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-500">Contas Vencem Hoje</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                R$ {resumoCentral?.financeiro?.contas_vencem_hoje_valor?.toFixed(2) || "0.00"}
              </p>
              <button
                onClick={() => router.push("/dashboard/financeiro/contas")}
                className="text-xs text-amber-600 hover:underline mt-1 font-semibold block"
              >
                Pagar Contas →
              </button>
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Recebíveis Divergentes</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                R$ {resumoCentral?.financeiro?.recebiveis_divergentes_valor?.toFixed(2) || "0.00"}
              </p>
              <button
                onClick={() => router.push("/dashboard/financeiro/conciliacao")}
                className="text-xs text-blue-600 hover:underline mt-1 font-semibold block"
              >
                Conciliar →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── BLOCO 4: FERRAMENTAS DE MARGEM & SIMULADOR DE PREÇO ─────────────── */}
      <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 bg-indigo-500/30 text-indigo-300 rounded-full">
            Simulador de Margem & CMV Alvo
          </span>
          <h3 className="text-lg font-bold mt-2">Proteja o Lucro do Seu Cardápio</h3>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Simule o preço de venda ideal quando o custo de ingredientes subir, sem alterar o sistema automaticamente.
          </p>
        </div>

        <button
          onClick={() => setModalSimulador(true)}
          className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2 flex-shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          Abrir Simulador de Preço
        </button>
      </div>

      {/* Modal Impacto de Custo em Cadeia */}
      {modalImpacto && impactoInsumo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border space-y-4">
            <div className="flex justify-between items-center border-b pb-3 border-slate-200 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Impacto de Aumento: {impactoInsumo.insumoNome}
              </h3>
              <button onClick={() => setModalImpacto(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
              <p className="font-bold">Variação de Preço do Insumo:</p>
              <p>
                R$ {impactoInsumo.precoAnterior.toFixed(2)}/kg → <span className="font-bold text-rose-600">R$ {impactoInsumo.precoAtual.toFixed(2)}/kg</span> (+{impactoInsumo.percentualAumento}%)
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Pratos e Fichas Afetadas ({impactoInsumo.quantidadeFichasAfetadas})</p>
              <div className="divide-y max-h-48 overflow-y-auto border rounded-lg p-2 text-xs">
                {impactoInsumo.fichasAfetadas.map((f) => (
                  <div key={f.fichaId} className="py-2 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{f.nomeReceita}</p>
                      <p className="text-slate-400 text-[11px]">Custo anterior: R$ {f.custoAnteriorPrato.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-rose-600">+ R$ {f.aumentoNoPrato.toFixed(2)}</p>
                      <p className="font-semibold text-slate-700 dark:text-slate-300">Novo: R$ {f.novoCustoPrato.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end border-t pt-3">
              <button
                onClick={() => setModalImpacto(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Simulador de Preço */}
      {modalSimulador && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border space-y-4">
            <h3 className="text-base font-bold border-b pb-3 text-slate-900 dark:text-white">Simulador de Preço Venda</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Custo Atual do Prato (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={simulacaoPrato.custo}
                  onChange={(e) => setSimulacaoPrato({ ...simulacaoPrato, custo: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">CMV Alvo Desejado (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={simulacaoPrato.cmvAlvo}
                  onChange={(e) => setSimulacaoPrato({ ...simulacaoPrato, cmvAlvo: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg font-bold"
                />
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-900 dark:text-emerald-200">
                <p className="text-[11px] uppercase tracking-wider font-bold">Preço de Venda Sugerido:</p>
                <p className="text-2xl font-extrabold mt-1">R$ {simulacaoCalculada.precoSugerido.toFixed(2)}</p>
                <p className="text-[11px] mt-1 text-slate-500">
                  Para manter o CMV em {simulacaoPrato.cmvAlvo}%, o valor recomendado de venda é R$ {simulacaoCalculada.precoSugerido.toFixed(2)}.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3 border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setModalSimulador(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
              >
                Fechar Simulador
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
