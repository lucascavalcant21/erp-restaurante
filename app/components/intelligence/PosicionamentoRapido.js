"use client";

// Posicionamento no Assistente (dono, 23/11/2026): "posicionamento" mostra a
// lista de produtos e quanto vai no prato; "posicionamento do filé" mostra só
// ele. Vem do aparelho (receitas-cache.js), sem internet. Editar é na Cozinha ›
// Posicionamento (botão abaixo do cartão).

import { useMemo, useState } from "react";
import { Scale, Search } from "lucide-react";
import { textoAlvo, textoFaixa } from "../../lib/posicionamento.mjs";

const VERDE = "var(--wa-verde-escuro, #005A49)";
const META = "var(--wa-meta, #667781)";
const semAcento = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function PosicionamentoRapido({ itens = [] }) {
  const [busca, setBusca] = useState("");
  const lista = useMemo(() => {
    const q = semAcento(busca).trim();
    return q ? itens.filter((i) => semAcento(i.nome).includes(q)) : itens;
  }, [itens, busca]);

  return (
    <div className="w-full">
      <p className="mb-2 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide" style={{ color: META }}>
        <Scale size={15} /> Posicionamento · quanto vai no prato
      </p>
      {itens.length > 6 && (
        <label className="mb-2 flex h-11 items-center gap-2 rounded-full bg-white px-4">
          <Search size={16} style={{ color: META }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar produto" aria-label="Procurar produto"
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none" />
        </label>
      )}
      <ul className="space-y-1.5">
        {lista.map((i) => {
          const faixa = textoFaixa(i);
          return (
            <li key={i.id} className="rounded-2xl bg-white px-3 py-2.5">
              <div className="flex items-baseline gap-3">
                <span className="min-w-0 flex-1 text-[17px] font-bold">{i.nome}</span>
                <span className="shrink-0 text-right text-[20px] font-extrabold tabular-nums" style={{ color: VERDE }}>{textoAlvo(i)}</span>
              </div>
              {(faixa || i.obs) && (
                <p className="mt-0.5 text-[14px]" style={{ color: META }}>
                  {faixa ? <b className="font-semibold">Aceita {faixa}</b> : null}{faixa && i.obs ? " · " : ""}{i.obs}
                </p>
              )}
            </li>
          );
        })}
        {!lista.length && <li className="rounded-2xl bg-white px-3 py-3 text-[15px]" style={{ color: META }}>Nenhum produto com esse nome.</li>}
      </ul>
    </div>
  );
}
