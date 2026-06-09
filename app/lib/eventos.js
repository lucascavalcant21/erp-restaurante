import { supabase, isSupabaseReady } from "./supabase";

export const EVENTOS_SEED = [];

export async function fetchEventos() {
  if (!isSupabaseReady()) return { data: EVENTOS_SEED, fromSeed: true };
  const { data, error } = await supabase.from("eventos").select("*").order("data", { ascending: true });
  if (error || !data?.length) return { data: EVENTOS_SEED, fromSeed: true };
  return { data, fromSeed: false };
}

export async function inserirEvento(ev) {
  if (!isSupabaseReady()) return { data: { ...ev, id: `ev${Date.now()}` }, error: null };
  const { data, error } = await supabase.from("eventos").insert([ev]).select().single();
  return { data, error: error?.message || null };
}

export async function atualizarEvento(id, updates) {
  if (!isSupabaseReady()) return { error: null };
  const { error } = await supabase.from("eventos").update(updates).eq("id", id);
  return { error: error?.message || null };
}

export async function removerEvento(id) {
  if (!isSupabaseReady()) return { error: null };
  const { error } = await supabase.from("eventos").delete().eq("id", id);
  return { error: error?.message || null };
}
