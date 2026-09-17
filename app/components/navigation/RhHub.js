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
import { fmtBRL } from "../../components/ui";

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

    let statusOperacional = "fora_turno"; // trabalhando | intervalo | atrasado | pendente | encerrado | atestado | folga
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
  const semRegistroEsperado = equipeProcessada.filter(e => e.statusOperacional === "pendente");

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
    <div className="min-h-screen bg-[#070F1E] text-slate-100 font-sans pb-24 pt-4 px-3 sm:px-6 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* CABEÇALHO DO HUB RH & EQUIPE */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-4 sm:p-6 rounded-2xl border border-slate-800 backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
              <Users size={15} />
              <span>RH & Equipe · Central de Pessoas</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {podeVerGestaoRH ? "Situação Operacional da Equipe" : `Meu Dia · ${sessao?.nome || "Colaborador"}`}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              {dataCapitalizada} · {unidadeInfo?.nome || "Unidade"}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={carregarDadosRH}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700 active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Atualizar dados de ponto e equipe"
            >
              <RefreshCw size={18} className={loading ? "animate-spin text-emerald-400" : ""} />
            </button>

            {podeVerGestaoRH && onVerGestaoCompleta && (
              <button
                type="button"
                onClick={onVerGestaoCompleta}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm transition-all shadow-lg shadow-emerald-950/40 flex items-center gap-2 min-h-[44px]"
              >
                <Users size={16} />
                <span>Gestão Completa de RH</span>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-950/50 border border-red-800 text-red-300 text-sm font-bold">
            ⚠️ {error}
          </div>
        )}

        {/* ─── VISÃO GERENCIAL DE RH (GESTOR / ADMIN) ─── */}
        {podeVerGestaoRH ? (
          <>
            {/* SEÇÃO 1: "AGORA" — SITUAÇÃO OPERACIONAL DA EQUIPE HOJE */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-2xs font-extrabold uppercase tracking-wider">Previstos Hoje</span>
                  <CalendarDays size={18} className="text-slate-400" />
                </div>
                <div>
                  <span className="text-2xl sm:text-3xl font-black text-white">{previstosHoje.length}</span>
                  <span className="text-3xs text-slate-400 block mt-0.5">de {colabsAtivos.length} colaboradores</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/40 flex flex-col justify-between">
                <div className="flex items-center justify-between text-emerald-400 mb-2">
                  <span className="text-2xs font-extrabold uppercase tracking-wider">Presentes</span>
                  <UserCheck size={18} className="text-emerald-400" />
                </div>
                <div>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-400">{presentes.length}</span>
                  <span className="text-3xs text-emerald-300/80 block mt-0.5">{trabalhando.length} no turno · {emIntervalo.length} em pausa</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/40 flex flex-col justify-between">
                <div className="flex items-center justify-between text-amber-400 mb-2">
                  <span className="text-2xs font-extrabold uppercase tracking-wider">Atrasados</span>
                  <Clock size={18} className="text-amber-400" />
                </div>
                <div>
                  <span className="text-2xl sm:text-3xl font-black text-amber-400">{atrasados.length}</span>
                  <span className="text-3xs text-amber-300/80 block mt-0.5">sem entrada no horário</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-sky-950/30 border border-sky-800/40 flex flex-col justify-between">
                <div className="flex items-center justify-between text-sky-400 mb-2">
                  <span className="text-2xs font-extrabold uppercase tracking-wider">Em Intervalo</span>
                  <Coffee size={18} className="text-sky-400" />
                </div>
                <div>
                  <span className="text-2xl sm:text-3xl font-black text-sky-400">{emIntervalo.length}</span>
                  <span className="text-3xs text-sky-300/80 block mt-0.5">pausa de refeição</span>
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: "PRECISA DA SUA ATENÇÃO" (ALERTAS E EXCEÇÕES DE RH) */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-400" />
                  <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">Precisa da sua Atenção</h2>
                </div>
                <span className="text-xs text-slate-400 font-semibold">
                  {pontosIncompletos.length + equipeBancoAtencao.length} pendências ativas
                </span>
              </div>

              {pontosIncompletos.length === 0 && equipeBancoAtencao.length === 0 ? (
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/40 flex items-center gap-3 text-emerald-300 text-xs font-bold">
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                  <span>Nenhuma pendência crítica ou inconsistência de ponto no momento.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pontosIncompletos.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-900/40 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                        <div>
                          <p className="text-xs font-extrabold text-white">Ponto Incompleto / Sem Intervalo</p>
                          <p className="text-3xs text-slate-400">{pontosIncompletos.length} funcionário(s) finalizaram sem intervalo</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => router.push("/dashboard/rh/ponto")}
                        className="px-3 py-1.5 rounded-lg bg-red-900/50 hover:bg-red-800/70 border border-red-700 text-red-200 text-3xs font-extrabold transition-all min-h-[36px]"
                      >
                        Resolver
                      </button>
                    </div>
                  )}

                  {equipeBancoAtencao.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-900/40 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full bg-amber-500" />
                        <div>
                          <p className="text-xs font-extrabold text-white">Banco de Horas em Alerta</p>
                          <p className="text-3xs text-slate-400">{equipeBancoAtencao.length} colaborador(es) com $\ge 6\text{h}$ acumuladas</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => router.push("/dashboard/rh")}
                        className="px-3 py-1.5 rounded-lg bg-amber-900/50 hover:bg-amber-800/70 border border-amber-700 text-amber-200 text-3xs font-extrabold transition-all min-h-[36px]"
                      >
                        Analisar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SEÇÃO 3: LANDSCAPE 2 COLUNAS — EQUIPE AGORA & BANCO DE HORAS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* LISTA DE EQUIPE AGORA (2 COLUNAS LG) */}
              <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <UserCheck size={18} className="text-emerald-400" />
                    <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">Equipe Agora</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandirEquipe(!expandirEquipe)}
                    className="text-2xs font-extrabold text-emerald-400 hover:underline min-h-[36px] flex items-center gap-1"
                  >
                    <span>{expandirEquipe ? "Ver Menos" : `Ver Todos (${equipeProcessada.length})`}</span>
                    <ChevronRight size={14} />
                  </button>
                </div>

                <div className="divide-y divide-slate-800/60">
                  {equipeExibida.map(({ colaborador, horario, situacao, statusOperacional }) => (
                    <div key={colaborador.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                          statusOperacional === "trabalhando" ? "bg-emerald-500" :
                          statusOperacional === "intervalo" ? "bg-purple-500" :
                          statusOperacional === "atrasado" ? "bg-amber-500 animate-pulse" :
                          statusOperacional === "pendente" ? "bg-red-500" :
                          statusOperacional === "encerrado" ? "bg-blue-500" : "bg-slate-600"
                        }`} />

                        <div className="min-w-0">
                          <p className="font-extrabold text-white truncate">{colaborador.nome}</p>
                          <p className="text-3xs text-slate-400 truncate">{colaborador.cargo || "Sem cargo"} · {colaborador.departamento || "Geral"}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`px-2.5 py-1 rounded-md text-3xs font-extrabold block ${
                          statusOperacional === "trabalhando" ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/50" :
                          statusOperacional === "intervalo" ? "bg-purple-950/60 text-purple-300 border border-purple-800/50" :
                          statusOperacional === "atrasado" ? "bg-amber-950/60 text-amber-400 border border-amber-800/50" :
                          statusOperacional === "pendente" ? "bg-red-950/60 text-red-400 border border-red-800/50" :
                          statusOperacional === "encerrado" ? "bg-blue-950/60 text-blue-400 border border-blue-800/50" : "bg-slate-800 text-slate-400"
                        }`}>
                          {statusOperacional === "trabalhando" ? "Trabalhando" :
                           statusOperacional === "intervalo" ? "☕ Intervalo" :
                           statusOperacional === "atrasado" ? "🟠 Atrasado" :
                           statusOperacional === "pendente" ? "🔴 Registro Pendente" :
                           statusOperacional === "encerrado" ? "Encerrado" : "Fora do Turno"}
                        </span>
                        {horario?.entrada && (
                          <span className="text-3xs text-slate-400 block mt-0.5">Turno: {horario.entrada} - {horario.saida || "Fim"}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SEÇÃO BANCO DE HORAS RESUMO (1 COLUNA LG) */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <Clock size={18} className="text-amber-400" />
                      <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">Banco de Horas</h2>
                    </div>
                    <span className="text-3xs font-extrabold text-slate-400">{equipeBancoAtencao.length} em alerta</span>
                  </div>

                  {equipeBancoAtencao.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4">Nenhum colaborador com acúmulo excessivo de banco de horas este mês.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {equipeBancoAtencao.slice(0, 5).map(b => (
                        <div key={b.colaborador.id} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-extrabold text-white truncate">{b.colaborador.nome}</p>
                            <p className="text-3xs text-slate-400">{b.colaborador.cargo || "Fixo"}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs font-black ${b.minutos >= 480 ? "bg-red-950 text-red-400 border border-red-800" : "bg-amber-950 text-amber-400 border border-amber-800"}`}>
                            {b.horas > 0 ? `+${b.horas}h` : `${b.horas}h`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/rh")}
                  className="w-full mt-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-extrabold transition-all border border-slate-700 flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <span>Analisar Banco Completo</span>
                  <ArrowRight size={14} />
                </button>
              </div>

            </div>

            {/* SEÇÃO 4: AÇÕES RÁPIDAS OPERACIONAIS (TARGETS >= 44PX) */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">Ações Rápidas de RH</h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/rh/gestao")}
                  className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all min-h-[48px] flex items-center gap-3 active:scale-95"
                >
                  <Users size={18} className="text-emerald-400 shrink-0" />
                  <span className="text-xs font-extrabold text-white">Funcionários</span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/rh/ponto")}
                  className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all min-h-[48px] flex items-center gap-3 active:scale-95"
                >
                  <Clock size={18} className="text-sky-400 shrink-0" />
                  <span className="text-xs font-extrabold text-white">Espelho Ponto</span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/rh/ponto")}
                  className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all min-h-[48px] flex items-center gap-3 active:scale-95"
                >
                  <CalendarDays size={18} className="text-indigo-400 shrink-0" />
                  <span className="text-xs font-extrabold text-white">Escalas</span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/rh")}
                  className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all min-h-[48px] flex items-center gap-3 active:scale-95"
                >
                  <Clock size={18} className="text-amber-400 shrink-0" />
                  <span className="text-xs font-extrabold text-white">Banco Horas</span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/rh/extra")}
                  className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all min-h-[48px] flex items-center gap-3 active:scale-95"
                >
                  <Plus size={18} className="text-purple-400 shrink-0" />
                  <span className="text-xs font-extrabold text-white">+ Trabalho Extra</span>
                </button>

                {podeVerRecrutamento && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/rh/recrutamento")}
                    className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all min-h-[48px] flex items-center gap-3 active:scale-95"
                  >
                    <UserPlus size={18} className="text-teal-400 shrink-0" />
                    <span className="text-xs font-extrabold text-white">Recrutamento</span>
                  </button>
                )}
              </div>
            </div>

            {/* SEÇÃO 5: MAIS FERRAMENTAS DE RH */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">Mais Ferramentas do Setor</h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {podeVerValores && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/rh/fechamento")}
                    className="p-3 rounded-xl bg-slate-900/40 hover:bg-slate-800/80 border border-slate-800 text-left transition-all min-h-[48px]"
                  >
                    <p className="text-xs font-bold text-white truncate">Folha de Pagamento</p>
                    <p className="text-3xs text-slate-400">Fechamento e holerites</p>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/rh/facial")}
                  className="p-3 rounded-xl bg-slate-900/40 hover:bg-slate-800/80 border border-slate-800 text-left transition-all min-h-[48px]"
                >
                  <p className="text-xs font-bold text-white truncate">Ponto Facial</p>
                  <p className="text-3xs text-slate-400">Reconhecimento por foto</p>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/rh/organograma")}
                  className="p-3 rounded-xl bg-slate-900/40 hover:bg-slate-800/80 border border-slate-800 text-left transition-all min-h-[48px]"
                >
                  <p className="text-xs font-bold text-white truncate">Organograma</p>
                  <p className="text-3xs text-slate-400">Hierarquia e liderança</p>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/rh/cardapio-funcionarios")}
                  className="p-3 rounded-xl bg-slate-900/40 hover:bg-slate-800/80 border border-slate-800 text-left transition-all min-h-[48px]"
                >
                  <p className="text-xs font-bold text-white truncate">Cardápio Refeitório</p>
                  <p className="text-3xs text-slate-400">Refeição da equipe</p>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* ─── VISÃO PESSOAL ("MEU DIA") PARA COLABORADOR SEM PERMISSÃO GERENCIAL ─── */
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-base font-black text-white">Status do Meu Ponto Hoje</h2>
                <span className="text-xs text-emerald-400 font-bold">{minhaSituacaoPonto.texto}</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-400">Horário Contratado Hoje:</p>
                  <p className="text-lg font-black text-white">
                    {horarioDoDia(meuColaborador, diaDaSemana).entrada || "Turno Padrão"} - {horarioDoDia(meuColaborador, diaDaSemana).saida || "Saída"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/ponto")}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all shadow-lg min-h-[48px] flex items-center justify-center gap-2"
                >
                  <Clock size={18} />
                  <span>Bater Meu Ponto</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
                <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Meu Banco de Horas</h3>
                <p className="text-2xl font-black text-white">{(meuBancoHoras / 60).toFixed(1)}h</p>
                <p className="text-3xs text-slate-400 mt-1">Saldo acumulado este mês</p>
              </div>

              <button
                type="button"
                onClick={() => router.push("/dashboard/rh/colaborador")}
                className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 text-left transition-all flex flex-col justify-between min-h-[100px]"
              >
                <div>
                  <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1">Meu Espelho</h3>
                  <p className="text-sm font-black text-white">Ver histórico de batidas</p>
                </div>
                <ArrowRight size={16} className="text-emerald-400 self-end" />
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/rh/cardapio-funcionarios")}
                className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 text-left transition-all flex flex-col justify-between min-h-[100px]"
              >
                <div>
                  <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1">Cardápio Equipe</h3>
                  <p className="text-sm font-black text-white">Ver refeição do dia</p>
                </div>
                <ArrowRight size={16} className="text-emerald-400 self-end" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
