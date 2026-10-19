"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users, UserCheck, Clock, CalendarDays, AlertTriangle, ChevronRight,
  Plus, CheckCircle2, ShieldCheck, FileText, UserPlus, Heart, Award,
  Sparkles, Coffee, Briefcase, DollarSign, Lock, RefreshCw, Layers, ArrowRight
} from "lucide-react";
import { useERP } from "../../context/ERPContext";
import {
  fetchColaboradores, fetchBancoHoras, somaMinutosBanco, BANCO_ALERTA_MIN,
  fetchAtestadosUnidade, horarioDoDia
} from "../../lib/rh";
import { fetchPontoHoje } from "../../lib/ponto";
import { situacaoDoPonto, atestadoNaData } from "../../lib/ponto-status.mjs";
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

export default function RhHub({ onVerGestaoCompleta, onAbrirPonto }) {
  const router = useRouter();
  const { sessao, unidadeAtiva, unidadeInfo } = useERP();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [colaboradores, setColaboradores] = useState([]);
  const [pontosHoje, setPontosHoje] = useState([]);
  const [bancoHoras, setBancoHoras] = useState([]);
  const [atestados, setAtestados] = useState([]);

  const [expandirEquipe, setExpandirEquipe] = useState(false);

  // Permissões
  const podeVerGestaoRH = !sessao?.gerenciado || hasPermission(sessao, "rh.overview.view") || hasPermission(sessao, "rh.employees.view");
  const podeVerPonto = !sessao?.gerenciado || hasPermission(sessao, "ponto.clock.view");
  const podeVerValores = !sessao?.gerenciado || hasPermission(sessao, "rh.payroll.view") || hasPermission(sessao, "rh.overview.view_values");
  const podeVerRecrutamento = !sessao?.gerenciado || hasPermission(sessao, "rh.recruiting.view");

  const agora = new Date();
  const mesAnoAtual = agora.toISOString().slice(0, 7);
  const dataHojeISO = agora.toISOString().slice(0, 10);
  const diaDaSemana = agora.getDay(); // 0=Dom..6=Sáb

  const dataFormatada = agora.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
  const dataCapitalizada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);

  // Carrega dados operacionais do RH
  const carregarDadosRH = useCallback(async () => {
    if (!unidadeAtiva) return;
    setLoading(true);
    setError(null);
    try {
      const [resColabs, resPontos, resBanco, resAtestados] = await Promise.all([
        fetchColaboradores(unidadeAtiva),
        fetchPontoHoje(unidadeAtiva),
        fetchBancoHoras(unidadeAtiva, mesAnoAtual),
        fetchAtestadosUnidade(unidadeAtiva, { desde: dataHojeISO })
      ]);

      if (resColabs.error) setError(resColabs.error);

      setColaboradores(resColabs.data || []);
      setPontosHoje(resPontos.data || []);
      setBancoHoras(resBanco.data || []);
      setAtestados(resAtestados.data || []);
    } catch (e) {
      setError(e.message || "Falha ao carregar dados do RH");
    } finally {
      setLoading(false);
    }
  }, [unidadeAtiva, mesAnoAtual, dataHojeISO]);

  useEffect(() => {
    carregarDadosRH();
  }, [carregarDadosRH]);

  // Colaboradores ativos (exclui inativos)
  const colabsAtivos = colaboradores.filter(c => c.status !== "inativo");

  // Mapeia registros de ponto por ID do colaborador
  const mapaPontos = new Map(pontosHoje.map(p => [p.colaborador_id, p]));

  // Calcula a situação da equipe hoje
  const horaMinAtualStr = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;

  const equipeProcessada = colabsAtivos.map(c => {
    const regPonto = mapaPontos.get(c.id);
    const atest = atestadoNaData(atestados, dataHojeISO);
    const sit = situacaoDoPonto(regPonto, { atestado: atest });
    const horario = horarioDoDia(c, diaDaSemana);
    const entradaEsperada = horario?.entrada || "";
    const estaPrevistoHoje = Boolean(entradaEsperada || (c.dias_trabalho && c.dias_trabalho.includes(String(diaDaSemana))));

    let statusOperacional = "fora_turno";
    let prioridadeOrdenacao = 99;

    if (sit.atestado) {
      statusOperacional = "atestado";
      prioridadeOrdenacao = 5;
    } else if (regPonto?.hora_saida) {
      statusOperacional = "encerrado";
      prioridadeOrdenacao = 4;
    } else if (regPonto?.hora_saida_intervalo && !regPonto?.hora_retorno_intervalo) {
      statusOperacional = "intervalo";
      prioridadeOrdenacao = 2;
    } else if (regPonto?.hora_entrada) {
      statusOperacional = "trabalhando";
      prioridadeOrdenacao = 3;
    } else if (estaPrevistoHoje) {
      if (entradaEsperada && horaMinAtualStr > entradaEsperada) {
        statusOperacional = "atrasado";
        prioridadeOrdenacao = 1;
      } else {
        statusOperacional = "pendente";
        prioridadeOrdenacao = 1.5;
      }
    } else {
      statusOperacional = "folga";
      prioridadeOrdenacao = 6;
    }

    return {
      colaborador: c,
      registro: regPonto,
      situacao: sit,
      horario,
      entradaEsperada,
      estaPrevistoHoje,
      statusOperacional,
      prioridadeOrdenacao
    };
  });

  // Filtros de contagem para o bloco "AGORA"
  const previstosHoje = equipeProcessada.filter(e => e.estaPrevistoHoje);
  const presentes = equipeProcessada.filter(e => e.statusOperacional === "trabalhando" || e.statusOperacional === "intervalo" || e.statusOperacional === "encerrado");
  const trabalhando = equipeProcessada.filter(e => e.statusOperacional === "trabalhando");
  const emIntervalo = equipeProcessada.filter(e => e.statusOperacional === "intervalo");
  const atrasados = equipeProcessada.filter(e => e.statusOperacional === "atrasado");

  // Pendências para "PRECISA DA SUA ATENÇÃO"
  const pontosIncompletos = equipeProcessada.filter(e => e.situacao.semIntervalo && e.statusOperacional === "encerrado");

  // Banco de Horas agrupado por colaborador
  const bancoPorColab = new Map();
  bancoHoras.forEach(b => {
    const atual = bancoPorColab.get(b.colaborador_id) || [];
    bancoPorColab.set(b.colaborador_id, [...atual, b]);
  });

  const equipeBancoAtencao = colabsAtivos.map(c => {
    const lancs = bancoPorColab.get(c.id) || [];
    const minTotais = somaMinutosBanco(lancs);
    return { colaborador: c, minutos: minTotais, horas: (minTotais / 60).toFixed(1) };
  }).filter(b => Math.abs(b.minutos) >= BANCO_ALERTA_MIN || b.minutos < 0)
    .sort((a, b) => Math.abs(b.minutos) - Math.abs(a.minutos));

  // Ordena equipe para exibição no Hub (Alertas e atrasos primeiro)
  const equipeOrdenada = [...equipeProcessada].sort((a, b) => a.prioridadeOrdenacao - b.prioridadeOrdenacao);
  const equipeExibida = expandirEquipe ? equipeOrdenada : equipeOrdenada.slice(0, 6);

  // Visão pessoal para colaborador sem perfil gerencial
  const meuColaborador = colaboradores.find(c => c.email === sessao?.email || c.nome?.toLowerCase() === sessao?.nome?.toLowerCase());
  const meuRegistroHoje = meuColaborador ? mapaPontos.get(meuColaborador.id) : null;
  const minhaSituacaoPonto = situacaoDoPonto(meuRegistroHoje);
  const meuBancoHoras = meuColaborador ? somaMinutosBanco(bancoPorColab.get(meuColaborador.id) || []) : 0;

  return (
    <div className="min-h-screen bg-hf-bg text-slate-900 font-sans pb-24 pt-4 px-3 sm:px-6 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* CABEÇALHO PADRONIZADO */}
        

        {error && (
          <HubErrorState
            message={error}
            onRetry={carregarDadosRH}
          />
        )}

        {/* ─── VISÃO GERENCIAL DE RH (GESTOR / ADMIN) ─── */}
        {podeVerGestaoRH ? (
          <>
            {/* SEÇÃO 1: "AGORA" — SITUAÇÃO OPERACIONAL DA EQUIPE HOJE */}
            <div className="space-y-3">
              <HubSectionHeader
                icon={UserCheck}
                title="Visão Geral da Equipe Hoje"
                badgeText={`${presentes.length}/${previstosHoje.length || colabsAtivos.length} presentes`}
                badgeVariant={presentes.length >= previstosHoje.length ? "green" : "amber"}
              />

              {loading ? (
                <HubSkeleton height="h-20" lines={1} />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  <div className="p-4 rounded-2xl bg-hf-surface border border-zinc-200/80 shadow-card flex flex-col justify-between">
                    <div className="flex items-center justify-between text-hf-text-2 mb-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider">Previstos Hoje</span>
                      <CalendarDays size={18} className="text-zinc-400" />
                    </div>
                    <div>
                      <span className="text-2xl sm:text-3xl font-black text-hf-text">{previstosHoje.length}</span>
                      <span className="text-[10px] text-hf-text-2 block mt-0.5">de {colabsAtivos.length} colaboradores</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-emerald-700 mb-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider">Presentes</span>
                      <UserCheck size={18} className="text-emerald-700" />
                    </div>
                    <div>
                      <span className="text-2xl sm:text-3xl font-black text-emerald-800">{presentes.length}</span>
                      <span className="text-[10px] text-emerald-700/80 font-medium block mt-0.5">{trabalhando.length} no turno · {emIntervalo.length} em pausa</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-amber-700 mb-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider">Atrasados</span>
                      <Clock size={18} className="text-amber-700" />
                    </div>
                    <div>
                      <span className="text-2xl sm:text-3xl font-black text-amber-800">{atrasados.length}</span>
                      <span className="text-[10px] text-amber-700/80 font-medium block mt-0.5">sem entrada no horário</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-hf-surface border border-zinc-200/80 shadow-card flex flex-col justify-between">
                    <div className="flex items-center justify-between text-hf-text-2 mb-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider">Em Intervalo</span>
                      <Coffee size={18} className="text-zinc-400" />
                    </div>
                    <div>
                      <span className="text-2xl sm:text-3xl font-black text-hf-text">{emIntervalo.length}</span>
                      <span className="text-[10px] text-hf-text-2 block mt-0.5">pausa de refeição</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SEÇÃO 2: "PRECISA DA SUA ATENÇÃO" */}
            <div className="space-y-3 pt-2">
              <HubSectionHeader
                icon={AlertTriangle}
                title="Precisa da sua Atenção"
                badgeText={`${pontosIncompletos.length + equipeBancoAtencao.length} pendências`}
                badgeVariant={(pontosIncompletos.length + equipeBancoAtencao.length) > 0 ? "red" : "green"}
              />

              {pontosIncompletos.length === 0 && equipeBancoAtencao.length === 0 ? (
                <HubAttentionCard
                  variant="green"
                  icon={CheckCircle2}
                  title="Nenhuma pendência crítica ou inconsistência de ponto no momento."
                  subtitle="Todos os registros de ponto e horas estão em conformity."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pontosIncompletos.length > 0 && (
                    <HubAttentionCard
                      variant="red"
                      icon={AlertTriangle}
                      title="Ponto Incompleto / Sem Intervalo"
                      subtitle={`${pontosIncompletos.length} funcionário(s) finalizaram sem intervalo`}
                      actionButton={
                        <HubActionButton
                          onClick={() => router.push("/dashboard/rh/ponto")}
                          variant="danger"
                        >
                          Resolver
                        </HubActionButton>
                      }
                    />
                  )}

                  {equipeBancoAtencao.length > 0 && (
                    <HubAttentionCard
                      variant="amber"
                      icon={Clock}
                      title="Banco de Horas em Alerta"
                      subtitle={`${equipeBancoAtencao.length} colaborador(es) com acúmulo em limite`}
                      actionButton={
                        <HubActionButton
                          onClick={() => router.push("/dashboard/rh")}
                          variant="secondary"
                        >
                          Analisar
                        </HubActionButton>
                      }
                    />
                  )}
                </div>
              )}
            </div>

            {/* SEÇÃO 3: LANDSCAPE 2 COLUNAS — EQUIPE AGORA & BANCO DE HORAS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">

              {/* LISTA DE EQUIPE AGORA (2 COLUNAS LG) */}
              <div className="lg:col-span-2 space-y-3">
                <HubSectionHeader
                  icon={UserCheck}
                  title="Equipe Agora"
                  action={
                    <button
                      type="button"
                      onClick={() => setExpandirEquipe(!expandirEquipe)}
                      className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1 min-h-[44px] cursor-pointer"
                    >
                      <span>{expandirEquipe ? "Ver Menos" : `Ver Todos (${equipeProcessada.length})`}</span>
                      <ChevronRight size={14} />
                    </button>
                  }
                />

                {loading ? (
                  <HubSkeleton height="h-16" lines={3} />
                ) : (
                  <HubListContainer>
                    {equipeExibida.map(({ colaborador, horario, situacao, statusOperacional }) => (
                      <HubListItem key={colaborador.id}>
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`h-3 w-3 rounded-full shrink-0 ${
                            statusOperacional === "trabalhando" ? "bg-emerald-500" :
                            statusOperacional === "intervalo" ? "bg-emerald-700" :
                            statusOperacional === "atrasado" ? "bg-amber-500 animate-pulse" :
                            statusOperacional === "pendente" ? "bg-rose-500" :
                            statusOperacional === "encerrado" ? "bg-emerald-700" : "bg-slate-600"
                          }`} />

                          <div className="min-w-0">
                            <p className="font-extrabold text-hf-text text-xs sm:text-sm truncate">{colaborador.nome}</p>
                            <p className="text-[10px] text-hf-text-2 truncate">{colaborador.cargo || "Sem cargo"} · {colaborador.departamento || "Geral"}</p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold block border ${
                            statusOperacional === "trabalhando" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                            statusOperacional === "intervalo" ? "bg-zinc-100 text-zinc-800 border-zinc-200" :
                            statusOperacional === "atrasado" ? "bg-amber-50 text-amber-800 border-amber-200" :
                            statusOperacional === "pendente" ? "bg-rose-50 text-rose-800 border-rose-200" :
                            statusOperacional === "encerrado" ? "bg-zinc-100 text-zinc-700 border-zinc-200" : "bg-zinc-50 text-zinc-600 border-zinc-200"
                          }`}>
                            {statusOperacional === "trabalhando" ? "Trabalhando" :
                             statusOperacional === "intervalo" ? "☕ Intervalo" :
                             statusOperacional === "atrasado" ? "🟠 Atrasado" :
                             statusOperacional === "pendente" ? "🔴 Registro Pendente" :
                             statusOperacional === "encerrado" ? "Encerrado" : "Fora do Turno"}
                          </span>
                          {horario?.entrada && (
                            <span className="text-[10px] text-hf-text-2 block mt-0.5">Turno: {horario.entrada} - {horario.saida || "Fim"}</span>
                          )}
                        </div>
                      </HubListItem>
                    ))}
                  </HubListContainer>
                )}
              </div>

              {/* SEÇÃO BANCO DE HORAS RESUMO (1 COLUNA LG) */}
              <div className="space-y-3">
                <HubSectionHeader
                  icon={Clock}
                  title="Banco de Horas"
                  badgeText={`${equipeBancoAtencao.length} em alerta`}
                  badgeVariant={equipeBancoAtencao.length > 0 ? "amber" : "slate"}
                />

                <HubCardContainer className="space-y-3 flex flex-col justify-between">
                  <div>
                    {equipeBancoAtencao.length === 0 ? (
                      <p className="text-xs text-hf-text-2 italic py-4">Nenhum colaborador com acúmulo excessivo de banco de horas este mês.</p>
                    ) : (
                      <HubListContainer>
                        {equipeBancoAtencao.slice(0, 5).map(b => (
                          <HubListItem key={b.colaborador.id}>
                            <div className="min-w-0">
                              <p className="font-extrabold text-hf-text text-xs truncate">{b.colaborador.nome}</p>
                              <p className="text-[10px] text-hf-text-2">{b.colaborador.cargo || "Fixo"}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${b.minutos >= 480 ? "bg-rose-50 text-rose-800 border-rose-200" : "bg-amber-50 text-amber-800 border-amber-200"}`}>
                              {b.horas > 0 ? `+${b.horas}h` : `${b.horas}h`}
                            </span>
                          </HubListItem>
                        ))}
                      </HubListContainer>
                    )}
                  </div>

                  <HubActionButton
                    onClick={() => router.push("/dashboard/rh")}
                    variant="secondary"
                    icon={ArrowRight}
                    fullWidth
                    className="mt-4"
                  >
                    Analisar Banco Completo
                  </HubActionButton>
                </HubCardContainer>
              </div>

            </div>

            {/* SEÇÃO 4: AÇÕES RÁPIDAS OPERACIONAIS */}
            <div className="space-y-3 pt-2">
              <HubSectionHeader
                title="Ações Rápidas de RH"
              />

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/rh/gestao")}
                  className="p-3.5 rounded-2xl bg-hf-surface hover:bg-emerald-50/40 border border-zinc-200/80 hover:border-emerald-500/40 text-left transition-all min-h-[48px] flex items-center gap-3 cursor-pointer shadow-card hover:shadow-hover hf-card-interactive"
                >
                  <Users size={18} className="text-emerald-700 shrink-0" />
                  <span className="text-xs font-extrabold text-hf-text">Funcionários</span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/rh/ponto")}
                  className="p-3.5 rounded-2xl bg-hf-surface hover:bg-emerald-50/40 border border-zinc-200/80 hover:border-emerald-500/40 text-left transition-all min-h-[48px] flex items-center gap-3 cursor-pointer shadow-card hover:shadow-hover hf-card-interactive"
                >
                  <Clock size={18} className="text-zinc-400 shrink-0" />
                  <span className="text-xs font-extrabold text-hf-text">Espelho Ponto</span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/rh/ponto")}
                  className="p-3.5 rounded-2xl bg-hf-surface hover:bg-emerald-50/40 border border-zinc-200/80 hover:border-emerald-500/40 text-left transition-all min-h-[48px] flex items-center gap-3 cursor-pointer shadow-card hover:shadow-hover hf-card-interactive"
                >
                  <CalendarDays size={18} className="text-zinc-400 shrink-0" />
                  <span className="text-xs font-extrabold text-hf-text">Escalas</span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/rh")}
                  className="p-3.5 rounded-2xl bg-hf-surface hover:bg-emerald-50/40 border border-zinc-200/80 hover:border-emerald-500/40 text-left transition-all min-h-[48px] flex items-center gap-3 cursor-pointer shadow-card hover:shadow-hover hf-card-interactive"
                >
                  <Clock size={18} className="text-amber-700 shrink-0" />
                  <span className="text-xs font-extrabold text-hf-text">Banco Horas</span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/rh/extra")}
                  className="p-3.5 rounded-2xl bg-hf-surface hover:bg-emerald-50/40 border border-zinc-200/80 hover:border-emerald-500/40 text-left transition-all min-h-[48px] flex items-center gap-3 cursor-pointer shadow-card hover:shadow-hover hf-card-interactive"
                >
                  <Plus size={18} className="text-zinc-400 shrink-0" />
                  <span className="text-xs font-extrabold text-hf-text">+ Trabalho Extra</span>
                </button>

                {podeVerRecrutamento && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/rh/recrutamento")}
                    className="p-3.5 rounded-2xl bg-hf-surface hover:bg-emerald-50/40 border border-zinc-200/80 hover:border-emerald-500/40 text-left transition-all min-h-[48px] flex items-center gap-3 cursor-pointer shadow-card hover:shadow-hover hf-card-interactive"
                  >
                    <UserPlus size={18} className="text-teal-700 shrink-0" />
                    <span className="text-xs font-extrabold text-hf-text">Recrutamento</span>
                  </button>
                )}
              </div>
            </div>

            {/* SEÇÃO 5: MAIS FERRAMENTAS DE RH */}
            <div className="space-y-3 pt-2">
              <HubSectionHeader
                title="Mais Ferramentas do Setor"
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {podeVerValores && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/rh/fechamento")}
                    className="p-3.5 rounded-2xl bg-hf-surface hover:bg-emerald-50/40 border border-zinc-200/80 hover:border-emerald-500/40 text-left transition-all min-h-[48px] cursor-pointer shadow-card hover:shadow-hover hf-card-interactive"
                  >
                    <p className="text-xs font-bold text-hf-text truncate">Folha de Pagamento</p>
                    <p className="text-[10px] text-hf-text-2 mt-0.5">Fechamento e holerites</p>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/rh/ponto/corrigir")}
                  className="p-3.5 rounded-2xl bg-hf-surface hover:bg-emerald-50/40 border border-zinc-200/80 hover:border-emerald-500/40 text-left transition-all min-h-[48px] cursor-pointer shadow-card hover:shadow-hover hf-card-interactive"
                >
                  <p className="text-xs font-bold text-hf-text truncate">Corrigir Ponto</p>
                  <p className="text-[10px] text-hf-text-2 mt-0.5">Ajustes e justificativas</p>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/rh/organograma")}
                  className="p-3.5 rounded-2xl bg-hf-surface hover:bg-emerald-50/40 border border-zinc-200/80 hover:border-emerald-500/40 text-left transition-all min-h-[48px] cursor-pointer shadow-card hover:shadow-hover hf-card-interactive"
                >
                  <p className="text-xs font-bold text-hf-text truncate">Organograma</p>
                  <p className="text-[10px] text-hf-text-2 mt-0.5">Hierarquia e liderança</p>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/rh/cardapio-funcionarios")}
                  className="p-3.5 rounded-2xl bg-hf-surface hover:bg-emerald-50/40 border border-zinc-200/80 hover:border-emerald-500/40 text-left transition-all min-h-[48px] cursor-pointer shadow-card hover:shadow-hover hf-card-interactive"
                >
                  <p className="text-xs font-bold text-hf-text truncate">Cardápio Refeitório</p>
                  <p className="text-[10px] text-hf-text-2 mt-0.5">Refeição da equipe</p>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* ─── VISÃO PESSOAL ("MEU DIA") PARA COLABORADOR SEM PERMISSÃO GERENCIAL ─── */
          <div className="space-y-6">
            <HubCardContainer className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3">
                <h2 className="text-base font-black text-hf-text">Status do Meu Ponto Hoje</h2>
                <span className="text-xs text-emerald-700 font-bold">{minhaSituacaoPonto.texto}</span>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-hf-text-2">Horário Contratado Hoje:</p>
                  <p className="text-lg font-black text-hf-text">
                    {horarioDoDia(meuColaborador, diaDaSemana).entrada || "Turno Padrão"} - {horarioDoDia(meuColaborador, diaDaSemana).saida || "Saída"}
                  </p>
                </div>

                <HubActionButton
                  onClick={() => router.push("/dashboard/ponto")}
                  variant="primary"
                  icon={Clock}
                >
                  Bater Meu Ponto
                </HubActionButton>
              </div>
            </HubCardContainer>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <HubCardContainer>
                <h3 className="text-xs font-extrabold text-hf-text-2 uppercase tracking-wider mb-2">Meu Banco de Horas</h3>
                <p className="text-2xl font-black text-hf-text">{(meuBancoHoras / 60).toFixed(1)}h</p>
                <p className="text-[10px] text-hf-text-2 mt-1">Saldo acumulado este mês</p>
              </HubCardContainer>

              <button
                type="button"
                disabled={!meuColaborador}
                title={meuColaborador ? undefined : "Seu usuário não está ligado a um cadastro de funcionário."}
                onClick={() => meuColaborador && router.push(`/dashboard/rh/espelho/${meuColaborador.id}`)}
                className="p-5 rounded-2xl bg-hf-surface border border-zinc-200/80 hover:border-emerald-500/40 text-left transition-all flex flex-col justify-between min-h-[100px] cursor-pointer shadow-card hover:shadow-hover hf-card-interactive"
              >
                <div>
                  <h3 className="text-xs font-extrabold text-hf-text-2 uppercase tracking-wider mb-1">Meu Espelho</h3>
                  <p className="text-sm font-black text-hf-text">Ver histórico de batidas</p>
                </div>
                <ArrowRight size={16} className="text-emerald-700 self-end" />
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/rh/cardapio-funcionarios")}
                className="p-5 rounded-2xl bg-hf-surface border border-zinc-200/80 hover:border-emerald-500/40 text-left transition-all flex flex-col justify-between min-h-[100px] cursor-pointer shadow-card hover:shadow-hover hf-card-interactive"
              >
                <div>
                  <h3 className="text-xs font-extrabold text-hf-text-2 uppercase tracking-wider mb-1">Cardápio Equipe</h3>
                  <p className="text-sm font-black text-hf-text">Ver refeição do dia</p>
                </div>
                <ArrowRight size={16} className="text-emerald-700 self-end" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
