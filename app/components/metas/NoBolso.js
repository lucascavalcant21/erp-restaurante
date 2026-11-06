"use client";

import { noBolso } from "../../lib/precificacao.mjs";

const brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Lucro em reais, meta fixa e o que sobra ou falta. */
export default function NoBolso({ lucro, preco, metaPct, metaReais, rotulo }) {
  const b = noBolso({ lucro, preco, metaPct: metaPct === "" ? null : metaPct, metaReais });
  if (!b) return null;
  const cor = b.estado === "prejuizo" || b.estado === "abaixo" ? "text-hf-danger" : "text-hf-success";
  return (
    <div className="mt-2 rounded-xl border border-hf-border bg-hf-elevated p-3">
      <p className="text-xs font-bold text-hf-text-2">{rotulo === "Lucro" ? "Lucro por pedido" : rotulo}</p>
      <p className={`text-2xl font-black tabular-nums ${cor}`}>{brl(b.lucro)}</p>
      <dl className="mt-1 space-y-0.5 text-sm">
        {b.meta !== null && <div className="flex justify-between gap-3"><dt className="text-hf-text-2">{b.rotuloMeta}</dt><dd className="font-bold tabular-nums text-hf-text">{brl(b.meta)}</dd></div>}
        {b.margem > 0 && <div className="flex justify-between gap-3"><dt className="text-hf-text-2">Margem de segurança</dt><dd className="font-bold tabular-nums text-hf-success">{brl(b.margem)}</dd></div>}
        {b.falta > 0 && <div className="flex justify-between gap-3"><dt className="text-hf-text-2">Falta para a meta</dt><dd className="font-bold tabular-nums text-hf-danger">{brl(b.falta)}</dd></div>}
      </dl>
      {b.estado === "sem_meta" && <p className="mt-1 text-xs text-hf-text-2">Defina a meta de lucro para ver a margem de segurança.</p>}
    </div>
  );
}

