// Plano do dia: aprovar (dono), ler e marcar (equipe no Nico). Pela sessão de
// quem usa; o banco confere a permissão e a unidade (PLANO-DIA-1). Sem a
// migração, aprovar guarda em config_sistema e a equipe só vê, sem marcar.
import { supabase, isSupabaseReady } from "./supabase";
import { fetchPlanoDoDia, salvarPlanoDoDia } from "./parametros";
import { normalizarTarefa } from "./plano-dia.mjs";

const semMigracao = (e) => /plano_dia|hefisto_aprovar_plano_dia|hefisto_marcar_tarefa_plano|does not exist|schema cache|Could not find the function/i.test(e?.message || "");
export const hojeSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

export async function aprovarPlano(unidadeId, { pedido, plano, aprovadoPor }) {
  if (!isSupabaseReady()) return { error: "Sem conexão com o banco." };
  const data = hojeSP();
  const tarefas = (plano || []).map((t) => ({ ...t }));
  const { data: r, error } = await supabase.rpc("hefisto_aprovar_plano_dia", { p_unidade: String(unidadeId), p_data: data, p_pedido: pedido || null, p_tarefas: tarefas });
  if (error && semMigracao(error)) {
    const s = await salvarPlanoDoDia(unidadeId, { data, pedido, plano: tarefas, aprovadoPor, aprovadoEm: new Date().toISOString() });
    return { error: s?.error || null, semProgresso: true };
  }
  if (error) return { error: error.message };
  if (!r?.ok) return { error: r?.erro || "Não aprovou." };
  return { error: null, planoId: r.plano_id };
}

/** Plano ativo de hoje com as tarefas. `comProgresso` = dá para marcar feito. */
export async function lerPlanoDeHoje(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { plano: null, tarefas: [] };
  const data = hojeSP();
  const { data: planos, error } = await supabase.from("plano_dia").select("id, pedido, aprovado_por, aprovado_em")
    .eq("unidade_id", String(unidadeId)).eq("data", data).eq("status", "ativo").limit(1);
  if (error) {
    if (!semMigracao(error)) return { plano: null, tarefas: [], erro: error.message };
    const { data: p } = await fetchPlanoDoDia(unidadeId).catch(() => ({ data: null }));
    if (!p || p.data !== data) return { plano: null, tarefas: [], comProgresso: false };
    return { plano: { pedido: p.pedido, aprovadoPor: p.aprovadoPor, aprovadoEm: p.aprovadoEm }, tarefas: (p.plano || []).map(normalizarTarefa), comProgresso: false };
  }
  const p = planos?.[0];
  if (!p) return { plano: null, tarefas: [], comProgresso: true };
  const { data: ts, error: e2 } = await supabase.from("plano_dia_tarefa").select("*").eq("plano_id", p.id).order("ordem");
  if (e2) return { plano: null, tarefas: [], erro: e2.message };
  return { plano: { id: p.id, pedido: p.pedido, aprovadoPor: p.aprovado_por, aprovadoEm: p.aprovado_em }, tarefas: (ts || []).map(normalizarTarefa), comProgresso: true };
}

export async function marcarTarefa(id, feito, quem = null) {
  const { data, error } = await supabase.rpc("hefisto_marcar_tarefa_plano", { p_tarefa: id, p_feito: !!feito, p_quem: quem || null });
  if (error) return { error: semMigracao(error) ? "Marcar tarefa precisa da migração PLANO-DIA-1." : error.message };
  if (!data?.ok) return { error: data?.erro || "Não marcou." };
  return { error: null };
}
