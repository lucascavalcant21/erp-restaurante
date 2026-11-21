"use client";

// Buffet: ponto de equilíbrio em convidados, produção com sobra de segurança e
// sobras reais em peso e dinheiro (dono, 21/11/2026).

import { useMemo } from "react";
import { producaoDoBuffet, equilibrioDoBuffet, sobrasDoBuffet } from "../../../../../lib/evento-buffet.mjs";
import { fmtReais } from "../../../../../lib/valor-percentual.mjs";
import { Cartao, Numero, LinhaValor } from "./ui";

const kg = (g, un = "g") => {
  if (g === null || g === undefined) return "—";
  const grande = un === "ml" ? "L" : "kg";
  return g >= 1000 ? `${(g / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${grande}` : `${Math.round(g).toLocaleString("pt-BR")} ${un}`;
};
const COR = { ok: "border-emerald-200 bg-emerald-50", atencao: "border-amber-200 bg-amber-50", alerta: "border-red-200 bg-red-50", sem_dado: "border-slate-200 bg-slate-50" };

/** Linha curta do ponto de equilíbrio (usada na etapa Custos e preço). */
export function EquilibrioDoBuffet({ orc, fichas, resumo }) {
  const e = useMemo(() => equilibrioDoBuffet(orc, fichas, resumo), [orc, fichas, resumo]);
  return (
    <div className={`rounded-2xl border p-4 ${COR[e.situacao]}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Ponto de equilíbrio</p>
      <p className="mt-1 text-base font-black text-slate-900">{e.texto || e.motivo}</p>
      {e.pontoEquilibrio !== null && e.porConvidado !== undefined && (
        <p className="mt-1 text-sm font-medium text-slate-700">
          Cada convidado a mais deixa {fmtReais(e.porConvidado)} de lucro.{e.meta ? ` Para a meta de lucro: ${e.meta} convidados.` : ""}
        </p>
      )}
    </div>
  );
}

export default function BuffetDoEvento({ orc, setOrc, resumo: r, fichas }) {
  const prod = useMemo(() => producaoDoBuffet(r), [r]);
  const sobras = useMemo(() => sobrasDoBuffet(prod, orc.sobras_reais || {}, r.pessoasConsumo), [prod, orc.sobras_reais, r.pessoasConsumo]);
  const mudar = (id, v) => setOrc((o) => ({ ...o, sobras_reais: { ...(o.sobras_reais || {}), [id]: v } }));
  if (!prod.itens.length) return null;
  return (
    <div className="space-y-5">
      <EquilibrioDoBuffet orc={orc} fichas={fichas} resumo={r} />

      <Cartao titulo="Produção e sobras" descricao={`O que produzir para ${Math.round(r.pessoasConsumo).toLocaleString("pt-BR")} pessoas-equivalentes${r.sobraPct ? `, com ${r.sobraPct.toLocaleString("pt-BR")}% de sobra de segurança` : ""}. Depois do evento, pese o que sobrou de cada item.`}>
        <ul className="divide-y divide-slate-100">
          {sobras.linhas.map((l) => (
            <li key={l.id} className="flex flex-wrap items-end justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-900">{l.nome}</p>
                <p className="text-xs font-medium text-slate-600">
                  Produzir {kg(l.produzirG, l.un)}{!l.emTotal && l.porPessoaG ? ` (${l.porPessoaG.toLocaleString("pt-BR")} ${l.un} por pessoa)` : ""} · {fmtReais(l.custo)}{l.custoKg !== null ? ` · ${fmtReais(l.custoKg)} o ${l.un === "ml" ? "L" : "kg"}` : ""}
                </p>
                {l.lancada && (
                  <p className={`mt-0.5 text-xs font-bold ${l.sobraPct > 15 ? "text-red-700" : "text-slate-700"}`}>
                    Sobrou {kg(l.sobraG, l.un)} = {l.sobraValor !== null ? fmtReais(l.sobraValor) : "—"} ({l.sobraPct?.toLocaleString("pt-BR")}% do produzido) · comeram {l.consumoPorPessoaG?.toLocaleString("pt-BR")} {l.un} por pessoa
                  </p>
                )}
              </div>
              <label className="w-36 shrink-0">
                <span className="mb-1 block text-xs font-bold text-slate-600">Sobrou ({l.un})</span>
                <Numero valor={orc.sobras_reais?.[l.id] ?? ""} onChange={(v) => mudar(l.id, v)} placeholder="0" aria-label={`Quanto sobrou de ${l.nome}, em ${l.un}`} />
              </label>
            </li>
          ))}
        </ul>
        {prod.semPeso.length > 0 && <p className="mt-2 text-xs font-bold text-amber-700">Sem peso da porção (não entra na conta de peso): {prod.semPeso.join(", ")}.</p>}
        <div className="mt-3 border-t border-slate-100 pt-3">
          <LinhaValor rotulo="Comida a produzir" valor={`${kg(prod.comidaProduzirG)}${prod.comidaPorPessoaG ? ` · ${prod.comidaPorPessoaG.toLocaleString("pt-BR")} g por pessoa` : ""}`} />
          {prod.sobraSegG > 0 && <LinhaValor rotulo="Sobra de segurança planejada" valor={`${kg(prod.sobraSegG)} · ${fmtReais(prod.sobraSegValor)}`} />}
          {sobras.lancadas > 0 && (
            <>
              <LinhaValor forte rotulo="Sobra real do evento" valor={`${kg(sobras.totalG)} · ${fmtReais(sobras.totalValor)}`} tom={sobras.totalPct > 15 ? "text-red-600" : "text-slate-900"} />
              {sobras.totalPct !== null && <LinhaValor rotulo="Do que foi produzido" valor={`${sobras.totalPct.toLocaleString("pt-BR")}%`} />}
              {r.lucro !== undefined && sobras.totalValor > 0 && <p className="mt-1 text-xs font-medium text-slate-600">Esse dinheiro já está no custo do cardápio: se não sobrasse, o lucro seria {fmtReais(r.lucro + sobras.totalValor)}.</p>}
            </>
          )}
        </div>
        {sobras.ajustes.length > 0 && (
          <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2">
            <p className="text-sm font-black text-amber-900">Para o próximo evento</p>
            <ul className="mt-1 space-y-0.5 text-sm font-medium text-amber-900">
              {sobras.ajustes.map((a) => <li key={a.id}>{a.nome}: de {a.de.toLocaleString("pt-BR")} {a.un} para {a.para.toLocaleString("pt-BR")} {a.un} por pessoa (o que foi consumido).</li>)}
            </ul>
          </div>
        )}
      </Cartao>
    </div>
  );
}
