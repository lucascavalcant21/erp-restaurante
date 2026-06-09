import { supabase, isSupabaseReady } from "./supabase";

export const FORNECEDORES_SEED = [];

export async function fetchFornecedores() {
  if (!isSupabaseReady()) return { data: FORNECEDORES_SEED, fromSeed: true };
  const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
  if (error || !data?.length) return { data: FORNECEDORES_SEED, fromSeed: true };
  return { data, fromSeed: false };
}

export async function inserirFornecedor(forn) {
  if (!isSupabaseReady()) return { data: { ...forn, id: `f${Date.now()}` }, error: null };
  const { data, error } = await supabase.from("fornecedores").insert([forn]).select().single();
  return { data, error: error?.message || null };
}

export async function atualizarFornecedor(id, updates) {
  if (!isSupabaseReady()) return { error: null };
  const { error } = await supabase.from("fornecedores").update(updates).eq("id", id);
  return { error: error?.message || null };
}

export async function removerFornecedor(id) {
  if (!isSupabaseReady()) return { error: null };
  const { error } = await supabase.from("fornecedores").delete().eq("id", id);
  return { error: error?.message || null };
}
