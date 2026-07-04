import { supabase, isSupabaseReady } from "./supabase";

// ─── ATAS DE REUNIÃO ─────────────────────────────────────────────────────────
// Atas geradas pelo sistema (tema + pauta -> IA redige o texto), com histórico.
// Não confundir com rh_atas (anexos por funcionário).

export async function fetchAtasReuniao(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [] };
  const { data, error } = await supabase
    .from("rh_atas_reuniao")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("data_reuniao", { ascending: false })
    .order("created_at", { ascending: false });
  return { data: data || [], error: error?.message };
}

export async function salvarAtaReuniao(ata) {
  if (!isSupabaseReady()) return { error: "Offline" };
  // id nulo quebra o INSERT (default gen_random_uuid) — remove antes
  const { id, created_at, ...campos } = ata;
  if (id) {
    const { error } = await supabase.from("rh_atas_reuniao").update(campos).eq("id", id);
    return { id, error: error?.message };
  }
  const { data, error } = await supabase.from("rh_atas_reuniao")
    .insert([campos]).select("id").single();
  return { id: data?.id, error: error?.message };
}

export async function removerAtaReuniao(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_atas_reuniao").delete().eq("id", id);
  return { error: error?.message };
}
