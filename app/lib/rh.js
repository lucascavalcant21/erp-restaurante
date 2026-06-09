/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CAMADA DE DADOS: RH (Funcionários, Ponto, Holerites)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * SQL para criar as tabelas no Supabase:
 *
 *   create table funcionarios (
 *     id         uuid primary key default gen_random_uuid(),
 *     nome       text not null,
 *     cargo      text not null,
 *     unidade    text not null,
 *     turno      text,
 *     salario    numeric not null default 0,
 *     admissao   date not null,
 *     cpf        text,
 *     tel        text,
 *     status     text default 'ativo',   -- 'ativo' | 'inativo'
 *     created_at timestamptz default now()
 *   );
 *
 *   create table registros_ponto (
 *     id          uuid primary key default gen_random_uuid(),
 *     func_id     uuid references funcionarios(id) on delete cascade,
 *     data        date not null,
 *     entrada     time,
 *     saida       time,
 *     obs         text,
 *     created_at  timestamptz default now(),
 *     unique(func_id, data)
 *   );
 *
 *   create table holerites (
 *     id          uuid primary key default gen_random_uuid(),
 *     func_id     uuid references funcionarios(id) on delete cascade,
 *     mes         integer not null,   -- 1-12
 *     ano         integer not null,
 *     bruto       numeric not null,
 *     liquido     numeric not null,
 *     detalhes    jsonb,              -- { proventos: [], descontos: [] }
 *     created_at  timestamptz default now()
 *   );
 *
 *   alter table funcionarios enable row level security;
 *   alter table registros_ponto enable row level security;
 *   alter table holerites enable row level security;
 *   create policy "auth_all" on funcionarios for all to authenticated using (true) with check (true);
 *   create policy "auth_all" on registros_ponto for all to authenticated using (true) with check (true);
 *   create policy "auth_all" on holerites for all to authenticated using (true) with check (true);
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase, isSupabaseReady } from "./supabase";
import { escoparPorUnidade, carimbarUnidade } from "./unidades";

// ── Seeds ─────────────────────────────────────────────────────────────────────
export const FUNCIONARIOS_SEED = [];

export const REGISTROS_PONTO_SEED = [];

export const HOLERITES_SEED = {};

// ── Funcionários ──────────────────────────────────────────────────────────────
export async function fetchFuncionarios(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: null, fromSeed: true };
  const { data, error } = await escoparPorUnidade(
    supabase.from("funcionarios").select("*").order("nome"),
    unidadeId,
  );
  if (error) return { data: [], error: error.message, fromSeed: true };
  return { data: data || [], error: null, fromSeed: false };
}

export async function inserirFuncionario(func, unidadeId) {
  if (!isSupabaseReady()) return { data: null, error: "Supabase não configurado" };
  const { data, error } = await supabase.from("funcionarios").insert([carimbarUnidade(func, unidadeId)]).select().single();
  return { data, error: error?.message || null };
}

export async function atualizarFuncionario(id, updates) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { error } = await supabase.from("funcionarios").update(updates).eq("id", id);
  return { error: error?.message || null };
}

export async function removerFuncionario(id) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { error } = await supabase.from("funcionarios").delete().eq("id", id);
  return { error: error?.message || null };
}

// ── Ponto ─────────────────────────────────────────────────────────────────────
/**
 * Busca registros de ponto de um mês (formato "YYYY-MM").
 */
export async function fetchPontoMes(mesStr) {
  if (!isSupabaseReady()) return { data: [], error: null, fromSeed: true };
  const inicio = `${mesStr}-01`;
  const fim    = `${mesStr}-31`;
  const { data, error } = await supabase
    .from("registros_ponto")
    .select("*")
    .gte("data", inicio)
    .lte("data", fim)
    .order("data");
  if (error) return { data: [], error: error.message, fromSeed: true };
  return { data: data || [], error: null, fromSeed: false };
}

/**
 * Registra ou atualiza um ponto (entrada ou saída).
 * Usa upsert pela constraint unique(func_id, data).
 */
export async function registrarPonto(funcId, data, tipo, hora) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const campo = tipo === "entrada" ? "entrada" : "saida";
  const { error } = await supabase
    .from("registros_ponto")
    .upsert({ func_id: funcId, data, [campo]: hora }, { onConflict: "func_id,data" });
  return { error: error?.message || null };
}

// ── Holerites ─────────────────────────────────────────────────────────────────
export async function fetchHolerites(funcId) {
  if (!isSupabaseReady()) return { data: [], error: null, fromSeed: true };
  const { data, error } = await supabase
    .from("holerites")
    .select("*")
    .eq("func_id", funcId)
    .order("ano", { ascending: false })
    .order("mes", { ascending: false });
  if (error) return { data: [], error: error.message, fromSeed: true };
  return { data: data || [], error: null, fromSeed: false };
}
