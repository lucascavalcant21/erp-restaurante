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
export const CLIENTES_SEED = [
  { id: "c1", nome: "Maria Oliveira",   tel: "(31) 99812-3456", unidade: "Seldeestrela",     ultima_compra: "2026-06-04", total_gasto: 1240.00, total_pedidos: 62 },
  { id: "c2", nome: "João Pedro Costa", tel: "(31) 98765-4321", unidade: "Seldeestrela",     ultima_compra: "2026-06-03", total_gasto: 680.00,  total_pedidos: 34 },
  { id: "c3", nome: "Fernanda Lima",    tel: "(31) 97654-3210", unidade: "Tico Tico Saladas", ultima_compra: "2026-06-05", total_gasto: 890.00,  total_pedidos: 47 },
  { id: "c4", nome: "Ricardo Martins",  tel: "(31) 96543-2109", unidade: "Burguer",           ultima_compra: "2026-04-10", total_gasto: 420.00,  total_pedidos: 21 },
  { id: "c5", nome: "Camila Santos",    tel: "(31) 95432-1098", unidade: "Seldeestrela",     ultima_compra: "2026-06-04", total_gasto: 310.00,  total_pedidos: 16 },
  { id: "c6", nome: "André Souza",      tel: "(31) 94321-0987", unidade: "Tico Tico Saladas", ultima_compra: "2026-03-15", total_gasto: 180.00,  total_pedidos: 9  },
];

export const AVALIACOES_SEED = [
  { id: "a1", nome: "Maria Oliveira",   nota: 10, comentario: "Comida deliciosa, entrega rápida!",    unidade: "Seldeestrela",     data: "2026-06-05" },
  { id: "a2", nome: "João Pedro Costa", nota: 9,  comentario: "Ótima qualidade sempre.",              unidade: "Seldeestrela",     data: "2026-06-04" },
  { id: "a3", nome: "Fernanda Lima",    nota: 8,  comentario: "Muito bom, poderia ter mais opções.",   unidade: "Tico Tico Saladas", data: "2026-06-04" },
  { id: "a4", nome: "Ricardo Martins",  nota: 5,  comentario: "Comida chegou fria.",                   unidade: "Burguer",           data: "2026-06-03" },
  { id: "a5", nome: "Camila Santos",    nota: 9,  comentario: "Atendimento excelente!",               unidade: "Seldeestrela",     data: "2026-06-02" },
  { id: "a6", nome: "Carlos Nunes",     nota: 3,  comentario: "Pedido errado, demorou muito.",         unidade: "Seldeestrela",     data: "2026-06-01" },
  { id: "a7", nome: "André Souza",      nota: 10, comentario: "Melhor salada da cidade!",              unidade: "Tico Tico Saladas", data: "2026-05-30" },
  { id: "a8", nome: "Bruna Leal",       nota: 8,  comentario: "Gostei muito, voltarei.",              unidade: "Seldeestrela",     data: "2026-05-29" },
];

export const CAMPANHAS_SEED = [
  { id: "cp1", nome: "Quinta do Suco",   tipo: "Desconto",   descricao: "30% de desconto em todos os sucos às quintas",  cupom: "SUCO30",  desconto: 30, unidade: "Todas",         inicio: "2026-06-01", fim: "2026-06-30", meta_clientes: 200, clientes_atingidos: 142, receita_gerada: 1280.00, status: "ativa" },
  { id: "cp2", nome: "Combo VIP Junho",  tipo: "VIP",        descricao: "Combo exclusivo para clientes VIP",            cupom: "VIP10",   desconto: 10, unidade: "Seldeestrela",  inicio: "2026-06-01", fim: "2026-06-15", meta_clientes: 50,  clientes_atingidos: 38,  receita_gerada: 950.00,  status: "ativa" },
  { id: "cp3", nome: "Reativação Maio",  tipo: "Reativação", descricao: "Desconto para clientes sem compra há 45+ dias", cupom: "VOLTA15", desconto: 15, unidade: "Todas",         inicio: "2026-05-10", fim: "2026-05-31", meta_clientes: 30,  clientes_atingidos: 12,  receita_gerada: 480.00,  status: "encerrada" },
];

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
