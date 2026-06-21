// ═══════════════════════════════════════════════════════════════
// documentos_empresa.js — Documentos Legais da Unidade
// ═══════════════════════════════════════════════════════════════

import { supabase, isSupabaseReady } from "./supabase";
import { escoparPorUnidade, carimbarUnidade } from "./unidades";

export async function fetchDocumentosEmpresa(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: "Supabase offline" };
  let query = supabase.from("empresa_documentos").select("*").order("created_at", { ascending: false });
  query = escoparPorUnidade(query, unidadeId);
  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

export async function inserirDocumentoEmpresa(doc, unidadeId) {
  if (!isSupabaseReady()) return { data: null, error: "Offline" };
  const d = carimbarUnidade(doc, unidadeId);
  const { data, error } = await supabase.from("empresa_documentos").insert([d]).select().single();
  return { data, error: error?.message };
}

export async function removerDocumentoEmpresa(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("empresa_documentos").delete().eq("id", id);
  return { error: error?.message };
}
