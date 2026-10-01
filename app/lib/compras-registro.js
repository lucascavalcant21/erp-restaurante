// Leitura e escrita da tela de COMPRAS (F2.4B) com o cliente do app.
// Regras em compras-estoque.mjs (testadas); escrita do custo médio só pelas
// RPCs compras_confirmar / compras_cancelar (db/F2_4B_COMPRAS_CUSTO_MEDIO.sql).

import { supabase, isSupabaseReady } from "./supabase.js";
import { salvarRascunho, confirmarCompra, cancelarCompra, criarFornecedor } from "./compras-estoque.mjs";
import { unidadeValida } from "./contas-pagar.mjs";

const semBanco = { data: null, error: "Offline" };
// coluna/função da F2.4B ausente = o SQL ainda não foi aplicado
export const faltaMigracaoF24B = (msg) => /data_recebimento|forma_pagamento|data_vencimento|quantidade_pedida|valor_pedido|estoque_custos_historico|compras_confirmar|compras_cancelar|unidade_base/i.test(String(msg || ""))
  && /does not exist|não existe|schema cache|could not find/i.test(String(msg || ""));

export async function fetchBaseCompras(unidadeId) {
  if (!isSupabaseReady() || !unidadeValida(unidadeId)) return { data: null, error: "Selecione uma unidade." };
  const [ins, est, forn, cus] = await Promise.all([
    supabase.from("insumos").select("id, nome, nome_interno, codigo_interno, unidade_medida, categoria, departamento").eq("unidade_id", unidadeId).order("nome"),
    supabase.from("estoques").select("id, nome, slug, tipo, status, ordem").eq("unidade_id", unidadeId).eq("status", "ativo").order("ordem").order("nome"),
    supabase.from("fornecedores").select("id, nome, unidade_id, ativo").order("nome"),
    supabase.from("estoque_custos").select("insumo_id, custo_medio_base, saldo_referencia, unidade_base, atualizado_em, origem_tipo").eq("unidade_id", unidadeId),
  ]);
  const erro = [ins.error, est.error, cus.error].find(Boolean);
  if (erro) return { data: null, error: erro.message };
  return {
    data: {
      insumos: ins.data || [], estoques: est.data || [],
      fornecedores: (forn.data || []).filter((f) => f.ativo !== false && (!f.unidade_id || f.unidade_id === unidadeId)),
      custos: Object.fromEntries((cus.data || []).map((c) => [c.insumo_id, c])),
      avisoFornecedores: forn.error?.message || null,
    },
    error: null,
  };
}

/** Compras do período (pela data da compra) + rascunhos em aberto, com itens. */
export async function fetchCompras(unidadeId, de, ate) {
  if (!isSupabaseReady() || !unidadeValida(unidadeId)) return { data: { compras: [], itens: [] }, error: null };
  const [p, r] = await Promise.all([
    supabase.from("vw_compras").select("*").eq("unidade_id", unidadeId).gte("data_compra", de).lte("data_compra", ate).order("data_compra", { ascending: false }),
    supabase.from("vw_compras").select("*").eq("unidade_id", unidadeId).eq("status", "rascunho").order("created_at", { ascending: false }),
  ]);
  const erro = p.error || r.error;
  if (erro) return { data: { compras: [], itens: [] }, error: erro.message };
  const mapa = new Map([...(p.data || []), ...(r.data || [])].map((c) => [c.id, c]));
  const compras = [...mapa.values()];
  const ids = compras.map((c) => c.id);
  const it = ids.length ? await supabase.from("compras_itens").select("*").in("compra_id", ids) : { data: [] };
  return { data: { compras, itens: it.data || [] }, error: it.error?.message || null };
}

export async function fetchHistoricoCusto(unidadeId, { insumoId = null, compraId = null } = {}) {
  if (!isSupabaseReady() || !unidadeValida(unidadeId)) return { data: [], error: null };
  let q = supabase.from("estoque_custos_historico").select("*").eq("unidade_id", unidadeId);
  if (insumoId) q = q.eq("insumo_id", insumoId);
  if (compraId) q = q.eq("origem_id", compraId);
  const { data, error } = await q.order("seq", { ascending: false }).limit(200);
  return { data: data || [], error: error?.message || null };
}

export const gravarRascunhoCompra = (p) => (isSupabaseReady() ? salvarRascunho(supabase, p) : semBanco);
export const confirmarCompraRegistro = (p) => (isSupabaseReady() ? confirmarCompra(supabase, p) : semBanco);
export const cancelarCompraRegistro = (p) => (isSupabaseReady() ? cancelarCompra(supabase, p) : semBanco);
export const novoFornecedor = (p) => (isSupabaseReady() ? criarFornecedor(supabase, p) : semBanco);
