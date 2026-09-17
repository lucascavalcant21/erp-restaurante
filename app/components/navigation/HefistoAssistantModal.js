"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Sparkles, Search, Mic, MicOff, X, ArrowRight, CornerDownLeft,
  AlertCircle, CheckCircle2, ShieldAlert, ChefHat, Package, Users, DollarSign,
  Layers, Lock, Loader2, BarChart2, Zap
} from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { processHefistoIntent, INTENT_CATALOG } from "../../lib/hefisto-intents";
import { executeRealAction } from "../../lib/hefisto-actions";
import { vozDisponivel, criarEscuta, falarTexto } from "../../lib/hefisto-voz";
import { canAccessRoute, hasPermission } from "../../lib/permissions-catalog.mjs";
import { HubActionButton } from "./HubPrimitives";

export default function HefistoAssistantModal() {
  const router = useRouter();
  const pathname = usePathname() || "";
  const { sessao, unidadeAtiva } = useERP();

  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [oubindo, setOubindo] = useState(false);
  const [mensagens, setMensagens] = useState([]);
  const [lastContext, setLastContext] = useState({});

  const inputRef = useRef(null);
  const escutaRef = useRef(null);

  // Permissões
  const podeVerFinanceiro = !sessao?.gerenciado || hasPermission(sessao, "dashboard.overview.view_values") || hasPermission(sessao, "financeiro.cashflow.view");
  const podeVerCozinha = !sessao?.gerenciado || canAccessRoute(sessao, "/dashboard/operacao/producao");
  const podeVerEstoque = !sessao?.gerenciado || canAccessRoute(sessao, "/dashboard/operacao/estoque");
  const podeVerEquipe = !sessao?.gerenciado || hasPermission(sessao, "rh.overview.view");

  // Abertura via Custom Events
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    };

    window.addEventListener("hefisto:open-assistant", handleOpen);
    window.addEventListener("hefisto:open-command-center", handleOpen);
    return () => {
      window.removeEventListener("hefisto:open-assistant", handleOpen);
      window.removeEventListener("hefisto:open-command-center", handleOpen);
    };
  }, []);

  // Atalho de Teclado (ESC fecha)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Limpa histórico e ações pendentes ao trocar de usuário ou tenant
  useEffect(() => {
    setMensagens([]);
    setLastContext({});
  }, [sessao?.id, unidadeAtiva]);

  // Inicializa escuta de voz se disponível
  useEffect(() => {
    if (vozDisponivel()) {
      escutaRef.current = criarEscuta({
        onParcial: (t) => setInputText(t),
        onFinal: (t) => {
          setInputText(t);
          setOubindo(false);
          enviarPergunta(t);
        },
        onErro: () => setOubindo(false),
        onFim: () => setOubindo(false)
      });
    }
  }, []);

  const toggleVoz = () => {
    if (!escutaRef.current) return;
    if (oubindo) {
      escutaRef.current.parar();
      setOubindo(false);
    } else {
      setInputText("");
      setOubindo(true);
      escutaRef.current.iniciar();
    }
  };

  const cancelarAcaoPending = (msgIndex) => {
    setMensagens(prev => prev.map((m, idx) => idx === msgIndex ? {
      ...m,
      actionPreview: { ...m.actionPreview, status: "cancelled" }
    } : m));
  };

  const executarAcaoConfirmada = async (msgIndex, actionPreview) => {
    if (!actionPreview || actionPreview.status === "executing" || actionPreview.status === "completed") return;

    // Trava botão para evitar duplo clique (idempotência)
    setMensagens(prev => prev.map((m, idx) => idx === msgIndex ? {
      ...m,
      actionPreview: { ...m.actionPreview, status: "executing" }
    } : m));

    try {
      const res = await executeRealAction({
        actionId: actionPreview.actionId,
        payload: actionPreview.payload,
        session: sessao,
        unitId: unidadeAtiva
      });

      if (res.success) {
        setMensagens(prev => [
          ...prev.map((m, idx) => idx === msgIndex ? {
            ...m,
            actionPreview: { ...m.actionPreview, status: "completed" }
          } : m),
          {
            sender: "hefisto",
            text: res.responseText,
            actionSuccess: true
          }
        ]);

        if (res.redirectRequired && res.targetRoute) {
          setTimeout(() => {
            setIsOpen(false);
            router.push(res.targetRoute);
          }, 1200);
        }
      } else {
        setMensagens(prev => [
          ...prev.map((m, idx) => idx === msgIndex ? {
            ...m,
            actionPreview: { ...m.actionPreview, status: "failed" }
          } : m),
          {
            sender: "hefisto",
            text: res.responseText || "Não foi possível executar a ação.",
            permissionDenied: res.permissionDenied
          }
        ]);
      }
    } catch (e) {
      setMensagens(prev => [
        ...prev.map((m, idx) => idx === msgIndex ? {
          ...m,
          actionPreview: { ...m.actionPreview, status: "failed" }
        } : m),
        {
          sender: "hefisto",
          text: `Erro ao executar ação: ${e.message}`
        }
      ]);
    }
  };

  const enviarPergunta = useCallback(async (textoParaEnviar) => {
    const queryText = typeof textoParaEnviar === "string" ? textoParaEnviar : inputText;
    if (!queryText || !queryText.trim() || loading) return;

    const userMsg = { sender: "user", text: queryText };
    const norm = queryText.trim().toLowerCase();

    // Verificação de Ação Pendente para Confirmação por Texto ("sim", "confirmar", "nao")
    const pendingMsgIndex = mensagens.findLastIndex(m => m.actionPreview?.status === "pending");

    if (pendingMsgIndex !== -1 && (norm === "sim" || norm === "confirmar" || norm === "pode fazer" || norm === "ok" || norm === "sim, pode")) {
      const pendingMsg = mensagens[pendingMsgIndex];
      const isExpired = Date.now() - pendingMsg.actionPreview.timestamp > 5 * 60 * 1000;

      if (isExpired) {
        setMensagens(prev => [...prev, userMsg, {
          sender: "hefisto",
          text: "Esta ação expirou (limite de 5 minutos). Por favor, solicite a ação novamente."
        }]);
        setInputText("");
        return;
      }

      setMensagens(prev => [...prev, userMsg]);
      setInputText("");
      await executarAcaoConfirmada(pendingMsgIndex, pendingMsg.actionPreview);
      return;
    }

    if (pendingMsgIndex !== -1 && (norm === "nao" || norm === "não" || norm === "cancelar" || norm === "cancela")) {
      cancelarAcaoPending(pendingMsgIndex);
      setMensagens(prev => [...prev, userMsg, {
        sender: "hefisto",
        text: "Ação cancelada pelo usuário."
      }]);
      setInputText("");
      return;
    }

    setMensagens(prev => [...prev, userMsg]);
    setInputText("");
    setLoading(true);

    try {
      const res = await processHefistoIntent({
        text: queryText,
        session: sessao,
        unitId: unidadeAtiva,
        contextState: lastContext
      });

      if (res.permissionDenied) {
        setMensagens(prev => [...prev, {
          sender: "hefisto",
          text: res.responseText || "Você não tem acesso a essa ação ou informação.",
          permissionDenied: true
        }]);
      } else if (res.type === "ANALYTICS_RESULT") {
        setMensagens(prev => [...prev, {
          sender: "hefisto",
          text: res.summaryText,
          analyticsResult: {
            title: res.title,
            periodoStr: res.periodoStr,
            evidenceLevel: res.evidenceLevel,
            metricHighlight: res.metricHighlight,
            evidenceList: res.evidenceList,
            sources: res.sources,
            drilldownActions: res.drilldownActions
          }
        }]);

        if (res.lastAnalyticsDomain) {
          setLastContext(prev => ({
            ...prev,
            lastAnalyticsDomain: res.lastAnalyticsDomain,
            lastPeriodKey: res.lastPeriodKey
          }));
        }

        // Síntese em voz curta (F3 TTS) se acionado por voz
        if (res.spokenSummary && vozDisponivel()) {
          falarTexto(res.spokenSummary);
        }
      } else if (res.type === "INSIGHTS_LIST") {
        setMensagens(prev => [...prev, {
          sender: "hefisto",
          text: res.insights && res.insights.length > 0
            ? `Héfisto encontrou ${res.insights.length} situação(ões) importante(s) que exige(m) atenção:`
            : "Não foram encontradas situações críticas ou alertas pendentes no momento.",
          insightsList: res.insights,
          summary: res.summary
        }]);

        if (res.spokenSummary && vozDisponivel()) {
          falarTexto(res.spokenSummary);
        }
      } else if (res.type === "ACTION_PREVIEW") {
        setMensagens(prev => [...prev, {
          sender: "hefisto",
          text: "Confirma a execução da ação abaixo?",
          actionPreview: {
            actionId: res.actionId,
            actionTitle: res.actionTitle,
            productName: res.productName,
            productId: res.productId,
            quantity: res.quantity,
            unit: res.unit,
            detailsText: res.detailsText,
            payload: res.payload,
            timestamp: Date.now(),
            status: "pending"
          }
        }]);
      } else if (res.type === "AMBIGUOUS_PRODUCT" || res.type === "AMBIGUOUS") {
        setMensagens(prev => [...prev, {
          sender: "hefisto",
          text: res.responseText,
          options: res.options
        }]);
      } else if (res.type === "MISSING_PARAM") {
        setMensagens(prev => [...prev, {
          sender: "hefisto",
          text: res.responseText
        }]);
      } else if (res.type === "NAVIGATION") {
        setMensagens(prev => [...prev, {
          sender: "hefisto",
          text: res.responseText,
          suggestedAction: res.suggestedAction
        }]);
        setTimeout(() => {
          setIsOpen(false);
          router.push(res.targetRoute);
        }, 600);
      } else {
        setMensagens(prev => [...prev, {
          sender: "hefisto",
          text: res.responseText,
          suggestedAction: res.suggestedAction
        }]);
        if (res.intent) {
          setLastContext({ lastIntent: res.intent });
        }
      }
    } catch (e) {
      setMensagens(prev => [...prev, {
        sender: "hefisto",
        text: "Não consegui processar sua solicitação no momento."
      }]);
    } finally {
      setLoading(false);
    }
  }, [inputText, loading, sessao, unidadeAtiva, lastContext, router, mensagens]);

  if (!isOpen) return null;

  // Sugestões de fichas por permissão
  const sugestoes = [
    { text: "Por que meu CMV aumentou?", perm: podeVerFinanceiro },
    { text: "Por que meu resultado caiu?", perm: podeVerFinanceiro },
    { text: "Quais produtos aumentaram de preço?", perm: podeVerEstoque },
    { text: "Quanto perdi este mês?", perm: podeVerEstoque },
    { text: "Como está o restaurante?", perm: true },
    { text: "Imprimir 3 etiquetas de Molho Branco", perm: podeVerEstoque }
  ].filter(s => s.perm);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-2xl bg-[#0B1528] border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] sm:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO DO OVERLAY DO ASSISTENTE */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white tracking-tight">Héfisto</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 font-extrabold border border-emerald-800/60 uppercase">
                  Inteligência Analítica (F1-F4)
                </span>
              </div>
              <p className="text-xs text-slate-400">Consultas, Diagnósticos, Explicações & Ações</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-10 h-10 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center min-h-[44px] min-w-[44px] cursor-pointer transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* CORPO DA CONVERSA / HISTÓRICO DA SESSÃO */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 min-h-[220px]">
          {mensagens.length === 0 ? (
            <div className="space-y-4 text-center py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                <Sparkles size={28} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">O que você deseja diagnosticar ou consultar?</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  Pergunte em português natural: "Por que meu CMV aumentou?", "Por que meu resultado caiu?", "Quais produtos subiram de preço?".
                </p>
              </div>

              {/* SUGESTÕES EM CHIPS */}
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {sugestoes.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => enviarPergunta(sug.text)}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-300 hover:text-emerald-400 border border-slate-800 hover:border-emerald-500/40 transition-all min-h-[44px] cursor-pointer"
                  >
                    ✦ {sug.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {mensagens.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] p-3.5 rounded-2xl text-xs space-y-2.5 ${
                      msg.sender === "user"
                        ? "bg-emerald-600 text-white font-bold rounded-tr-none shadow-md"
                        : msg.permissionDenied
                        ? "bg-rose-950/40 border border-rose-900/60 text-rose-200 rounded-tl-none"
                        : "bg-slate-900/80 border border-slate-800 text-slate-200 rounded-tl-none"
                    }`}
                  >
                    <div className="whitespace-pre-line leading-relaxed">{msg.text}</div>

                    {/* CARD DE DIAGNÓSTICO ANALÍTICO (F4) */}
                    {msg.analyticsResult && (
                      <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/40 space-y-3 mt-1 shadow-lg text-left">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                          <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs tracking-wide uppercase">
                            <BarChart2 size={15} />
                            <span>{msg.analyticsResult.title}</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 font-bold border border-emerald-500/20">
                            {msg.analyticsResult.periodoStr}
                          </span>
                        </div>

                        {msg.analyticsResult.metricHighlight && (
                          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                            <div>
                              <div className="text-[10px] text-slate-400 font-bold uppercase">{msg.analyticsResult.metricHighlight.label}</div>
                              <div className="text-base font-black text-white">{msg.analyticsResult.metricHighlight.currentStr}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-slate-400 font-bold uppercase">Vs Período Anterior</div>
                              <div className={`text-xs font-black ${msg.analyticsResult.metricHighlight.isPositiveImpact ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {msg.analyticsResult.metricHighlight.variationStr}
                              </div>
                            </div>
                          </div>
                        )}

                        {msg.analyticsResult.evidenceList && msg.analyticsResult.evidenceList.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Evidências Principais:</div>
                            <div className="space-y-1 text-xs text-slate-300">
                              {msg.analyticsResult.evidenceList.map((ev, i) => (
                                <div key={i} className="leading-relaxed">{ev}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {msg.analyticsResult.sources && (
                          <div className="text-[10px] text-slate-500 pt-1 font-semibold">
                            Base: {msg.analyticsResult.sources.join(" · ")}
                          </div>
                        )}

                        {msg.analyticsResult.drilldownActions && msg.analyticsResult.drilldownActions.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/80">
                            {msg.analyticsResult.drilldownActions.map((act, i) => (
                              <HubActionButton
                                key={i}
                                onClick={() => {
                                  setIsOpen(false);
                                  router.push(act.route);
                                }}
                                variant="primary"
                                icon={ArrowRight}
                              >
                                {act.label}
                              </HubActionButton>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* CARD DE INSIGHTS PROATIVOS (F5) */}
                    {msg.insightsList && msg.insightsList.length > 0 && (
                      <div className="space-y-3 mt-2 text-left">
                        {msg.insightsList.map((ins, i) => (
                          <div
                            key={ins.id || i}
                            className={`p-3.5 rounded-2xl bg-slate-950/90 border ${
                              ins.severity === "CRITICAL"
                                ? "border-rose-500/50"
                                : ins.severity === "ATTENTION"
                                ? "border-amber-500/40"
                                : "border-slate-800"
                            } space-y-2.5 shadow-md`}
                          >
                            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider ${
                                    ins.severity === "CRITICAL"
                                      ? "bg-rose-950 text-rose-300 border border-rose-800/60"
                                      : ins.severity === "ATTENTION"
                                      ? "bg-amber-950 text-amber-300 border border-amber-800/60"
                                      : "bg-slate-800 text-slate-300"
                                  }`}
                                >
                                  {ins.domain} · {ins.severity}
                                </span>
                                <span className="text-[10px] text-slate-400 font-semibold">{ins.period}</span>
                              </div>
                              <span className="text-[10px] text-slate-500 font-medium">Héfisto Vigilante</span>
                            </div>

                            <div>
                              <div className="text-xs font-black text-white">{ins.title}</div>
                              <div className="text-xs text-slate-300 mt-0.5">{ins.summary}</div>
                            </div>

                            {ins.evidence && ins.evidence.length > 0 && (
                              <div className="space-y-1 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                                <div className="text-[10px] font-bold text-slate-400 uppercase">Evidências:</div>
                                {ins.evidence.map((ev, evIdx) => (
                                  <div key={evIdx} className="text-[11px] text-slate-300 leading-snug">{ev}</div>
                                ))}
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/60">
                              {/* Botão de Explicação Analítica (F4) */}
                              {ins.analyticsQuery && (
                                <button
                                  type="button"
                                  onClick={() => enviarPergunta(ins.analyticsQuery)}
                                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 font-bold text-[11px] border border-slate-800 transition-colors min-h-[36px] flex items-center gap-1 cursor-pointer"
                                >
                                  <BarChart2 size={13} />
                                  <span>Entender por quê</span>
                                </button>
                              )}

                              {/* Botão de Ação / Navegação */}
                              {ins.suggestedActionIntent ? (
                                <button
                                  type="button"
                                  onClick={() => enviarPergunta(ins.suggestedActionIntent.text)}
                                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] transition-colors min-h-[36px] flex items-center gap-1 cursor-pointer"
                                >
                                  <Zap size={13} />
                                  <span>{ins.actionText || "Executar ação"}</span>
                                </button>
                              ) : ins.actionRoute ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsOpen(false);
                                    router.push(ins.actionRoute);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] transition-colors min-h-[36px] flex items-center gap-1 cursor-pointer"
                                >
                                  <ArrowRight size={13} />
                                  <span>{ins.actionText || "Ver detalhes"}</span>
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* PREVIEW DE AÇÃO CONTROLADA (F2) */}
                    {msg.actionPreview && (
                      <div className="p-4 rounded-2xl bg-slate-950/90 border border-amber-500/40 space-y-3 mt-1 shadow-lg text-left">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                          <div className="flex items-center gap-2 text-amber-400 font-extrabold text-xs tracking-wide uppercase">
                            <AlertCircle size={15} />
                            <span>{msg.actionPreview.actionTitle}</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20">
                            Ação Controlada
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-black text-white">{msg.actionPreview.productName}</div>
                          <div className="text-xs font-semibold text-slate-300">{msg.actionPreview.detailsText}</div>
                        </div>

                        {msg.actionPreview.status === "pending" && (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                cancelarAcaoPending(idx);
                                setMensagens(p => [...p, { sender: "hefisto", text: "Ação cancelada pelo usuário." }]);
                              }}
                              className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs border border-slate-800 transition-colors min-h-[44px] cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const isExpired = Date.now() - msg.actionPreview.timestamp > 5 * 60 * 1000;
                                if (isExpired) {
                                  setMensagens(p => [...p, { sender: "hefisto", text: "Esta ação expirou (limite de 5 minutos). Solicite novamente." }]);
                                  return;
                                }
                                executarAcaoConfirmada(idx, msg.actionPreview);
                              }}
                              className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-colors min-h-[44px] cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <span>Confirmar Execução</span>
                              <CheckCircle2 size={15} />
                            </button>
                          </div>
                        )}

                        {msg.actionPreview.status === "executing" && (
                          <div className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-emerald-400 animate-pulse">
                            <Loader2 size={16} className="animate-spin" />
                            <span>Executando ação no ERP...</span>
                          </div>
                        )}

                        {msg.actionPreview.status === "completed" && (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 pt-1">
                            <CheckCircle2 size={16} />
                            <span>Ação executada e auditada com sucesso</span>
                          </div>
                        )}

                        {msg.actionPreview.status === "cancelled" && (
                          <div className="text-xs font-bold text-slate-400 pt-1">
                            Ação cancelada pelo usuário
                          </div>
                        )}
                      </div>
                    )}

                    {/* OPÇÕES / AMBIGUIDADES */}
                    {msg.options && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {msg.options.map(opt => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              if (opt.query) {
                                enviarPergunta(opt.query);
                              } else if (opt.route) {
                                setIsOpen(false);
                                router.push(opt.route);
                              }
                            }}
                            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 text-xs font-bold transition-all min-h-[44px] flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>{opt.title}</span>
                            <ArrowRight size={14} />
                          </button>
                        ))}
                      </div>
                    )}

                    {msg.suggestedAction && (
                      <div className="pt-1">
                        <HubActionButton
                          onClick={() => {
                            setIsOpen(false);
                            router.push(msg.suggestedAction.route);
                          }}
                          variant="primary"
                          icon={ArrowRight}
                        >
                          {msg.suggestedAction.label}
                        </HubActionButton>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-emerald-400 flex items-center gap-2 animate-pulse">
                    <Sparkles size={16} className="animate-spin" />
                    <span>Analisando com Héfisto Analytics...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* BARRA DE ENTRADA E VOZ */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/40">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviarPergunta();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={oubindo ? "Ouvindo sua fala..." : "Pergunte (ex: Por que meu CMV aumentou?)..."}
                className="w-full pl-4 pr-10 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 transition-all min-h-[48px]"
              />
              {vozDisponivel() && (
                <button
                  type="button"
                  onClick={toggleVoz}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center ${
                    oubindo ? "bg-rose-600 text-white animate-pulse" : "text-slate-400 hover:text-white"
                  }`}
                  title="Usar microfone"
                >
                  {oubindo ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 min-h-[48px] cursor-pointer"
            >
              <span>Enviar</span>
              <CornerDownLeft size={14} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
