"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, XCircle, AlertTriangle, ShieldAlert, Clock, Loader2, Check } from "lucide-react";

export default function AgentConfirmationCard({ confirmation, onConfirmed, onCancelled }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [executedResult, setExecutedResult] = useState(null);
  const [status, setStatus] = useState(confirmation?.status || "PENDING");
  const [timeLeftSec, setTimeLeftSec] = useState(600); // 10 min

  const preview = confirmation?.preview || {};
  const fields = preview.fields || [];
  const riskLevel = confirmation?.riskLevel || preview.riskLevel || "MEDIUM";
  const confirmationId = confirmation?.confirmationId || confirmation?.confirmation_id;

  useEffect(() => {
    if (!confirmation?.expiresAt) return;
    const expiresMs = new Date(confirmation.expiresAt).getTime();

    const interval = setInterval(() => {
      const remainingSec = Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
      setTimeLeftSec(remainingSec);
      if (remainingSec === 0 && status === "PENDING") {
        setStatus("EXPIRED");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [confirmation?.expiresAt, status]);

  const minStr = String(Math.floor(timeLeftSec / 60)).padStart(2, "0");
  const secStr = String(timeLeftSec % 60).padStart(2, "0");

  async function handleConfirm() {
    if (loading || status !== "PENDING") return;
    setLoading(true);
    setError(null);

    try {
      if (typeof window !== "undefined" && window.hefistoExecuteConfirmation) {
        const res = await window.hefistoExecuteConfirmation(confirmationId);
        setExecutedResult(res);
        setStatus("EXECUTED");
        if (onConfirmed) onConfirmed(res);
      } else {
        // Fallback simulação de API local
        const { executeConfirmedTool } = await import("../../lib/confirmation-engine.js");
        const res = await executeConfirmedTool({ confirmationId, session: { usuarioId: "user-test" } });
        setExecutedResult(res);
        setStatus("EXECUTED");
        if (onConfirmed) onConfirmed(res);
      }
    } catch (err) {
      console.error("Erro ao executar ação confirmada:", err);
      setError(err.message || "Falha ao executar confirmação.");
      setStatus("FAILED");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (loading || status !== "PENDING") return;
    setLoading(true);
    try {
      if (typeof window !== "undefined" && window.hefistoCancelConfirmation) {
        await window.hefistoCancelConfirmation(confirmationId);
      } else {
        const { cancelConfirmation } = await import("../../lib/confirmation-engine.js");
        await cancelConfirmation({ confirmationId });
      }
      setStatus("CANCELLED");
      if (onCancelled) onCancelled(confirmationId);
    } catch (err) {
      console.error("Erro ao cancelar:", err);
    } finally {
      setLoading(false);
    }
  }

  const isHighRisk = riskLevel === "HIGH";

  return (
    <div className={`my-3 p-4 rounded-2xl border transition-all ${
      status === "EXECUTED"
        ? "bg-emerald-950/40 border-emerald-500/40"
        : status === "CANCELLED" || status === "EXPIRED" || status === "FAILED"
        ? "bg-slate-900/60 border-slate-700/60 opacity-75"
        : isHighRisk
        ? "bg-rose-950/30 border-rose-500/50 shadow-lg shadow-rose-950/20"
        : "bg-slate-900 border-amber-500/40 shadow-lg shadow-amber-950/20"
    }`}>
      {/* Header do Cartão de Confirmação */}
      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {isHighRisk ? (
            <ShieldAlert size={18} className="text-rose-400 shrink-0" />
          ) : (
            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
          )}
          <span className="text-xs font-black uppercase tracking-wider text-slate-200">
            {preview.title || "Confirmação de Ação Requerida"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Badge de Risco */}
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
            isHighRisk ? "bg-rose-500/20 text-rose-300 border border-rose-500/40" : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
          }`}>
            Risco {riskLevel}
          </span>

          {/* Countdown Timer */}
          {status === "PENDING" && (
            <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md">
              <Clock size={12} className="text-slate-400" />
              <span>{minStr}:{secStr}</span>
            </div>
          )}
        </div>
      </div>

      {/* Resumo */}
      {preview.summary && (
        <p className="text-xs text-slate-300 mb-3 font-medium leading-relaxed">
          {preview.summary}
        </p>
      )}

      {/* Campos Detalhados */}
      <div className="grid grid-cols-2 gap-2 mb-4 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
        {fields.map((f, idx) => (
          <div key={idx} className={f.fullWidth ? "col-span-2" : "col-span-1"}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              {f.label}
            </span>
            <span className="text-xs font-bold text-slate-100 block truncate">
              {f.value}
            </span>
          </div>
        ))}
      </div>

      {/* Exibição de Erro */}
      {error && (
        <div className="mb-3 p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs font-semibold flex items-center gap-2">
          <XCircle size={16} className="shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Ações / Status Final */}
      {status === "PENDING" && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer border border-slate-700 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 shadow-md disabled:opacity-50 ${
              isHighRisk
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30"
            }`}
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Processando...</span>
              </>
            ) : (
              <>
                <Check size={14} />
                <span>Confirmar Ação</span>
              </>
            )}
          </button>
        </div>
      )}

      {status === "EXECUTED" && (
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-950/50 p-2.5 rounded-xl border border-emerald-500/30">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
          <span>Ação executada com sucesso e auditada no sistema.</span>
        </div>
      )}

      {status === "CANCELLED" && (
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50">
          <XCircle size={16} className="shrink-0 text-slate-400" />
          <span>Operação cancelada pelo usuário. O banco de dados não foi alterado.</span>
        </div>
      )}

      {status === "EXPIRED" && (
        <div className="flex items-center gap-2 text-xs font-bold text-amber-400 bg-amber-950/50 p-2.5 rounded-xl border border-amber-500/30">
          <Clock size={16} className="shrink-0 text-amber-400" />
          <span>Esta confirmação expirou. Solicite a ação novamente para gerar uma nova prévia.</span>
        </div>
      )}
    </div>
  );
}
