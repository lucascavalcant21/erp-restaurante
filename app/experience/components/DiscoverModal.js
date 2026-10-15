"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  X,
  Volume2,
  VolumeX,
  Share2,
  UtensilsCrossed,
  Info,
  MapPin,
  BookOpen,
  Plus,
  CheckCircle2,
  ChevronRight,
  Flame,
  Award
} from "lucide-react";

export default function DiscoverModal({
  aberto,
  onClose,
  unidadeId,
  prato,
  onAdicionarAoCarrinho
}) {
  const [experiencia, setExperiencia] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const [falando, setFalando] = useState(false);
  const [compartilhado, setCompartilhado] = useState(false);

  useEffect(() => {
    if (!aberto || !prato?.id) {
      setExperiencia(null);
      setFalando(false);
      window.speechSynthesis?.cancel();
      return;
    }

    async function buscarExperiencia() {
      setCarregando(true);
      try {
        const res = await fetch(`/api/public/experience/${encodeURIComponent(unidadeId)}/discover?produtoId=${encodeURIComponent(prato.id)}`, {
          cache: "no-store"
        });
        const json = await res.json();
        if (json.ok) {
          setExperiencia(json);
          setIndiceAtivo(0);
        }
      } catch {
        // Fallback local se a rede oscilar
        setExperiencia({
          ok: true,
          prato,
          componentes: [
            {
              ingrediente: prato.nome_produto,
              nomeCientifico: "Preparação Autoral",
              origemCultural: "Tradição Gastronômica",
              historia: prato.descricao || "Prato especial desenvolvido pelo Chef.",
              curiosidades: "Cozimento cuidadoso e ingredientes de alta procedência.",
              perfilSabor: "Marcante e autêntico.",
              hotspot: { x: 50, y: 50 }
            }
          ]
        });
      } finally {
        setCarregando(false);
      }
    }

    buscarExperiencia();

    return () => {
      window.speechSynthesis?.cancel();
    };
  }, [aberto, prato, unidadeId]);

  // Narração em Áudio via Web Speech API nativa
  const alternarNarracao = () => {
    if (!window.speechSynthesis) return;

    if (falando) {
      window.speechSynthesis.cancel();
      setFalando(false);
      return;
    }

    const comp = experiencia?.componentes?.[indiceAtivo];
    if (!comp) return;

    const textoNarracao = `${comp.ingrediente}. ${comp.origemCultural}. ${comp.historia} ${comp.curiosidades}`;
    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(textoNarracao);
    utterance.lang = "pt-BR";
    utterance.rate = 0.95;
    utterance.onend = () => setFalando(false);
    utterance.onerror = () => setFalando(false);

    setFalando(true);
    synth.speak(utterance);
  };

  // Compartilhar experiência
  const compartilharPrato = async () => {
    const texto = `Descobri a história fascinante do prato "${prato.nome_produto}" no Héfisto Experience! ✨`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: prato.nome_produto,
          text: texto,
          url: window.location.href
        });
      } catch {
        // Usuário cancelou
      }
    } else {
      navigator.clipboard?.writeText(`${texto}\n${window.location.href}`);
      setCompartilhado(true);
      setTimeout(() => setCompartilhado(false), 3000);
    }
  };

  if (!aberto || !prato) return null;

  const componenteAtual = experiencia?.componentes?.[indiceAtivo] || null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in select-none">
      <div className="bg-[#181310] border border-amber-900/40 w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col h-[92vh] sm:h-[84vh] overflow-hidden">
        
        {/* HEADER */}
        <header className="p-4 bg-[#201915] border-b border-amber-900/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 text-amber-950 flex items-center justify-center shadow-md">
              <BookOpen size={18} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-black text-amber-100">Héfisto Discover</h3>
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-3xs font-extrabold uppercase">
                  Imersão
                </span>
              </div>
              <p className="text-3xs text-amber-300/60 font-medium">História e Botânica do Prato</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão Áudio */}
            {typeof window !== "undefined" && "speechSynthesis" in window && (
              <button
                onClick={alternarNarracao}
                className={`p-2 rounded-xl border transition ${
                  falando
                    ? "bg-amber-600 text-white border-amber-500 animate-pulse"
                    : "bg-[#291f1a] text-amber-300 border-amber-900/40 hover:bg-[#342721]"
                }`}
                title={falando ? "Pausar Narração" : "Ouvir História do Ingrediente"}
              >
                {falando ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>
            )}

            {/* Compartilhar */}
            <button
              onClick={compartilharPrato}
              className="p-2 rounded-xl bg-[#291f1a] text-amber-300 border border-amber-900/40 hover:bg-[#342721] transition"
              title="Compartilhar"
            >
              <Share2 size={17} />
            </button>

            {/* Fechar */}
            <button
              onClick={() => {
                window.speechSynthesis?.cancel();
                onClose();
              }}
              className="w-9 h-9 rounded-xl bg-black/40 hover:bg-black/60 text-amber-200/80 hover:text-white flex items-center justify-center transition"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* FEEDBACK COMPARTILHADO */}
        {compartilhado && (
          <div className="bg-emerald-600 text-white text-xs font-bold py-1.5 px-4 text-center shrink-0 animate-in fade-in">
            Link copiado para a área de transferência!
          </div>
        )}

        {/* FOTOGRAFIA INTERATIVA COM HOTSPOTS */}
        <div className="relative h-56 sm:h-64 bg-[#231b17] overflow-hidden shrink-0">
          {prato.imagem_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={prato.imagem_url} alt={prato.nome_produto} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-amber-700/30">
              <UtensilsCrossed size={52} />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#181310] via-transparent to-black/40 pointer-events-none" />

          {/* PONTOS CLICÁVEIS (HOTSPOTS) */}
          {experiencia?.componentes?.map((comp, idx) => {
            const isAtivo = idx === indiceAtivo;
            const x = comp.hotspot?.x || 50;
            const y = comp.hotspot?.y || 50;

            return (
              <button
                key={comp.ingrediente + idx}
                onClick={() => {
                  setIndiceAtivo(idx);
                  if (falando) {
                    window.speechSynthesis?.cancel();
                    setFalando(false);
                  }
                }}
                style={{ left: `${x}%`, top: `${y}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 transition-all transform ${
                  isAtivo ? "scale-125 z-20" : "scale-100 z-10 opacity-80 hover:opacity-100"
                }`}
              >
                <span className="relative flex h-8 w-8 items-center justify-center">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      isAtivo ? "bg-amber-400" : "bg-white/40"
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-6 w-6 items-center justify-center font-black text-2xs shadow-xl border-2 ${
                      isAtivo
                        ? "bg-amber-500 text-amber-950 border-white"
                        : "bg-[#181310]/90 text-amber-300 border-amber-500/80"
                    }`}
                  >
                    {idx + 1}
                  </span>
                </span>
              </button>
            );
          })}

          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between pointer-events-none">
            <div className="text-white">
              <span className="text-3xs uppercase tracking-widest font-extrabold text-amber-400 drop-shadow">
                {prato.categoria || "Gastronomia"}
              </span>
              <h2 className="text-base sm:text-lg font-black text-white drop-shadow leading-tight">
                {prato.nome_produto}
              </h2>
            </div>
            <span className="text-xs font-black text-amber-300 bg-black/60 px-2.5 py-1 rounded-xl backdrop-blur-sm border border-amber-900/30 drop-shadow">
              Toque nos pontos da foto 👆
            </span>
          </div>
        </div>

        {/* NAVEGADOR DE COMPONENTES */}
        {experiencia?.componentes?.length > 1 && (
          <div className="flex gap-2 overflow-x-auto p-3 bg-[#1e1713] border-b border-amber-900/20 scrollbar-none shrink-0">
            {experiencia.componentes.map((comp, idx) => (
              <button
                key={comp.ingrediente + idx}
                onClick={() => {
                  setIndiceAtivo(idx);
                  if (falando) {
                    window.speechSynthesis?.cancel();
                    setFalando(false);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                  idx === indiceAtivo
                    ? "bg-amber-600 text-white shadow-md shadow-amber-950/40"
                    : "bg-[#281f1a] text-amber-200/70 hover:bg-[#342721] border border-amber-900/30"
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-black/30 flex items-center justify-center text-3xs font-black">
                  {idx + 1}
                </span>
                <span>{comp.ingrediente}</span>
              </button>
            ))}
          </div>
        )}

        {/* CONTEÚDO CULTURAL DO INGREDIENTE */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-amber-100">
          {componenteAtual && (
            <>
              {/* Título & Nome Científico */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  <h3 className="text-lg font-black text-amber-100">
                    {componenteAtual.ingrediente}
                  </h3>
                </div>
                {componenteAtual.nomeCientifico && (
                  <p className="text-xs italic text-amber-400 font-serif mt-0.5">
                    {componenteAtual.nomeCientifico}
                  </p>
                )}
              </div>

              {/* Origem Cultural */}
              {componenteAtual.origemCultural && (
                <div className="bg-[#241c17] border border-amber-900/30 rounded-2xl p-3.5 flex items-start gap-3 shadow-inner">
                  <MapPin size={20} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-3xs uppercase font-extrabold text-amber-400 tracking-wider block">
                      Origem & Ecossistema
                    </span>
                    <p className="text-xs text-amber-100/90 font-semibold mt-0.5">
                      {componenteAtual.origemCultural}
                    </p>
                  </div>
                </div>
              )}

              {/* História Cultural */}
              {componenteAtual.historia && (
                <div className="space-y-1">
                  <span className="text-3xs uppercase font-extrabold text-amber-400/80 tracking-wider block">
                    História Gastronômica
                  </span>
                  <p className="text-xs leading-relaxed text-amber-100/90 font-medium bg-[#1e1713]/60 p-3 rounded-2xl border border-amber-900/20">
                    {componenteAtual.historia}
                  </p>
                </div>
              )}

              {/* Curiosidades & Sustentabilidade */}
              {componenteAtual.curiosidades && (
                <div className="bg-amber-950/30 border border-amber-800/30 rounded-2xl p-3.5 flex items-start gap-3">
                  <Award size={20} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-3xs uppercase font-extrabold text-amber-400 tracking-wider block">
                      Curiosidade & Importância
                    </span>
                    <p className="text-xs text-amber-200/90 leading-relaxed mt-0.5">
                      {componenteAtual.curiosidades}
                    </p>
                  </div>
                </div>
              )}

              {/* Perfil de Sabor */}
              {componenteAtual.perfilSabor && (
                <div className="bg-[#241c17] border border-amber-900/30 rounded-2xl p-3 flex items-center justify-between">
                  <span className="text-3xs uppercase font-extrabold text-amber-400/80 tracking-wider">
                    Perfil Sensorial
                  </span>
                  <span className="text-xs font-bold text-amber-200">
                    {componenteAtual.perfilSabor}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* RODAPÉ: ADICIONAR AO PEDIDO */}
        <footer className="p-4 bg-[#1e1713] border-t border-amber-900/30 flex items-center justify-between gap-3 shrink-0">
          <div>
            <span className="text-3xs uppercase font-extrabold text-amber-400/80 block">Preço</span>
            <span className="text-lg font-black text-amber-300">
              R$ {Number(prato.preco_venda || 0).toFixed(2)}
            </span>
          </div>

          <button
            onClick={() => {
              window.speechSynthesis?.cancel();
              onAdicionarAoCarrinho(prato, "");
              onClose();
            }}
            className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-950/50 transition active:scale-95"
          >
            <Plus size={16} />
            <span>Adicionar este Prato à Mesa</span>
          </button>
        </footer>

      </div>
    </div>
  );
}
