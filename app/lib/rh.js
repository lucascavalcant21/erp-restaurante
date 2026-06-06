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

// ── Seeds ─────────────────────────────────────────────────────────────────────
export const FUNCIONARIOS_SEED = [
  { id: "f1", nome: "Ana Clara Souza",   cargo: "Cozinheira",  unidade: "Seldeestrela", turno: "06:00–14:00", salario: 2100, admissao: "2024-01-10", status: "ativo" },
  { id: "f2", nome: "Bruno Ferreira",    cargo: "Auxiliar",    unidade: "Seldeestrela", turno: "08:00–17:00", salario: 1800, admissao: "2024-03-05", status: "ativo" },
  { id: "f3", nome: "Carla Mendes",      cargo: "Atendente",   unidade: "Tico Tico",    turno: "08:00–17:00", salario: 1900, admissao: "2023-11-20", status: "ativo" },
  { id: "f4", nome: "Diego Alves",       cargo: "Entregador",  unidade: "Burguer",      turno: "10:00–19:00", salario: 1750, admissao: "2025-02-14", status: "ativo" },
  { id: "f5", nome: "Elisa Rocha",       cargo: "Gerente",     unidade: "Seldeestrela", turno: "07:00–16:00", salario: 3500, admissao: "2022-08-01", status: "ativo" },
];

export const REGISTROS_PONTO_SEED = [
  { id: "r1",  func_id: "f1", data: "2026-06-02", entrada: "06:02", saida: "14:05" },
  { id: "r2",  func_id: "f1", data: "2026-06-03", entrada: "06:18", saida: "14:10" },
  { id: "r3",  func_id: "f1", data: "2026-06-04", entrada: "05:58", saida: "14:02" },
  { id: "r4",  func_id: "f1", data: "2026-06-05", entrada: "06:01", saida: null    },
  { id: "r5",  func_id: "f2", data: "2026-06-02", entrada: "08:25", saida: "17:10" },
  { id: "r6",  func_id: "f2", data: "2026-06-03", entrada: "08:05", saida: "17:02" },
  { id: "r7",  func_id: "f2", data: "2026-06-04", entrada: null,    saida: null    },
  { id: "r8",  func_id: "f2", data: "2026-06-05", entrada: "08:12", saida: null    },
  { id: "r9",  func_id: "f3", data: "2026-06-02", entrada: "08:00", saida: "17:00" },
  { id: "r10", func_id: "f3", data: "2026-06-03", entrada: "08:03", saida: "17:05" },
  { id: "r11", func_id: "f3", data: "2026-06-04", entrada: "08:00", saida: "17:00" },
  { id: "r12", func_id: "f3", data: "2026-06-05", entrada: "08:00", saida: null    },
  { id: "r13", func_id: "f4", data: "2026-06-02", entrada: "10:05", saida: "19:00" },
  { id: "r14", func_id: "f4", data: "2026-06-03", entrada: "10:30", saida: "19:15" },
  { id: "r15", func_id: "f4", data: "2026-06-04", entrada: "10:00", saida: "19:00" },
  { id: "r16", func_id: "f4", data: "2026-06-05", entrada: "10:02", saida: null    },
  { id: "r17", func_id: "f5", data: "2026-06-02", entrada: "07:00", saida: "16:00" },
  { id: "r18", func_id: "f5", data: "2026-06-03", entrada: "07:00", saida: "16:05" },
  { id: "r19", func_id: "f5", data: "2026-06-04", entrada: "07:02", saida: "16:00" },
  { id: "r20", func_id: "f5", data: "2026-06-05", entrada: "07:00", saida: null    },
];

export const HOLERITES_SEED = {
  f1: [
    { id: "h1", func_id: "f1", mes: 5, ano: 2026, bruto: 2100, liquido: 1780, detalhes: { proventos: [{ nome: "Salário Base", valor: 2100 }], descontos: [{ nome: "INSS", valor: 168 }, { nome: "IRRF", valor: 152 }] } },
    { id: "h2", func_id: "f1", mes: 4, ano: 2026, bruto: 2100, liquido: 1780, detalhes: { proventos: [{ nome: "Salário Base", valor: 2100 }], descontos: [{ nome: "INSS", valor: 168 }, { nome: "IRRF", valor: 152 }] } },
  ],
  f2: [], f3: [], f4: [],
  f5: [
    { id: "h3", func_id: "f5", mes: 5, ano: 2026, bruto: 3500, liquido: 2870, detalhes: { proventos: [{ nome: "Salário Base", valor: 3500 }], descontos: [{ nome: "INSS", valor: 280 }, { nome: "IRRF", valor: 350 }] } },
  ],
};

// ── Funcionários ──────────────────────────────────────────────────────────────
export async function fetchFuncionarios() {
  if (!isSupabaseReady()) return { data: [], error: null, fromSeed: true };
  const { data, error } = await supabase
    .from("funcionarios")
    .select("*")
    .order("nome");
  if (error) return { data: [], error: error.message, fromSeed: true };
  return { data: data || [], error: null, fromSeed: false };
}

export async function inserirFuncionario(func) {
  if (!isSupabaseReady()) return { data: null, error: "Supabase não configurado" };
  const { data, error } = await supabase.from("funcionarios").insert([func]).select().single();
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
