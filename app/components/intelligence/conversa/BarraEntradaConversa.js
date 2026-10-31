"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Send, Mic, MicOff, Volume2, VolumeX } from "lucide-react";

/**
 * Barra de entrada e voz isolada: mantém o estado `entrada` localmente
 * para que cada tecla digitada NÃO re-renderize a lista inteira de mensagens da conversa.
 */
const BarraEntradaConversa = memo(function BarraEntradaConversa({
  ocupado,
  autoFoco = false,
  vozOk = false,
  sinteseOk = false,
  ouvindo = false,
  lerEmVoz = false,
  textoVozParcial = "",
  onEnviar,
  onAlternarMicrofone,
  onAlternarLeituraVoz,
}) {
  const [entrada, setEntrada] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFoco) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [autoFoco]);

  useEffect(() => {
    if (textoVozParcial) {
      setEntrada(textoVozParcial);
    }
  }, [textoVozParcial]);

  function submeter(e) {
    if (e) e.preventDefault();
    const limpo = entrada.trim();
    if (!limpo || ocupado) return;
    setEntrada("");
    onEnviar(limpo);
  }

  return (
    <div className="sticky bottom-0 z-10 -mx-1 mt-2 bg-hf-elevated/90 px-1 pb-1 pt-2 backdrop-blur-sm" style={{ paddingBottom: "max(4px, env(safe-area-inset-bottom, 0px))" }}>
      <form onSubmit={submeter} className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          rows={2}
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          maxLength={500}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submeter();
            }
          }}
          placeholder={ouvindo ? "Ouvindo… pode falar" : "Pergunte qualquer coisa sobre sua empresa..."}
          aria-label="Pergunte ao Héfisto"
          className="max-h-32 min-h-[54px] min-w-0 flex-1 resize-none rounded-2xl border border-hf-border-strong bg-hf-surface px-3.5 py-2.5 text-[15px] leading-snug text-hf-text shadow-xs transition focus:border-hf-accent focus:outline-none focus:ring-2 focus:ring-hf-accent/20"
        />
        {vozOk && (
          <button
            type="button"
            onClick={onAlternarMicrofone}
            aria-label={ouvindo ? "Parar de ouvir" : "Falar com o Héfisto"}
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition active:scale-95 ${
              ouvindo
                ? "animate-pulse bg-hf-danger text-white shadow-sm"
                : "border border-hf-border-strong bg-hf-surface text-hf-text hover:border-hf-accent hover:text-hf-accent"
            }`}
          >
            {ouvindo ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
        )}
        <button
          type="submit"
          disabled={!entrada.trim() || ocupado}
          aria-label="Enviar"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-hf-accent text-hf-accent-fg shadow-xs transition hover:bg-emerald-800 active:scale-95 disabled:opacity-40"
        >
          <Send size={19} />
        </button>
      </form>
      {vozOk && sinteseOk && (
        <button
          type="button"
          onClick={onAlternarLeituraVoz}
          className="mt-1.5 inline-flex min-h-[32px] items-center gap-1.5 self-start rounded-lg px-1.5 text-[12px] font-semibold text-hf-text-2 transition hover:bg-hf-surface hover:text-hf-text"
        >
          {lerEmVoz ? <Volume2 size={14} className="text-hf-accent" /> : <VolumeX size={14} />}
          {lerEmVoz ? "Lendo respostas de voz em voz alta" : "Ler respostas de voz em voz alta"}
        </button>
      )}
    </div>
  );
});

export default BarraEntradaConversa;
