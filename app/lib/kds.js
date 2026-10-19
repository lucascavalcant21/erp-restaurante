/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CAMADA DE DADOS: KDS (Kitchen Display System)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * fetchPedidosAtivos: vendas do dia (usado pela tela de Delivery).
 * Fila da cozinha (KDS): pedidos_itens.status_kds — mais abaixo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase, isSupabaseReady } from "./supabase";
import { STATUS_NA_FILA, montarFilaKDS, pedidoFicaPronto } from "./kds-fila.mjs";

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

// ─── FILA DA COZINHA (pedidos_itens.status_kds) ─────────────────────────────
// Salão, cardápio digital (mesa e delivery aceitos) e iFood caem aqui. As
// regras de agrupamento e de estado estão em kds-fila.mjs (testadas).

const JANELA_HORAS = 24; // ticket esquecido de outro dia não polui a tela

/** Tickets ativos da unidade para o setor ("cozinha", "bar" ou "todos"). */
export async function fetchFilaKDS(unidadeId, setor = "cozinha") {
  if (!isSupabaseReady()) return { data: [], error: "Supabase não configurado" };
  if (!unidadeId || unidadeId === "todas") return { data: [], error: "Escolha uma unidade." };
  const desde = new Date(Date.now() - JANELA_HORAS * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from("pedidos_itens")
    .select(`
      id, pedido_id, quantidade, observacao, status_kds, created_at,
      produtos ( nome_produto, departamento ),
      pedidos!inner ( id, unidade_id, status, tipo_pedido, cliente_nome, identificacao, created_at )
    `)
    .eq("pedidos.unidade_id", unidadeId)
    .in("status_kds", STATUS_NA_FILA)
    .gte("created_at", desde)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) {
    console.error("[kds] fetchFilaKDS:", error.message);
    return { data: [], error: error.message };
  }
  return { data: montarFilaKDS(data, setor), error: null };
}

/** Muda o estado de um item (pendente → preparando → pronto). */
export async function atualizarItemKDS(itemId, novoStatus) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { error } = await supabase
    .from("pedidos_itens")
    .update({ status_kds: novoStatus, updated_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) console.error("[kds] atualizarItemKDS:", error.message);
  return { error: error?.message || null };
}

/**
 * Entrega os itens do ticket que estão na tela (só os do setor). Se o pedido
 * é online e não sobrou nada na fila, ele vira "pronto" (despacho/TV).
 */
export async function entregarTicketKDS(pedido, itemIds) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const ids = (itemIds || []).filter(Boolean);
  if (!pedido?.id || !ids.length) return { error: null };
  const agora = new Date().toISOString();
  const { error } = await supabase
    .from("pedidos_itens")
    .update({ status_kds: "entregue", updated_at: agora })
    .eq("pedido_id", pedido.id)
    .in("id", ids);
  if (error) {
    console.error("[kds] entregarTicketKDS:", error.message);
    return { error: error.message };
  }
  const { data: itens, error: eI } = await supabase.from("pedidos_itens").select("status_kds").eq("pedido_id", pedido.id);
  if (!eI && pedidoFicaPronto(pedido, itens)) {
    await supabase.from("pedidos")
      .update({ status: "pronto", updated_at: agora })
      .eq("id", pedido.id)
      .eq("status", pedido.status); // não passa por cima de quem mudou o pedido no meio do caminho
  }
  return { error: null };
}
