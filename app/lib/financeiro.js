// ═══════════════════════════════════════════════════════════════
// CAMADA DE DADOS: Financeiro (Lançamentos de caixa + Documentos)
// ═══════════════════════════════════════════════════════════════
//
// Tabelas Supabase (ver docs/migracao-multiunidade.sql):
//   lancamentos(id, tipo, categoria, descricao, valor, data, unidade_id)
//   documentos(id, tipo, descricao, categoria, valor, emissao, vencimento, status, unidade_id)

import { supabase, isSupabaseReady } from "./supabase";
import { escoparPorUnidade, carimbarUnidade } from "./unidades";

// ── Lançamentos (fluxo de caixa) ───────────────────────────────────────────────
export async function fetchLancamentos(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: null };
  const { data, error } = await escoparPorUnidade(
    supabase.from("lancamentos").select("*").order("data", { ascending: false }),
    unidadeId,
  );
  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

export async function inserirLancamento(l, unidadeId) {
  if (!isSupabaseReady()) return { data: { ...l, id: `l${Date.now()}` }, error: null };
  const { data, error } = await supabase.from("lancamentos").insert([carimbarUnidade(l, unidadeId)]).select().single();
  return { data, error: error?.message || null };
}

export async function removerLancamento(id) {
  if (!isSupabaseReady()) return { error: null };
  const { error } = await supabase.from("lancamentos").delete().eq("id", id);
  return { error: error?.message || null };
}

// ── Documentos (notas, boletos, faturas) ───────────────────────────────────────
export async function fetchDocumentos(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: null };
  const { data, error } = await escoparPorUnidade(
    supabase.from("documentos").select("*").order("vencimento", { ascending: true }),
    unidadeId,
  );
  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

export async function inserirDocumento(d, unidadeId) {
  if (!isSupabaseReady()) return { data: { ...d, id: `d${Date.now()}` }, error: null };
  const { data, error } = await supabase.from("documentos").insert([carimbarUnidade(d, unidadeId)]).select().single();
  return { data, error: error?.message || null };
}

export async function atualizarDocumento(id, updates) {
  if (!isSupabaseReady()) return { error: null };
  const { error } = await supabase.from("documentos").update(updates).eq("id", id);
  return { error: error?.message || null };
}

export async function removerDocumento(id) {
  if (!isSupabaseReady()) return { error: null };
  const { error } = await supabase.from("documentos").delete().eq("id", id);
  return { error: error?.message || null };
}
