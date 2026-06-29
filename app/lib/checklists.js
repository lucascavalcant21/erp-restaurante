import { supabase, isSupabaseReady } from "./supabase";

export async function fetchTemplates(unidadeId, dept, tipo) {
  if (!isSupabaseReady()) return { data: [], error: "Supabase offline" };
  
  let query = supabase.from("checklists_templates").select("*").eq("ativo", true);
  
  if (unidadeId && unidadeId !== "matriz") query = query.eq("unidade_id", unidadeId);
  if (dept) query = query.eq("departamento", dept);
  if (tipo) query = query.eq("tipo", tipo);

  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

export async function salvarTemplate(template) {
  if (!isSupabaseReady()) return { error: "Offline" };
  
  // `id` nulo quebra o INSERT (coluna id NOT NULL com default no Postgres)
  const { id, created_at, ...campos } = template;

  if (id) {
    const { error } = await supabase.from("checklists_templates").update(campos).eq("id", id);
    return { error: error?.message };
  } else {
    const { error } = await supabase.from("checklists_templates").insert([campos]);
    return { error: error?.message };
  }
}

export async function desativarTemplate(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("checklists_templates").update({ ativo: false }).eq("id", id);
  return { error: error?.message };
}

// ─── EXECUÇÃO (Operacional) ──────────────────────────────────────────────────

export async function salvarExecucao(execucao) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("checklists_execucoes").insert([execucao]);
  return { error: error?.message };
}

export async function fetchHistoricoExecucoes(unidadeId, dataRef, dept) {
  if (!isSupabaseReady()) return { data: [] };
  
  // Faz um join com a tabela de templates para trazer o nome e o departamento
  let query = supabase.from("checklists_execucoes")
    .select(`
      *,
      checklists_templates!inner(titulo, departamento, tipo),
      colaboradores(nome)
    `)
    .eq("data_referencia", dataRef);

  if (unidadeId && unidadeId !== "matriz") query = query.eq("unidade_id", unidadeId);
  if (dept) query = query.eq("checklists_templates.departamento", dept);

  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}
