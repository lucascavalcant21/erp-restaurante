import { supabase, isSupabaseReady } from "./supabase";
import { escoparPorUnidade } from "./unidades";

// ─── TEMPLATES (Cérebro apenas) ────────────────────────────────────────────────
export async function fetchTemplates() {
  if (!isSupabaseReady()) return { data: [], error: null };
  const { data, error } = await supabase
    .from("tarefas_templates")
    .select("*")
    .order("created_at", { ascending: false });
  return { data: data || [], error: error?.message };
}

export async function inserirTemplate(template) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { data, error } = await supabase
    .from("tarefas_templates")
    .insert([template])
    .select()
    .single();
  return { data, error: error?.message };
}

// ─── INSTÂNCIAS (Atribuições para Unidades) ──────────────────────────────────
export async function fetchMinhasTarefas(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: null };
  const query = supabase
    .from("tarefas_instancias")
    .select("*, tarefas_templates(titulo, descricao, tipo, campos)")
    .order("prazo", { ascending: true, nullsFirst: false });
  
  const { data, error } = await escoparPorUnidade(query, unidadeId);
  return { data: data || [], error: error?.message };
}

export async function criarInstancia(instancia) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { data, error } = await supabase
    .from("tarefas_instancias")
    .insert([instancia])
    .select()
    .single();
  return { data, error: error?.message };
}

export async function responderTarefa(instanciaId, respostas, funcionarioNome) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { data, error } = await supabase
    .from("tarefas_instancias")
    .update({
      status: "concluida",
      respostas,
      funcionario_nome: funcionarioNome,
      concluida_em: new Date().toISOString()
    })
    .eq("id", instanciaId)
    .select()
    .single();
  return { data, error: error?.message };
}
