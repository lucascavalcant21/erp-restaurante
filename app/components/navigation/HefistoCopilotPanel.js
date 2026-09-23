"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Sparkles, Search, Mic, MicOff, X, ArrowRight, CornerDownLeft,
  AlertCircle, CheckCircle2, ShieldAlert, ChefHat, Package, Users, DollarSign,
  Layers, Lock, Loader2, BarChart2, Zap, Tag, ChevronRight, RefreshCw, AlertTriangle, Inbox,
  ThumbsUp, ThumbsDown, Activity
} from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { useHefistoPageContext } from "../../context/HefistoPageContext";
import { processHefistoIntent } from "../../lib/hefisto-intents";
import { parseActionIntent, executeRealAction } from "../../lib/hefisto-actions";
import { executeAnalyticsQuery } from "../../lib/hefisto-analytics";
import { getProactiveInsights } from "../../lib/hefisto-insights";
import { identifySpecialist } from "../../lib/hefisto-specialists";
import { identifyRoutine } from "../../lib/hefisto-routines";
import { vozDisponivel, criarEscuta, falarTexto } from "../../lib/hefisto-voz";
import { canAccessRoute, hasPermission } from "../../lib/permissions-catalog.mjs";
import { getHefistoInbox } from "../../lib/hefisto-inbox.js";
import { recordUserFeedback } from "../../lib/hefisto-telemetry.js";
import { recordPilotIssue } from "../../lib/hefisto-pilot.js";
import { perguntarAoHefisto } from "../../lib/hefisto-ai/cliente.js";

