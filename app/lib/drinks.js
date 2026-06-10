/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CAMADA DE DADOS: Drinks do Bar
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Cardápio específico para drinks (com álcool e sem álcool/mocktails):
 * - Copo, xarope, sabor, mL, destilado, chantilly, guarnição
 *
 * SQL:
 *   create table drinks (
 *     id uuid primary key default gen_random_uuid(),
 *     nome text not null,
 *     tipo text not null,        -- 'drink' | 'mocktail'
 *     copo text,                 -- rocks, coupe, highball, etc
 *     ml numeric,
 *     preco_venda numeric not null,
 *     preco_custo numeric not null,
 *     destilado text,            -- vodka, rum, gin, whiskey (null para mocktail)
 *     xarope_sim boolean,
 *     xarope_qual text,
 *     sabor text,
 *     chantilly boolean,
 *     guarnacao text,
 *     unidade_id text references unidades(id),
 *     created_at timestamptz default now()
 *   );
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase, isSupabaseReady } from "./supabase";
import { escoparPorUnidade, carimbarUnidade } from "./unidades";

const TIPOS = ["Drink", "Mocktail"];
const COPOS = ["Rocks", "Coupe", "Highball", "Colada", "Shot", "Martini", "Margarita", "Hurricane", "Vaso"];
const DESTILADOS = ["Vodka", "Rum", "Gin", "Whiskey", "Tequila", "Conhaque", "Cerveja", "Vinho"];
const SABORES = ["Morango", "Maçã", "Cranberry", "Limão", "Laranja", "Melancia", "Pêssego", "Coco", "Menta"];
const GUARNACOES = ["Limão", "Laranja", "Morango", "Cereja", "Hortelã", "Canela", "Mel", "Açúcar"];

export async function fetchDrinks(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: null };
  const { data, error } = await escoparPorUnidade(
    supabase.from("drinks").select("*").order("nome"),
    unidadeId,
  );
  if (error) {
    console.error("[drinks] fetchDrinks:", error.message);
    return { data: [], error: error.message };
  }
  return { data: data || [], error: null };
}

export async function inserirDrink(drink, unidadeId) {
  if (!isSupabaseReady()) return { data: null, error: "Supabase não configurado" };
  const { data, error } = await supabase
    .from("drinks")
    .insert([carimbarUnidade(drink, unidadeId)])
    .select()
    .single();
  if (error) console.error("[drinks] inserirDrink:", error.message);
  return { data, error: error?.message || null };
}

export async function atualizarDrink(id, updates) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { error } = await supabase.from("drinks").update(updates).eq("id", id);
  if (error) console.error("[drinks] atualizarDrink:", error.message);
  return { error: error?.message || null };
}

export async function removerDrink(id) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { error } = await supabase.from("drinks").delete().eq("id", id);
  if (error) console.error("[drinks] removerDrink:", error.message);
  return { error: error?.message || null };
}

export { TIPOS, COPOS, DESTILADOS, SABORES, GUARNACOES };
