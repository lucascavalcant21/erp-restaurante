"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  X,
  Send,
  Loader2,
  UtensilsCrossed,
  Wine,
  HelpCircle,
  Bell,
  ArrowRight,
  Plus,
  CheckCircle2,
  Fish,
  Flame,
  Users,
  Leaf,
  Mic,
  MicOff
} from "lucide-react";

const ICONES_BOTOES = {
  sparkles: Sparkles,
  fish: Fish,
  meat: Flame,
  drink: Wine,
  users: Users,
  leaf: Leaf
};

export default function ConciergeModal({
  aberto,
  onClose,
  unidadeId,
  unidadeNome = "Seldeestrela",
  idioma = "pt",
  setIdioma,
  onAdicionarAoCarrinho,
  onChamarGarcom
}) {
  const [carregando, setCarregando] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [botoesIniciais, setBotoesIniciais] = useState([]);
  const [subBotoes, setSubBotoes] = useState(null);
  const [perguntasFrequentes, setPerguntasFrequentes] = useState([]);
  const [perguntaTexto, setPerguntaTexto] = useState("");
  const [ouvindoVoz, setOuvindoVoz] = useState(false);
  const recognitionRef = useRef(null);
  const fimChatRef = useRef(null);

  const alternarReconhecimentoVoz = () => {
    if (ouvindoVoz) {
      recognitionRef.current?.stop();
      setOuvindoVoz(false);
      return;
    }

    const SpeechRec = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SpeechRec) {
      alert(idioma === "en" ? "Voice speech recognition is not supported in this browser." : idioma === "es" ? "El reconocimiento de voz no está disponible en este navegador." : "Reconhecimento de voz não suportado neste navegador. Digite sua pergunta.");
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = idioma === "en" ? "en-US" : idioma === "es" ? "es-ES" : "pt-BR";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setOuvindoVoz(true);
      };

      recognition.onresult = (event) => {
        const textoFalado = event.results[0]?.[0]?.transcript;
        if (textoFalado) {
          setPerguntaTexto(textoFalado);
          enviarPergunta(textoFalado);
        }
      };

      recognition.onerror = () => {
        setOuvindoVoz(false);
      };

      recognition.onend = () => {
        setOuvindoVoz(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setOuvindoVoz(false);
    }
  };

  // Carrega mensagem inicial e botões de boas-vindas
  useEffect(() => {
    if (!aberto) return;

    async function iniciarBoasVindas() {
      setCarregando(true);
      try {
        const res = await fetch(`/api/public/experience/${encodeURIComponent(unidadeId)}/concierge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo: "welcome", idioma })
        });
        const json = await res.json();
        if (json.ok) {
          setBotoesIniciais(json.botoes || []);
          setPerguntasFrequentes(json.perguntasFrequentes || []);
          setSubBotoes(null);
          setHistorico([
            {
              id: "msg-welcome",
              tipo: "concierge",
              texto: `${json.titulo} ${json.subtitulo}`
            }
          ]);
        }
      } catch {
        setHistorico([
          {
            id: "msg-err",
            tipo: "concierge",
            texto: "Olá! Sou seu garçom virtual. Como posso ajudar com o cardápio?"
          }
        ]);
      } finally {
        setCarregando(false);
      }
    }

    iniciarBoasVindas();
  }, [aberto, unidadeId, idioma]);

  useEffect(() => {
    fimChatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [historico, carregando]);

  // Ação rápida por botão
  const executarAcaoBotao = async (acaoId, subOpcaoId = null, rotulo = "") => {
    setCarregando(true);
    setHistorico(prev => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        tipo: "user",
        texto: rotulo || acaoId
      }
    ]);

    try {
      const res = await fetch(`/api/public/experience/${encodeURIComponent(unidadeId)}/concierge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "action",
          acao: acaoId,
          subOpcao: subOpcaoId,
          idioma
        })
      });
      const json = await res.json();
      if (json.ok) {
        setSubBotoes(json.subBotoes || null);
        setHistorico(prev => [
          ...prev,
          {
            id: `concierge-${Date.now()}`,
            tipo: "concierge",
            texto: json.mensagem,
            produtos: json.produtos || []
          }
        ]);
      }
    } catch {
      setHistorico(prev => [
        ...prev,
        {
          id: `concierge-${Date.now()}`,
          tipo: "concierge",
          texto: "Desculpe, ocorreu uma instabilidade momentânea ao buscar as recomendações."
        }
      ]);
    } finally {
      setCarregando(false);
    }
  };

  // Enviar pergunta livre (texto)
  const enviarPergunta = async (textoPersonalizado = null) => {
    const texto = (textoPersonalizado || perguntaTexto).trim();
    if (!texto || carregando) return;

    setPerguntaTexto("");
    setCarregando(true);
    setHistorico(prev => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        tipo: "user",
        texto
      }
    ]);

    try {
      const res = await fetch(`/api/public/experience/${encodeURIComponent(unidadeId)}/concierge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "query",
          pergunta: texto,
          idioma
        })
      });
      const json = await res.json();
      if (json.ok) {
        setHistorico(prev => [
          ...prev,
          {
            id: `concierge-${Date.now()}`,
            tipo: "concierge",
            texto: json.resposta,
            produtos: json.produtosRecomendados || []
          }
        ]);
      } else {
        setHistorico(prev => [
          ...prev,
          {
            id: `concierge-${Date.now()}`,
            tipo: "concierge",
            texto: json.resposta || "Não consegui encontrar produtos para essa solicitação."
          }
        ]);
      }
    } catch {
      setHistorico(prev => [
        ...prev,
        {
          id: `concierge-${Date.now()}`,
          tipo: "concierge",
          texto: "Desculpe, não consegui processar sua dúvida agora. Gostaria de chamar um garçom humano?"
        }
      ]);
    } finally {
      setCarregando(false);
    }
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in select-none">
      <div className="bg-[#17120f] border border-amber-900/40 w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col h-[92vh] sm:h-[82vh] overflow-hidden">
        
        {/* TOPO DO CONCIERGE */}
        <header className="p-4 bg-[#1f1814] border-b border-amber-900/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-500 text-amber-950 flex items-center justify-center shadow-lg shadow-amber-900/40">
              <Sparkles size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-amber-100">Héfisto Concierge</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-3xs font-extrabold uppercase tracking-wider border border-emerald-500/30">
                  Online
                </span>
              </div>
              <p className="text-3xs text-amber-300/60 font-medium">Garçom Virtual & Inteligência Gastronômica</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Idioma */}
            <div className="flex items-center bg-[#291f1a] rounded-xl p-0.5 border border-amber-900/40 text-2xs">
              <button
                onClick={() => setIdioma("pt")}
                className={`px-2 py-1 rounded-lg font-bold transition ${idioma === "pt" ? "bg-amber-600 text-white" : "text-amber-400/60"}`}
              >
                PT
              </button>
              <button
                onClick={() => setIdioma("en")}
                className={`px-2 py-1 rounded-lg font-bold transition ${idioma === "en" ? "bg-amber-600 text-white" : "text-amber-400/60"}`}
              >
                EN
              </button>
              <button
                onClick={() => setIdioma("es")}
                className={`px-2 py-1 rounded-lg font-bold transition ${idioma === "es" ? "bg-amber-600 text-white" : "text-amber-400/60"}`}
              >
                ES
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-black/30 hover:bg-black/50 text-amber-200/80 hover:text-white flex items-center justify-center transition"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* HISTÓRICO DE MENSAGENS / RECOMENDAÇÕES */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {historico.map(msg => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.tipo === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-sm leading-relaxed shadow-sm ${
                  msg.tipo === "user"
                    ? "bg-amber-600 text-white rounded-tr-none font-semibold"
                    : "bg-[#231b17] border border-amber-900/30 text-amber-100 rounded-tl-none font-normal"
                }`}
              >
                {msg.texto}
              </div>

              {/* CARDS DE PRODUTOS RECOMENDADOS */}
              {msg.produtos && msg.produtos.length > 0 && (
                <div className="w-full mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {msg.produtos.map(prod => (
                    <div
                      key={prod.id}
                      className="bg-[#201814] border border-amber-900/30 rounded-2xl p-3 flex flex-col justify-between gap-2 hover:border-amber-600/50 transition shadow-sm"
                    >
                      <div className="flex gap-3">
                        <div className="w-16 h-16 rounded-xl bg-[#2e231d] overflow-hidden shrink-0 relative">
                          {prod.imagem_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={prod.imagem_url} alt={prod.nome_produto} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-amber-700/40">
                              <UtensilsCrossed size={20} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-3xs uppercase font-extrabold text-amber-500/80 tracking-wider">
                            {prod.categoria || "Especial"}
                          </p>
                          <h4 className="text-xs font-black text-amber-50 truncate leading-snug">
                            {prod.nome_produto}
                          </h4>
                          <p className="text-xs font-black text-amber-400 mt-1">
                            R$ {Number(prod.preco_venda || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {prod.descricao && (
                        <p className="text-3xs text-amber-200/70 line-clamp-2">
                          {prod.descricao}
                        </p>
                      )}

                      <button
                        onClick={() => {
                          onAdicionarAoCarrinho(prod, "");
                          onClose();
                        }}
                        className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md shadow-amber-950/40"
                      >
                        <Plus size={14} />
                        Adicionar à Mesa
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {carregando && (
            <div className="flex items-center gap-2 text-amber-400/70 text-xs font-semibold py-2">
              <Loader2 size={16} className="animate-spin text-amber-500" />
              <span>O Concierge está consultando as criações do Chef...</span>
            </div>
          )}

          <div ref={fimChatRef} />
        </div>

        {/* SUGESTÕES DE BOTÕES / ESTILOS */}
        <div className="p-3 bg-[#1c1511] border-t border-amber-900/20 space-y-2.5 shrink-0">
          {/* Sub-opções de drinks (se houver) */}
          {subBotoes && (
            <div className="space-y-1">
              <p className="text-3xs font-extrabold text-amber-400/80 uppercase tracking-widest px-1">
                Escolha o estilo de drink:
              </p>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {subBotoes.map(sb => (
                  <button
                    key={sb.id}
                    onClick={() => executarAcaoBotao("drinks", sb.id, sb.rotulo)}
                    disabled={carregando}
                    className="px-3 py-1.5 rounded-xl bg-amber-900/30 border border-amber-700/40 hover:bg-amber-800/40 text-amber-100 text-xs font-bold whitespace-nowrap transition active:scale-95"
                  >
                    {sb.rotulo}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Botões rápidos iniciais */}
          {!subBotoes && botoesIniciais.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {botoesIniciais.map(btn => {
                const Icone = ICONES_BOTOES[btn.icone] || Sparkles;
                return (
                  <button
                    key={btn.id}
                    onClick={() => executarAcaoBotao(btn.id, null, btn.rotulo)}
                    disabled={carregando}
                    className="px-3 py-1.5 rounded-xl bg-[#29201b] border border-amber-900/30 hover:border-amber-600/50 text-amber-200 text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 active:scale-95"
                  >
                    <Icone size={14} className="text-amber-400" />
                    <span>{btn.rotulo}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Dúvidas Frequentes Rápidas */}
          {perguntasFrequentes.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              {perguntasFrequentes.map(pf => (
                <button
                  key={pf}
                  onClick={() => enviarPergunta(pf)}
                  disabled={carregando}
                  className="px-2.5 py-1 rounded-lg bg-black/30 border border-amber-900/20 text-amber-300/80 hover:text-amber-100 text-3xs font-medium whitespace-nowrap transition"
                >
                  💬 {pf}
                </button>
              ))}
            </div>
          )}

          {/* Barra de Pergunta Livre + Chamar Garçom + Microfone */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => {
                onClose();
                onChamarGarcom();
              }}
              className="p-3 rounded-2xl bg-amber-950/40 border border-amber-800/30 text-amber-300 hover:text-amber-100 transition shrink-0"
              title="Chamar Atendimento Humano"
            >
              <Bell size={18} />
            </button>

            <button
              type="button"
              onClick={alternarReconhecimentoVoz}
              className={`p-3 rounded-2xl border transition shrink-0 ${
                ouvindoVoz
                  ? "bg-red-600 text-white border-red-500 animate-pulse shadow-lg shadow-red-900/50"
                  : "bg-amber-950/40 border-amber-800/30 text-amber-300 hover:text-amber-100"
              }`}
              title={ouvindoVoz ? "Ouvindo... Toque para finalizar" : "Falar pergunta com voz"}
            >
              {ouvindoVoz ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            <div className="flex-1 relative flex items-center">
              <input
                type="text"
                value={perguntaTexto}
                onChange={(e) => setPerguntaTexto(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enviarPergunta()}
                placeholder={ouvindoVoz ? "Ouvindo sua voz..." : "Pergunte ou toque no microfone..."}
                disabled={carregando}
                className="w-full bg-[#120e0c] border border-amber-900/40 rounded-2xl py-3 pl-4 pr-11 text-xs text-amber-100 placeholder:text-amber-500/30 outline-none focus:border-amber-500 transition"
              />
              <button
                onClick={() => enviarPergunta()}
                disabled={!perguntaTexto.trim() || carregando}
                className="absolute right-2 w-8 h-8 rounded-xl bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center transition disabled:opacity-30"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
