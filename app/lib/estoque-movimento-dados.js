// Leitura e escrita de ENTRADA/RETIRADA, ESTORNO, AJUSTE e SEGURANÇA DO
// ESTOQUE com o cliente do app. Regras e validações ficam em
// estoque-movimento.mjs (testadas); aqui só se passa o `supabase` e se busca o
// que as telas precisam. Toda escrita de saldo vai pelas funções do banco
// (EST-MOV-1): nada aqui grava direto em estoque_itens nem no histórico.

import { supabase, isSupabaseReady } from "./supabase.js";
import {
  registrarMovimento, estornarMovimento, ajustarInventario, lerSegurancaEstoque, salvarSegurancaEstoque,
  corrigirItemContagem, bancoDesatualizado, MSG_BANCO_DESATUALIZADO,
} from "./estoque-movimento.mjs";
import { unidadeValida } from "./contas-pagar.mjs";
import { marcadorInventario } from "./inventario-saldo.mjs";

// unidade_conteudo + permite_fracionado: garrafa fracionada guarda o saldo em ml (inventario-saldo.mjs)
const CAMPOS_INSUMO = "id, nome, nome_interno, marca, unidade_medida, categoria, codigo_interno, departamento, custo_unitario, custo_compra, tamanho_embalagem, unidade_comercial, unidade_conteudo, permite_fracionado, fornecedor, preco_atualizado_em";
const semBanco = { data: null, error: "Sistema sem conexão com o banco." };
// coluna nova ausente = SQL da EST-MOV-1 ainda não rodou
const colunaAusente = (e) => /column .* does not exist|could not find .* column|PGRST204/i.test(String(e?.message || e || ""));

/** Locais, produtos por local (saldo), cadastro e custo médio. */
export async function fetchBaseMovimento(unidadeId) {
  if (!isSupabaseReady() || !unidadeValida(unidadeId)) return { data: null, error: "Selecione uma unidade." };
  const [e, ei, ins, cm] = await Promise.all([
    supabase.from("estoques").select("id, nome, slug, tipo, status, ordem, controla_validade").eq("unidade_id", unidadeId).eq("status", "ativo").order("ordem").order("nome"),
    supabase.from("estoque_itens").select("id, estoque_id, insumo_id, quantidade_atual, validade, local_interno").eq("unidade_id", unidadeId),
    supabase.from("insumos").select(CAMPOS_INSUMO).eq("unidade_id", unidadeId).order("nome"),
    supabase.from("estoque_custos").select("insumo_id, custo_medio_base").eq("unidade_id", unidadeId),
  ]);
  const erro = [e.error, ei.error, ins.error].find(Boolean);
  if (erro) return { data: null, error: erro.message };
  return {
    data: {
      estoques: e.data || [],
      itens: ei.data || [],
      insumos: ins.data || [],
      custosMedios: Object.fromEntries((cm.data || []).map((c) => [c.insumo_id, Number(c.custo_medio_base)])),
    },
    error: null,
  };
}

const CAMPOS_MOV = "id, tipo, quantidade, saldo_anterior, saldo_posterior, usuario_nome, observacao, data_movimento, created_at, valor_total, insumo_id, estoque_id, estoque_destino_id";
const CAMPOS_MOV_NOVOS = "motivo, origem, estorno_de_id, autorizado_por_nome, justificativa, responsavel_nome, unidade_medida, detalhe_quantidade, validade, inventario_id";

/**
 * Últimos lançados de um local (o mais novo primeiro), com quais já foram
 * estornados. Só leitura: a tela não oferece editar nem apagar.
 */
export async function fetchUltimosMovimentos(unidadeId, estoqueId, limite = 30) {
  if (!isSupabaseReady() || !unidadeValida(unidadeId) || !estoqueId) return { data: [], estornados: new Set(), error: null };
  const consulta = (campos) => supabase.from("estoque_movimentacoes_multi")
    .select(`${campos}, insumo:insumos(nome, unidade_medida, tamanho_embalagem, unidade_conteudo, permite_fracionado)`)
    .eq("unidade_id", unidadeId).eq("estoque_id", estoqueId)
    .order("created_at", { ascending: false }).limit(limite);
  let r = await consulta(`${CAMPOS_MOV}, ${CAMPOS_MOV_NOVOS}`);
  let desatualizado = false;
  if (r.error && colunaAusente(r.error)) { desatualizado = true; r = await consulta(CAMPOS_MOV); }
  if (r.error) return { data: [], estornados: new Set(), error: r.error.message };
  const lista = r.data || [];
  let estornados = new Set();
  if (!desatualizado && lista.length) {
    const e = await supabase.from("estoque_movimentacoes_multi").select("estorno_de_id").in("estorno_de_id", lista.map((m) => m.id));
    if (!e.error) estornados = new Set((e.data || []).map((x) => x.estorno_de_id));
  }
  return { data: lista, estornados, desatualizado, error: null };
}

/**
 * Ajustes já lançados a partir de um inventário (para não ajustar duas vezes e
 * mostrar o resultado). legado = "estoque|insumo" que o caminho anterior
 * (fechar → acerto de contagem com o marcador do inventário) já aplicou.
 */
export async function fetchAjustesDoInventario(contagemId, unidadeId = null) {
  if (!isSupabaseReady() || !contagemId) return { data: [], legado: new Set(), error: null };
  let legado = new Set();
  if (unidadeValida(unidadeId)) {
    const l = await supabase.from("estoque_movimentacoes_multi").select("estoque_id, insumo_id")
      .eq("unidade_id", unidadeId).eq("tipo", "contagem").ilike("observacao", `%${marcadorInventario(contagemId)}%`);
    if (!l.error) legado = new Set((l.data || []).map((m) => `${m.estoque_id}|${m.insumo_id}`));
  }
  const { data, error } = await supabase.from("estoque_movimentacoes_multi")
    .select("id, inventario_item_id, tipo, quantidade, valor_total, autorizado_por_nome, created_at, estorno_de_id")
    .eq("inventario_id", contagemId);
  if (error) return { data: [], legado, desatualizado: colunaAusente(error), error: colunaAusente(error) ? null : error.message };
  return { data: data || [], legado, error: null };
}

export const lancarMovimento = (p) => (isSupabaseReady() ? registrarMovimento(supabase, p) : semBanco);
export const estornarLancamento = (p) => (isSupabaseReady() ? estornarMovimento(supabase, p) : semBanco);
export const ajustarPeloInventario = (p) => (isSupabaseReady() ? ajustarInventario(supabase, p) : semBanco);
export const corrigirProdutoContado = (p) => (isSupabaseReady() ? corrigirItemContagem(supabase, p) : semBanco);
export const salvarSeguranca = (p) => (isSupabaseReady() ? salvarSegurancaEstoque(supabase, p) : semBanco);
export async function lerSeguranca(unidadeId) {
  if (!isSupabaseReady()) return semBanco;
  return lerSegurancaEstoque(supabase, unidadeId);
}
export { bancoDesatualizado, MSG_BANCO_DESATUALIZADO };
