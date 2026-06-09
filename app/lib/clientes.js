/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CAMADA DE DADOS: Clientes (CRM, NPS, Campanhas)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * SQL para criar as tabelas no Supabase:
 *
 *   create table clientes (
 *     id            uuid primary key default gen_random_uuid(),
 *     nome          text not null,
 *     tel           text,
 *     unidade       text,
 *     total_gasto   numeric default 0,
 *     total_pedidos integer default 0,
 *     ultima_compra date,
 *     created_at    timestamptz default now()
 *   );
 *
 *   create table avaliacoes_nps (
 *     id         uuid primary key default gen_random_uuid(),
 *     cliente_id uuid references clientes(id),
 *     nome       text,
 *     nota       integer not null check (nota between 0 and 10),
 *     comentario text,
 *     unidade    text,
 *     data       date default current_date,
 *     created_at timestamptz default now()
 *   );
 *
 *   create table campanhas (
 *     id                  uuid primary key default gen_random_uuid(),
 *     nome                text not null,
 *     tipo                text not null,
 *     descricao           text,
 *     cupom               text,
 *     desconto            numeric default 0,
 *     unidade             text default 'Todas',
 *     inicio              date not null,
 *     fim                 date not null,
 *     meta_clientes       integer default 0,
 *     clientes_atingidos  integer default 0,
 *     receita_gerada      numeric default 0,
 *     status              text default 'agendada',
 *     created_at          timestamptz default now()
 *   );
 *
 *   alter table clientes enable row level security;
 *   alter table avaliacoes_nps enable row level security;
 *   alter table campanhas enable row level security;
 *   create policy "auth_all" on clientes for all to authenticated using (true) with check (true);
 *   create policy "auth_all" on avaliacoes_nps for all to authenticated using (true) with check (true);
 *   create policy "auth_all" on campanhas for all to authenticated using (true) with check (true);
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase, isSupabaseReady } from "./supabase";

// ── Seeds ─────────────────────────────────────────────────────────────────────
export const CLIENTES_SEED = [];

export const AVALIACOES_SEED = [];

export const CAMPANHAS_SEED = [];

// ── Clientes ──────────────────────────────────────────────────────────────────
export async function fetchClientes() {
  if (!isSupabaseReady()) return { data: [], error: null, fromSeed: true };
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .order("total_gasto", { ascending: false });
  if (error) return { data: [], error: error.message, fromSeed: true };
  return { data: data || [], error: null, fromSeed: false };
}

export async function inserirCliente(cliente) {
  if (!isSupabaseReady()) return { data: null, error: "Supabase não configurado" };
  const { data, error } = await supabase.from("clientes").insert([cliente]).select().single();
  return { data, error: error?.message || null };
}

export async function atualizarCliente(id, updates) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { error } = await supabase.from("clientes").update(updates).eq("id", id);
  return { error: error?.message || null };
}

// ── NPS ───────────────────────────────────────────────────────────────────────
export async function fetchAvaliacoes() {
  if (!isSupabaseReady()) return { data: [], error: null, fromSeed: true };
  const { data, error } = await supabase
    .from("avaliacoes_nps")
    .select("*")
    .order("data", { ascending: false });
  if (error) return { data: [], error: error.message, fromSeed: true };
  return { data: data || [], error: null, fromSeed: false };
}

export async function inserirAvaliacao(avaliacao) {
  if (!isSupabaseReady()) return { data: null, error: "Supabase não configurado" };
  const { data, error } = await supabase.from("avaliacoes_nps").insert([avaliacao]).select().single();
  return { data, error: error?.message || null };
}

// ── Campanhas ─────────────────────────────────────────────────────────────────
export async function fetchCampanhas() {
  if (!isSupabaseReady()) return { data: [], error: null, fromSeed: true };
  const { data, error } = await supabase
    .from("campanhas")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message, fromSeed: true };
  return { data: data || [], error: null, fromSeed: false };
}

export async function inserirCampanha(campanha) {
  if (!isSupabaseReady()) return { data: null, error: "Supabase não configurado" };
  const { data, error } = await supabase.from("campanhas").insert([campanha]).select().single();
  return { data, error: error?.message || null };
}

export async function atualizarStatusCampanha(id, status) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { error } = await supabase.from("campanhas").update({ status }).eq("id", id);
  return { error: error?.message || null };
}
