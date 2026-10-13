// Cálculos do mês gravados (RH-5). Escrita só pelas funções do banco, que
// conferem permissão e situação; nada aqui grava em rh_calculos_mes direto.
import { supabase, isSupabaseReady } from "../supabase";

const semTabela = (e) => /rh_calculos_mes|rh_calculo_|does not exist|schema cache/i.test(e?.message || "");

/** Cálculo vigente (não substituído) do colaborador na competência. disponivel=false antes da RH-5. */
export async function fetchCalculoMes(colaboradorId, competencia) {
  if (!isSupabaseReady() || !colaboradorId) return { data: null, disponivel: false, error: null };
  const { data, error } = await supabase.from("rh_calculos_mes").select("*")
    .eq("colaborador_id", colaboradorId).eq("competencia", competencia).neq("situacao", "substituido").maybeSingle();
  if (error && semTabela(error)) return { data: null, disponivel: false, error: null };
  return { data: data || null, disponivel: true, error: error?.message || null };
}

export async function registrarCalculoMes(colaboradorId, competencia, resultado, meta = {}) {
  const { data, error } = await supabase.rpc("rh_calculo_registrar", {
    p_colaborador: colaboradorId, p_competencia: competencia,
    p_linhas: resultado.linhas, p_totais: resultado.totais, p_pendencias: resultado.pendencias, p_meta: meta,
  });
  return { data, error: error?.message || null };
}

export async function validarCalculoMes(id, observacao) {
  const { error } = await supabase.rpc("rh_calculo_validar", { p_id: id, p_observacao: observacao || null });
  return { error: error?.message || null };
}

export async function reabrirCalculoMes(id, motivo) {
  const { error } = await supabase.rpc("rh_calculo_reabrir", { p_id: id, p_motivo: motivo });
  return { error: error?.message || null };
}
