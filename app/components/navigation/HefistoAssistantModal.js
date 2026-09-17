"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, Search, Mic, MicOff, X, ArrowRight, CornerDownLeft,
  AlertCircle, CheckCircle2, ShieldAlert, ChefHat, Package, Users, DollarSign,
  Layers, Lock
} from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { processHefistoIntent, INTENT_CATALOG } from "../../lib/hefisto-intents";
import { vozDisponivel, criarEscuta } from "../../lib/hefisto-voz";
import { canAccessRoute, hasPermission } from "../../lib/permissions-catalog.mjs";
import { HubActionButton } from "./HubPrimitives";

export default function HefistoAssistantModal() {
  const router = useRouter();
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

  // Limpa histórico ao trocar de usuário ou tenant
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

  const enviarPergunta = useCallback(async (textoParaEnviar) => {
    const queryText = typeof textoParaEnviar === "string" ? textoParaEnviar : inputText;
    if (!queryText || !queryText.trim() || loading) return;

    const userMsg = { sender: "user", text: queryText };
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
          text: "Você não tem acesso a essa informação.",
          permissionDenied: true
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
      } else if (res.type === "AMBIGUOUS") {
        setMensagens(prev => [...prev, {
          sender: "hefisto",
          text: res.responseText,
          options: res.options
        }]);
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
  }, [inputText, loading, sessao, unidadeAtiva, lastContext, router]);

  if (!isOpen) return null;

  // Sugestões de fichas por permissão
  const sugestoes = [
    { text: "Como está o restaurante?", perm: true },
    { text: "O que está acabando?", perm: podeVerEstoque },
    { text: "Tem produção atrasada?", perm: podeVerCozinha },
    { text: "Quem está trabalhando hoje?", perm: podeVerEquipe },
    { text: "Como está o CMV?", perm: podeVerFinanceiro },
    { text: "Abrir etiquetas", perm: true }
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
                  Assistente F1
                </span>
              </div>
              <p className="text-xs text-slate-400">Linguagem natural & consultas da operação</p>
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
                <h3 className="text-sm font-bold text-white">O que você precisa consultar ou abrir?</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  Escreva ou fale em português natural. Consulte a cozinha, estoque, RH, financeiro ou navegue para qualquer módulo.
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

                    {msg.options && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {msg.options.map(opt => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setIsOpen(false);
                              router.push(opt.route);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold transition-colors min-h-[44px] flex items-center gap-1.5 cursor-pointer"
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
                    <span>Consultando Héfisto...</span>
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
                placeholder={oubindo ? "Ouvindo sua fala..." : "Pergunte ou peça para abrir um módulo..."}
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
