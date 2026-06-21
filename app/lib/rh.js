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

// ── Cargos e Turnos Dinâmicos ────────────────────────────────────────────────
export async function fetchCargos(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: null };
  const { data, error } = await escoparPorUnidade(supabase.from("rh_cargos").select("*").order("nome"), unidadeId);
  return { data: data || [], error: error?.message };
}

export const CARGOS_PADRAO = [
  // COZINHA
  { nome: "Auxiliar de Cozinha 1", funcoes_padrao: "Limpeza da praça, preparo inicial de insumos básicos (descascar, cortar)." },
  { nome: "Auxiliar de Cozinha 2", funcoes_padrao: "Apoio nas frituras e grelha, organização de geladeiras, montagem básica." },
  { nome: "Auxiliar de Cozinha 3", funcoes_padrao: "Apoio avançado ao cozinheiro, controle de validade e reposição de praça durante o serviço." },
  { nome: "Cozinheiro 1", funcoes_padrao: "Preparo de pratos menos complexos, responsável por uma praça específica (ex: saladas ou fritadeira)." },
  { nome: "Cozinheiro 2", funcoes_padrao: "Execução de pratos quentes, domínio de grelha/fogão, controle de CMV da praça." },
  { nome: "Cozinheiro 3", funcoes_padrao: "Sub-chefe do turno, organiza a saída de pratos (boqueta), cobra qualidade e tempo." },
  { nome: "Chefe de Cozinha", funcoes_padrao: "Criação de fichas técnicas, escala de equipe, gestão de compras e estoque, liderança geral da operação." },
  { nome: "Auxiliar de Produção", funcoes_padrao: "Preparo de molhos, porcionamento e pré-preparo em grande escala fora do horário de pico." },
  // SALÃO
  { nome: "Cumim", funcoes_padrao: "Limpeza de mesas, polimento de talheres, reposição de gelo e suporte geral aos garçons." },
  { nome: "Garçom", funcoes_padrao: "Atendimento ao cliente, tirada de pedidos, vendas sugestivas, entrega de pratos e bebidas." },
  { nome: "Chefe de Fila", funcoes_padrao: "Organização do rodízio de praças dos garçons, resolução de problemas rápidos no salão." },
  { nome: "Maître", funcoes_padrao: "Recepção de clientes VIPs, organização de reservas, treinamento de atendimento e vinhos." },
  { nome: "Gerente", funcoes_padrao: "Gestão completa da equipe de atendimento, fechamento de caixa, relacionamento com clientes e feedbacks." },
  // BAR
  { nome: "Auxiliar de Barman", funcoes_padrao: "Limpeza do bar, reposição de xaropes, corte de frutas, lavagem de copos." },
  { nome: "Bartender", funcoes_padrao: "Preparo de drinks clássicos e autorais, atendimento aos clientes do balcão." },
  { nome: "Chefe do Bar", funcoes_padrao: "Criação de carta de drinks, inventário de bebidas, treinamento de auxiliares, gestão de validade de insumos do bar." }
];

export async function inserirCargosPadrao(unidadeId) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const linhas = CARGOS_PADRAO.map(c => carimbarUnidade(c, unidadeId));
  const { error } = await supabase.from("rh_cargos").insert(linhas);
  return { error: error?.message || null };
}

export async function inserirCargo(c, unidadeId) {
  const { data, error } = await supabase.from("rh_cargos").insert([carimbarUnidade(c, unidadeId)]).select().single();
  return { data, error: error?.message };
}
export async function atualizarCargo(id, updates) {
  const { error } = await supabase.from("rh_cargos").update(updates).eq("id", id);
  return { error: error?.message };
}
export async function removerCargo(id) {
  const { error } = await supabase.from("rh_cargos").delete().eq("id", id);
  return { error: error?.message };
}

export async function fetchTurnos(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: null };
  const { data, error } = await escoparPorUnidade(supabase.from("rh_turnos").select("*").order("nome"), unidadeId);
  return { data: data || [], error: error?.message };
}
export async function inserirTurno(t, unidadeId) {
  const { data, error } = await supabase.from("rh_turnos").insert([carimbarUnidade(t, unidadeId)]).select().single();
  return { data, error: error?.message };
}
export async function atualizarTurno(id, updates) {
  const { error } = await supabase.from("rh_turnos").update(updates).eq("id", id);
  return { error: error?.message };
}
export async function removerTurno(id) {
  const { error } = await supabase.from("rh_turnos").delete().eq("id", id);
  return { error: error?.message };
}
