import { supabase, isSupabaseReady } from "./supabase";

export async function fetchColaboradores(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: "Supabase offline" };
  
  let query = supabase.from("colaboradores").select("*").order("nome");
  if (unidadeId && unidadeId !== "matriz") {
    query = query.eq("unidade_id", unidadeId);
  }

  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

export async function inserirColaborador(colab) {
  if (!isSupabaseReady()) return { data: null, error: "Offline" };
  const { data, error } = await supabase.from("colaboradores").insert([colab]).select().single();
  return { data, error: error?.message };
}

export async function removerColaborador(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("colaboradores").delete().eq("id", id);
  return { error: error?.message };
}

// Futuramente: Upload de Documentos para o Storage
export async function fetchDocumentos(colabId) {
  if (!isSupabaseReady()) return { data: [] };
  const { data } = await supabase.from("documentos_rh").select("*").eq("colaborador_id", colabId);
  return { data: data || [] };
}
