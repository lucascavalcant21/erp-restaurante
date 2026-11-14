"use client";

// Uma pergunta do Jhon para conhecer o negócio (implantação, 14/11/2026).
// Mais tocar do que digitar: escolha e múltipla em pílulas; número e texto só
// quando não tem como ser de outro jeito.

import { useState } from "react";
import { Check, Loader2, MessageCircleQuestion } from "lucide-react";
import { validarResposta } from "../../lib/implantacao.mjs";

export default function PerguntaDoJhon({ pergunta, inicial = undefined, onResponder, compacta = false }) {
  const [valor, setValor] = useState(inicial ?? (pergunta.tipo === "multipla" ? [] : ""));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function enviar(v = valor) {
    const r = validarResposta(pergunta, v);
    if (r.erro) { setErro(r.erro); return; }
    setSalvando(true); setErro("");
    const e = await onResponder(r.valor);
    setSalvando(false);
    if (e) setErro(e);
  }

  const pilula = (ativa) => `min-h-[44px] rounded-full border px-4 text-[15px] font-semibold shadow-none ${ativa ? "border-mw-marinho bg-mw-marinho text-white" : "border-mw-borda bg-white text-mw-marinho"}`;

  return (
    <div className={`rounded-[22px] border border-mw-borda bg-mw-card ${compacta ? "p-4" : "p-5"}`}>
      <p className="flex items-center gap-2 text-[13px] font-semibold text-mw-azul"><MessageCircleQuestion size={16} /> O Jhon pergunta</p>
      <p className="mt-1 text-[18px] font-semibold leading-snug text-mw-marinho">{pergunta.texto}</p>
      <div className="mt-3">
        {pergunta.tipo === "escolha" && (
          <div className="flex flex-wrap gap-2">
            {pergunta.opcoes.map((o) => <button key={o} type="button" disabled={salvando} onClick={() => { setValor(o); enviar(o); }} className={pilula(valor === o)}>{o}</button>)}
          </div>
        )}
        {pergunta.tipo === "multipla" && (
          <>
            <div className="flex flex-wrap gap-2">
              {pergunta.opcoes.map((o) => {
                const on = valor.includes(o);
                return <button key={o} type="button" aria-pressed={on} onClick={() => setValor(on ? valor.filter((x) => x !== o) : [...valor, o])} className={pilula(on)}>{on && <Check size={14} className="mr-1 inline" />}{o}</button>;
              })}
            </div>
            <button type="button" disabled={salvando || !valor.length} onClick={() => enviar()} className="mt-3 min-h-[48px] w-full rounded-full bg-mw-marinho text-[16px] font-semibold text-white shadow-none disabled:opacity-40">
              {salvando ? <Loader2 size={18} className="mx-auto animate-spin" /> : "Responder"}
            </button>
          </>
        )}
        {(pergunta.tipo === "numero" || pergunta.tipo === "texto") && (
          <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="space-y-2">
            <div className="flex items-center gap-2">
              <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode={pergunta.tipo === "numero" ? "decimal" : "text"}
                placeholder={pergunta.dica || (pergunta.unidade ? pergunta.unidade : "")} aria-label={pergunta.texto}
                className="h-12 min-w-0 flex-1 rounded-full border border-mw-borda bg-white px-4 text-[16px] text-mw-marinho outline-none focus:border-mw-agua" />
              {pergunta.tipo === "numero" && pergunta.unidade && <span className="shrink-0 text-[14px] text-mw-sec">{pergunta.unidade}</span>}
            </div>
            <div className="flex gap-2">
              {pergunta.permiteNaoSei && <button type="button" disabled={salvando} onClick={() => enviar("nao_sei")} className="min-h-[48px] flex-1 rounded-full border border-mw-borda bg-white text-[15px] font-semibold text-mw-marinho shadow-none">Não sei</button>}
              <button type="submit" disabled={salvando} className="min-h-[48px] flex-[2] rounded-full bg-mw-marinho text-[16px] font-semibold text-white shadow-none disabled:opacity-40">
                {salvando ? <Loader2 size={18} className="mx-auto animate-spin" /> : "Responder"}
              </button>
            </div>
          </form>
        )}
      </div>
      {erro && <p className="mt-2 text-[14px] text-hf-danger">{erro}</p>}
    </div>
  );
}
