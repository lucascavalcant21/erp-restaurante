/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CAMADA DE DADOS: Produção
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * SQL para criar a tabela no Supabase (cole no SQL Editor):
 *
 *   create table producoes (
 *     id              uuid primary key default gen_random_uuid(),
 *     unidade_id      text,
 *     setor           text not null,           -- 'bar' | 'cozinha'
 *     prato_id        uuid references cardapio(id),
 *     prato_nome      text not null,
 *     prato_preco     numeric not null default 0,
 *     quantidade      numeric not null default 1,
 *     custo_total     numeric not null default 0,
 *     receita_potencial numeric not null default 0,
 *     funcionario_id  uuid,
 *     funcionario_nome text,
 *     teve_alteracao  boolean default false,
 *     motivo_alteracao text,
 *     ingredientes_usados jsonb default '[]',
 *     sobras          text,
 *     created_at      timestamptz default now()
 *   );
 *
 *   alter table producoes enable row level security;
 *   create policy "auth_all" on producoes for all to authenticated using (true) with check (true);
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase, isSupabaseReady } from "./supabase";
import { escoparPorUnidade, carimbarUnidade } from "./unidades";

/**
 * Busca o histórico de produções, opcionalmente filtrado por setor.
 */
export async function fetchProducoes(unidadeId, setor = null, limite = 200) {
  if (!isSupabaseReady()) return { data: [], error: null };

  let query = supabase
    .from("producoes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limite);

  if (setor) query = query.eq("setor", setor);
  query = escoparPorUnidade(query, unidadeId);

  const { data, error } = await query;
  if (error) {
    console.error("[producao] fetchProducoes:", error.message);
    return { data: [], error: error.message };
  }
  return { data: data || [], error: null };
}

import { registrarProducao as registrarProducaoIntegrada } from "./estoque";

/**
 * Registra uma produção e dá baixa no estoque através do motor RPC integrado.
 */
export async function registrarProducao(prod, ingredientes, unidadeId) {
  if (prod?.ficha_id || prod?.id) {
    return registrarProducaoIntegrada(unidadeId, { id: prod.ficha_id || prod.id, ...prod }, prod.quantidade || 1, prod.funcionario_id, [], {
      departamento: prod.setor,
      localArmazenamento: prod.localArmazenamento || null,
    });
  }
  return { error: "Ficha técnica inválida para produção integrada." };
}

/**
 * Busca fichas técnicas de um prato (ingredientes da receita).
 */
export async function fetchFichaDoPrato(pratoId) {
  if (!isSupabaseReady()) return { data: [], error: null };

  const { data, error } = await supabase
    .from("fichas_tecnicas")
    .select("*")
    .eq("prato_id", pratoId);

  if (error) {
    console.error("[producao] fetchFichaDoPrato:", error.message);
    return { data: [], error: error.message };
  }
  return { data: data || [], error: null };
}

/**
 * Busca o resumo financeiro da produção para exibir nos KPIs.
 */
export function calcularResumo(producoes) {
  const custoTotal = producoes.reduce((acc, p) => acc + (p.custo_total || 0), 0);
  const receitaPotencial = producoes.reduce((acc, p) => acc + (p.receita_potencial || 0), 0);
  const lucroEstimado = receitaPotencial - custoTotal;
  const totalProduzido = producoes.reduce((acc, p) => acc + (p.quantidade || 0), 0);
  const comAlteracao = producoes.filter((p) => p.teve_alteracao).length;
  return { custoTotal, receitaPotencial, lucroEstimado, totalProduzido, comAlteracao };
}
