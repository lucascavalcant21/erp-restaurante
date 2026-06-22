import { supabase, isSupabaseReady } from "./supabase";

export async function fetchTreinamentos(unidadeId) {
  if (!isSupabaseReady()) return { data: [] };
  let query = supabase.from("treinamentos").select("*").order("created_at", { ascending: false });
  if (unidadeId && unidadeId !== "todas") {
    query = query.eq("unidade_id", unidadeId);
  }
  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

export async function inserirTreinamento(t) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("treinamentos").insert([t]);
  return { error: error?.message };
}

export async function removerTreinamento(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("treinamentos").delete().eq("id", id);
  return { error: error?.message };
}
