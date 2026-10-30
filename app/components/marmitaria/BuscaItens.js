"use client";

// Busca universal da marmita: pré-preparos e ingredientes do estoque geral
// (os mesmos das fichas do restaurante — nada é copiado), ou embalagens.
// No fim da lista, criar o que não existe sem sair da marmita.

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { normalizarBusca } from "../../lib/ingredientes-utils.mjs";
import { custoUnitarioEfetivoInsumo, custoDeProduzirFicha, parseNumero } from "../../lib/ficha-calculos.mjs";
import { brl, inputCls } from "./ui";
import { casaBusca } from "../../lib/busca.mjs";

export const ehEmbalagem = (i) => String(i?.departamento || "").toLowerCase() === "embalagens"
  || /embalag/i.test(String(i?.categoria || "")) || String(i?.tipo || "").toLowerCase() === "embalagem";

export default function BuscaItens({ base, modo = "ingrediente", filtroInicial = "", onEscolher, onCriarIngrediente, onCriarPrePreparo, onCriarEmbalagem, excluir = [] }) {
  const [termo, setTermo] = useState(filtroInicial);
  const usoPorInsumo = useMemo(() => {
    const m = new Map();
    for (const f of base.fichas) for (const fi of f.fichas_ingredientes || []) if (fi.insumo_id) m.set(fi.insumo_id, (m.get(fi.insumo_id) || 0) + 1);
    return m;
  }, [base.fichas]);

  const resultados = useMemo(() => {
    const t = normalizarBusca(termo);
    const casa = (nome) => !t || casaBusca(nome, termo);
    const fora = new Set(excluir);
    if (modo === "embalagem") {
      return base.insumosLista.filter((i) => ehEmbalagem(i) && !fora.has(i.id) && casa(i.nome)).slice(0, 30)
        .map((i) => ({ tipo: "embalagem", id: i.id, nome: i.nome, detalhe: `${brl(custoUnitarioEfetivoInsumo(i))} / un` }));
    }
    const preps = base.prePreparos.filter((f) => !fora.has(f.id) && casa(f.nome_receita)).slice(0, 15).map((f) => {
      const rend = parseNumero(f.rendimento_porcoes);
      const custo = custoDeProduzirFicha(f, base.fichas);
      const un = f.rendimento_unidade || "un";
      return { tipo: "pre_preparo", id: f.id, nome: f.nome_receita,
        detalhe: rend > 0 && custo > 0 ? `Pré-preparo · rende ${rend} ${un} · ${brl(custo / rend)}/${un}` : "Pré-preparo · sem custo ou rendimento" };
    });
    const ings = base.insumosLista.filter((i) => !i.ficha_tecnica_id && !ehEmbalagem(i) && !fora.has(i.id) && casa(i.nome)).slice(0, 30).map((i) => {
      const usos = usoPorInsumo.get(i.id) || 0;
      const c = custoUnitarioEfetivoInsumo(i);
      return { tipo: "ingrediente", id: i.id, nome: i.nome,
        detalhe: `${c > 0 ? `${brl(c)}/${String(i.unidade_medida || "un").toLowerCase() === "g" ? "kg" : String(i.unidade_medida || "un").toLowerCase() === "ml" ? "L" : i.unidade_medida || "un"}` : "sem custo"}${usos ? ` · usado em ${usos} ficha${usos > 1 ? "s" : ""}` : ""}${i.departamento === "marmitaria" ? " · só marmitaria" : ""}` };
    });
    return [...preps, ...ings];
  }, [termo, modo, base, usoPorInsumo, excluir]);

  const textoCriar = termo.trim();
  return (
    <div className="rounded-xl border border-hf-border bg-hf-surface">
      <div className="relative p-2">
        <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-hf-muted" />
        <input autoFocus value={termo} onChange={(e) => setTermo(e.target.value)} className={`${inputCls} pl-9`}
          placeholder={modo === "embalagem" ? "Buscar embalagem (marmitex, tampa, sacola…)" : "Buscar ingrediente ou pré-preparo (arroz, frango…)"} />
      </div>
      <ul className="max-h-72 overflow-y-auto border-t border-hf-border">
        {resultados.map((r) => (
          <li key={`${r.tipo}:${r.id}`}>
            <button type="button" onClick={() => onEscolher(r)} className="flex w-full min-h-[48px] flex-col items-start px-3 py-2 text-left hover:bg-hf-elevated">
              <span className="text-sm font-semibold text-hf-text">{r.nome}</span>
              <span className="text-xs text-hf-muted">{r.detalhe}</span>
            </button>
          </li>
        ))}
        {!resultados.length && <li className="px-3 py-3 text-sm text-hf-muted">Nada encontrado{textoCriar ? ` para “${textoCriar}”` : ""}.</li>}
      </ul>
      <div className="flex flex-wrap gap-2 border-t border-hf-border p-2">
        {modo === "embalagem" ? (
          <button type="button" onClick={() => onCriarEmbalagem?.(textoCriar)} className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-3 text-sm font-semibold text-hf-accent hover:bg-hf-accent/5">
            <Plus size={15} /> Cadastrar embalagem{textoCriar ? ` “${textoCriar}”` : ""}
          </button>
        ) : (
          <>
            <button type="button" onClick={() => onCriarIngrediente?.(textoCriar)} className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-3 text-sm font-semibold text-hf-accent hover:bg-hf-accent/5">
              <Plus size={15} /> Novo ingrediente{textoCriar ? ` “${textoCriar}”` : ""}
            </button>
            {onCriarPrePreparo && (
              <button type="button" onClick={() => onCriarPrePreparo?.(textoCriar)} className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-3 text-sm font-semibold text-hf-accent hover:bg-hf-accent/5">
                <Plus size={15} /> Novo pré-preparo{textoCriar ? ` “${textoCriar}”` : ""}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
