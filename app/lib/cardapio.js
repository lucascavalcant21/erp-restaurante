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

export const CARDAPIO_SEED = [
  { id: "p1", nome: "Marmitex Executiva",   categoria: "Marmita",         preco: 19.90, custo: 7.05,  ativo: true },
  { id: "p2", nome: "Suco Natural 500ml",   categoria: "Bebida",          preco: 9.00,  custo: 3.80,  ativo: true },
  { id: "p3", nome: "Salada Completa",      categoria: "Salada",          preco: 14.90, custo: 4.35,  ativo: true },
  { id: "p4", nome: "Marmitex Premium",     categoria: "Marmita",         preco: 24.90, custo: 10.20, ativo: true },
  { id: "p5", nome: "Prato Feijão Tropeiro",categoria: "Prato Principal", preco: 22.00, custo: 9.80,  ativo: true },
  { id: "p6", nome: "Combo Salada + Suco",  categoria: "Combo",           preco: 18.90, custo: 8.50,  ativo: true },
  { id: "p7", nome: "Refrigerante Lata",    categoria: "Bebida",          preco: 6.00,  custo: 3.20,  ativo: true },
  { id: "p8", nome: "Sobremesa do Dia",     categoria: "Sobremesa",       preco: 8.50,  custo: 5.10,  ativo: true },
];

export async function fetchCardapio() {
  if (!isSupabaseReady()) return { data: [], error: null, fromSeed: true };
  const { data, error } = await supabase.from("cardapio").select("*").order("categoria").order("nome");
  if (error) return { data: [], error: error.message, fromSeed: true };
  return { data: data || [], error: null, fromSeed: false };
}

export async function inserirPrato(prato) {
  if (!isSupabaseReady()) return { data: null, error: "Supabase não configurado" };
  const { data, error } = await supabase.from("cardapio").insert([prato]).select().single();
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
