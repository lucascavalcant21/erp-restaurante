import { supabase, isSupabaseReady } from "./supabase";

// ─── PRODUTOS (Cardápio Físico/Digital) ──────────────────────────────────────

export async function fetchProdutos(unidadeId, dept) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  
  let query = supabase.from("produtos")
    .select(`
      *,
      fichas_tecnicas ( nome_receita )
    `)
    .order("categoria")
    .order("nome_produto");

  if (unidadeId && unidadeId !== "matriz") query = query.eq("unidade_id", unidadeId);
  if (dept) query = query.eq("departamento", dept);

  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

export async function salvarProduto(produto) {
  if (!isSupabaseReady()) return { error: "Offline" };
  
  if (produto.id) {
    const { error } = await supabase.from("produtos").update(produto).eq("id", produto.id);
    return { error: error?.message };
  } else {
    const { error } = await supabase.from("produtos").insert([produto]);
    return { error: error?.message };
  }
}

// ─── MESAS (Mapa do Salão) ───────────────────────────────────────────────────

export async function fetchMesas(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  
  const { data, error } = await supabase.from("mesas")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("numero_mesa");
    
  return { data: data || [], error: error?.message };
}

export async function criarMesa(unidadeId, numero) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("mesas").insert([{ unidade_id: unidadeId, numero_mesa: numero }]);
  return { error: error?.message };
}

// ─── PEDIDOS E COMANDAS (PDV) ────────────────────────────────────────────────

// Busca o pedido que está "aberto" para aquela mesa
export async function fetchPedidoAberto(mesaId) {
  if (!isSupabaseReady()) return { data: null };
  
  const { data, error } = await supabase.from("pedidos")
    .select(`
      *,
      pedidos_itens (
         id, quantidade, valor_unitario, observacao, status_kds, created_at,
         produtos ( nome_produto, departamento )
      )
    `)
    .eq("mesa_id", mesaId)
    .eq("status", "aberto")
    .single();

  return { data: data || null, error: error?.message };
}

export async function abrirMesaEPedido(unidadeId, mesaId) {
  if (!isSupabaseReady()) return { error: "Offline" };
  
  // 1. Muda status da mesa
  await supabase.from("mesas").update({ status: 'ocupada' }).eq("id", mesaId);
  
  // 2. Cria o Pedido (Comanda)
  const { data, error } = await supabase.from("pedidos").insert([{
     unidade_id: unidadeId,
     mesa_id: mesaId,
     status: 'aberto',
     valor_total: 0
  }]).select().single();
  
  return { data, error: error?.message };
}

export async function lancarItemComanda(pedidoId, produtoId, valorUnitario, quantidade, obs) {
  if (!isSupabaseReady()) return { error: "Offline" };
  
  // Insere o item na mesa. Isso já joga o item direto pro KDS com status 'pendente'
  const { error } = await supabase.from("pedidos_itens").insert([{
     pedido_id: pedidoId,
     produto_id: produtoId,
     quantidade: quantidade,
     valor_unitario: valorUnitario,
     observacao: obs,
     status_kds: 'pendente'
  }]);

  return { error: error?.message };
}

export async function fecharContaDaMesa(mesaId, pedidoId) {
  if (!isSupabaseReady()) return { error: "Offline" };
  
  await supabase.from("pedidos").update({ status: 'pago' }).eq("id", pedidoId);
  await supabase.from("mesas").update({ status: 'livre' }).eq("id", mesaId);
  
  return { success: true };
}

// ─── KDS (Kitchen Display System) ────────────────────────────────────────────

export async function fetchItensKDS(unidadeId, dept) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  
  // Busca todos os itens que NÃO foram entregues, que sejam do departamento correto,
  // E que o pedido original ainda esteja "aberto"
  let query = supabase.from("pedidos_itens")
    .select(`
      id, quantidade, observacao, status_kds, created_at,
      produtos!inner ( nome_produto, departamento ),
      pedidos!inner ( id, status, mesas (numero_mesa) )
    `)
    .eq("pedidos.unidade_id", unidadeId)
    .eq("pedidos.status", "aberto")
    .neq("status_kds", "entregue")
    .order("created_at", { ascending: true }); // O mais velho primeiro

  if(dept && dept !== 'todos') {
     query = query.eq("produtos.departamento", dept);
  }

  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

export async function atualizarStatusKDS(itemId, novoStatus) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("pedidos_itens").update({ status_kds: novoStatus, updated_at: new Date().toISOString() }).eq("id", itemId);
  return { error: error?.message };
}
