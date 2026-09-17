"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChefHat, Flame, Tag, Package, AlertTriangle, CheckSquare, Sparkles,
  ArrowRight, Clock, Plus, BarChart2, RefreshCw, FileText, CheckCircle2,
  XCircle, ChevronRight, Layers, AlertCircle, ShoppingCart, ShieldAlert,
  Wrench, Users, Play, Eye
} from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { fetchProducaoDeHoje, fetchEstoque } from "../../lib/estoque";
import { fetchTemplates, fetchHistoricoExecucoes } from "../../lib/checklists";
import { canAccessRoute, hasPermission } from "../../lib/permissions-catalog.mjs";

export default function CozinhaHubPage() {
  const router = useRouter();
  const { sessao, unidadeAtiva, unidadeInfo } = useERP();

  // Estados dos dados reais
  const [loadingProducao, setLoadingProducao] = useState(true);
  const [errorProducao, setErrorProducao] = useState(null);
  const [producoesHoje, setProducoesHoje] = useState([]);
  const [itensPlanejados, setItensPlanejados] = useState([]);

  const [loadingEstoque, setLoadingEstoque] = useState(true);
  const [errorEstoque, setErrorEstoque] = useState(null);
  const [itensCriticos, setItensCriticos] = useState([]);

  const [loadingChecklists, setLoadingChecklists] = useState(true);
  const [errorChecklists, setErrorChecklists] = useState(null);
  const [checklistsStatus, setChecklistsStatus] = useState({ total: 0, concluidos: 0 });

  // Verificação de Permissões
  const podeVerEstoque = !sessao?.gerenciado || canAccessRoute(sessao, "/dashboard/operacao/estoque");
  const podeVerEtiquetas = !sessao?.gerenciado || canAccessRoute(sessao, "/dashboard/operacao/etiquetas");
  const podeVerProducao = !sessao?.gerenciado || canAccessRoute(sessao, "/dashboard/operacao/producao");
  const podeVerChecklists = !sessao?.gerenciado || canAccessRoute(sessao, "/dashboard/checklists");

  // Saudação e data formatada
  const agora = new Date();
  const hora = agora.getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const primeiroNome = sessao?.nome ? sessao.nome.split(" ")[0] : "Equipe";

  const dataFormatada = agora.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
  const dataCapitalizada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);

  // 1. Carrega dados reais de Produção do Dia
  const carregarProducao = useCallback(async () => {
    if (!unidadeAtiva) return;
    setLoadingProducao(true);
    setErrorProducao(null);
    try {
      const { data, error } = await fetchProducaoDeHoje(unidadeAtiva, { departamento: "cozinha" });
      if (error) {
        setErrorProducao(error);
      } else {
        setProducoesHoje(data || []);
      }

      // Lê o planejamento rascunhado no localStorage do chef se existir
      try {
        const chavePlano = `producao_plano_${unidadeAtiva}_cozinha`;
        const raw = localStorage.getItem(chavePlano);
        if (raw) {
          const d = JSON.parse(raw);
          if (d && typeof d.plano === "object") {
            const listaPlano = Object.entries(d.plano)
              .filter(([_, v]) => Number(String(v.qtd || "").replace(",", ".")) > 0)
              .map(([id, v]) => ({ id, qtd: v.qtd, resp: v.resp }));
            setItensPlanejados(listaPlano);
          }
        }
      } catch (_) {}
    } catch (e) {
      setErrorProducao(e.message || "Falha ao carregar produção");
    } finally {
      setLoadingProducao(false);
    }
  }, [unidadeAtiva]);

  // 2. Carrega dados reais de Estoque Crítico
  const carregarEstoque = useCallback(async () => {
    if (!unidadeAtiva || !podeVerEstoque) return;
    setLoadingEstoque(true);
    setErrorEstoque(null);
    try {
      const { data, error } = await fetchEstoque(unidadeAtiva, "cozinha");
      if (error) {
        setErrorEstoque(error);
      } else {
        // Insumos com estoque_minimo definido e quantidade_atual <= estoque_minimo
        const criticos = (data || []).filter(
          item => item.estoque_minimo !== null && item.quantidade_atual <= item.estoque_minimo
        );
        setItensCriticos(criticos.slice(0, 4));
      }
    } catch (e) {
      setErrorEstoque(e.message || "Falha ao carregar estoque");
    } finally {
      setLoadingEstoque(false);
    }
  }, [unidadeAtiva, podeVerEstoque]);

  // 3. Carrega dados reais de Checklists
  const carregarChecklists = useCallback(async () => {
    if (!unidadeAtiva || !podeVerChecklists) return;
    setLoadingChecklists(true);
    setErrorChecklists(null);
    try {
      const { data: templates } = await fetchTemplates(unidadeAtiva, "cozinha");
      const { data: execucoes } = await fetchHistoricoExecucoes(unidadeAtiva, "cozinha", 1);

      const total = templates?.length || 0;
      const concluidos = execucoes?.length || 0;
      setChecklistsStatus({ total, concluidos });
    } catch (e) {
      setErrorChecklists(e.message || "Falha ao carregar checklists");
    } finally {
      setLoadingChecklists(false);
    }
  }, [unidadeAtiva, podeVerChecklists]);

  useEffect(() => {
    carregarProducao();
    carregarEstoque();
    carregarChecklists();
  }, [carregarProducao, carregarEstoque, carregarChecklists]);

  // Cálculos dinâmicos da Produção
  const totalRegistrado = producoesHoje.length;
  const totalPlanejadoCount = Math.max(totalRegistrado, itensPlanejados.length, 1);
  const progressoPercentual = Math.min(100, Math.round((totalRegistrado / totalPlanejadoCount) * 100));

  return (
    <div className="min-h-screen bg-[#070F1E] text-slate-100 font-sans pb-24 pt-4 px-3 sm:px-6 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* CABEÇALHO DO AMBIENTE OPERACIONAL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-inner">
              <ChefHat size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-3xs uppercase tracking-widest font-bold text-emerald-400">Ambiente Operacional</span>
                <span className="text-slate-600">•</span>
                <span className="text-3xs text-slate-400">{unidadeInfo?.nome || "Cozinha Central"}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {saudacao}, {primeiroNome}!
              </h1>
              <p className="text-xs text-slate-400">{dataCapitalizada}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                carregarProducao();
                carregarEstoque();
                carregarChecklists();
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white hover:border-slate-700 transition-all min-h-[44px]"
            >
              <RefreshCw size={14} className={loadingProducao || loadingEstoque ? "animate-spin text-emerald-400" : ""} />
              <span>Atualizar</span>
            </button>

            {podeVerProducao && (
              <button
                type="button"
                onClick={() => router.push("/dashboard/operacao/producao?dept=cozinha")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold transition-all shadow-md min-h-[44px]"
              >
                <span>Produção do Dia</span>
                <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>

        {/* COMPOSIÇÃO LANDSCAPE / PORTRAIT DA OPERAÇÃO */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* COLUNA PRINCIPAL (2 LARGURAS EM LANDSCAPE) */}
          <div className="lg:col-span-2 space-y-6">

            {/* SEÇÃO 1: AGORA — ITENS QUE PRECISAM DE ATENÇÃO */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Clock size={16} />
                  Atenção Imediata na Cozinha
                </span>
                <span className="text-3xs text-slate-400">Tempo real</span>
              </div>

              {loadingProducao ? (
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse space-y-2">
                  <div className="h-4 bg-slate-800 rounded w-1/3" />
                  <div className="h-3 bg-slate-800 rounded w-2/3" />
                </div>
              ) : errorProducao ? (
                <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-900/60 text-rose-300 text-xs flex items-center justify-between">
                  <span>Não foi possível carregar as atenções da produção.</span>
                  <button onClick={carregarProducao} className="underline text-rose-200 font-bold ml-2">Tentar novamente</button>
                </div>
              ) : producoesHoje.length === 0 ? (
                <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-3">
                  <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                  <div>
                    <p className="font-bold">Nenhuma pendência crítica travando a cozinha agora.</p>
                    <p className="text-3xs text-emerald-400/80">Inicie novos lotes de preparo ou lance produções concluídas.</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                      <Flame size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">
                        {producoesHoje.length} preparos registrados hoje na cozinha
                      </p>
                      <p className="text-xs text-slate-400">Último lançamento registrado com sucesso.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push("/dashboard/operacao/producao?dept=cozinha")}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 shrink-0 min-h-[44px]"
                  >
                    Ver detalhes
                  </button>
                </div>
              )}
            </div>

            {/* SEÇÃO 2: PRODUÇÃO DE HOJE (PROGRESSO + LISTA OPERACIONAL) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Flame size={16} className="text-emerald-400" />
                  Produção de Hoje
                </span>
                <span className="text-xs font-bold text-emerald-400">
                  {totalRegistrado} de {totalPlanejadoCount} concluídas ({progressoPercentual}%)
                </span>
              </div>

              {/* Barra de Progresso Dinâmica */}
              <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${progressoPercentual}%` }}
                />
              </div>

              {/* Lista Operacional de Produção */}
              {loadingProducao ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-slate-900/60 rounded-xl border border-slate-800 animate-pulse" />
                  ))}
                </div>
              ) : producoesHoje.length === 0 ? (
                <div className="p-6 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
                  <Flame size={32} className="mx-auto text-slate-600" />
                  <p className="text-sm font-bold text-slate-300">Nenhum lote de produção lançado hoje até o momento.</p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Acesse a Produção do Dia para selecionar fichas técnicas e registrar lotes de pré-preparo.
                  </p>
                  {podeVerProducao && (
                    <button
                      onClick={() => router.push("/dashboard/operacao/producao?dept=cozinha")}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl inline-flex items-center gap-2 transition-all min-h-[44px]"
                    >
                      <Plus size={16} /> Lançar Primeira Produção
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {producoesHoje.slice(0, 5).map((prod) => {
                    const nomeReceita = prod.fichas_tecnicas?.nome_receita || "Receita de Cozinha";
                    const quantidade = Number(prod.quantidade_produzida || 0);
                    const unidade = prod.fichas_tecnicas?.rendimento_unidade || "porções";
                    const responsavel = prod.colaboradores?.nome || "Cozinha";
                    const horaFmt = new Date(prod.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

                    return (
                      <div
                        key={prod.id}
                        className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/90 text-slate-200 transition-all hover:bg-slate-800/40 min-h-[56px]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                            <CheckCircle2 size={18} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs sm:text-sm font-bold truncate">{nomeReceita}</span>
                              <span className="text-3xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-semibold shrink-0">
                                CONCLUÍDO
                              </span>
                            </div>
                            <span className="text-3xs sm:text-xs text-slate-400 truncate">
                              {quantidade} {unidade} • {horaFmt} • Por {responsavel}
                            </span>
                          </div>
                        </div>

                        {podeVerEtiquetas && (
                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/operacao/etiquetas?produto=${encodeURIComponent(nomeReceita)}`)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold transition-colors shrink-0 min-h-[44px]"
                          >
                            <Tag size={14} />
                            <span className="hidden sm:inline">Etiqueta</span>
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {producoesHoje.length > 5 && (
                    <button
                      onClick={() => router.push("/dashboard/operacao/producao?dept=cozinha")}
                      className="w-full text-center py-2.5 text-xs font-bold text-emerald-400 hover:underline"
                    >
                      Ver todas as {producoesHoje.length} produções de hoje →
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* SEÇÃO 3: AÇÕES RÁPIDAS OPERACIONAIS (GRANDES >= 44PX) */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Ações Rápidas da Cozinha
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {podeVerEtiquetas && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/operacao/etiquetas")}
                    className="flex flex-col items-start p-3.5 rounded-xl bg-slate-900/80 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/50 text-slate-100 transition-all text-left group min-h-[70px] justify-between"
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                      <Tag size={20} />
                    </div>
                    <span className="text-xs font-bold leading-tight">Imprimir Etiqueta</span>
                    <span className="text-3xs text-slate-400">MDK-022 / TSPL</span>
                  </button>
                )}

                {podeVerProducao && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/operacao/producao?dept=cozinha")}
                    className="flex flex-col items-start p-3.5 rounded-xl bg-slate-900/80 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/50 text-slate-100 transition-all text-left group min-h-[70px] justify-between"
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                      <Plus size={20} />
                    </div>
                    <span className="text-xs font-bold leading-tight">Lançar Produção</span>
                    <span className="text-3xs text-slate-400">Baixa automática</span>
                  </button>
                )}

                {podeVerEstoque && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/operacao/estoque/tablet")}
                    className="flex flex-col items-start p-3.5 rounded-xl bg-slate-900/80 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/50 text-slate-100 transition-all text-left group min-h-[70px] justify-between"
                  >
                    <div className="w-9 h-9 rounded-lg bg-slate-800 text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                      <Package size={20} />
                    </div>
                    <span className="text-xs font-bold leading-tight">Retirar Estoque</span>
                    <span className="text-3xs text-slate-400">Modo Operação</span>
                  </button>
                )}

                {podeVerEstoque && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/operacao/estoque")}
                    className="flex flex-col items-start p-3.5 rounded-xl bg-slate-900/80 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/50 text-slate-100 transition-all text-left group min-h-[70px] justify-between"
                  >
                    <div className="w-9 h-9 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                      <AlertTriangle size={20} />
                    </div>
                    <span className="text-xs font-bold leading-tight">Registrar Perda</span>
                    <span className="text-3xs text-slate-400">Avarias / Validade</span>
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* COLUNA LATERAL (ESTOQUE CRÍTICO + CHECKLISTS + NAVEGAÇÃO COMPLEMENTAR) */}
          <div className="space-y-6">

            {/* SEÇÃO 4: PROBLEMAS & ALERTAS (ESTOQUE CRÍTICO) */}
            {podeVerEstoque && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle size={15} />
                    Estoque Crítico (Cozinha)
                  </span>
                </div>

                {loadingEstoque ? (
                  <div className="h-24 bg-slate-900/60 rounded-xl border border-slate-800 animate-pulse" />
                ) : errorEstoque ? (
                  <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-900/50 text-3xs text-rose-300">
                    Não foi possível carregar o estoque crítico.
                  </div>
                ) : itensCriticos.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span>Nenhum insumo abaixo do estoque mínimo.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {itensCriticos.map(item => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-rose-950/20 border border-rose-900/50 flex items-center justify-between text-xs min-h-[48px]"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-white truncate">{item.nome}</span>
                          <span className="text-3xs text-rose-300">
                            {item.quantidade_atual} {item.unidade_medida} (mín: {item.estoque_minimo})
                          </span>
                        </div>
                        <span className="text-3xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold shrink-0">
                          BAIXO
                        </span>
                      </div>
                    ))}
                    <button
                      onClick={() => router.push("/dashboard/operacao/estoque")}
                      className="w-full text-center py-1.5 text-3xs font-bold text-rose-400 hover:underline"
                    >
                      Ver posição completa do estoque →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* SEÇÃO 5: CHECKLISTS OPERACIONAIS */}
            {podeVerChecklists && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <CheckSquare size={15} className="text-emerald-400" />
                    Rotinas & Checklists
                  </span>
                </div>

                {loadingChecklists ? (
                  <div className="h-20 bg-slate-900/60 rounded-xl border border-slate-800 animate-pulse" />
                ) : (
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/90 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200">Abertura & Higiene</span>
                      <span className="font-bold text-emerald-400">
                        {checklistsStatus.concluidos}/{checklistsStatus.total || 1} concluídos
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => router.push("/dashboard/operacao/rotina?dept=cozinha")}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition-colors min-h-[44px]"
                    >
                      <span>Preencher / Continuar</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* SEÇÃO 6: FERRAMENTAS COMPLEMENTARES DA COZINHA */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Ferramentas da Cozinha
              </span>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/operacao/fichas?dept=cozinha")}
                  className="p-3 rounded-xl bg-slate-900/40 hover:bg-slate-800/80 border border-slate-800 text-left transition-all min-h-[48px]"
                >
                  <p className="text-xs font-bold text-white truncate">Fichas Técnicas</p>
                  <p className="text-3xs text-slate-400">Receitas e modos</p>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/cozinha/kds")}
                  className="p-3 rounded-xl bg-slate-900/40 hover:bg-slate-800/80 border border-slate-800 text-left transition-all min-h-[48px]"
                >
                  <p className="text-xs font-bold text-white truncate">KDS Cozinha</p>
                  <p className="text-3xs text-slate-400">Display de pedidos</p>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/operacao/montagem?dept=cozinha")}
                  className="p-3 rounded-xl bg-slate-900/40 hover:bg-slate-800/80 border border-slate-800 text-left transition-all min-h-[48px]"
                >
                  <p className="text-xs font-bold text-white truncate">Guia Montagem</p>
                  <p className="text-3xs text-slate-400">Empratamento</p>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/operacao/controles")}
                  className="p-3 rounded-xl bg-slate-900/40 hover:bg-slate-800/80 border border-slate-800 text-left transition-all min-h-[48px]"
                >
                  <p className="text-xs font-bold text-white truncate">Temperaturas</p>
                  <p className="text-3xs text-slate-400">Aferição Anvisa</p>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
