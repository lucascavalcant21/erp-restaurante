// ═══════════════════════════════════════════════════════════════
// unidades.js — Restaurantes (Unidades)
// ═══════════════════════════════════════════════════════════════

import { supabase, isSupabaseReady } from "./supabase";

export async function fetchUnidades() {
  if (!isSupabaseReady()) {
    // Retorno fallback se não tiver supabase
    return { data: [{ id: "matriz", nome: "Unidade Matriz", cor: "#22c55e" }], error: null };
  }
  const { data, error } = await supabase.from("unidades").select("*").order("nome");
  if (error || !data || data.length === 0) {
    return { data: [{ id: "matriz", nome: "Unidade Matriz", cor: "#22c55e" }], error: null };
  }
  return { data, error: null };
}

export async function inserirUnidade(u) {
  if (!isSupabaseReady()) return { data: null, error: "Offline" };
  const { data, error } = await supabase.from("unidades").insert([u]).select().single();
  return { data, error: error?.message };
}

export async function atualizarUnidade(id, updates) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("unidades").update(updates).eq("id", id);
  return { error: error?.message };
}

export async function removerUnidade(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("unidades").delete().eq("id", id);
  return { error: error?.message };
}

export const DEPARTAMENTOS = [
  { id: "bar",      nome: "Bar e Bebidas",       cor: "#3B82F6" },
  { id: "cozinha",  nome: "Cozinha e Pratos",    cor: "#10B981" },
];

/** Retorna a unidade pelo id. Se não achar, retorna a primeira da lista. */
export function getUnidade(listaUnidades, id) {
  if (!listaUnidades || listaUnidades.length === 0) return { id: "matriz", nome: "Unidade Matriz", cor: "#22c55e" };
  return listaUnidades.find((u) => u.id === id) || listaUnidades[0];
}

/**
 * Resolve a unidade inicial a partir da sessão.
 */
export function unidadeDaSessao(sessao, listaUnidades = []) {
  if (listaUnidades.length === 0) return "matriz";
  const v = sessao?.unidade;
  if (!v) return listaUnidades[0].id;
  const porId = listaUnidades.find((u) => u.id === v);
  if (porId) return porId.id;
  return listaUnidades[0].id;
}

/** Papéis que enxergam a rede inteira e podem gerenciar lojas. */
export function podeVerTodas(papelId) {
  return papelId === "admin" || papelId === "financeiro";
}

/** Aplica .eq("unidade_id", ...) na query. (Obrigatório ter unidade) */
export function escoparPorUnidade(query, unidadeId) {
  return unidadeId ? query.eq("unidade_id", unidadeId) : query;
}

/** Carimba unidade_id num objeto a inserir. */
export function carimbarUnidade(obj, unidadeId) {
  return { ...obj, unidade_id: unidadeId };
}
