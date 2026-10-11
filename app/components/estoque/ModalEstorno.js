"use client";

// Estorno de um lançamento (administrador autorizado + PIN). O original fica
// no histórico; o banco lança o movimento contrário (estoque_estornar).

import { useState } from "react";
import { Loader2, RotateCcw, X } from "lucide-react";
import { estornarLancamento } from "../../lib/estoque-movimento-dados";
import { rotuloMotivo, unidadeDoSaldo } from "../../lib/estoque-movimento.mjs";

const fmtQ = (n) => Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const un = (u) => (String(u || "").toLowerCase() === "l" ? "L" : (u || "un"));
export const fmtHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

export default function ModalEstorno({ estorno, setEstorno, onFeito }) {
  const [enviando, setEnviando] = useState(false);
  const m = estorno.mov;
  const entra = m.tipo === "entrada";
  const unidade = m.unidade_medida ? un(m.unidade_medida) : unidadeDoSaldo(m.insumo);
  const enviar = async (e) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    const r = await estornarLancamento({ movimento_id: m.id, justificativa: estorno.justificativa, pin: estorno.pin, chave: estorno.chave });
    setEnviando(false);
    if (r.error) return setEstorno({ ...estorno, erro: r.error, pin: r.pin ? "" : estorno.pin });
    onFeito(`Estorno feito: ${entra ? "saíram" : "voltaram"} ${fmtQ(m.quantidade)} ${unidade} de ${m.insumo?.nome || "produto"}. O lançamento original continua no histórico.`);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/40 sm:items-center sm:p-4">
      <form onSubmit={enviar} className="w-full max-w-md space-y-3 rounded-t-3xl bg-hf-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl">
        <div className="flex justify-between">
          <h3 className="flex items-center gap-2 text-lg font-black text-hf-text"><RotateCcw size={18} /> Estornar lançamento</h3>
          <button type="button" onClick={() => setEstorno(null)} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-xl text-hf-text-2 hover:bg-hf-elevated"><X size={20} /></button>
        </div>
        <div className="rounded-2xl bg-hf-elevated p-3 text-sm text-hf-text">
          <p className="font-black">{entra ? "Entrada" : "Retirada"} de {fmtQ(m.quantidade)} {unidade} · {m.insumo?.nome}</p>
          <p className="text-xs text-hf-text-2">{[rotuloMotivo(m.motivo), m.usuario_nome, fmtHora(m.created_at)].filter(Boolean).join(" · ")}</p>
          <p className="mt-1 text-xs">O estorno lança o movimento contrário ({entra ? "retira" : "devolve"} {fmtQ(m.quantidade)} {unidade}). Nada é apagado.</p>
        </div>
        <input required value={estorno.justificativa} onChange={(e) => setEstorno({ ...estorno, justificativa: e.target.value })} placeholder="Motivo do estorno"
          className="h-12 w-full rounded-xl border border-hf-border bg-hf-surface px-3 font-bold text-hf-text" />
        <input required type="password" inputMode="numeric" autoComplete="off" value={estorno.pin}
          onChange={(e) => setEstorno({ ...estorno, pin: e.target.value.replace(/\D/g, "").slice(0, 8) })} placeholder="PIN do administrador"
          className="h-12 w-full rounded-xl border border-hf-border bg-hf-surface px-3 font-black tracking-widest text-hf-text" />
        {estorno.erro && <p className="text-sm font-bold text-hf-danger">{estorno.erro}</p>}
        <button disabled={enviando} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-hf-text font-black text-hf-surface disabled:opacity-60">
          {enviando ? <><Loader2 size={18} className="animate-spin" /> Estornando...</> : "Confirmar estorno"}
        </button>
      </form>
    </div>
  );
}
