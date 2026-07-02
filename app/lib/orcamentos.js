import { supabase, isSupabaseReady } from "./supabase";

/**
 * Orçamentos de eventos salvos (histórico).
 * As propostas completas (itens, preços, configurações) ficam no campo
 * `dados` (jsonb) — a tela restaura tudo exatamente como estava.
 *
 * SQL:
 *   CREATE TABLE IF NOT EXISTS orcamentos_eventos (
 *     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     unidade_id text,
 *     nome text,
 *     cliente text,
 *     data_evento date,
 *     convidados numeric,
 *     dados jsonb,
 *     created_at timestamptz DEFAULT now(),
 *     updated_at timestamptz DEFAULT now()
 *   );
 */

export async function fetchOrcamentosEventos(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  let q = supabase.from("orcamentos_eventos").select("*").order("updated_at", { ascending: false });
  if (unidadeId && unidadeId !== "matriz" && unidadeId !== "todas") q = q.eq("unidade_id", unidadeId);
  const { data, error } = await q;
  return { data: data || [], error: error?.message || null };
}

export async function salvarOrcamentoEvento(orc) {
  if (!isSupabaseReady()) return { data: null, error: "Offline" };
  const { id, created_at, updated_at, ...campos } = orc;
  campos.updated_at = new Date().toISOString();

  if (id) {
    const { data, error } = await supabase.from("orcamentos_eventos").update(campos).eq("id", id).select().single();
    return { data, error: error?.message || null };
  }
  const { data, error } = await supabase.from("orcamentos_eventos").insert([campos]).select().single();
  return { data, error: error?.message || null };
}

export async function removerOrcamentoEvento(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("orcamentos_eventos").delete().eq("id", id);
  return { error: error?.message || null };
}
