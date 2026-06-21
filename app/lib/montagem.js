/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CAMADA DE DADOS: Montagem (fichas de montagem)
 * ─────────────────────────────────────────────────────────────────────────────
 * Fichas de montagem de pratos (cozinha) e drinks (bar) com descritivo
 * passo a passo, foto, tempo de preparo e observações.
 *
 * SQL: ver docs/montagem.sql
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase, isSupabaseReady } from "./supabase";
import { escoparPorUnidade, carimbarUnidade } from "./unidades";

const BUCKET = "montagem-fotos";

export async function fetchMontagens(unidadeId, departamento) {
  if (!isSupabaseReady()) return { data: [], error: null };
  let query = supabase.from("montagem").select("*").order("nome");
  if (departamento) query = query.eq("departamento", departamento);
  const { data, error } = await escoparPorUnidade(query, unidadeId);
  if (error) {
    console.error("[montagem] fetchMontagens:", error.message);
    return { data: [], error: error.message };
  }
  return { data: data || [], error: null };
}

export async function inserirMontagem(montagem, unidadeId) {
  if (!isSupabaseReady()) return { data: null, error: "Supabase não configurado" };
  const payload = carimbarUnidade(montagem, unidadeId);
  // Garante que o frontend envia a estrutura_ia como object/json
  const { data, error } = await supabase
    .from("montagem")
    .insert([payload])
    .select()
    .single();
  if (error) console.error("[montagem] inserirMontagem:", error.message);
  return { data, error: error?.message || null };
}

export async function atualizarMontagem(id, updates) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { error } = await supabase
    .from("montagem")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("[montagem] atualizarMontagem:", error.message);
  return { error: error?.message || null };
}

export async function removerMontagem(id) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { error } = await supabase.from("montagem").delete().eq("id", id);
  if (error) console.error("[montagem] removerMontagem:", error.message);
  return { error: error?.message || null };
}

// ── Upload de foto ────────────────────────────────────────────────────────
export async function uploadFotoMontagem(file, nome) {
  if (!isSupabaseReady()) return { url: null, error: "Supabase não configurado" };
  const ext = file.name.split(".").pop();
  const path = `${Date.now()}-${nome.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) {
    console.error("[montagem] uploadFoto:", uploadError.message);
    return { url: null, error: uploadError.message };
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data?.publicUrl || null, error: null };
}

export async function removerFotoMontagem(fotoUrl) {
  if (!isSupabaseReady() || !fotoUrl) return { error: null };
  const path = fotoUrl.split(`${BUCKET}/`)[1];
  if (!path) return { error: null };
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.error("[montagem] removerFoto:", error.message);
  return { error: error?.message || null };
}
