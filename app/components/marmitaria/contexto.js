"use client";

// Uma leitura do banco para o módulo inteiro: as seis áreas usam a mesma base
// (marmitas, bases, ingredientes, estoques, configuração) e recarregam
// juntas depois de gravar.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { UNIDADE_MARMITARIA } from "../../lib/marmitaria/acesso.mjs";
import { carregarBase } from "../../lib/marmitaria/dados";
import { custoDaMarmita } from "../../lib/marmitaria/nucleo.mjs";
import { enviarFila, erroDeRede, guardarCopia, lerCopia, offline } from "../../lib/offline/fila.mjs";

// Cópia da última leitura no aparelho (dono, 21/11/2026: usar sem internet).
// Os Maps não viram JSON: guarda as listas e remonta.
const NOME_COPIA = (u) => `marmitaria-base:${u}`;
function paraCopia(b) { const { insumos, espelho, ...resto } = b; return resto; }
function daCopia(c) {
  const insumosLista = c.insumosLista || [];
  return { ...c, insumos: new Map(insumosLista.map((i) => [i.id, i])), espelho: new Map(insumosLista.filter((i) => i.ficha_tecnica_id).map((i) => [i.ficha_tecnica_id, i.id])) };
}

const Ctx = createContext(null);

export function MarmitariaProvider({ children }) {
  // Sempre a unidade da marmitaria, sem mexer na unidade do resto do app.
  const unidadeId = UNIDADE_MARMITARIA;
  const [base, setBase] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [copiaDe, setCopiaDe] = useState(null); // data da cópia em uso quando está sem internet

  const recarregar = useCallback(async () => {
    if (!unidadeId) { setBase(null); setCarregando(false); return; }
    setCarregando(true);
    const usarCopia = () => {
      const c = lerCopia(NOME_COPIA(unidadeId));
      if (!c?.dados) return false;
      setBase(daCopia(c.dados)); setCopiaDe(c.em); setErro(null);
      return true;
    };
    try {
      if (offline() && usarCopia()) return;
      const r = await carregarBase(unidadeId);
      if (r.error && erroDeRede(r.error) && usarCopia()) return;
      if (r.error && !r.marmitas) { setErro(r.error); setBase(null); }
      else {
        setErro(r.error || null); setBase(r); setCopiaDe(null);
        if (!r.error) guardarCopia(NOME_COPIA(unidadeId), paraCopia(r));
      }
    } catch (e) {
      if (!(erroDeRede(e) && usarCopia())) setErro(e?.message || "Falha ao carregar a marmitaria.");
    } finally {
      setCarregando(false);
    }
  }, [unidadeId]);

  useEffect(() => { recarregar(); }, [recarregar]);

  // A internet voltou: envia o que ficou na fila e lê de novo.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const voltou = async () => { await enviarFila(); await recarregar(); };
    window.addEventListener("online", voltou);
    if (!offline()) enviarFila().then((r) => { if (r?.enviados) recarregar(); });
    return () => window.removeEventListener("online", voltou);
  }, [recarregar]);

  // custo técnico de cada marmita, calculado uma vez para todas as telas
  const custos = useMemo(() => {
    const m = new Map();
    if (!base) return m;
    for (const mm of base.marmitas) m.set(mm.id, custoDaMarmita({ itens: mm.itens, embalagens: mm.embalagens, fichas: base.fichas, insumos: base.insumos }));
    return m;
  }, [base]);

  const valor = useMemo(() => ({ unidadeId, base, carregando, erro, recarregar, custos, copiaDe }), [unidadeId, base, carregando, erro, recarregar, custos, copiaDe]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useMarmitaria() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMarmitaria fora do MarmitariaProvider");
  return v;
}
