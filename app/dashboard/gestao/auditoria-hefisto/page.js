"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck, ShieldAlert, Lock, Unlock, Search, Filter, Calendar, User,
  CheckCircle2, AlertCircle, XCircle, RefreshCw, BarChart2, Layers, AlertTriangle
} from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { queryAuditEvents } from "../../../lib/hefisto-audit";
import { isSafeModeActive, setSafeMode, isKillSwitchActive, setKillSwitch, RISK_LEVELS } from "../../../lib/hefisto-policy";

export default function AuditoriaHefistoPage() {
  const { sessao, unidadeAtiva } = useERP();

  const [periodo, setPeriodo] = useState("hoje");
  const [filtroRisco, setFiltroRisco] = useState("TODOS");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [busca, setBusca] = useState("");

  const [safeMode, setSafeModeState] = useState(false);
  const [killSwitch, setKillSwitchState] = useState(false);
  const [eventos, setEventos] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const unitId = unidadeAtiva?.id || "matriz";

  const carregarDados = () => {
    setSafeModeState(isSafeModeActive(unitId));
    setKillSwitchState(isKillSwitchActive(unitId));

    const evs = queryAuditEvents({
      tenantId: unitId,
      periodKey: periodo,
      riskLevel: filtroRisco !== "TODOS" ? filtroRisco : null,
      executionStatus: filtroStatus !== "TODOS" ? filtroStatus : null
    });

    if (busca.trim()) {
      const q = busca.toLowerCase();
      setEventos(evs.filter(e =>
        e.textInput.toLowerCase().includes(q) ||
        e.userName.toLowerCase().includes(q) ||
        (e.actionId && e.actionId.toLowerCase().includes(q)) ||
        e.correlationId.toLowerCase().includes(q)
      ));
    } else {
      setEventos(evs);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [unitId, periodo, filtroRisco, filtroStatus, busca]);

  const toggleSafeMode = () => {
    const next = !safeMode;
    setSafeMode(unitId, next);
    setSafeModeState(next);
  };

  const toggleKillSwitch = () => {
    const next = !killSwitch;
    setKillSwitch(unitId, next);
    setKillSwitchState(next);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto text-slate-100 font-sans">
      {/* CABEÇALHO DA AUDITORIA DO HÉFISTO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-[#0B1528] border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">Auditoria & Governança do Héfisto</h1>
            <p className="text-xs text-slate-400">Rastreabilidade Determinística, Matriz de Risco e Modo Seguro</p>
          </div>
        </div>

        {/* PAINEL DE CONTROLE DE MODO SEGURO & KILL SWITCH */}
        <div className="flex flex-wrap items-center gap-3">
          {/* MODO SEGURO */}
          <button
            type="button"
            onClick={toggleSafeMode}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black border transition-all flex items-center gap-2 cursor-pointer min-h-[44px] ${
              safeMode
                ? "bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {safeMode ? <Lock size={16} /> : <Unlock size={16} />}
            <span>Modo Seguro: {safeMode ? "ATIVADO" : "DESATIVADO"}</span>
          </button>

          {/* KILL SWITCH */}
          <button
            type="button"
            onClick={toggleKillSwitch}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black border transition-all flex items-center gap-2 cursor-pointer min-h-[44px] ${
              killSwitch
                ? "bg-rose-500/20 border-rose-500/60 text-rose-300 hover:bg-rose-500/30 animate-pulse"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <ShieldAlert size={16} />
            <span>Kill Switch: {killSwitch ? "BLOQUEIO TOTAL" : "INATIVO"}</span>
          </button>
        </div>
      </div>

      {/* BARRA DE FILTROS E BUSCA */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* PERÍODO */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            {["hoje", "7dias", "30dias"].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodo(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold capitalize transition-colors ${
                  periodo === p ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                {p === "hoje" ? "Hoje" : p === "7dias" ? "7 Dias" : "30 Dias"}
              </button>
            ))}
          </div>

          {/* FILTRO RISCO */}
          <select
            value={filtroRisco}
            onChange={(e) => setFiltroRisco(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-300 outline-none"
          >
            <option value="TODOS">Todos os Riscos</option>
            <option value={RISK_LEVELS.READ_ONLY}>Somente Leitura</option>
            <option value={RISK_LEVELS.LOW_RISK_ACTION}>Baixo Risco</option>
            <option value={RISK_LEVELS.SENSITIVE_ACTION}>Sensíveis (F2)</option>
            <option value={RISK_LEVELS.HIGH_RISK_ACTION}>Alto Risco (Bloqueadas)</option>
          </select>

          {/* BUSCA */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar solicitação, usuário ou correlation ID..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 outline-none"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={carregarDados}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* LISTA E TABELA DE EVENTOS DE AUDITORIA */}
      <div className="bg-[#0B1528] border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Layers size={16} className="text-emerald-400" />
            <span>Trilha de Eventos Auditados ({eventos.length})</span>
          </h2>
          <span className="text-xs text-slate-400 font-medium">Isolamento de Tenant: {unitId}</span>
        </div>

        {eventos.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <ShieldCheck size={36} className="mx-auto text-slate-600" />
            <div className="text-sm font-bold text-slate-400">Nenhum evento registrado no período</div>
            <div className="text-xs">As solicitações e ações executadas pelo Héfisto aparecerão aqui.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Horário</th>
                  <th className="p-3.5">Usuário</th>
                  <th className="p-3.5">Solicitação / Texto</th>
                  <th className="p-3.5">Risco</th>
                  <th className="p-3.5">Permissão</th>
                  <th className="p-3.5">Aprovação</th>
                  <th className="p-3.5">Status Execução</th>
                  <th className="p-3.5 text-right">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {eventos.map((ev) => (
                  <tr key={ev.eventId} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-3.5 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                      {new Date(ev.timestamp).toLocaleTimeString("pt-BR")}
                    </td>
                    <td className="p-3.5 font-bold text-white">{ev.userName}</td>
                    <td className="p-3.5 max-w-xs truncate text-slate-200">{ev.textInput || "—"}</td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-md font-black text-[10px] uppercase ${
                        ev.riskLevel === "HIGH_RISK_ACTION" ? "bg-rose-950 text-rose-300 border border-rose-800" :
                        ev.riskLevel === "SENSITIVE_ACTION" ? "bg-amber-950 text-amber-300 border border-amber-800" :
                        ev.riskLevel === "LOW_RISK_ACTION" ? "bg-emerald-950 text-emerald-300 border border-emerald-800" :
                        "bg-slate-800 text-slate-300"
                      }`}>
                        {ev.riskLevel}
                      </span>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className={ev.permissionResult ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                        {ev.permissionResult ? "✓ Autorizada" : "✗ Negada"}
                      </span>
                    </td>
                    <td className="p-3.5 whitespace-nowrap text-slate-300">
                      {ev.approvalResult}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        ev.executionStatus === "SUCCEEDED" ? "bg-emerald-500/10 text-emerald-400" :
                        ev.executionStatus.startsWith("BLOCKED") ? "bg-rose-500/10 text-rose-400" :
                        "bg-slate-800 text-slate-400"
                      }`}>
                        {ev.executionStatus}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedEvent(ev)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        Ver Ficha
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE FICHA TÉCNICA DE AUDITORIA (DETALHES DO EVENTO) */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-lg bg-[#0B1528] border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="font-black text-white text-base">Ficha de Evento de Auditoria</div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300 font-medium">
              <div><span className="text-slate-500">Correlation ID:</span> <span className="font-mono text-emerald-400">{selectedEvent.correlationId}</span></div>
              <div><span className="text-slate-500">Horário:</span> {new Date(selectedEvent.timestamp).toLocaleString("pt-BR")}</div>
              <div><span className="text-slate-500">Usuário:</span> {selectedEvent.userName} (ID: {selectedEvent.userId})</div>
              <div><span className="text-slate-500">Solicitação:</span> "{selectedEvent.textInput}"</div>
              <div><span className="text-slate-500">Intenção / Ação:</span> {selectedEvent.intentId || selectedEvent.actionId || "N/A"}</div>
              <div><span className="text-slate-500">Nível de Risco:</span> {selectedEvent.riskLevel}</div>
              <div><span className="text-slate-500">Permissão Exigida:</span> {selectedEvent.permissionRequired || "Nenhuma"} ({selectedEvent.permissionResult ? "Ok" : "Falhou"})</div>
              <div><span className="text-slate-500">Aprovação do Usuário:</span> {selectedEvent.approvalResult}</div>
              <div><span className="text-slate-500">Status Execução:</span> {selectedEvent.executionStatus}</div>
              {selectedEvent.errorCode && (
                <div className="p-2 rounded-xl bg-rose-950/40 text-rose-300 border border-rose-900/60 font-mono">
                  Erro: {selectedEvent.errorCode}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedEvent(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Fechar Detalhes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
