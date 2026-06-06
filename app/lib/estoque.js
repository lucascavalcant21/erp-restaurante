/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CAMADA DE DADOS: Estoque
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * SQL para criar a tabela no Supabase (cole no SQL Editor):
 *
 *   create table estoque (
 *     id          uuid primary key default gen_random_uuid(),
 *     nome        text not null,
 *     categoria   text not null,
 *     unidade     text not null,        -- kg, L, un, cx
 *     quantidade  numeric not null default 0,
 *     minimo      numeric not null default 0,
 *     preco_unit  numeric not null default 0,
 *     fornecedor  text,
 *     updated_at  timestamptz default now()
 *   );
 *
 *   -- Histórico de movimentações
 *   create table estoque_movimentacoes (
 *     id          uuid primary key default gen_random_uuid(),
 *     estoque_id  uuid references estoque(id) on delete cascade,
 *     tipo        text not null,   -- 'entrada' | 'saida'
 *     quantidade  numeric not null,
 *     obs         text,
 *     created_at  timestamptz default now()
 *   );
 *
 *   -- Habilitar RLS
 *   alter table estoque enable row level security;
 *   alter table estoque_movimentacoes enable row level security;
 *
 *   -- Política: qualquer usuário autenticado pode ler/escrever
 *   create policy "auth_all" on estoque for all to authenticated using (true) with check (true);
 *   create policy "auth_all" on estoque_movimentacoes for all to authenticated using (true) with check (true);
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase, isSupabaseReady } from "./supabase";

// ─── Seed de demonstração (usado quando Supabase não está configurado) ─────────
export const ESTOQUE_SEED = [
  { id: "e1", nome: "Frango (peito)",       categoria: "Proteína",    unidade: "kg", quantidade: 8,   minimo: 10,  preco_unit: 18.90, fornecedor: "Frigorífico BH"   },
  { id: "e2", nome: "Arroz Branco",         categoria: "Grão",        unidade: "kg", quantidade: 25,  minimo: 10,  preco_unit: 4.50,  fornecedor: "Distribuidora Sul" },
  { id: "e3", nome: "Feijão Carioca",       categoria: "Grão",        unidade: "kg", quantidade: 12,  minimo: 8,   preco_unit: 7.20,  fornecedor: "Distribuidora Sul" },
  { id: "e4", nome: "Farinha de Trigo",     categoria: "Grão",        unidade: "kg", quantidade: 3,   minimo: 10,  preco_unit: 3.80,  fornecedor: "Moinho Central"    },
  { id: "e5", nome: "Óleo de Soja",         categoria: "Óleo",        unidade: "L",  quantidade: 9,   minimo: 5,   preco_unit: 6.90,  fornecedor: "Distribuidora Sul" },
  { id: "e6", nome: "Tomate",               categoria: "Hortifruti",  unidade: "kg", quantidade: 4,   minimo: 8,   preco_unit: 5.50,  fornecedor: "Hortifruti Verde"  },
  { id: "e7", nome: "Embalagem Marmitex G", categoria: "Embalagem",   unidade: "cx", quantidade: 2,   minimo: 3,   preco_unit: 48.00, fornecedor: "EmbalaFácil"       },
];

// ─── Funções de acesso ────────────────────────────────────────────────────────

/**
 * Busca todos os itens do estoque ordenados por nome.
 * @returns {Promise<{data: Array, error: string|null, fromSeed: boolean}>}
 */
// Normaliza campos: preco_unit → custo_unitario, ultima_entrada fallback
function normalizar(item) {
  return {
    ...item,
    custo_unitario: item.custo_unitario ?? item.preco_unit ?? 0,
    ultima_entrada: item.ultima_entrada ?? item.updated_at?.slice(0, 10) ?? null,
  };
}

export async function fetchEstoque() {
  if (!isSupabaseReady()) {
    return { data: ESTOQUE_SEED.map(normalizar), error: null, fromSeed: true };
  }

  const { data, error } = await supabase
    .from("estoque")
    .select("*")
    .order("nome");

  if (error) {
    console.error("[estoque] fetchEstoque:", error.message);
    return { data: ESTOQUE_SEED.map(normalizar), error: error.message, fromSeed: true };
  }

  return { data: (data || []).map(normalizar), error: null, fromSeed: false };
}

/**
 * Insere um novo item no estoque.
 * @param {Object} item - { nome, categoria, unidade, quantidade, minimo, preco_unit, fornecedor }
 */
export async function inserirItem(item) {
  if (!isSupabaseReady()) return { data: null, error: "Supabase não configurado" };

  const { data, error } = await supabase
    .from("estoque")
    .insert([item])
    .select()
    .single();

  if (error) console.error("[estoque] inserirItem:", error.message);
  return { data, error: error?.message || null };
}

/**
 * Atualiza quantidade de um item (movimentação de entrada ou saída).
 * Também grava o histórico em estoque_movimentacoes.
 * @param {string} id - UUID do item
 * @param {"entrada"|"saida"} tipo
 * @param {number} quantidade
 * @param {string} [obs]
 */
export async function movimentar(id, tipo, quantidade, obs = "") {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };

  // Busca quantidade atual
  const { data: item, error: fetchErr } = await supabase
    .from("estoque")
    .select("quantidade")
    .eq("id", id)
    .single();

  if (fetchErr) return { error: fetchErr.message };

  const novaQtd = tipo === "entrada"
    ? item.quantidade + quantidade
    : Math.max(0, item.quantidade - quantidade);

  // Atualiza quantidade
  const { error: updateErr } = await supabase
    .from("estoque")
    .update({ quantidade: novaQtd, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateErr) return { error: updateErr.message };

  // Grava histórico (melhor esforço — não bloqueia)
  await supabase.from("estoque_movimentacoes").insert([{
    estoque_id: id, tipo, quantidade, obs,
  }]);

  return { error: null, novaQtd };
}

/**
 * Remove um item do estoque.
 * @param {string} id - UUID do item
 */
export async function removerItem(id) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };

  const { error } = await supabase
    .from("estoque")
    .delete()
    .eq("id", id);

  if (error) console.error("[estoque] removerItem:", error.message);
  return { error: error?.message || null };
}
