"use client";

// Sequência da marmitaria (16/11/2026): lê o que falta para a jornada (guias
// de montagem, equipe, vendas) e guarda, uma vez, que a implantação acabou.
// Depois disso a barra da marmitaria muda para o modo do dia a dia.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseReady } from "../../lib/supabase";
import { fetchProcessosMarmitaria, salvarParams } from "../../lib/parametros";
import { precoNormalizadoDoInsumo } from "../../lib/ingredientes-utils.mjs";
import { statusDaJornada } from "../../lib/marmitaria/jornada.mjs";
import { ehEmbalagem } from "./BuscaItens";
import { useMarmitaria } from "./contexto";

const Ctx = createContext(null);

async function contar(tabela, unidadeId) {
  if (!isSupabaseReady()) return null;
  const { count, error } = await supabase.from(tabela).select("id", { count: "exact", head: true }).eq("unidade_id", unidadeId);
  return error || count == null ? null : count;
}

export function JornadaProvider({ children }) {
  const { base, unidadeId, custos } = useMarmitaria();
  const [extra, setExtra] = useState(null);

  const ler = useCallback(async () => {
    if (!unidadeId || unidadeId === "todas") return;
    const [proc, aloc, vendas, cfg] = await Promise.all([
      fetchProcessosMarmitaria(unidadeId).catch(() => ({ error: "x" })),
      contar("marmitaria_rh_alocacoes", unidadeId).catch(() => null),
      contar("marmitaria_vendas", unidadeId).catch(() => null),
      supabase.from("config_sistema").select("params").eq("unidade_id", unidadeId).limit(1).then((r) => r, () => ({ error: true })),
    ]);
    setExtra({
      processos: proc?.error ? null : proc.data,
      alocacoes: aloc,
      temVendas: vendas == null ? null : vendas > 0,
      concluidaSalva: Boolean(cfg?.data?.[0]?.params?.marmitaria_jornada_concluida),
      delivery: cfg?.data?.[0]?.params?.delivery || null,
    });
  }, [unidadeId]);
  useEffect(() => { setExtra(null); ler(); }, [ler, base]);

  const jornada = useMemo(() => {
    if (!base || !extra) return null;
    return statusDaJornada({
      unidade: base.unidade, config: base.config, insumosLista: base.insumosLista, marmitas: base.marmitas, custos,
      delivery: extra.delivery, processos: extra.processos, alocacoes: extra.alocacoes, temVendas: extra.temVendas, concluidaSalva: extra.concluidaSalva,
      ehEmbalagem, precoDoInsumo: precoNormalizadoDoInsumo,
    });
  }, [base, extra, custos]);

  // Os nove prontos: grava uma vez e o sistema muda para o dia a dia.
  const concluir = useCallback(async () => {
    if (!unidadeId) return;
    const r = await salvarParams(unidadeId, { marmitaria_jornada_concluida: { em: new Date().toISOString() } });
    if (!r?.error) setExtra((x) => (x ? { ...x, concluidaSalva: true } : x));
  }, [unidadeId]);
  useEffect(() => { if (jornada?.acabouDeConcluir) concluir(); }, [jornada?.acabouDeConcluir, concluir]);

  // Nome e segmento do delivery (passo 1).
  const salvarDelivery = useCallback(async (d) => {
    if (!unidadeId) return { error: "Selecione uma unidade." };
    const r = await salvarParams(unidadeId, { delivery: d });
    if (!r?.error) setExtra((x) => (x ? { ...x, delivery: d } : x));
    return r;
  }, [unidadeId]);
  const valor = useMemo(() => ({ jornada, delivery: extra?.delivery || null, recarregarJornada: ler, concluir, salvarDelivery }), [jornada, extra, ler, concluir, salvarDelivery]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useJornada = () => useContext(Ctx) || { jornada: null, delivery: null, recarregarJornada: () => {}, concluir: async () => {}, salvarDelivery: async () => ({}) };
