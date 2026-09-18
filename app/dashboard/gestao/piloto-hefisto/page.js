"use client";

import React, { useState, useEffect } from "react";
import {
  Compass, Package, ChefHat, FileText, Zap, Inbox, Sparkles, Tag,
  ArrowDownCircle, ArrowUpCircle, AlertTriangle, CheckSquare, Lock, ShieldCheck,
  CheckCircle2, XCircle, RefreshCw, Users, Clock, TrendingUp, BarChart2,
  AlertCircle, ThumbsDown, HelpCircle, Activity, ToggleLeft, ToggleRight
} from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import {
  getPilotConfig, updatePilotCapability, calculatePilotMetrics,
  getDeduplicatedPilotIssues, PILOT_CAPABILITIES_CATALOG, TASK_BASELINES_SEC
} from "../../../lib/hefisto-pilot.js";

export default function PilotoHefistoPage() {
  const { sessao, unidadeAtiva } = useERP();

  const [periodo, setPeriodo] = useState("hoje");
  const [config, setConfig] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [issues, setIssues] = useState([]);

  const unitId = unidadeAtiva?.id || "matriz";

  const carregarDados = () => {
    const cfg = getPilotConfig(unitId);
    setConfig(cfg);
    const met = calculatePilotMetrics({ tenantId: unitId, periodKey: periodo });
    setMetrics(met);
    const iss = getDeduplicatedPilotIssues({ tenantId: unitId });
    setIssues(iss);
  };

  useEffect(() => {
    carregarDados();
  }, [unitId, periodo]);

  const toggleCapability = (capabilityId, currentStatus) => {
    const res = updatePilotCapability({
      tenantId: unitId,
      capabilityId,
      enabled: !currentStatus
    });

    if (!res.success) {
      alert(res.message || "Não foi possível alterar a capacidade.");
    } else {
      carregarDados();
    }
  };

  const group1Caps = PILOT_CAPABILITIES_CATALOG.filter(c => c.group === 1);
  const group2Caps = PILOT_CAPABILITIES_CATALOG.filter(c => c.group === 2);
  const group3Caps = PILOT_CAPABILITIES_CATALOG.filter(c => c.group === 3);
  const prohibitedCaps = PILOT_CAPABILITIES_CATALOG.filter(c => c.group === "PROHIBITED");

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto text-slate-100 font-sans">
      {/* CABEÇALHO DO PAINEL DO PILOTO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-[#0B1528] border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
            <Compass size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white tracking-tight">HÉFISTO · PILOTO OPERACIONAL</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase">
                Piloto Ativo
              </span>
            </div>
            <p className="text-xs text-slate-400">Adoção Controlada, Liberação Gradual de Capacidades e Medição de Valor (F14)</p>
          </div>
        </div>

        {/* SELETOR DE PERÍODO & REFRESH */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-900/80 p-1 rounded-2xl border border-slate-800 text-xs">
            <button
              onClick={() => setPeriodo("hoje")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${periodo === "hoje" ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20" : "text-slate-400 hover:text-white"}`}
            >
              Hoje
            </button>
            <button
              onClick={() => setPeriodo("7dias")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${periodo === "7dias" ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20" : "text-slate-400 hover:text-white"}`}
            >
              7 Dias
            </button>
            <button
              onClick={() => setPeriodo("30dias")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${periodo === "30dias" ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20" : "text-slate-400 hover:text-white"}`}
            >
              30 Dias
            </button>
          </div>

          <button
            onClick={carregarDados}
            className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400 transition-all cursor-pointer min-h-[40px]"
            title="Atualizar Métricas"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* PAINEL DOS 4 SINAIS DE VALOR (ADOÇÃO, QUALIDADE, EFICIÊNCIA, SEGURANÇA) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* SINAL 1: ADOÇÃO */}
        <div className="p-4 rounded-3xl bg-[#0B1528] border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={14} /> ADOÇÃO
            </span>
            <span className="text-[10px] text-slate-500">Recorrência</span>
          </div>
          <div className="text-2xl font-black text-white">{metrics?.signals?.adoption?.totalRequests || 0} <span className="text-xs font-normal text-slate-400">pedidos</span></div>
          <div className="text-xs text-slate-400 space-y-0.5">
            <div>Usuários Ativos: <strong className="text-slate-200">{metrics?.signals?.adoption?.activeUsersCount || 0}</strong></div>
            <div>Dias com Uso: <strong className="text-slate-200">{metrics?.signals?.adoption?.activeDaysCount || 0} dias</strong></div>
          </div>
        </div>

        {/* SINAL 2: QUALIDADE */}
        <div className="p-4 rounded-3xl bg-[#0B1528] border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 size={14} /> QUALIDADE
            </span>
            <span className="text-[10px] text-slate-500">Conclusão</span>
          </div>
          <div className="text-2xl font-black text-emerald-400">{metrics?.signals?.quality?.taskSuccessRatePercent || 100}%</div>
          <div className="text-xs text-slate-400 space-y-0.5">
            <div>Taxa de Correção: <strong className="text-amber-300">{metrics?.signals?.quality?.correctionRatePercent || 0}%</strong></div>
            <div>Esclarecimentos: <strong className="text-slate-200">{metrics?.signals?.quality?.clarificationsCount || 0}</strong></div>
          </div>
        </div>

        {/* SINAL 3: EFICIÊNCIA ESTIMADA */}
        <div className="p-4 rounded-3xl bg-[#0B1528] border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} /> EFICIÊNCIA
            </span>
            <span className="text-[10px] text-slate-500">Vs Baseline</span>
          </div>
          <div className="text-2xl font-black text-cyan-400">~{metrics?.signals?.efficiency?.estimatedSavedMinutes || 0} <span className="text-xs font-normal text-slate-400">min economizados</span></div>
          <div className="text-xs text-slate-400 space-y-0.5">
            <div>Tempo Médio Héfisto: <strong className="text-cyan-300">{metrics?.signals?.efficiency?.avgHefistoTimeSec || 0}s</strong> por tarefa</div>
          </div>
        </div>

        {/* SINAL 4: SEGURANÇA */}
        <div className="p-4 rounded-3xl bg-[#0B1528] border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={14} /> SEGURANÇA
            </span>
            <span className="text-[10px] text-slate-500">Release Gate</span>
          </div>
          <div className="text-2xl font-black text-emerald-400">{metrics?.signals?.safety?.safetyPassStatus || "PASS"}</div>
          <div className="text-xs text-slate-400 space-y-0.5">
            <div>Incidentes F13: <strong className="text-slate-200">{metrics?.signals?.safety?.incidentsCount || 0}</strong></div>
            <div>Bloqueios de Política: <strong className="text-slate-200">{metrics?.signals?.safety?.policyBlockedCount || 0}</strong></div>
          </div>
        </div>
      </div>

      {/* MATRIZ DE CAPACIDADES DO PILOTO (ROLLOUT GRID) */}
      <div className="p-5 rounded-3xl bg-[#0B1528] border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <ToggleRight size={18} className="text-amber-400" />
            Matriz de Controle de Capacidades do Piloto
          </h2>
          <span className="text-xs text-slate-400">Liberação gradual configurada por empresa</span>
        </div>

        {/* GRUPO 1 */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Grupo 1: Consultas & Navegação (Baixo Risco — Padrão Liberado)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {group1Caps.map(cap => {
              const isEnabled = config?.capabilities?.[cap.id] === true;
              return (
                <div key={cap.id} className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-200">{cap.name}</div>
                    <div className="text-[10px] text-slate-400">ID: {cap.id}</div>
                  </div>
                  <button
                    onClick={() => toggleCapability(cap.id, isEnabled)}
                    className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all ${
                      isEnabled ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    {isEnabled ? "HABILITADO" : "DESATIVADO"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* GRUPO 2 & 3 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* GRUPO 2: ETIQUETAS */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Grupo 2: Etiquetas TSPL WebUSB</h3>
            {group2Caps.map(cap => {
              const isEnabled = config?.capabilities?.[cap.id] === true;
              return (
                <div key={cap.id} className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-200">{cap.name}</div>
                    <div className="text-[10px] text-slate-400">Fluxo TSPL MDK-022 pré-validado</div>
                  </div>
                  <button
                    onClick={() => toggleCapability(cap.id, isEnabled)}
                    className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all ${
                      isEnabled ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    {isEnabled ? "HABILITADO" : "DESATIVADO"}
                  </button>
                </div>
              );
            })}
          </div>

          {/* GRUPO 3: AÇÕES F2 */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Grupo 3: Ações Controladas F2 (Requer Confirmação)</h3>
            <div className="space-y-2">
              {group3Caps.map(cap => {
                const isEnabled = config?.capabilities?.[cap.id] === true;
                return (
                  <div key={cap.id} className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-200">{cap.name}</div>
                      <div className="text-[10px] text-amber-400/80 font-medium">Exige Preview F2 + Etapa de Confirmação</div>
                    </div>
                    <button
                      onClick={() => toggleCapability(cap.id, isEnabled)}
                      className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all ${
                        isEnabled ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-slate-800 text-slate-500"
                      }`}
                    >
                      {isEnabled ? "HABILITADO" : "DESATIVADO"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* GRUPO PROIBIDO */}
        <div className="pt-2 space-y-2">
          <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
            <Lock size={13} /> Grupo Proibido (Permanentemente Fora de Autonomia da IA)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {prohibitedCaps.map(cap => (
              <div key={cap.id} className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-500/20 text-rose-300 text-[11px] flex items-center justify-between opacity-80">
                <span>{cap.name}</span>
                <Lock size={12} className="shrink-0 text-rose-400" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RESUMO DE COMPARATIVO DE BASELINE DE TAREFAS */}
      <div className="p-5 rounded-3xl bg-[#0B1528] border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <BarChart2 size={16} className="text-cyan-400" />
          Metodologia de Medição de Tempo por Tarefa (Baseline Tradicional vs Héfisto)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="font-bold text-slate-200">Consultar Estoque de Item</div>
            <div className="text-slate-400 text-[11px]">Tradicional: <strong className="text-amber-300">45s</strong> · Héfisto: <strong className="text-emerald-400">8s</strong></div>
            <div className="text-[10px] text-cyan-400 font-bold">Economia: ~37s por busca</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="font-bold text-slate-200">Consultar Produção do Dia</div>
            <div className="text-slate-400 text-[11px]">Tradicional: <strong className="text-amber-300">40s</strong> · Héfisto: <strong className="text-emerald-400">6s</strong></div>
            <div className="text-[10px] text-cyan-400 font-bold">Economia: ~34s por busca</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="font-bold text-slate-200">Impressão de Etiqueta TSPL</div>
            <div className="text-slate-400 text-[11px]">Tradicional: <strong className="text-amber-300">35s</strong> · Héfisto: <strong className="text-emerald-400">10s</strong></div>
            <div className="text-[10px] text-cyan-400 font-bold">Economia: ~25s por lote</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="font-bold text-slate-200">Briefing de Abertura</div>
            <div className="text-slate-400 text-[11px]">Tradicional: <strong className="text-amber-300">120s</strong> · Héfisto: <strong className="text-emerald-400">15s</strong></div>
            <div className="text-[10px] text-cyan-400 font-bold">Economia: ~105s por turno</div>
          </div>
        </div>
      </div>

      {/* PROBLEMAS DO PILOTO DEDUPLICADOS (PILOT ISSUES) */}
      <div className="p-5 rounded-3xl bg-[#0B1528] border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-400" />
            Problemas Reportados no Piloto (Deduplicados)
          </h2>
          <span className="text-xs text-slate-400">Revisão Humana Obrigatoria para Inclusão em Evals</span>
        </div>

        {issues.length === 0 ? (
          <div className="p-6 text-center text-xs text-emerald-400/80 bg-emerald-950/10 border border-emerald-500/20 rounded-2xl font-bold">
            ✓ Nenhum problema ou atrito técnico reportado durante o piloto.
          </div>
        ) : (
          <div className="space-y-3">
            {issues.map((iss, i) => (
              <div key={i} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px] uppercase">{iss.issueType}</span>
                    <span className="font-bold text-slate-200">{iss.capability} na rota <code className="text-slate-400">{iss.route}</code></span>
                  </div>
                  {iss.comments.length > 0 && <p className="text-slate-300 italic text-[11px]">"{iss.comments[0]}"</p>}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 font-bold text-xs">{iss.count} ocorrência(s)</span>
                  <button
                    onClick={() => alert(`Ocorrência ${iss.key} candidata a fixture F11.`)}
                    className="px-3 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold hover:bg-cyan-500/30 text-xs transition-all cursor-pointer"
                  >
                    + Add to Eval Set
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
