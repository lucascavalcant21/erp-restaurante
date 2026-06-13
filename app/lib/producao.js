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

/**
 * Registra uma produção e dá baixa no estoque.
 * @param {Object} prod - Dados da produção
 * @param {Array} ingredientes - Lista de ingredientes com { estoque_id, nome, qtd_usada, qtd_ficha, unidade, custo_unit }
 * @param {string} unidadeId
 */
export async function registrarProducao(prod, ingredientes, unidadeId) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };

  // 1. Calcula custo total
  const custoTotal = ingredientes.reduce(
    (acc, ing) => acc + (ing.qtd_usada || 0) * (ing.custo_unit || 0), 0
  );

  // 2. Calcula receita potencial (preço de venda x quantidade produzida)
  const receitaPotencial = (prod.prato_preco || 0) * (prod.quantidade || 1);

  // 3. Verifica se houve alteração nos ingredientes
  const teveAlteracao = ingredientes.some(
    (ing) => Math.abs((ing.qtd_usada || 0) - (ing.qtd_ficha || 0)) > 0.001
  );

  // 4. Monta registro
  const registro = carimbarUnidade({
    setor: prod.setor,
    prato_id: prod.prato_id,
    prato_nome: prod.prato_nome,
    prato_preco: prod.prato_preco || 0,
    quantidade: prod.quantidade || 1,
    custo_total: custoTotal,
    receita_potencial: receitaPotencial,
    funcionario_id: prod.funcionario_id || null,
    funcionario_nome: prod.funcionario_nome || "",
    teve_alteracao: teveAlteracao,
    motivo_alteracao: prod.motivo_alteracao || null,
    ingredientes_usados: JSON.stringify(ingredientes.map((i) => ({
      estoque_id: i.estoque_id,
      nome: i.nome,
      unidade: i.unidade,
      qtd_ficha: i.qtd_ficha,
      qtd_usada: i.qtd_usada,
      custo_unit: i.custo_unit,
    }))),
    sobras: prod.sobras || null,
  }, unidadeId);

  const { data, error } = await supabase
    .from("producoes")
    .insert([registro])
    .select()
    .single();

  if (error) {
    console.error("[producao] registrarProducao:", error.message);
    return { error: error.message };
  }

  // 5. Dar baixa no estoque para cada ingrediente
  for (const ing of ingredientes) {
    if (!ing.estoque_id || !ing.qtd_usada) continue;

    // Busca quantidade atual
    const { data: item, error: fetchErr } = await supabase
      .from("estoque")
      .select("quantidade")
      .eq("id", ing.estoque_id)
      .single();

    if (fetchErr) continue;

    const novaQtd = Math.max(0, (item.quantidade || 0) - ing.qtd_usada);

    await supabase
      .from("estoque")
      .update({ quantidade: novaQtd, updated_at: new Date().toISOString() })
      .eq("id", ing.estoque_id);

    // Registra movimentação
    await supabase.from("estoque_movimentacoes").insert([{
      estoque_id: ing.estoque_id,
      tipo: "saida",
      quantidade: ing.qtd_usada,
      obs: JSON.stringify({
        via: "producao",
        prato: prod.prato_nome,
        responsavel: prod.funcionario_nome || "",
        setor: prod.setor,
      }),
      unidade_id: (unidadeId && unidadeId !== "todas") ? unidadeId : null,
    }]);
  }

  return { data, error: null };
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
