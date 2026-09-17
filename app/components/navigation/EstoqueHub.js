"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Package, AlertTriangle, ArrowRight, ShoppingCart,
  Plus, Minus, ClipboardCheck, Search, Tag, Truck, Box, Sparkles,
  CheckCircle2, DollarSign, TrendingUp, History, FileText, ArrowUpRight,
  ChevronRight, Layers, Lock
} from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { fetchEstoque, fetchMovimentosEstoque } from "../../lib/estoque";
import { canAccessRoute, hasPermission } from "../../lib/permissions-catalog.mjs";
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

export default function EstoqueHub({ onVerTabelaCompleta, onAbrirEntrada, onAbrirSaida }) {
  const router = useRouter();
  const { sessao, unidadeAtiva, unidadeInfo } = useERP();

  // Estados dos dados reais
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [insumos, setInsumos] = useState([]);
  const [movimentos, setMovimentos] = useState([]);

  // Permissões Financeiras e Operacionais
  const podeVerCustos = !sessao?.gerenciado || hasPermission(sessao, "estoque.products.view_costs") || hasPermission(sessao, "estoque.overview.view_values");
  const podeMovimentar = !sessao?.gerenciado || hasPermission(sessao, "estoque.operation.adjust_stock") || canAccessRoute(sessao, "/dashboard/operacao/estoque/tablet");
  const podeVerCompras = !sessao?.gerenciado || canAccessRoute(sessao, "/dashboard/operacao/compras");
  const podeVerInventario = !sessao?.gerenciado || canAccessRoute(sessao, "/dashboard/gestao/inventario");

  // Data formatada
  const agora = new Date();
  const dataFormatada = agora.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
  const dataCapitalizada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);

  // Carrega dados reais de estoque e movimentações
  const carregarDadosEstoque = useCallback(async () => {
    if (!unidadeAtiva) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Busca estoque físico real
      const { data: dataInsumos, error: errInsumos } = await fetchEstoque(unidadeAtiva, null);
      if (errInsumos) {
        setError(errInsumos);
      } else {
        setInsumos(dataInsumos || []);
      }

      // 2. Busca movimentações recentes (últimos 5 movimentos reais)
      const { data: dataMovs } = await fetchMovimentosEstoque(unidadeAtiva, null, 5);
      setMovimentos(dataMovs || []);
    } catch (e) {
      setError(e.message || "Falha ao carregar dados do estoque");
    } finally {
      setLoading(false);
    }
  }, [unidadeAtiva]);

  useEffect(() => {
    carregarDadosEstoque();
  }, [carregarDadosEstoque]);

  // Cálculos Operacionais Dinâmicos baseados no modelo real
  const semEstoque = insumos.filter(i => Number(i.quantidade_atual || 0) <= 0);
  const abaixoMinimo = insumos.filter(i => {
    const min = Number(i.estoque_minimo);
    const qtd = Number(i.quantidade_atual || 0);
    return Number.isFinite(min) && min > 0 && qtd <= min;
  });

  // Produtos que precisam de compra (sem estoque ou abaixo do mínimo)
  const itensParaComprar = Array.from(new Set([...semEstoque, ...abaixoMinimo]));

  // Ordena itens críticos por percentual de falta (quantidade_atual / estoque_minimo)
  const criticosOrdenados = [...itensParaComprar].sort((a, b) => {
    const ratioA = (Number(a.quantidade_atual || 0)) / (Number(a.estoque_minimo) || 1);
    const ratioB = (Number(b.quantidade_atual || 0)) / (Number(b.estoque_minimo) || 1);
    return ratioA - ratioB;
  }).slice(0, 6);

  // Estimativa de valor de reposição em R$ (se usuário puder ver custos)
  const custoReposicaoTotal = itensParaComprar.reduce((acc, item) => {
    const min = Number(item.estoque_minimo) || 1;
    const qtd = Number(item.quantidade_atual) || 0;
    const faltam = Math.max(0, min - qtd);
    const custo = Number(item.custo_unitario || item.custo_compra) || 0;
    return acc + (faltam * custo);
  }, 0);

  return (
    <div className="min-h-screen bg-[#070F1E] text-slate-100 font-sans pb-24 pt-4 px-3 sm:px-6 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* CABEÇALHO PADRONIZADO */}
        <HubHeader
          icon={Package}
          domainTag="Central de Decisão"
          unitName={unidadeInfo?.nome || "Estoque Geral"}
          title="Estoque & Compras"
          subtitle={dataCapitalizada}
          onRefresh={carregarDadosEstoque}
          isRefreshing={loading}
          primaryActionButton={
            <HubActionButton
              onClick={onVerTabelaCompleta}
              variant="primary"
              icon={ArrowRight}
            >
              Ver Tabela Completa
            </HubActionButton>
          }
        />

        {/* 1. SEÇÃO ATENÇÃO AGORA: MÉTRICAS DE EXCEÇÃO REAIS */}
        <div className="space-y-3">
          <HubSectionHeader
            icon={AlertTriangle}
            title="Atenção Agora no Estoque"
            badgeText="Tempo real"
            badgeVariant="amber"
          />

          {loading ? (
            <HubSkeleton height="h-20" lines={1} />
          ) : error ? (
            <HubErrorState
              message="Não foi possível carregar os alertas do estoque."
              onRetry={carregarDadosEstoque}
            />
          ) : itensParaComprar.length === 0 ? (
            <HubAttentionCard
              variant="green"
              icon={CheckCircle2}
              title="✓ Estoque sem itens críticos."
              subtitle="Todos os insumos cadastrados estão acima do nível de segurança."
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* 🔴 Sem Estoque */}
              <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-900/60 flex flex-col justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400">Sem Estoque</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-black text-rose-200">{semEstoque.length}</span>
                  <span className="text-[10px] text-rose-400/80">produtos</span>
                </div>
              </div>

              {/* 🟠 Abaixo do Mínimo */}
              <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-900/60 flex flex-col justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">Abaixo do Mínimo</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-black text-amber-200">{abaixoMinimo.length}</span>
                  <span className="text-[10px] text-amber-400/80">itens</span>
                </div>
              </div>

              {/* 🛒 Precisa Comprar */}
              <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-900/60 flex flex-col justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">Sugeridos p/ Compra</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-black text-emerald-200">{itensParaComprar.length}</span>
                  <span className="text-[10px] text-emerald-400/80">reposições</span>
                </div>
              </div>

              {/* 💰 Estimativa de Reposição */}
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Est. Reposição</span>
                <div className="mt-1">
                  {podeVerCustos ? (
                    <span className="text-lg sm:text-xl font-black text-white">
                      R$ {custoReposicaoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                      <Lock size={12} /> Restrito
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* COMPOSIÇÃO LANDSCAPE / PORTRAIT DE ESTOQUE */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* COLUNA PRINCIPAL (2 LARGURAS EM LANDSCAPE) */}
          <div className="lg:col-span-2 space-y-6">

            {/* SEÇÃO 2: ESTOQUE CRÍTICO (TOP PRODUTOS ORDENADOS POR CRITICIDADE) */}
            <div className="space-y-3">
              <HubSectionHeader
                icon={Package}
                title="Insumos com Estoque Crítico"
                action={
                  <button
                    type="button"
                    onClick={onVerTabelaCompleta}
                    className="text-xs font-bold text-emerald-400 hover:underline min-h-[44px] flex items-center justify-center cursor-pointer"
                  >
                    Ver todos os {insumos.length} produtos →
                  </button>
                }
              />

              {loading ? (
                <HubSkeleton height="h-16" lines={3} />
              ) : criticosOrdenados.length === 0 ? (
                <HubAttentionCard
                  variant="green"
                  icon={CheckCircle2}
                  title="Nenhum produto com saldo em nível de risco."
                  subtitle="O saldo de todos os insumos está em nível seguro."
                />
              ) : (
                <HubListContainer>
                  {criticosOrdenados.map((item) => {
                    const qtd = Number(item.quantidade_atual || 0);
                    const min = Number(item.estoque_minimo) || 1;
                    const percentual = Math.min(100, Math.max(0, Math.round((qtd / min) * 100)));
                    const eZero = qtd <= 0;

                    return (
                      <HubListItem key={item.id}>
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            eZero ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-400"
                          }`}>
                            <AlertTriangle size={18} />
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs sm:text-sm font-bold truncate">{item.nome}</span>
                              {item.marca && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                                  {item.marca}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400">
                              Atual: <strong className={eZero ? "text-rose-400" : "text-amber-300"}>{qtd} {item.unidade_medida}</strong> • Mínimo desejado: {min} {item.unidade_medida}
                            </span>
                          </div>
                        </div>

                        {/* Indicador Proporcional */}
                        <div className="w-full sm:w-36 flex flex-col gap-1 shrink-0">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className={eZero ? "text-rose-400" : "text-amber-400"}>
                              {eZero ? "ZERADO" : `${percentual}% do mínimo`}
                            </span>
                          </div>
                          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                            <div
                              className={`h-full rounded-full transition-all ${eZero ? "bg-rose-500" : "bg-amber-500"}`}
                              style={{ width: `${percentual}%` }}
                            />
                          </div>
                        </div>
                      </HubListItem>
                    );
                  })}
                </HubListContainer>
              )}
            </div>

            {/* SEÇÃO 3: AÇÕES RÁPIDAS OPERACIONAIS */}
            <div className="space-y-3 pt-2">
              <HubSectionHeader
                title="Ações Rápidas de Estoque"
              />

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {podeMovimentar && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onAbrirEntrada) onAbrirEntrada();
                      else router.push("/dashboard/operacao/estoque/tablet");
                    }}
                    className="flex flex-col items-start p-3.5 rounded-xl bg-slate-900/80 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/50 text-slate-100 transition-all text-left group min-h-[72px] justify-between cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                      <Plus size={20} />
                    </div>
                    <span className="text-xs font-bold leading-tight">➕ Entrada de Estoque</span>
                    <span className="text-[10px] text-slate-400">Recebimento de carga</span>
                  </button>
                )}

                {podeMovimentar && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onAbrirSaida) onAbrirSaida();
                      else router.push("/dashboard/operacao/estoque/tablet");
                    }}
                    className="flex flex-col items-start p-3.5 rounded-xl bg-slate-900/80 hover:bg-amber-950/40 border border-slate-800 hover:border-amber-500/50 text-slate-100 transition-all text-left group min-h-[72px] justify-between cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                      <Minus size={20} />
                    </div>
                    <span className="text-xs font-bold leading-tight">➖ Baixa / Saída</span>
                    <span className="text-[10px] text-slate-400">Consumo da cozinha</span>
                  </button>
                )}

                {podeVerCompras && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/operacao/compras?dept=cozinha")}
                    className="flex flex-col items-start p-3.5 rounded-xl bg-slate-900/80 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/50 text-slate-100 transition-all text-left group min-h-[72px] justify-between cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                      <ShoppingCart size={20} />
                    </div>
                    <span className="text-xs font-bold leading-tight">🛒 Pedidos de Compras</span>
                    <span className="text-[10px] text-slate-400">Cotação & Fornecedores</span>
                  </button>
                )}

                {podeMovimentar && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/operacao/estoque")}
                    className="flex flex-col items-start p-3.5 rounded-xl bg-slate-900/80 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/50 text-slate-100 transition-all text-left group min-h-[72px] justify-between cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                      <AlertTriangle size={20} />
                    </div>
                    <span className="text-xs font-bold leading-tight">⚠ Registrar Perda</span>
                    <span className="text-[10px] text-slate-400">Validades & Avarias</span>
                  </button>
                )}

                {podeVerInventario && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/gestao/inventario")}
                    className="flex flex-col items-start p-3.5 rounded-xl bg-slate-900/80 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/50 text-slate-100 transition-all text-left group min-h-[72px] justify-between cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-slate-800 text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                      <ClipboardCheck size={20} />
                    </div>
                    <span className="text-xs font-bold leading-tight">📋 Inventário Físico</span>
                    <span className="text-[10px] text-slate-400">Contagem de Estoque</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onVerTabelaCompleta}
                  className="flex flex-col items-start p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-100 transition-all text-left group min-h-[72px] justify-between cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <Search size={20} />
                  </div>
                  <span className="text-xs font-bold leading-tight">🔎 Consultar Produto</span>
                  <span className="text-[10px] text-slate-400">Busca completa</span>
                </button>
              </div>
            </div>

          </div>

          {/* COLUNA LATERAL (MOVIMENTAÇÕES RECENTES + SUGESTÃO DE REPOSIÇÃO + FERRAMENTAS) */}
          <div className="space-y-6">

            {/* SEÇÃO 4: SUGESTÃO DE REPOSIÇÃO */}
            {podeVerCompras && (
              <div className="space-y-3">
                <HubSectionHeader
                  icon={ShoppingCart}
                  title="Sugestão de Reposição"
                />

                <HubCardContainer className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">Itens Atrasados / Abaixo do Mínimo</span>
                    <span className="font-bold text-emerald-400">{itensParaComprar.length} sugeridos</span>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    O sistema identifica automaticamente os insumos que atingiram o limite mínimo de segurança para rápida geração de pedidos.
                  </p>

                  <HubActionButton
                    onClick={() => router.push("/dashboard/operacao/compras?dept=cozinha")}
                    variant="primary"
                    icon={ArrowRight}
                    fullWidth
                  >
                    Revisar Lista de Compras
                  </HubActionButton>
                </HubCardContainer>
              </div>
            )}

            {/* SEÇÃO 5: MOVIMENTAÇÕES RECENTES */}
            <div className="space-y-3 pt-2">
              <HubSectionHeader
                icon={History}
                title="Movimentações Recentes"
              />

              {movimentos.length === 0 ? (
                <HubCardContainer className="py-4 text-center text-xs text-slate-400">
                  Nenhuma movimentação registrada recentemente.
                </HubCardContainer>
              ) : (
                <HubListContainer>
                  {movimentos.map(mov => {
                    const eEntrada = mov.tipo === "entrada";
                    const nomeInsumo = mov.insumo?.nome || "Produto";
                    const qtd = Number(mov.quantidade_unidades) || 0;
                    const resp = mov.responsavel || "Sistema";
                    const horaFmt = new Date(mov.data_movimento || mov.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

                    return (
                      <HubListItem key={mov.id}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            eEntrada ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
                          }`}>
                            {eEntrada ? <Plus size={14} /> : <Minus size={14} />}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-white truncate text-xs">{nomeInsumo}</span>
                            <span className="text-[10px] text-slate-400 truncate">
                              {eEntrada ? "+" : "-"}{qtd} un. • {horaFmt} • Por {resp}
                            </span>
                          </div>
                        </div>

                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase shrink-0 ${
                          eEntrada ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
                        }`}>
                          {eEntrada ? "Entrada" : "Saída"}
                        </span>
                      </HubListItem>
                    );
                  })}
                </HubListContainer>
              )}
            </div>

            {/* SEÇÃO 6: MAIS FERRAMENTAS DO ESTOQUE */}
            <div className="space-y-3 pt-2">
              <HubSectionHeader
                title="Mais Ferramentas de Estoque"
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onVerTabelaCompleta}
                  className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-left transition-all min-h-[48px] cursor-pointer"
                >
                  <p className="text-xs font-bold text-white truncate">Estoque Geral</p>
                  <p className="text-[10px] text-slate-400">Tabela completa</p>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/operacao/notas")}
                  className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-left transition-all min-h-[48px] cursor-pointer"
                >
                  <p className="text-xs font-bold text-white truncate">Entrada de NFe</p>
                  <p className="text-[10px] text-slate-400">Importar XML</p>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/operacao/fornecedores")}
                  className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-left transition-all min-h-[48px] cursor-pointer"
                >
                  <p className="text-xs font-bold text-white truncate">Fornecedores</p>
                  <p className="text-[10px] text-slate-400">Contatos e prazos</p>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/operacao/embalagens")}
                  className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-left transition-all min-h-[48px] cursor-pointer"
                >
                  <p className="text-xs font-bold text-white truncate">Embalagens</p>
                  <p className="text-[10px] text-slate-400">Descartáveis</p>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
