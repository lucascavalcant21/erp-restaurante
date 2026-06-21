// ═══════════════════════════════════════════════════════════════
// pessoas.js — RH ↔ Portal do Colaborador (documentos, holerites,
// avisos, advertências, produções, cursos) + upload de anexos.
// ═══════════════════════════════════════════════════════════════

import { supabase, isSupabaseReady } from "./supabase";
import { carimbarUnidade } from "./unidades";

// Liga o colaborador logado ao seu cadastro de funcionário (pelo e-mail)
export async function buscarFuncionarioPorEmail(email) {
  if (!isSupabaseReady() || !email) return null;
  const { data } = await supabase.from("funcionarios").select("*").eq("email", email).maybeSingle();
  return data || null;
}

// Helper genérico: lista por funcionário
async function listarPorFunc(tabela, funcId, ordem = "created_at") {
  if (!isSupabaseReady() || !funcId) return [];
  const { data } = await supabase.from(tabela).select("*").eq("func_id", funcId).order(ordem, { ascending: false });
  return data || [];
}
// Lista itens do funcionário + os "para todos" (func_id null) — usado em avisos/cursos
async function listarFuncOuTodos(tabela, funcId, unidadeId) {
  if (!isSupabaseReady()) return [];
  let q = supabase.from(tabela).select("*").order("created_at", { ascending: false });
  if (funcId) q = q.or(`func_id.eq.${funcId},func_id.is.null`); else q = q.is("func_id", null);
  const { data } = await q;
  return data || [];
}

// ── Documentos ─────────────────────────────────────────────────
export const fetchDocumentos = (funcId) => listarPorFunc("func_documentos", funcId);
export async function inserirDocumento(doc, unidadeId) {
  const { data, error } = await supabase.from("func_documentos").insert([carimbarUnidade(doc, unidadeId)]).select().single();
  return { data, error: error?.message || null };
}
export const removerDocumento = (id) => supabase.from("func_documentos").delete().eq("id", id);

// ── Holerites (folha) ──────────────────────────────────────────
export const fetchHolerites = (funcId) => listarPorFunc("holerites", funcId);
export async function inserirHolerite(h, unidadeId) {
  const { data, error } = await supabase.from("holerites").insert([carimbarUnidade(h, unidadeId)]).select().single();
  return { data, error: error?.message || null };
}
export const removerHolerite = (id) => supabase.from("holerites").delete().eq("id", id);

// ── Avisos ─────────────────────────────────────────────────────
export const fetchAvisos = (funcId) => listarFuncOuTodos("avisos", funcId);
export async function inserirAviso(a, unidadeId) {
  const { data, error } = await supabase.from("avisos").insert([carimbarUnidade(a, unidadeId)]).select().single();
  return { data, error: error?.message || null };
}
export const removerAviso = (id) => supabase.from("avisos").delete().eq("id", id);

// ── Advertências ───────────────────────────────────────────────
export const fetchAdvertencias = (funcId) => listarPorFunc("advertencias", funcId);
export async function inserirAdvertencia(a, unidadeId) {
  const { data, error } = await supabase.from("advertencias").insert([carimbarUnidade(a, unidadeId)]).select().single();
  return { data, error: error?.message || null };
}
export const removerAdvertencia = (id) => supabase.from("advertencias").delete().eq("id", id);

// ── Produções ──────────────────────────────────────────────────
export const fetchProducoes = (funcId) => listarPorFunc("producoes", funcId, "data");
export async function inserirProducao(p, unidadeId) {
  const { data, error } = await supabase.from("producoes").insert([carimbarUnidade(p, unidadeId)]).select().single();
  return { data, error: error?.message || null };
}
export const atualizarProducao = (id, updates) => supabase.from("producoes").update(updates).eq("id", id);
export const removerProducao = (id) => supabase.from("producoes").delete().eq("id", id);

// ── Cursos ─────────────────────────────────────────────────────
export const fetchCursos = (funcId) => listarFuncOuTodos("cursos", funcId);
export async function inserirCurso(c, unidadeId) {
  const { data, error } = await supabase.from("cursos").insert([carimbarUnidade(c, unidadeId)]).select().single();
  return { data, error: error?.message || null };
}
export const removerCurso = (id) => supabase.from("cursos").delete().eq("id", id);

// ── Tipos de Bonificações ──────────────────────────────────────
export async function fetchTiposBonificacao(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: null };
  const { data, error } = await supabase.from("rh_tipos_bonificacao")
    .select("*")
    .or(`unidade_id.eq.${unidadeId},unidade_id.eq.todas`)
    .order("nome");
  return { data: data || [], error: error?.message };
}
export async function inserirTipoBonificacao(tb, unidadeId) {
  const { data, error } = await supabase.from("rh_tipos_bonificacao").insert([carimbarUnidade(tb, unidadeId)]).select().single();
  return { data, error: error?.message || null };
}
export async function atualizarTipoBonificacao(id, updates) {
  const { error } = await supabase.from("rh_tipos_bonificacao").update(updates).eq("id", id);
  return { error: error?.message || null };
}
export async function removerTipoBonificacao(id) {
  const { error } = await supabase.from("rh_tipos_bonificacao").delete().eq("id", id);
  return { error: error?.message || null };
}

// ── Bonificações (Lançamentos p/ Func) ─────────────────────────
export async function fetchBonificacoes(funcId) {
  if (!isSupabaseReady() || !funcId) return [];
  const { data } = await supabase.from("rh_bonificacoes")
    .select("*, rh_tipos_bonificacao(nome)")
    .eq("func_id", funcId)
    .order("data", { ascending: false });
  return data || [];
}
export async function inserirBonificacao(b, unidadeId) {
  const { data, error } = await supabase.from("rh_bonificacoes").insert([carimbarUnidade(b, unidadeId)]).select().single();
  return { data, error: error?.message || null };
}
export const removerBonificacao = (id) => supabase.from("rh_bonificacoes").delete().eq("id", id);

// ── Atas de Reunião ────────────────────────────────────────────
export const fetchAtas = (funcId) => listarPorFunc("rh_atas", funcId, "data");
export async function inserirAta(ata, unidadeId) {
  const { data, error } = await supabase.from("rh_atas").insert([carimbarUnidade(ata, unidadeId)]).select().single();
  return { data, error: error?.message || null };
}
export const removerAta = (id) => supabase.from("rh_atas").delete().eq("id", id);

// ── Histórico de Alterações ────────────────────────────────────
export const fetchHistorico = (funcId) => listarPorFunc("rh_historico", funcId, "data");
export async function inserirHistorico(hist, unidadeId) {
  const { data, error } = await supabase.from("rh_historico").insert([carimbarUnidade(hist, unidadeId)]).select().single();
  return { data, error: error?.message || null };
}
export const removerHistorico = (id) => supabase.from("rh_historico").delete().eq("id", id);

// ── Upload de anexo (Supabase Storage) ─────────────────────────
export async function uploadAnexo(file, pasta = "geral") {
  if (!isSupabaseReady() || !file) return { url: null, error: "Sem arquivo" };
  const ext = file.name.split(".").pop();
  const path = `${pasta}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("anexos").upload(path, file, { upsert: false });
  if (error) return { url: null, error: error.message };
  const { data } = supabase.storage.from("anexos").getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}
