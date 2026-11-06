"use client";

// Uma leitura do banco para o módulo inteiro: as seis áreas usam a mesma base
// (marmitas, pré-preparos, ingredientes, estoques, configuração) e recarregam
// juntas depois de gravar.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { UNIDADE_MARMITARIA } from "../../lib/marmitaria/acesso.mjs";
import { carregarBase } from "../../lib/marmitaria/dados";
import { custoDaMarmita } from "../../lib/marmitaria/nucleo.mjs";

const Ctx = createContext(null);

export function MarmitariaProvider({ children }) {
  // Sempre a unidade da marmitaria, sem mexer na unidade do resto do app.
  const unidadeId = UNIDADE_MARMITARIA;
  const [base, setBase] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const recarregar = useCallback(async () => {
    if (!unidadeId) { setBase(null); setCarregando(false); return; }
    setCarregando(true);
    try {
      const r = await carregarBase(unidadeId);
      if (r.error && !r.marmitas) { setErro(r.error); setBase(null); }
      else { setErro(r.error || null); setBase(r); }
    } catch (e) {
      setErro(e?.message || "Falha ao carregar a marmitaria.");
    } finally {
      setCarregando(false);
    }
  }, [unidadeId]);

  useEffect(() => { recarregar(); }, [recarregar]);

  // custo técnico de cada marmita, calculado uma vez para todas as telas
  const custos = useMemo(() => {
    const m = new Map();
    if (!base) return m;
    for (const mm of base.marmitas) m.set(mm.id, custoDaMarmita({ itens: mm.itens, embalagens: mm.embalagens, fichas: base.fichas, insumos: base.insumos }));
    return m;
  }, [base]);

  const valor = useMemo(() => ({ unidadeId, base, carregando, erro, recarregar, custos }), [unidadeId, base, carregando, erro, recarregar, custos]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useMarmitaria() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMarmitaria fora do MarmitariaProvider");
  return v;
}
