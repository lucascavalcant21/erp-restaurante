"use client";

// Calculadora "por quilo" (salmoura e empanado, dono 23/11/2026): a pessoa diz
// quantos kg e vê cada ingrediente já multiplicado. A conta é de
// app/lib/formulas-por-quilo.mjs (quantidade × kg ÷ kg de referência).
// Usada na tela (Cozinha › Salmouras / Empanados) e no cartão do assistente.

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { TIPOS_FORMULA, CATEGORIAS_SALMOURA, calcularFormula, textoKg } from "../../lib/formulas-por-quilo.mjs";

const CHIPS = [0.5, 1, 2, 3, 5, 10];
const fmtKg = (v) => String(Math.round(v * 100) / 100).replace(".", ",");

export default function CalculadoraFormula({ formula, kgInicial = null, cores = null }) {
  const [kgTxt, setKgTxt] = useState(kgInicial ? fmtKg(kgInicial) : "");
  const kg = Number(String(kgTxt).replace(",", "."));
  const r = useMemo(() => (kg > 0 ? calcularFormula(formula, kg) : null), [formula, kg]);
  const T = TIPOS_FORMULA[formula.tipo] || TIPOS_FORMULA.salmoura;
  const refBruta = formula.tipo === "empanado" ? (formula.referencia || "farinha") : "produto";
  const ref = refBruta.charAt(0).toLowerCase() + refBruta.slice(1);
  const destaque = cores?.destaque || "var(--hf-text, #111827)";
  const meta = cores?.meta || "var(--hf-muted, #6b7280)";
  const fundoItem = cores?.item || "#fff";
  const mudar = (d) => setKgTxt(fmtKg(Math.max(0.5, (kg > 0 ? kg : 0) + d)));
  const cat = CATEGORIAS_SALMOURA.find((c) => c.id === formula.categoria);

  return (
    <div className="w-full">
      <p className="text-[12.5px] font-bold uppercase tracking-wide" style={{ color: meta }}>
        {T.singular === "salmoura" ? `Salmoura${cat && cat.id !== "outro" ? ` · ${cat.rotulo}` : ""}` : `Empanado · ${formula.referencia || "farinha"}`}
      </p>
      <p className="text-[19px] font-extrabold leading-tight">{formula.nome}</p>
      {formula.produtos?.length > 0 && <p className="mt-0.5 text-[14px]" style={{ color: meta }}>Usada em: {formula.produtos.join(", ")}</p>}

      <p className="mt-3 text-[15px] font-bold">Quantos kg de {ref}{formula.tipo === "salmoura" ? " vai na salmoura" : " vai usar"}?</p>
      <div className="mt-1.5 flex items-center gap-2">
        <button type="button" aria-label="Menos meio quilo" onClick={() => mudar(-0.5)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-black/10" style={{ background: fundoItem }}><Minus size={18} /></button>
        <label className="flex h-12 min-w-0 flex-1 items-center rounded-full border border-black/10 px-4" style={{ background: fundoItem }}>
          <input inputMode="decimal" value={kgTxt} onChange={(e) => setKgTxt(e.target.value.replace(/[^\d,.]/g, ""))} placeholder="ex.: 1,8" aria-label={`Quilos de ${ref}`}
            className="min-w-0 flex-1 bg-transparent text-center text-[20px] font-extrabold tabular-nums outline-none" />
          <span className="text-[15px] font-bold" style={{ color: meta }}>kg</span>
        </label>
        <button type="button" aria-label="Mais meio quilo" onClick={() => mudar(0.5)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-black/10" style={{ background: fundoItem }}><Plus size={18} /></button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {CHIPS.map((c) => (
          <button key={c} type="button" aria-pressed={kg === c} onClick={() => setKgTxt(fmtKg(c))}
            className={`min-h-[40px] rounded-full px-3.5 text-[14.5px] font-bold ${kg === c ? "bg-hf-menu text-white" : "border border-black/10"}`} style={kg === c ? undefined : { background: fundoItem }}>
            {fmtKg(c)} kg
          </button>
        ))}
      </div>

      {!r && <p className="mt-3 text-[14.5px]" style={{ color: meta }}>Escolha os quilos para ver as quantidades.</p>}
      {r?.erro && <p className="mt-3 text-[14.5px] font-semibold text-hf-danger">{r.erro}</p>}
      {r && !r.erro && (
        <div className="mt-3 space-y-3">
          <p className="text-[14px] font-bold" style={{ color: meta }}>Para {textoKg(r.kg)} de {ref}:</p>
          {r.secoes.map((s, k) => (
            <div key={k}>
              {(r.secoes.length > 1 || formula.tipo === "empanado") && <p className="mb-1 text-[13px] font-black uppercase tracking-wide" style={{ color: meta }}>{s.titulo}</p>}
              <ul className="divide-y divide-black/5 rounded-2xl" style={{ background: fundoItem }}>
                {s.itens.map((i, j) => (
                  <li key={j} className="flex items-baseline justify-between gap-3 px-3 py-2.5">
                    <span className="min-w-0 text-[17px] font-semibold">{i.nome}</span>
                    <b className="shrink-0 text-right text-[19px] font-extrabold tabular-nums" style={{ color: destaque }}>{i.texto}</b>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {formula.tempo && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[15px] text-amber-900"><b>Tempo:</b> {formula.tempo}</p>}
          {formula.preparo && <p className="whitespace-pre-line text-[15px] leading-relaxed">{formula.preparo}</p>}
        </div>
      )}
    </div>
  );
}
