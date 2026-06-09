import { supabase, isSupabaseReady } from "./supabase";
import { escoparPorUnidade, carimbarUnidade } from "./unidades";

export const FORNECEDORES_SEED = [];

export async function fetchFornecedores(unidadeId) {
  if (!isSupabaseReady()) return { data: FORNECEDORES_SEED, fromSeed: true };
  const { data, error } = await escoparPorUnidade(
    supabase.from("fornecedores").select("*").order("nome"),
    unidadeId,
  );
  if (error || !data?.length) return { data: FORNECEDORES_SEED, fromSeed: true };
  return { data, fromSeed: false };
}

export async function inserirFornecedor(forn, unidadeId) {
  if (!isSupabaseReady()) return { data: { ...forn, id: `f${Date.now()}` }, error: null };
  const { data, error } = await supabase.from("fornecedores").insert([carimbarUnidade(forn, unidadeId)]).select().single();
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