export default function HefistoCopilotPanel() {
  const router = useRouter();
  const pathname = usePathname() || "";
  const { sessao, unidadeAtiva } = useERP();
  const { pageContext, setSelectedEntity, clearSelectedEntity } = useHefistoPageContext();

  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [oubindo, setOubindo] = useState(false);
  const [mensagens, setMensagens] = useState([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [pendingPreview, setPendingPreview] = useState(null);

  // Estados F14 Piloto (Onboarding, Reportar Problema, Check de Impressão)
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingSlide, setOnboardingSlide] = useState(1);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportComment, setReportComment] = useState("");
  const [showPrintCheckModal, setShowPrintCheckModal] = useState(false);

  const inputRef = useRef(null);
  const escutaRef = useRef(null);


  // Permissões
  const podeVerFinanceiro = !sessao?.gerenciado || hasPermission(sessao, "dashboard.overview.view_values") || hasPermission(sessao, "financeiro.cashflow.view");
  const podeVerCozinha = !sessao?.gerenciado || canAccessRoute(sessao, "/dashboard/operacao/producao");
  const podeVerEstoque = !sessao?.gerenciado || canAccessRoute(sessao, "/dashboard/operacao/estoque");
  const podeVerEquipe = !sessao?.gerenciado || hasPermission(sessao, "rh.overview.view");

  // Carrega itens da caixa F10
  const carregarInboxCount = useCallback(async () => {
    try {
      const res = await getHefistoInbox({ session: sessao, unitId: unidadeAtiva });
      if (res && typeof res.actionableCount === "number") {
        setInboxCount(res.actionableCount);
      }
    } catch (_) {
      setInboxCount(0);
    }
  }, [sessao, unidadeAtiva]);

  useEffect(() => {
    carregarInboxCount();
  }, [carregarInboxCount, pathname]);

  // Abertura e fechamento via evento customizado e atalho Alt+H
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleToggle = () => {
      setIsOpen(prev => {
        const next = !prev;
        if (next) setTimeout(() => inputRef.current?.focus(), 100);
        return next;
      });
    };

    window.addEventListener("hefisto:open-assistant", handleOpen);
    window.addEventListener("hefisto:toggle-copilot", handleToggle);

    const handleKeyDown = (e) => {
      if (e.altKey && (e.key === "h" || e.key === "H")) {
        e.preventDefault();
        handleToggle();
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("hefisto:open-assistant", handleOpen);
      window.removeEventListener("hefisto:toggle-copilot", handleToggle);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Sugestões Determinísticas Contextuais (3 a 4 max)
  const getContextualSuggestions = () => {
    const suggestions = [];

    if (pageContext.domain === "estoque") {
      if (pageContext.entityName) {
        suggestions.push({ label: `Quanto temos de ${pageContext.entityName}?`, prompt: `quanto temos de ${pageContext.entityName}` });
        suggestions.push({ label: `Registrar entrada de ${pageContext.entityName}`, prompt: `registre entrada de 1 kg de ${pageContext.entityName}` });
        suggestions.push({ label: `Imprimir etiquetas`, prompt: `imprima 3 etiquetas de ${pageContext.entityName}` });
      } else {
        suggestions.push({ label: "Quais itens estão zerados?", prompt: "quais produtos estao com estoque zerado ou critico" });
        suggestions.push({ label: "Ver reposição necessária", prompt: "quais compras precisam ser feitas para repor o estoque" });
        suggestions.push({ label: "Imprimir etiquetas", prompt: "imprimir etiquetas" });
      }
    } else if (pageContext.domain === "cozinha") {
      if (pageContext.entityName) {
        suggestions.push({ label: `Custo da receita ${pageContext.entityName}`, prompt: `quanto custa essa receita ${pageContext.entityName}` });
        suggestions.push({ label: `Concluir produção`, prompt: `marque a producao de ${pageContext.entityName} como concluida` });
      } else {
        suggestions.push({ label: "Como está a cozinha hoje?", prompt: "como esta a cozinha hoje" });
        suggestions.push({ label: "Briefing da Cozinha", prompt: "faca o briefing da cozinha" });
        suggestions.push({ label: "Produções pendentes", prompt: "quais producoes estao pendentes" });
      }
    } else if (pageContext.domain === "financeiro") {
      suggestions.push({ label: "Por que o CMV aumentou?", prompt: "por que meu CMV aumentou esta semana" });
      suggestions.push({ label: "Resultado financeiro do mês", prompt: "qual o resultado do mes" });
      suggestions.push({ label: "Contas a pagar hoje", prompt: "quais contas a pagar vencem esta semana" });
    } else if (pageContext.domain === "rh") {
      suggestions.push({ label: "Quem está trabalhando hoje?", prompt: "quem esta trabalhando hoje" });
      suggestions.push({ label: "Faltas e atrasos da semana", prompt: "mostrar faltas nao justificadas da equipe" });
      suggestions.push({ label: "Ponto pendente", prompt: "quais batidas de ponto precisam de ajuste" });
    } else {
      suggestions.push({ label: "Prepare o restaurante para abrir", prompt: "prepare meu restaurante para abrir" });
      suggestions.push({ label: "O que precisa da minha atenção?", prompt: "o que precisa da minha atencao hoje" });
      suggestions.push({ label: "Como estão as vendas de hoje?", prompt: "qual o total de vendas de hoje" });
    }

    return suggestions.slice(0, 4);
  };

  // Envio de Comando / Pergunta Contextual
  const handleEnviar = async (textoManuscrito = null) => {
    const query = String(textoManuscrito || inputText || "").trim();
    if (!query) return;

    // Regra Rígida de Ponto Tradicional (0% facial, 0% batida por IA)
    if (query.toLowerCase().includes("ponto") || query.toLowerCase().includes("bater ponto")) {
      setIsOpen(false);
      setInputText("");
      router.push("/dashboard/ponto");
      return;
    }

    const novaMensagemUsuario = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    };

    setMensagens(prev => [...prev, novaMensagemUsuario]);
    if (!textoManuscrito) setInputText("");
    setLoading(true);

    try {
      // 1. Tenta Ação Controlada F2 (com apoio do contexto de entidade)
      let queryComContexto = query;
      if (pageContext.entityName && !query.toLowerCase().includes(pageContext.entityName.toLowerCase())) {
        queryComContexto = `${query} de ${pageContext.entityName}`;
      }

      const actionResult = await parseActionIntent({
        text: queryComContexto,
        session: sessao,
        unitId: unidadeAtiva
      });

      if (actionResult && actionResult.type === "ACTION_PREVIEW") {
        setPendingPreview(actionResult);
        setLoading(false);
        return;
      }

      // 2. Conversa com o Héfisto com IA (endpoint /api/hefisto/agent).
      // Ele só consulta: quem executa ação continua sendo o passo 1, com
      // confirmação. Se a IA estiver fora do ar, caímos no motor determinístico
      // de sempre — o ERP não pode parar por causa do assistente.
      const iaRes = await perguntarAoHefisto({
        mensagem: queryComContexto,
        pageContext,
        unidadeAtiva,
      });

      if (iaRes?.ok && iaRes.texto) {
        const respostaIA = {
          id: `bot-${Date.now()}`,
          sender: "hefisto",
          type: iaRes.rota ? "NAVIGATION" : "TEXT",
          title: "Héfisto",
          responseText: iaRes.texto,
          structured: null,
          suggestedActions: iaRes.rota
            ? [{ label: "Abrir a tela", action: () => router.push(iaRes.rota) }]
            : [],
          timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        };
        setMensagens(prev => [...prev, respostaIA]);
        falarTexto(iaRes.texto);
        setLoading(false);
        return;
      }

      // 3. Fallback: motor determinístico (intenção/analytics/specialist)
      const res = await processHefistoIntent({
        text: query,
        session: sessao,
        unitId: unidadeAtiva,
        contextState: {
          lastRoute: pageContext.route,
          domain: pageContext.domain,
          entityName: pageContext.entityName
        }
      });

      let respostaFormatada = {
        id: `bot-${Date.now()}`,
        sender: "hefisto",
        type: res?.type || "TEXT",
        title: res?.title || "Héfisto",
        responseText: res?.responseText || "Consulta concluída.",
        structured: res?.structured || null,
        suggestedActions: res?.suggestedActions || [],
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      };

      setMensagens(prev => [...prev, respostaFormatada]);

      if (res?.spokenSummary) {
        falarTexto(res.spokenSummary);
      }
    } catch (err) {
      setMensagens(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "hefisto",
          type: "ERROR",
          responseText: "Não consegui consultar as informações necessárias no momento.",
          timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Confirmação de Ação Sensível F2
  const handleConfirmarAcao = async () => {
    if (!pendingPreview) return;
    setLoading(true);
    try {
      const res = await executeRealAction({
        actionId: pendingPreview.actionId,
        payload: pendingPreview.payload,
        session: sessao,
        unitId: unidadeAtiva
      });

      setPendingPreview(null);
      setMensagens(prev => [
        ...prev,
        {
          id: `act-res-${Date.now()}`,
          sender: "hefisto",
          type: "STATUS",
          title: res.success ? "AÇÃO EXECUTADA COM SUCESSO" : "FALHA NA EXECUÇÃO",
          responseText: res.message || res.responseText || "Operação realizada.",
          statusType: res.success ? "success" : "error",
          timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        }
      ]);

      // Notifica refresh da página
      window.dispatchEvent(new CustomEvent("hefisto:action-completed"));
    } catch (err) {
      setPendingPreview(null);
      setMensagens(prev => [
        ...prev,
        {
          id: `act-err-${Date.now()}`,
          sender: "hefisto",
          type: "ERROR",
          responseText: "Ocorreu um erro ao executar a ação solicitada.",
          timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Escuta de Voz F3
  const toggleVoz = () => {
    if (!vozDisponivel()) return;
    if (oubindo) {
      escutaRef.current?.stop();
      setOubindo(false);
      return;
    }

    setOubindo(true);
    escutaRef.current = criarEscuta(
      (textoReconhecido) => {
        setOubindo(false);
        if (textoReconhecido) {
          setInputText(textoReconhecido);
          handleEnviar(textoReconhecido);
        }
      },
      () => setOubindo(false)
    );
    escutaRef.current?.start();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-40 md:bottom-6 md:right-6 flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/30 shadow-xl rounded-full px-4 py-3 transition-all duration-200 active:scale-95 group"
        title="Abrir Héfisto Copiloto (Alt+H)"
      >
        <Sparkles className="w-5 h-5 text-amber-400 group-hover:rotate-12 transition-transform" />
        <span className="text-xs font-semibold text-slate-100 hidden sm:inline">Héfisto Copiloto</span>
        {inboxCount > 0 && (
          <span className="bg-amber-500 text-slate-950 text-[10px] font-bold rounded-full px-1.5 py-0.5 animate-pulse">
            {inboxCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm transition-opacity">
      {/* Drawer do Copiloto no Desktop/Tablet */}
      <div className="w-full sm:w-[460px] h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between overflow-hidden">
        {/* Cabeçalho do Copiloto */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">HÉFISTO</h3>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Copiloto
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <span className="capitalize">{pageContext.domain}</span>
                {pageContext.entityName && (
                  <>
                    <ChevronRight className="w-3 h-3 text-slate-500" />
                    <span className="text-amber-300 font-medium truncate max-w-[160px]">{pageContext.entityName}</span>
                    <button
                      onClick={clearSelectedEntity}
                      className="text-slate-500 hover:text-red-400 ml-1"
                      title="Limpar contexto da entidade"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {inboxCount > 0 && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push("/dashboard");
                }}
                className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                <Inbox className="w-3.5 h-3.5" />
                <span className="font-semibold text-[11px]">Precisa de você ({inboxCount})</span>
              </button>
            )}

            {(!sessao?.gerenciado || hasPermission(sessao, "gestao.operational_center.view")) && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push("/dashboard/gestao/saude-hefisto");
                }}
                title="Saúde do Sistema & Observabilidade"
                className="p-1.5 text-cyan-400 hover:bg-cyan-500/10 border border-cyan-500/20 rounded-lg transition-colors cursor-pointer"
              >
                <Activity className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setIsOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corpo de Mensagens & Respostas Estruturadas */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {mensagens.length === 0 && !pendingPreview && (
            <div className="space-y-4 my-2">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                👋 Olá! Sou o <strong>Héfisto</strong>, seu Copiloto Operacional. Reconheço a tela ativa e posso responder dúvidas ou executar ações autorizadas.
              </div>

              {/* Sugestões Contextuais */}
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Sugestões para esta tela:</p>
                <div className="space-y-2">
                  {getContextualSuggestions().map((sug, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleEnviar(sug.prompt)}
                      className="w-full text-left bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 rounded-xl p-3 text-xs text-slate-200 flex items-center justify-between group transition-all"
                    >
                      <span>{sug.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Renderização do Modal de Preview de Ação F2 */}
          {pendingPreview && (
            <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <AlertTriangle className="w-4 h-4" />
                <span>CONFIRMAÇÃO DE AÇÃO OPERACIONAL</span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-100">{pendingPreview.actionTitle}</p>
                <p className="text-xs text-slate-300">Item: <strong>{pendingPreview.productName}</strong></p>
                <p className="text-xs text-slate-300">Detalhes: {pendingPreview.detailsText}</p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setPendingPreview(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-2 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmarAcao}
                  disabled={loading}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirmar"}
                </button>
              </div>
            </div>
          )}

          {/* Histórico de Mensagens */}
          {mensagens.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-amber-500 text-slate-950 font-medium"
                    : msg.type === "ERROR"
                    ? "bg-red-950/40 border border-red-500/30 text-red-200"
                    : msg.type === "STATUS"
                    ? "bg-emerald-950/40 border border-emerald-500/30 text-emerald-200"
                    : "bg-slate-950 border border-slate-800 text-slate-200"
                }`}
              >
                {msg.title && (
                  <p className="font-bold text-[11px] opacity-80 mb-1 tracking-wide">{msg.title}</p>
                )}
                <p className="whitespace-pre-wrap">{msg.responseText}</p>
                <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-800/40 text-[9px] opacity-60">
                  <span className="text-[9px] opacity-75">{msg.timestamp}</span>
                  {msg.sender === "hefisto" && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => recordUserFeedback({ correlationId: msg.correlationId, rating: "POSITIVE", tenantId: unidadeAtiva?.id })}
                        className="hover:text-emerald-400 p-0.5 cursor-pointer"
                        title="Resposta útil"
                      >
                        <ThumbsUp size={11} />
                      </button>
                      <button
                        onClick={() => recordUserFeedback({ correlationId: msg.correlationId, rating: "NEGATIVE", reason: "Resposta incorreta", tenantId: unidadeAtiva?.id })}
                        className="hover:text-rose-400 p-0.5 cursor-pointer"
                        title="Reportar problema nesta resposta"
                      >
                        <ThumbsDown size={11} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-amber-400 p-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Héfisto consultando contexto...</span>
            </div>
          )}
        </div>

        {/* Rodapé / Input Bar */}
        <div className="p-4 bg-slate-950/90 border-t border-slate-800 space-y-2">
          <div className="relative flex items-center bg-slate-900 border border-slate-700 focus-within:border-amber-500 rounded-xl px-3 py-2">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleEnviar()}
              placeholder="Pergunte ou peça uma ação..."
              className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none pr-16"
            />
            <div className="absolute right-2 flex items-center gap-1">
              <button
                onClick={toggleVoz}
                className={`p-1.5 rounded-lg transition-colors ${
                  oubindo ? "bg-red-500 text-white animate-pulse" : "text-slate-400 hover:text-amber-400"
                }`}
                title="Comando de voz (F3)"
              >
                {oubindo ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                onClick={() => handleEnviar()}
                disabled={!inputText.trim() || loading}
                className="p-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 rounded-lg transition-colors cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>Piloto Héfisto F14 · Previa obrigatória em alterações</span>
            <button
              onClick={() => setShowReportModal(true)}
              className="text-amber-400 hover:underline font-semibold cursor-pointer"
            >
              Reportar problema
            </button>
          </div>
        </div>
      </div>

      {/* MODAL 1: REPORTAR PROBLEMA NO PILOTO */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B1528] border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">Reportar Problema no Piloto</h3>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={16} /></button>
            </div>
            <p className="text-xs text-slate-300">
              Sua rota ativa (<code className="text-cyan-300">{pathname}</code>) e metadados sanitizados serão anexados automaticamente ao log do piloto.
            </p>
            <textarea
              value={reportComment}
              onChange={e => setReportComment(e.target.value)}
              placeholder="Descreva o que aconteceu (opcional)..."
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 min-h-[80px]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowReportModal(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 cursor-pointer">Cancelar</button>
              <button
                onClick={() => {
                  recordPilotIssue({
                    tenantId: unidadeAtiva?.id,
                    issueType: "UX_FRICTION",
                    route: pathname,
                    capability: pageContext?.module || "general",
                    comment: reportComment
                  });
                  alert("Problema reportado com sucesso e enviado para revisão do Piloto!");
                  setShowReportModal(false);
                  setReportComment("");
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Enviar Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

