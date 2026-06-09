/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CAMADA DE DADOS: Cardápio
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * SQL para criar as tabelas no Supabase:
 *
 *   create table cardapio (
 *     id          uuid primary key default gen_random_uuid(),
 *     nome        text not null,
 *     categoria   text not null,
 *     preco       numeric not null default 0,
 *     custo       numeric not null default 0,
 *     descricao   text,
 *     ativo       boolean not null default true,
 *     imagem_url  text,
 *     created_at  timestamptz default now()
 *   );
 *
 *   create table fichas_tecnicas (
 *     id          uuid primary key default gen_random_uuid(),
 *     prato_id    uuid references cardapio(id) on delete cascade,
 *     ingrediente_id uuid,           -- referência a tabela ingredientes
 *     nome        text not null,     -- nome do ingrediente (desnormalizado)
 *     quantidade  numeric not null,
 *     unidade     text not null,
 *     custo_unit  numeric not null default 0
 *   );
 *
 *   alter table cardapio enable row level security;
 *   alter table fichas_tecnicas enable row level security;
 *   create policy "auth_all" on cardapio for all to authenticated using (true) with check (true);
 *   create policy "auth_all" on fichas_tecnicas for all to authenticated using (true) with check (true);
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase, isSupabaseReady } from "./supabase";
import { escoparPorUnidade, carimbarUnidade } from "./unidades";

export const CARDAPIO_SEED = [];

export async function fetchCardapio(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: null, fromSeed: true };
  const { data, error } = await escoparPorUnidade(
    supabase.from("cardapio").select("*").order("categoria").order("nome"),
    unidadeId,
  );
  if (error) return { data: [], error: error.message, fromSeed: true };
  return { data: data || [], error: null, fromSeed: false };
}

export async function inserirPrato(prato, unidadeId) {
  if (!isSupabaseReady()) return { data: null, error: "Supabase não configurado" };
  const { data, error } = await supabase.from("cardapio").insert([carimbarUnidade(prato, unidadeId)]).select().single();
  return { data, error: error?.message || null };
}

export async function atualizarPrato(id, updates) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { error } = await supabase.from("cardapio").update(updates).eq("id", id);
  return { error: error?.message || null };
}

export async function removerPrato(id) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { error } = await supabase.from("cardapio").delete().eq("id", id);
  return { error: error?.message || null };
}

/** Busca ficha técnica de um prato (itens de ingredientes) */
export async function fetchFicha(pratoId) {
  if (!isSupabaseReady()) return { data: [], error: null };
  const { data, error } = await supabase
    .from("fichas_tecnicas")
    .select("*")
    .eq("prato_id", pratoId);
  return { data: data || [], error: error?.message || null };
}
