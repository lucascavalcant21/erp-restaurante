/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CAMADA DE DADOS: KDS (Kitchen Display System)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Busca e atualiza itens das vendas (venda_itens) que precisam ser preparados.
 * Supõe-se a existência da coluna "status_preparo" na tabela "venda_itens".
 * Status possíveis: 'pendente' | 'preparando' | 'pronto' | 'entregue'
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase, isSupabaseReady } from "./supabase";

/**
 * Busca vendas do dia que contêm itens ativos (pendente, preparando, pronto)
 * Os itens já são agrupados por venda.
 * @param {string} unidadeId
 */
export async function fetchPedidosAtivos(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: "Supabase não configurado" };
  
  // Início do dia
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicioDia = hoje.toISOString();

  // Busca as vendas recentes
  let query = supabase
    .from("vendas")
    .select("*, venda_itens(*)")
    .gte("created_at", inicioDia)
    .neq("status", "cancelada")
    .order("created_at", { ascending: true }); // mais antigos primeiro no KDS

  if (unidadeId !== "todas") {
    query = query.eq("unidade_id", unidadeId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[kds] fetchPedidosAtivos:", error.message);
    return { data: [], error: error.message };
  }

  // Filtrar apenas vendas que possuem itens que não estão 'entregues' (ou seja, ainda em processo)
  // Além disso, vamos remover os itens que já estão 'entregue' para limpar a tela
  const vendasFiltradas = (data || [])
    .map(venda => {
      const itensAtivos = (venda.venda_itens || []).filter(item => item.status_preparo !== 'entregue');
      return { ...venda, venda_itens: itensAtivos };
    })
    .filter(venda => venda.venda_itens.length > 0);

  return { data: vendasFiltradas, error: null };
}

/**
 * Atualiza o status de preparo de um item específico.
 * @param {string} itemId
 * @param {string} novoStatus ('pendente', 'preparando', 'pronto', 'entregue')
 */
export async function atualizarStatusItem(itemId, novoStatus) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  
  const { error } = await supabase
    .from("venda_itens")
    .update({ status_preparo: novoStatus })
    .eq("id", itemId);

  if (error) {
    console.error("[kds] atualizarStatusItem:", error.message);
    return { error: error.message };
  }

  return { error: null };
}

/**
 * Finaliza todos os itens de uma venda de uma só vez (Move para 'entregue').
 * @param {string} vendaId
 */
export async function finalizarPedidoTodo(vendaId) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };

  const { error } = await supabase
    .from("venda_itens")
    .update({ status_preparo: 'entregue' })
    .eq("venda_id", vendaId)
    .neq("status_preparo", "entregue");

  if (error) {
    console.error("[kds] finalizarPedidoTodo:", error.message);
    return { error: error.message };
  }

  return { error: null };
}
