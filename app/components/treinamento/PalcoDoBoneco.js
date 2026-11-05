"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Pause, Play, Volume2, VolumeX } from "lucide-react";
import Boneco from "./Boneco";
import Demonstracao from "./Demonstracao";
import { personagemDaArea } from "../../lib/treinamento-regras.mjs";

const lerVoz = () => { try { return localStorage.getItem("hefisto_treino_voz") !== "0"; } catch { return true; } };
const gravarVoz = (v) => { try { localStorage.setItem("hefisto_treino_voz", v ? "1" : "0"); } catch {} };
const temVoz = () => typeof window !== "undefined" && "speechSynthesis" in window;
const CHAVE = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hf-accent";

function escolherVoz() {
  const vozes = window.speechSynthesis.getVoices();
  return vozes.find((v) => /^pt[-_]BR/i.test(v.lang)) || vozes.find((v) => /^pt/i.test(v.lang)) || null;
}

/** Aula apresentada pelo boneco, cena a cena. O texto continua sempre disponível. */
export default function PalcoDoBoneco({ cenas, area = "geral", titulo, videoUrl, aoTerminar }) {
  const [indice, setIndice] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [falando, setFalando] = useState(false);
  const [voz, setVoz] = useState(true);
  const [lerTudo, setLerTudo] = useState(false);
  const temporizador = useRef(null);
  // A troca de aula chega antes do efeito que volta à cena 1: nunca sai do limite.
  const posicao = Math.min(indice, Math.max(cenas.length - 1, 0));
  const cena = cenas[posicao];
  const ultima = posicao >= cenas.length - 1;
  const personagem = personagemDaArea(area);

  useEffect(() => { setVoz(lerVoz() && temVoz()); }, []);
  useEffect(() => { setIndice(0); setTocando(false); }, [cenas]);

  const parar = useCallback(() => {
    clearTimeout(temporizador.current);
    if (temVoz()) window.speechSynthesis.cancel();
    setFalando(false);
  }, []);
  useEffect(() => parar, [parar]);

  useEffect(() => {
    parar();
    if (!tocando || !cena) return undefined;
    let cancelada = false;
    const fim = () => {
      if (cancelada) return;
      setFalando(false);
      if (ultima) { setTocando(false); aoTerminar?.(); return; }
      temporizador.current = setTimeout(() => setIndice((i) => i + 1), 500);
    };
    setFalando(true);
    if (voz && temVoz()) {
      const fala = new SpeechSynthesisUtterance(cena.fala);
      fala.lang = "pt-BR";
      fala.rate = 1;
      const v = escolherVoz();
      if (v) fala.voice = v;
      fala.onend = fim;
      fala.onerror = (e) => { if (e.error !== "canceled" && e.error !== "interrupted") fim(); };
      window.speechSynthesis.speak(fala);
    } else {
      temporizador.current = setTimeout(fim, Math.max(3000, cena.fala.length * 60));
    }
    return () => { cancelada = true; };
    // A cena só recomeça quando muda a cena, o play ou a voz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice, tocando, voz, cena]);

  if (!cena) return null;
  const irPara = (i) => { setIndice(Math.max(0, Math.min(cenas.length - 1, i))); };
  const alternarVoz = () => { const v = !voz; setVoz(v); gravarVoz(v); };

  return (
    <section aria-label={titulo || "Aula"} className="overflow-hidden rounded-2xl border border-hf-border bg-hf-surface shadow-sm">
      <div className="bg-hf-elevated p-3 sm:p-5">
        <div className="grid items-center gap-2 sm:grid-cols-[150px_minmax(0,1fr)_150px]">
          <div className="flex items-end justify-center gap-2 sm:contents">
            <Boneco area={area} falando={falando} gesto={cena.gesto} className="h-36 w-28 sm:h-52 sm:w-full" />
            <Demonstracao tipo={cena.demonstracao} className="h-28 w-28 sm:order-last sm:h-36 sm:w-full" />
          </div>
          <div aria-live="polite" className="relative rounded-2xl border border-hf-border bg-hf-surface p-4 sm:min-h-44">
            <p className="text-xs font-bold text-hf-accent">{personagem.nome} · {personagem.funcao}</p>
            {cena.texto && <p className="mt-1.5 text-base font-semibold leading-relaxed text-hf-text">{cena.texto}</p>}
            {cena.itens?.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {cena.itens.map((item) => <li key={item} className="flex gap-2 text-sm font-medium leading-relaxed text-hf-text"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-hf-accent" />{item}</li>)}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-hf-border p-3">
        <button onClick={() => irPara(posicao - 1)} disabled={posicao === 0} aria-label="Cena anterior" className={`grid h-12 w-12 place-items-center rounded-xl border border-hf-border text-hf-text disabled:opacity-40 ${CHAVE}`}><ChevronLeft size={22} /></button>
        <button onClick={() => setTocando((t) => !t)} className={`flex h-12 min-w-32 flex-1 items-center justify-center gap-2 rounded-xl bg-hf-accent px-4 text-sm font-black text-hf-accent-fg sm:flex-none ${CHAVE}`}>
          {tocando ? <><Pause size={20} /> Pausar</> : <><Play size={20} /> {posicao === 0 ? "Começar" : "Continuar"}</>}
        </button>
        <button onClick={() => irPara(posicao + 1)} disabled={ultima} aria-label="Próxima cena" className={`grid h-12 w-12 place-items-center rounded-xl border border-hf-border text-hf-text disabled:opacity-40 ${CHAVE}`}><ChevronRight size={22} /></button>
        <span className="text-sm font-bold text-hf-text-2">{posicao + 1} de {cenas.length}</span>
        <span className="ml-auto flex gap-2">
          {temVoz() && <button onClick={alternarVoz} aria-pressed={voz} aria-label={voz ? "Desligar a voz" : "Ligar a voz"} className={`grid h-12 w-12 place-items-center rounded-xl border border-hf-border text-hf-text ${CHAVE}`}>{voz ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>}
          <button onClick={() => setLerTudo((v) => !v)} aria-expanded={lerTudo} className={`flex h-12 items-center gap-2 rounded-xl border border-hf-border px-3 text-sm font-bold text-hf-text ${CHAVE}`}><FileText size={18} /> Ler</button>
        </span>
      </div>

      {lerTudo && (
        <div className="space-y-3 border-t border-hf-border p-4">
          {cenas.map((c, i) => <p key={i} className="text-sm font-medium leading-relaxed text-hf-text">{c.fala}</p>)}
        </div>
      )}
      {videoUrl && (
        <div className="border-t border-hf-border p-3">
          <p className="mb-2 text-sm font-bold text-hf-text">Vídeo da casa</p>
          <video src={videoUrl} controls playsInline preload="metadata" className="max-h-[60dvh] w-full rounded-xl bg-black">
            <a href={videoUrl}>Abrir o vídeo</a>
          </video>
        </div>
      )}
    </section>
  );
}
