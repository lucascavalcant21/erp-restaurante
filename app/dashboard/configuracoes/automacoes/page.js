"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Clock, Calendar, Sparkles, CheckCircle2, AlertTriangle, ShieldCheck,
  Play, RefreshCw, Lock, ArrowRight, Eye, Power, AlertCircle
} from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import {
  getAutomationsForTenant,
  updateAutomation,
  triggerScheduledAutomations,
  getAutomationHistory
} from "../../../lib/hefisto-automations";
import { HubHeader, HubCard, HubStatusBadge, HubActionButton } from "../../../components/navigation/HubPrimitives";

const DIAS_SEMANA = [
  { id: 1, label: "Seg" },
  { id: 2, label: "Ter" },
  { id: 3, label: "Qua" },
  { id: 4, label: "Qui" },
  { id: 5, label: "Sex" },
  { id: 6, label: "Sáb" },
  { id: 7, label: "Dom" }
];

export default function AutomacoesPage() {
  const router = useRouter();
  const { sessao, unidadeAtiva } = useERP();

  const [automacoes, setAutomacoes] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewModal, setPreviewModal] = useState(null);

  useEffect(() => {
    carregarDados();
  }, [unidadeAtiva, sessao]);

  const carregarDados = () => {
    const list = getAutomationsForTenant(unidadeAtiva || "unidade-padrao", sessao);
    setAutomacoes([...list]);
    const hist = getAutomationHistory(unidadeAtiva || "unidade-padrao", 15);
    setHistorico([...hist]);
  };

  const handleToggle = (auto) => {
    setPreviewModal({
      automation: auto,
      newEnabled: !auto.enabled,
      newTime: auto.scheduleTime,
      newDays: [...auto.scheduleDays]
    });
  };

  const salvarAlteracoes = () => {
    if (!previewModal) return;
    const { automation, newEnabled, newTime, newDays } = previewModal;

    updateAutomation(unidadeAtiva || "unidade-padrao", automation.id, {
      enabled: newEnabled,
      scheduleTime: newTime,
      scheduleDays: newDays
    }, sessao);

    setPreviewModal(null);
    carregarDados();
  };

  const executarManual = async (automationId) => {
    setLoading(true);
    try {
      await triggerScheduledAutomations({
        tenantId: unidadeAtiva || "unidade-padrao",
        ownerSession: sessao,
        forceOccurrenceKey: `manual-${Date.now()}`
      });
      carregarDados();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070D18] text-slate-100 p-4 sm:p-6 md:p-8 space-y-6">
      {/* CABEÇALHO DO MÓDULO */}
      <HubHeader
        title="Automações do Héfisto"
        subtitle="Agendamentos programados de briefings e verificações operacionais"
        icon={Sparkles}
        badgeText="F9 — Read-Only Automation"
        badgeVariant="success"
      />

      {/* BANNER INFORMATIVO DE SEGURANÇA */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-start gap-3">
        <ShieldCheck className="text-emerald-400 mt-0.5 shrink-0" size={20} />
        <div className="text-xs space-y-1">
          <div className="font-extrabold text-white uppercase tracking-wide">
            GARANTIA DE EXECUÇÃO READ-ONLY & AUTONOMIA CONTROLADA
          </div>
          <p className="text-slate-300 leading-relaxed">
            As automações do Héfisto são estritamente <strong>consultivas</strong>. Elas preparam briefings de abertura,
            status e fechamento no fuso horário configurado da empresa. Nenhuma automação altera estoque, faz pagamentos ou registra ponto automaticamente.
          </p>
        </div>
      </div>

      {/* LISTA DE AUTOMAÇÕES PROGRAMADAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {automacoes.map((auto) => (
          <HubCard key={auto.id} className="space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800/80 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-white">{auto.name}</h3>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                    auto.enabled
                      ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}>
                    {auto.enabled ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{auto.description}</p>
              </div>

              <button
                type="button"
                onClick={() => handleToggle(auto)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center ${
                  auto.enabled
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                }`}
                title={auto.enabled ? "Desativar automação" : "Ativar automação"}
              >
                <Power size={18} />
              </button>
            </div>

            {/* SELEÇÃO DE HORÁRIO E DIAS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold flex items-center gap-1.5">
                  <Clock size={14} className="text-emerald-400" />
                  Horário de Execução:
                </span>
                <span className="font-mono font-extrabold text-white bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                  {auto.scheduleTime} ({auto.timezone.split("/")[1] || "Local"})
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
                  <Calendar size={14} className="text-emerald-400" />
                  Dias de Operação:
                </span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {DIAS_SEMANA.map((d) => {
                    const isSelected = auto.scheduleDays.includes(d.id);
                    return (
                      <span
                        key={d.id}
                        className={`text-[10px] font-black px-2.5 py-1 rounded-md border ${
                          isSelected
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-slate-950 text-slate-600 border-slate-900"
                        }`}
                      >
                        {d.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* METADADOS E METRICAS DE EXECUÇÃO */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <div>
                <span>Próxima: </span>
                <strong className="text-slate-200">
                  {auto.enabled ? new Date(auto.nextExecutionAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Pausada"}
                </strong>
              </div>

              <button
                type="button"
                onClick={() => executarManual(auto.id)}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1 transition-colors cursor-pointer min-h-[36px]"
              >
                <Play size={12} className="text-emerald-400" />
                <span>Testar agora</span>
              </button>
            </div>
          </HubCard>
        ))}
      </div>

      {/* HISTÓRICO RECENTE DE EXECUÇÃO */}
      <HubCard className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <Clock size={16} className="text-emerald-400" />
            <span>Histórico Recente de Execuções Automatizadas</span>
          </h3>
          <span className="text-[10px] text-slate-400 font-bold uppercase">Auditoria F6 Integrada</span>
        </div>

        {historico.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">
            Nenhuma execução automática registrada nesta sessão.
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {historico.map((h) => (
              <div key={h.id} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <div className="font-bold text-white">{h.name}</div>
                  <div className="text-[10px] text-slate-400">{h.summaryText}</div>
                </div>
                <div className="text-right space-y-1">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                    h.status === "SUCCEEDED" ? "bg-emerald-950 text-emerald-400 border-emerald-800" :
                    h.status === "SKIPPED" ? "bg-amber-950 text-amber-400 border-amber-800" :
                    "bg-rose-950 text-rose-400 border-rose-800"
                  }`}>
                    {h.status}
                  </span>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {new Date(h.executedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </HubCard>

      {/* MODAL DE PREVIEW E CONFIRMAÇÃO DE CONF DA AUTOMAÇÃO */}
      {previewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#0B1528] border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-black text-sm">
                <Sparkles size={16} className="text-emerald-400" />
                <span>Confirmar Automação: {previewModal.automation.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div>
                <strong>Empresa: </strong> {unidadeAtiva || "Unidade Padrão"}
              </div>
              <div>
                <strong>Modo: </strong> <span className="text-emerald-400 font-bold">READ_ONLY_AUTOMATION</span>
              </div>
              <div>
                <strong>Status: </strong> {previewModal.newEnabled ? "Ativar Automação" : "Pausar Automação"}
              </div>
              <div>
                <strong>Garantia de Segurança: </strong> Apenas consultas e briefings. <strong className="text-amber-400">NÃO ALTERA DADOS.</strong>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs border border-slate-800 transition-colors min-h-[44px] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarAlteracoes}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-colors min-h-[44px] cursor-pointer"
              >
                Confirmar e Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
