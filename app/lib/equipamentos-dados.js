"use client";

// Leitura e gravação da Fritadeira e coifa (regras em app/lib/equipamentos.mjs).
// Agenda e histórico: controle_manutencoes (a mesma da tela Controles).
// Equipamentos, passo a passo e materiais: config_sistema.params.equipamentos.

import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "./supabase";
import { salvarParams } from "./parametros";
import { fetchManutencoes, inserirManutencao, atualizarManutencao, registrarExecucaoManutencao } from "./controles_cozinha";
import { TIPOS_EQUIPAMENTO, hojeSP, montarEquipamentos, nomeDaTarefa, normalizarEquipamentos, normalizarProcedimento, novoIdEquip, somarDiasEquip } from "./equipamentos.mjs";

async function lerParams(unidadeId) {
  const { data, error } = await supabase.from("config_sistema").select("params").eq("unidade_id", unidadeId).limit(1);
  if (error) throw new Error(error.message);
  return normalizarEquipamentos(data?.[0]?.params?.equipamentos || null);
}
const gravarParams = async (unidadeId, dados) => {
  const r = await salvarParams(unidadeId, { equipamentos: normalizarEquipamentos(dados) });
  if (r?.error) throw new Error(r.error);
};

/** Insumos da unidade e o saldo somado de cada um (para os avisos de material). */
async function lerEstoque(unidadeId) {
  const [ins, itens] = await Promise.all([
    supabase.from("insumos").select("id, nome").eq("unidade_id", unidadeId).is("arquivado_em", null).limit(2000),
    supabase.from("estoque_itens").select("insumo_id, quantidade_atual").eq("unidade_id", unidadeId).limit(5000),
  ]);
  const saldos = new Map();
  for (const i of itens.data || []) saldos.set(i.insumo_id, (saldos.get(i.insumo_id) || 0) + (Number(i.quantidade_atual) || 0));
  return { insumos: ins.data || [], saldos };
}

export function useEquipamentos(unidadeId) {
  const [estado, setEstado] = useState({ carregando: true, erro: "", dados: null, equipamentos: [], insumos: [], saldos: new Map() });

  const carregar = useCallback(async () => {
    if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") { setEstado((e) => ({ ...e, carregando: false })); return; }
    try {
      const [dados, man, est] = await Promise.all([lerParams(unidadeId), fetchManutencoes(unidadeId), lerEstoque(unidadeId)]);
      if (man.error) throw new Error(man.error);
      setEstado({ carregando: false, erro: "", dados, equipamentos: montarEquipamentos(dados, man.data), insumos: est.insumos, saldos: est.saldos });
    } catch (e) {
      setEstado((s) => ({ ...s, carregando: false, erro: e.message || "Não consegui carregar." }));
    }
  }, [unidadeId]);
  useEffect(() => { carregar(); }, [carregar]);

  /** Novo equipamento: uma linha na agenda para cada tarefa do tipo. freq = { tarefa: dias } */
  const criar = async ({ nome, tipo, freq }) => {
    const dados = await lerParams(unidadeId);
    const eq = { id: novoIdEquip(), nome: String(nome).trim(), tipo };
    const procedimentos = { ...dados.procedimentos };
    for (const tarefa of TIPOS_EQUIPAMENTO[tipo].tarefas) {
      const dias = Number(freq?.[tarefa]);
      if (!(dias > 0)) continue;
      const r = await inserirManutencao({ unidade_id: unidadeId, nome: nomeDaTarefa(eq, tarefa), categoria: tipo === "outro" ? "outro" : tipo, frequencia_dias: dias, proxima_prevista: somarDiasEquip(hojeSP(), dias), ativo: true });
      if (r.error) throw new Error(r.error);
      procedimentos[r.data.id] = normalizarProcedimento({ equipamento_id: eq.id, tarefa });
    }
    await gravarParams(unidadeId, { ...dados, equipamentos: [...dados.equipamentos, eq], procedimentos });
    await carregar();
  };

  const fizAgora = async (tarefa, { responsavel = "", observacao = "" } = {}) => {
    const r = await registrarExecucaoManutencao(tarefa.linha, { responsavel, observacao });
    if (r.error) throw new Error(r.error);
    await carregar();
  };

  const reagendar = async (tarefa, dataISO) => {
    const r = await atualizarManutencao(tarefa.id, { proxima_prevista: String(dataISO).slice(0, 10) });
    if (r.error) throw new Error(r.error);
    await carregar();
  };

  /** Passo a passo, materiais, cuidados e de quantos em quantos dias. */
  const salvarTarefa = async (tarefa, { procedimento, frequencia_dias }) => {
    const dias = Number(frequencia_dias);
    if (dias > 0 && dias !== tarefa.frequencia_dias) {
      const r = await atualizarManutencao(tarefa.id, { frequencia_dias: dias });
      if (r.error) throw new Error(r.error);
    }
    const dados = await lerParams(unidadeId);
    await gravarParams(unidadeId, { ...dados, procedimentos: { ...dados.procedimentos, [tarefa.id]: normalizarProcedimento({ ...procedimento, equipamento_id: tarefa.procedimento.equipamento_id, tarefa: tarefa.tarefa }) } });
    await carregar();
  };

  /** Tira o equipamento da tela. A agenda fica inativa (o histórico continua guardado). */
  const remover = async (equipamento) => {
    for (const t of equipamento.tarefas) {
      const r = await atualizarManutencao(t.id, { ativo: false });
      if (r.error) throw new Error(r.error);
    }
    const dados = await lerParams(unidadeId);
    await gravarParams(unidadeId, { ...dados, equipamentos: dados.equipamentos.filter((e) => e.id !== equipamento.id) });
    await carregar();
  };

  return { ...estado, carregar, criar, fizAgora, reagendar, salvarTarefa, remover };
}
