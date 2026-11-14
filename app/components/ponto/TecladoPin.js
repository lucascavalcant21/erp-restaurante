"use client";

// Teclado de PIN do ponto no tablet compartilhado (decisão do dono,
// 14/11/2026: cada funcionário se identifica pelo PIN de 4 números). Quem
// confere é o banco (hefisto_conferir_pin, db/PONTO_PIN_1): o PIN nunca fica
// no aparelho, e 5 erros em 10 minutos travam o tablet.

import { useState } from "react";
import { Delete, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function TecladoPin({ unidadeId, onAchou }) {
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [conferindo, setConferindo] = useState(false);

  async function conferir(completo) {
    setConferindo(true);
    const { data, error } = await supabase.rpc("hefisto_conferir_pin", { p_unidade: unidadeId, p_pin: completo });
    setConferindo(false);
    setPin("");
    if (error || !data) return setErro("Não foi possível conferir o PIN agora. Tente de novo.");
    if (!data.ok) return setErro(data.erro || "PIN não encontrado.");
    setErro("");
    onAchou?.(data.colaborador_id, data.nome);
  }

  function tocar(d) {
    if (conferindo || pin.length >= 4) return;
    const novo = pin + d;
    setPin(novo);
    setErro("");
    if (novo.length === 4) conferir(novo);
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-5 py-4">
      <p className="text-center text-[22px] font-black text-hf-text">Digite o seu PIN</p>
      <div className="flex gap-4" aria-label={`${pin.length} de 4 números digitados`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-5 w-5 rounded-full border-2 ${i < pin.length ? "border-hf-text bg-hf-text" : "border-hf-border-strong"}`} />
        ))}
      </div>
      <p role="status" className="min-h-[24px] text-center text-[15px] font-bold text-hf-danger">
        {conferindo ? <Loader2 size={20} className="mx-auto animate-spin text-hf-text-2" /> : erro}
      </p>
      <div className="grid w-full grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" onClick={() => tocar(d)} className="h-20 rounded-3xl border-2 border-hf-border bg-hf-surface text-[32px] font-black text-hf-text active:scale-95">{d}</button>
        ))}
        <span />
        <button type="button" onClick={() => tocar("0")} className="h-20 rounded-3xl border-2 border-hf-border bg-hf-surface text-[32px] font-black text-hf-text active:scale-95">0</button>
        <button type="button" onClick={() => setPin(pin.slice(0, -1))} aria-label="Apagar" className="grid h-20 place-items-center rounded-3xl text-hf-text-2 active:scale-95"><Delete size={30} /></button>
      </div>
      <p className="text-center text-sm font-semibold text-hf-text-2">Não tem PIN? Fale com o gerente.</p>
    </div>
  );
}
