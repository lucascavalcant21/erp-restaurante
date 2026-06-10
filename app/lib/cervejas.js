/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CAMADA DE DADOS: Cervejas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Catálogo de cervejas: marca, estilo, volume, teor alcoólico, preço,
 * estoque, fornecedor e histórico de vendas.
 *
 * SQL (Supabase):
 *   create table cervejas (
 *     id uuid primary key default gen_random_uuid(),
 *     marca text not null,
 *     estilo text not null,       -- Pilsen, IPA, Stout, etc
 *     volume_ml numeric not null, -- 350, 600, 1000
 *     alcool numeric,             -- 4.5%, etc
 *     preco_compra numeric not null,
 *     preco_venda numeric not null,
 *     quantidade numeric not null default 0,
 *     minimo numeric not null default 10,
 *     fornecedor text,
 *     origem text,                -- Brasil, Importada
 *     unidade_id text references unidades(id),
 *     created_at timestamptz default now()
 *   );
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase, isSupabaseReady } from "./supabase";
import { escoparPorUnidade, carimbarUnidade } from "./unidades";

const ESTILOS = [
  "Pilsen", "Lager", "IPA", "Stout", "Porter", "Amber", "Witbier",
  "Saison", "Blonde Ale", "Brown Ale", "Red Ale", "Sour", "Helles"
];

const VOLUMES = [330, 350, 600, 1000];
const ORIGENS = ["Brasil", "Importada"];

export async function fetchCervejas(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: null };
  const { data, error } = await escoparPorUnidade(
    supabase.from("cervejas").select("*").order("marca"),
    unidadeId,
  );
  if (error) {
    console.error("[cervejas] fetchCervejas:", error.message);
    return { data: [], error: error.message };
  }
  return { data: data || [], error: null };
}

export async function inserirCerveja(cerveja, unidadeId) {
  if (!isSupabaseReady()) return { data: null, error: "Supabase não configurado" };
  const { data, error } = await supabase
    .from("cervejas")
    .insert([carimbarUnidade(cerveja, unidadeId)])
    .select()
    .single();
  if (error) console.error("[cervejas] inserirCerveja:", error.message);
  return { data, error: error?.message || null };
}

export async function atualizarCerveja(id, updates) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { error } = await supabase.from("cervejas").update(updates).eq("id", id);
  if (error) console.error("[cervejas] atualizarCerveja:", error.message);
  return { error: error?.message || null };
}

export async function removerCerveja(id) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { error } = await supabase.from("cervejas").delete().eq("id", id);
  if (error) console.error("[cervejas] removerCerveja:", error.message);
  return { error: error?.message || null };
}

export { ESTILOS, VOLUMES, ORIGENS };
