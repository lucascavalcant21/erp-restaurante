// ═══════════════════════════════════════════════════════════════
// unidades.js — Restaurantes (Unidades)
// ═══════════════════════════════════════════════════════════════
//
// UNIDADES = Restaurantes (lojas físicas)
// Dentro de cada restaurante existem 3 DEPARTAMENTOS:
// - Bar: bebidas, drinks, coquetéis, cervejas
// - Cozinha: alimentos, pratos, ingredientes
// - Cervejas: catálogo e estoque específico
//
// Cada unidade tem seu próprio estoque, cardápio, etc.
// "Central" consolida a visão de todas as unidades.

import { supabase, isSupabaseReady } from "./supabase";

// Removido o hardcode UNIDADES. Agora elas vêm do BD via fetchUnidades.
export async function fetchUnidades() {
  if (!isSupabaseReady()) return { data: [], error: "Supabase offline" };
  const { data, error } = await supabase.from("unidades").select("*").order("nome");
  return { data: data || [], error: error?.message };
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

// DEPARTAMENTOS dentro de cada restaurante
export const DEPARTAMENTOS = [
  { id: "bar",      nome: "Bar e Bebidas",       cor: "#3B82F6" },
  { id: "cozinha",  nome: "Cozinha e Pratos",   cor: "#10B981" },
  { id: "cervejas", nome: "Cervejas e Chopes",  cor: "#F59E0B" },
];

// "Central" consolida todas as unidades
export const CENTRAL = { id: "todas", nome: "Central", curto: "Tudo", cor: "#8B5CF6" };

/** Retorna a unidade pelo id (ou CENTRAL se for "todas"/inexistente). */
export function getUnidade(listaUnidades, id) {
  if (!id || id === "todas") return CENTRAL;
  return listaUnidades.find((u) => u.id === id) || CENTRAL;
}

/** True se o contexto atual é a visão consolidada da matriz. */
export function isCentral(id) {
  return !id || id === "todas";
}

/**
 * Resolve a unidade inicial a partir da sessão do usuário.
 * - Admin / vínculo "Todas" → Central (pode trocar entre unidades)
 * - Gerente de unidade → travado na própria unidade
 * Aceita tanto id ("seldeestrela") quanto nome legado ("Seldeestrela").
 */
export function unidadeDaSessao(sessao, listaUnidades = []) {
  const v = sessao?.unidade;
  if (!v || /todas/i.test(v)) return CENTRAL.id;
  const porId   = listaUnidades.find((u) => u.id === v);
  if (porId) return porId.id;
  const porNome = listaUnidades.find((u) => u.nome?.toLowerCase() === String(v).toLowerCase());
  return porNome ? porNome.id : CENTRAL.id;
}

/** Papéis que enxergam a rede inteira e podem alternar de unidade. */
export function podeVerTodas(papelId) {
  return papelId === "admin" || papelId === "financeiro";
}

// ── Helpers de escopo de dados (multiunidade) ──────────────────────────────────
// Aplicam o filtro/carimbo de unidade só quando há uma unidade específica.
// Em "Central" (todas) NÃO filtram — retornam a rede inteira.

/** Aplica .eq("unidade_id", ...) na query quando a unidade é específica. */
export function escoparPorUnidade(query, unidadeId) {
  return (unidadeId && unidadeId !== "todas") ? query.eq("unidade_id", unidadeId) : query;
}

/** Carimba unidade_id num objeto a inserir (null em "Central"). */
export function carimbarUnidade(obj, unidadeId) {
  return { ...obj, unidade_id: (unidadeId && unidadeId !== "todas") ? unidadeId : null };
}
