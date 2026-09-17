"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChefHat, Flame, Tag, Package, AlertTriangle, CheckSquare,
  ArrowRight, Clock, Plus, RefreshCw, CheckCircle2, Layers
} from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { fetchProducaoDeHoje, fetchEstoque } from "../../lib/estoque";
import { fetchTemplates, fetchHistoricoExecucoes } from "../../lib/checklists";
import { canAccessRoute } from "../../lib/permissions-catalog.mjs";
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

export default function CozinhaHub({ onVerGestaoCompleta }) {
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

  const carregarTudo = useCallback(() => {
    carregarProducao();
    carregarEstoque();
    carregarChecklists();
  }, [carregarProducao, carregarEstoque, carregarChecklists]);

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  // Cálculos dinâmicos da Produção
  const totalRegistrado = producoesHoje.length;
  const totalPlanejadoCount = Math.max(totalRegistrado, itensPlanejados.length, 1);
  const progressoPercentual = Math.min(100, Math.round((totalRegistrado / totalPlanejadoCount) * 100));

  const isRefreshing = loadingProducao || loadingEstoque || loadingChecklists;

  return (
    <div className="min-h-screen bg-[#070F1E] text-slate-100 font-sans pb-24 pt-4 px-3 sm:px-6 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* CABEÇALHO PADRONIZADO */}
        <HubHeader
          icon={ChefHat}
          domainTag="Ambiente Operacional"
          unitName={unidadeInfo?.nome || "Cozinha Central"}
          title={`${saudacao}, ${primeiroNome}!`}
          subtitle={dataCapitalizada}
          onRefresh={carregarTudo}
          isRefreshing={isRefreshing}
          viewModeButton={
            onVerGestaoCompleta ? (
              <HubActionButton
                onClick={onVerGestaoCompleta}
                variant="outline"
                icon={Layers}
              >
                <span>Gestão Completa</span>
              </HubActionButton>
            ) : null
          }
          primaryActionButton={
            podeVerProducao ? (
              <HubActionButton
                onClick={() => router.push("/dashboard/operacao/producao?dept=cozinha")}
                variant="primary"
                icon={ArrowRight}
              >
                <span>Produção do Dia</span>
              </HubActionButton>
            ) : null
          }
        />

        {/* LAYOUT EM GRID LANDSCAPE / PORTRAIT DA OPERAÇÃO */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* COLUNA PRINCIPAL (2 LARGURAS EM DESKTOP/TABLET LANDSCAPE) */}
          <div className="lg:col-span-2 space-y-6">

            {/* SEÇÃO 1: AGORA — ATENÇÃO IMEDIATA */}
            <div className="space-y-3">
              <HubSectionHeader
                icon={Clock}
                title="Atenção Imediata na Cozinha"
                badgeText="Tempo real"
                badgeVariant="amber"
              />

              {loadingProducao ? (
                <HubSkeleton height="h-20" lines={1} />
              ) : errorProducao ? (
                <HubErrorState
                  message="Não foi possível carregar as atenções da produção."
                  onRetry={carregarProducao}
                />
              ) : producoesHoje.length === 0 ? (
                <HubAttentionCard
                  variant="green"
                  icon={CheckCircle2}
                  title="Nenhuma pendência crítica travando a cozinha agora."
                  subtitle="Inicie novos lotes de preparo ou lance produções concluídas."
                />
              ) : (
                <HubAttentionCard
                  variant="amber"
                  icon={Flame}
                  title={`${producoesHoje.length} preparos registrados hoje na cozinha`}
                  subtitle="Último lançamento registrado com sucesso."
                  actionButton={
                    <HubActionButton
                      onClick={() => router.push("/dashboard/operacao/producao?dept=cozinha")}
                      variant="secondary"
                    >
                      Ver detalhes
                    </HubActionButton>
                  }
                />
              )}
            </div>

            {/* SEÇÃO 2: PRODUÇÃO DE HOJE (PROGRESSO + LISTA OPERACIONAL) */}
            <div className="space-y-3 pt-2">
              <HubSectionHeader
                icon={Flame}
                title="Produção de Hoje"
                badgeText={`${totalRegistrado} de ${totalPlanejadoCount} (${progressoPercentual}%)`}
                badgeVariant={progressoPercentual === 100 ? "green" : "amber"}
              />

              {/* Barra de Progresso Dinâmica */}
              <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${progressoPercentual}%` }}
                />
              </div>

              {/* Lista Operacional de Produção */}
              {loadingProducao ? (
                <HubSkeleton height="h-16" lines={3} />
              ) : producoesHoje.length === 0 ? (
                <HubCardContainer className="text-center space-y-3 py-6">
                  <Flame size={32} className="mx-auto text-slate-600" />
                  <p className="text-sm font-bold text-slate-300">Nenhum lote de produção lançado hoje até o momento.</p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Acesse a Produção do Dia para selecionar fichas técnicas e registrar lotes de pré-preparo.
                  </p>
                  {podeVerProducao && (
                    <div className="pt-2 flex justify-center">
                      <HubActionButton
                        onClick={() => router.push("/dashboard/operacao/producao?dept=cozinha")}
                        variant="primary"
                        icon={Plus}
                      >
                        Lançar Primeira Produção
                      </HubActionButton>
                    </div>
                  )}
                </HubCardContainer>
              ) : (
                <HubListContainer>
                  {producoesHoje.slice(0, 5).map((prod) => {
                    const nomeReceita = prod.fichas_tecnicas?.nome_receita || "Receita de Cozinha";
                    const quantidade = Number(prod.quantidade_produzida || 0);
                    const unidade = prod.fichas_tecnicas?.rendimento_unidade || "porções";
                    const responsavel = prod.colaboradores?.nome || "Cozinha";
                    const horaFmt = new Date(prod.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

                    return (
                      <HubListItem key={prod.id}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                            <CheckCircle2 size={18} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs sm:text-sm font-bold truncate">{nomeReceita}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-semibold shrink-0">
                                CONCLUÍDO
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 truncate">
                              {quantidade} {unidade} • {horaFmt} • Por {responsavel}
                            </span>
                          </div>
                        </div>

                        {podeVerEtiquetas && (
                          <HubActionButton
                            onClick={() => router.push(`/dashboard/operacao/etiquetas?produto=${encodeURIComponent(nomeReceita)}`)}
                            variant="outline"
                            icon={Tag}
                          >
                            <span className="hidden sm:inline">Etiqueta</span>
                          </HubActionButton>
                        )}
                      </HubListItem>
                    );
                  })}
                </HubListContainer>
              )}

              {producoesHoje.length > 5 && (
                <button
                  onClick={() => router.push("/dashboard/operacao/producao?dept=cozinha")}
                  className="w-full text-center py-2.5 text-xs font-bold text-emerald-400 hover:underline min-h-[44px] flex items-center justify-center"
                >
                  Ver todas as {producoesHoje.length} produções de hoje →
                </button>
              )}
            </div>

            {/* SEÇÃO 3: AÇÕES RÁPIDAS OPERACIONAIS */}
            <div className="space-y-3 pt-2">
              <HubSectionHeader
                title="Ações Rápidas da Cozinha"
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {podeVerEtiquetas && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/operacao/etiquetas")}
                    className="flex flex-col items-start p-3.5 rounded-xl bg-slate-900/80 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/50 text-slate-100 transition-all text-left group min-h-[72px] justify-between cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                      <Tag size={20} />
                    </div>
                    <span className="text-xs font-bold leading-tight">Imprimir Etiqueta</span>
                    <span className="text-[10px] text-slate-400">MDK-022 / TSPL</span>
                  </button>
                )}

                {podeVerProducao && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/operacao/producao?dept=cozinha")}
                    className="flex flex-col items-start p-3.5 rounded-xl bg-slate-900/80 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/50 text-slate-100 transition-all text-left group min-h-[72px] justify-between cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                      <Plus size={20} />
                    </div>
                    <span className="text-xs font-bold leading-tight">Lançar Produção</span>
                    <span className="text-[10px] text-slate-400">Baixa automática</span>
                  </button>
                )}

                {podeVerEstoque && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/operacao/estoque/tablet")}
                    className="flex flex-col items-start p-3.5 rounded-xl bg-slate-900/80 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/50 text-slate-100 transition-all text-left group min-h-[72px] justify-between cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-slate-800 text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                      <Package size={20} />
                    </div>
                    <span className="text-xs font-bold leading-tight">Retirar Estoque</span>
                    <span className="text-[10px] text-slate-400">Modo Operação</span>
                  </button>
                )}

                {podeVerEstoque && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/operacao/estoque")}
                    className="flex flex-col items-start p-3.5 rounded-xl bg-slate-900/80 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/50 text-slate-100 transition-all text-left group min-h-[72px] justify-between cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                      <AlertTriangle size={20} />
                    </div>
                    <span className="text-xs font-bold leading-tight">Registrar Perda</span>
                    <span className="text-[10px] text-slate-400">Avarias / Validade</span>
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* COLUNA LATERAL (ESTOQUE CRÍTICO + CHECKLISTS + NAVEGAÇÃO COMPLEMENTAR) */}
          <div className="space-y-6">

            {/* SEÇÃO 4: ESTOQUE CRÍTICO */}
            {podeVerEstoque && (
              <div className="space-y-3">
                <HubSectionHeader
                  icon={AlertTriangle}
                  title="Estoque Crítico (Cozinha)"
                  badgeText={itensCriticos.length > 0 ? `${itensCriticos.length} insumos` : undefined}
                  badgeVariant={itensCriticos.length > 0 ? "red" : "green"}
                />

                {loadingEstoque ? (
                  <HubSkeleton height="h-24" lines={1} />
                ) : errorEstoque ? (
                  <HubErrorState
                    message="Não foi possível carregar o estoque crítico."
                    onRetry={carregarEstoque}
                  />
                ) : itensCriticos.length === 0 ? (
                  <HubAttentionCard
                    variant="green"
                    icon={CheckCircle2}
                    title="Nenhum insumo abaixo do estoque mínimo."
                  />
                ) : (
                  <div className="space-y-2">
                    <HubListContainer>
                      {itensCriticos.map(item => (
                        <HubListItem key={item.id}>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-white truncate text-xs sm:text-sm">{item.nome}</span>
                            <span className="text-[10px] text-rose-300">
                              {item.quantidade_atual} {item.unidade_medida} (mín: {item.estoque_minimo})
                            </span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold shrink-0 border border-rose-500/30">
                            BAIXO
                          </span>
                        </HubListItem>
                      ))}
                    </HubListContainer>
                    <button
                      onClick={() => router.push("/dashboard/operacao/estoque")}
                      className="w-full text-center py-2 text-xs font-bold text-rose-400 hover:underline min-h-[44px] flex items-center justify-center"
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
                <HubSectionHeader
                  icon={CheckSquare}
                  title="Rotinas & Checklists"
                />

                {loadingChecklists ? (
                  <HubSkeleton height="h-20" lines={1} />
                ) : errorChecklists ? (
                  <HubErrorState
                    message="Falha ao carregar checklists da cozinha."
                    onRetry={carregarChecklists}
                  />
                ) : (
                  <HubCardContainer className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200">Abertura & Higiene</span>
                      <span className="font-bold text-emerald-400">
                        {checklistsStatus.concluidos}/{checklistsStatus.total || 1} concluídos
                      </span>
                    </div>

                    <HubActionButton
                      onClick={() => router.push("/dashboard/operacao/rotina?dept=cozinha")}
                      variant="primary"
                      icon={ArrowRight}
                      fullWidth
                    >
                      Preencher / Continuar
                    </HubActionButton>
                  </HubCardContainer>
                )}
              </div>
            )}

            {/* SEÇÃO 6: FERRAMENTAS COMPLEMENTARES DA COZINHA */}
            <div className="space-y-3 pt-2">
              <HubSectionHeader
                title="Ferramentas da Cozinha"
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/operacao/fichas?dept=cozinha")}
                  className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-left transition-all min-h-[48px] cursor-pointer"
                >
                  <p className="text-xs font-bold text-white truncate">Fichas Técnicas</p>
                  <p className="text-[10px] text-slate-400">Receitas e modos</p>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/cozinha/kds")}
                  className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-left transition-all min-h-[48px] cursor-pointer"
                >
                  <p className="text-xs font-bold text-white truncate">KDS Cozinha</p>
                  <p className="text-[10px] text-slate-400">Display de pedidos</p>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/operacao/montagem?dept=cozinha")}
                  className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-left transition-all min-h-[48px] cursor-pointer"
                >
                  <p className="text-xs font-bold text-white truncate">Guia Montagem</p>
                  <p className="text-[10px] text-slate-400">Empratamento</p>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/operacao/controles")}
                  className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-left transition-all min-h-[48px] cursor-pointer"
                >
                  <p className="text-xs font-bold text-white truncate">Temperaturas</p>
                  <p className="text-[10px] text-slate-400">Aferição Anvisa</p>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
