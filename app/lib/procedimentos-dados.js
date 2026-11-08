// Procedimentos da casa: leitura e gravação pela sessão de quem edita (RLS por unidade).
// Reaproveita a Operação Inteligente (op_processos/op_secoes/op_itens).
import { supabase, isSupabaseReady } from "./supabase";
import { salvarProcesso, salvarEstrutura, arquivarProcesso } from "./operacao-inteligente";
import { CATEGORIA, montarProcedimentos, paraEstrutura } from "./procedimentos.mjs";

export async function listarProcedimentos(unidadeId) {
  if (!isSupabaseReady() || !unidadeId) return { data: [] };
  const { data: procs, error } = await supabase.from("op_processos").select("id, nome, descricao, setor, updated_at")
    .eq("unidade_id", String(unidadeId)).eq("categoria", CATEGORIA).eq("arquivado", false).order("nome");
  if (error) return { data: [], error: error.message };
  if (!procs?.length) return { data: [] };
  const ids = procs.map((p) => p.id);
  const [{ data: secoes }, { data: itens }] = await Promise.all([
    supabase.from("op_secoes").select("id, processo_id, titulo, ordem").in("processo_id", ids),
    supabase.from("op_itens").select("id, processo_id, secao_id, titulo, ordem").in("processo_id", ids),
  ]);
  return { data: montarProcedimentos(procs, secoes, itens) };
}

export async function salvarProcedimento(unidadeId, proc) {
  const { processo, secoes } = paraEstrutura(proc, unidadeId);
  const r = await salvarProcesso(processo);
  if (r.error || !r.id) return { error: r.error || "Não consegui salvar." };
  const e = await salvarEstrutura(r.id, secoes);
  return { id: r.id, error: e.error || null };
}

export async function arquivarProcedimento(id) {
  return arquivarProcesso(id, true);
}
