// Leitura e transições de vínculos (RH-4). Toda escrita passa pelas funções do
// banco, que validam CLT/CCT e permissão: nada aqui grava em rh_vinculos direto.
import { supabase, isSupabaseReady } from "./supabase";

export async function fetchVinculos(colaboradorId) {
  if (!isSupabaseReady() || !colaboradorId) return { data: [], error: null };
  const { data, error } = await supabase.from("rh_vinculos").select("*").eq("colaborador_id", colaboradorId).order("inicio", { ascending: false });
  return { data: data || [], error: error?.message || null };
}

export async function fetchTransicoes(colaboradorId) {
  if (!isSupabaseReady() || !colaboradorId) return { data: [], error: null };
  const { data, error } = await supabase.from("rh_vinculo_transicoes").select("*").eq("colaborador_id", colaboradorId).order("solicitado_em", { ascending: false });
  return { data: data || [], error: error?.message || null };
}

export async function solicitarTransicao({ colaboradorId, tipo, vigencia, dados = {}, motivo, documento = null }) {
  const { data, error } = await supabase.rpc("rh_transicao_solicitar", {
    p_colaborador: colaboradorId, p_tipo: tipo, p_vigencia: vigencia, p_dados: dados, p_motivo: motivo, p_documento: documento,
  });
  return { id: data || null, error: error?.message || null };
}

export async function decidirTransicao(transicaoId, aprovar, observacao = null) {
  const { data, error } = await supabase.rpc("rh_transicao_decidir", { p_transicao: transicaoId, p_aprovar: aprovar, p_observacao: observacao });
  return { id: data || null, error: error?.message || null };
}
