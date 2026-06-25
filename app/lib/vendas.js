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
  const { error } = await supabase.from("mesas").insert([{ 
    unidade_id: unidadeId, 
    numero_mesa: numero,
    status: 'livre'
  }]);
  return { error: error?.message };
}

export async function deletarMesa(mesaId) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("mesas").delete().eq("id", mesaId).eq("status", "livre");
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

export async function processarBaixaEstoqueECMV(pedidoId, unidadeId) {
  if (!isSupabaseReady()) return;

  // 1. Pega os itens do pedido com as fichas e ingredientes
  const { data: itens } = await supabase.from("pedidos_itens")
    .select(`
      quantidade,
      produtos (
         departamento,
         fichas_tecnicas (
            fichas_ingredientes (
               quantidade,
               insumos ( id, custo_unitario )
            )
         )
      )
    `)
    .eq("pedido_id", pedidoId);

  if(!itens || itens.length === 0) return;

  let custoCozinha = 0;
  let custoBar = 0;
  const deducoesEstoque = {};

  // 2. Calcula as deduções e o CMV
  itens.forEach(it => {
     const ficha = it.produtos?.fichas_tecnicas;
     if(!ficha || !ficha.fichas_ingredientes) return;

     ficha.fichas_ingredientes.forEach(ing => {
        const qtdGasta = ing.quantidade * it.quantidade;
        const custoGasto = qtdGasta * ing.insumos.custo_unitario;

        // Soma para o DRE Financeiro (Separando Bar vs Cozinha)
        if(it.produtos.departamento === 'cozinha') custoCozinha += custoGasto;
        else custoBar += custoGasto;

        // Agrupa pro Estoque
        if(!deducoesEstoque[ing.insumos.id]) deducoesEstoque[ing.insumos.id] = 0;
        deducoesEstoque[ing.insumos.id] += qtdGasta;
     });
  });

  // 3. Atualiza o Estoque
  const insumosIds = Object.keys(deducoesEstoque);
  if(insumosIds.length > 0) {
     const { data: estoqueDB } = await supabase.from("estoque_atual")
        .select("insumo_id, quantidade_atual")
        .eq("unidade_id", unidadeId)
        .in("insumo_id", insumosIds);

     const atualizacoes = [];
     insumosIds.forEach(id => {
        const dbInfo = estoqueDB?.find(e => e.insumo_id === id);
        const saldoAnterior = dbInfo ? dbInfo.quantidade_atual : 0;
        atualizacoes.push({
           unidade_id: unidadeId,
           insumo_id: id,
           quantidade_atual: saldoAnterior - deducoesEstoque[id],
           updated_at: new Date().toISOString()
        });
     });

     if(atualizacoes.length > 0) {
        await supabase.from("estoque_atual").upsert(atualizacoes, { onConflict: 'unidade_id, insumo_id' });
     }
  }

  // 4. Lança o CMV no Financeiro (DRE Automático)
  const contasCMV = [];
  const hoje = new Date().toISOString().split('T')[0];

  if(custoCozinha > 0) {
     contasCMV.push({ unidade_id: unidadeId, descricao: `Baixa CMV Cozinha - Pedido`, valor: custoCozinha, data_vencimento: hoje, data_pagamento: hoje, categoria: 'cmv', status: 'pago' });
  }
  if(custoBar > 0) {
     contasCMV.push({ unidade_id: unidadeId, descricao: `Baixa CMV Bar - Pedido`, valor: custoBar, data_vencimento: hoje, data_pagamento: hoje, categoria: 'cmv', status: 'pago' });
  }

  if(contasCMV.length > 0) {
     await supabase.from("contas_pagar").insert(contasCMV);
  }
}

export async function fecharContaDaMesa(mesaId, pedidoId, unidadeId, caixaId, pagamentoData) {
  if (!isSupabaseReady()) return { error: "Offline" };
  
  await supabase.from("pedidos").update({ 
     status: 'pago',
     caixa_id: caixaId || null,
     forma_pagamento: pagamentoData?.principal || 'multiplo'
  }).eq("id", pedidoId);
  
  await supabase.from("mesas").update({ status: 'livre' }).eq("id", mesaId);

  // Insere entradas no DRE Financeiro baseadas no split
  if(pagamentoData && pagamentoData.split && unidadeId) {
     const splitEntries = pagamentoData.split.map(sp => ({
        unidade_id: unidadeId,
        descricao: `Recebimento Mesa #${mesaId} (${sp.forma}) ${pagamentoData.nome ? 'Cliente: '+pagamentoData.nome : ''}`,
        valor: sp.valor,
        tipo: 'entrada',
        categoria: 'vendas',
        status: 'pago',
        data: new Date().toISOString()
     }));
     await supabase.from("contas_pagar").insert(splitEntries);
  }
  
  // Roda a mágica da Automação (Não bloqueia a tela do usuário)
  if(unidadeId) {
     processarBaixaEstoqueECMV(pedidoId, unidadeId).catch(console.error);
  }
  
  return { success: true };
}

export async function lancarVendaBalcao(unidadeId, caixaId, itensCart, pagamentoData) {
  if (!isSupabaseReady()) return { error: "Offline" };

  const subtotal = itensCart.reduce((acc, it) => acc + (it.preco_venda * it.quantidade), 0);
  const desconto = pagamentoData?.desconto || 0;
  const taxa = pagamentoData?.taxa || 0;
  const valorTotal = subtotal - desconto + taxa;

  // 1. Cria o Pedido (Comanda Direta) com status 'pago'
  const { data: pedido, error: errPed } = await supabase.from("pedidos").insert([{
     unidade_id: unidadeId,
     status: 'pago',
     valor_total: valorTotal,
     tipo_pedido: 'balcao',
     forma_pagamento: pagamentoData?.principal || 'multiplo',
     caixa_id: caixaId
  }]).select().single();

  if (errPed) return { error: errPed.message };

  // 2. Cria os Itens
  const itensDB = itensCart.map(it => ({
     pedido_id: pedido.id,
     produto_id: it.id,
     quantidade: it.quantidade,
     valor_unitario: it.preco_venda,
     observacao: it.observacao || '',
     status_kds: it.departamento === 'cozinha' ? 'pendente' : 'entregue'
  }));

  const { error: errItens } = await supabase.from("pedidos_itens").insert(itensDB);
  if (errItens) return { error: errItens.message };

  // 3. Financeiro: Adicionar em contas_pagar (Entrada) baseada no Split
  if(pagamentoData && pagamentoData.split) {
     const splitEntries = pagamentoData.split.map(sp => ({
        unidade_id: unidadeId,
        descricao: `Venda Balcão #${pedido.id.substring(0,6)} (${sp.forma}) ${pagamentoData.nome ? 'Cliente: '+pagamentoData.nome : ''} ${pagamentoData.cpf ? 'CPF: '+pagamentoData.cpf : ''}`,
        valor: sp.valor,
        tipo: 'entrada',
        categoria: 'vendas',
        status: 'pago',
        data: new Date().toISOString()
     }));
     await supabase.from("contas_pagar").insert(splitEntries);
  } else {
     // Fallback
     await supabase.from("contas_pagar").insert([{
        unidade_id: unidadeId,
        descricao: `Venda Balcão #${pedido.id.substring(0,6)}`,
        valor: valorTotal,
        tipo: 'entrada',
        categoria: 'vendas',
        status: 'pago',
        data: new Date().toISOString()
     }]);
  }

  // 4. Baixa de Estoque
  processarBaixaEstoqueECMV(pedido.id, unidadeId).catch(console.error);

  return { data: pedido, error: null };
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

// ─── DELIVERY E AUTO-ATENDIMENTO (Pedidos Online) ────────────────────────────

// Usado pelo app/cardapio/[unidadeId] para enviar o pedido
export async function enviarPedidoOnline(unidadeId, dadosCliente, itensCart) {
  if (!isSupabaseReady()) return { error: "Offline" };
  
  // 1. Cria o Pedido com status 'novo_online'
  const valorTotal = itensCart.reduce((acc, it) => acc + (it.preco_venda * it.quantidade), 0);
  
  const { data: pedido, error: errPed } = await supabase.from("pedidos").insert([{
     unidade_id: unidadeId,
     status: 'novo_online',
     tipo_pedido: dadosCliente.tipo, // 'delivery' ou 'qrcode'
     cliente_nome: dadosCliente.nome,
     cliente_telefone: dadosCliente.telefone,
     endereco_entrega: dadosCliente.endereco || null,
     troco_para: dadosCliente.troco || null,
     valor_total: valorTotal
  }]).select().single();

  if (errPed) return { error: errPed.message };

  // 2. Insere os itens com status 'aguardando_aceite' (Pra não cair no KDS ainda)
  const insertsItens = itensCart.map(it => ({
     pedido_id: pedido.id,
     produto_id: it.id,
     quantidade: it.quantidade,
     valor_unitario: it.preco_venda,
     observacao: it.observacao || "",
     status_kds: 'aguardando_aceite'
  }));

  const { error: errItens } = await supabase.from("pedidos_itens").insert(insertsItens);
  return { error: errItens?.message, pedidoId: pedido.id };
}

// Usado pelo Dashboard do Restaurante para ver os pedidos que chegaram
export async function fetchPedidosOnlinePendentes(unidadeId) {
  if (!isSupabaseReady()) return { data: [] };
  
  const { data, error } = await supabase.from("pedidos")
    .select(`
      *,
      pedidos_itens (
         id, quantidade, valor_unitario, observacao,
         produtos ( nome_produto, departamento )
      )
    `)
    .eq("unidade_id", unidadeId)
    .eq("status", "novo_online")
    .order("created_at", { ascending: true });

  return { data: data || [], error: error?.message };
}

// Quando o caixa clica em "Aceitar"
export async function aceitarPedidoOnline(pedidoId) {
  if (!isSupabaseReady()) return { error: "Offline" };
  
  // 1. Muda status do pedido para 'aberto' (ou 'preparando_delivery')
  await supabase.from("pedidos").update({ status: 'preparando_delivery', updated_at: new Date().toISOString() }).eq("id", pedidoId);
  
  // 2. Libera os itens pro KDS (muda de 'aguardando_aceite' para 'pendente')
  await supabase.from("pedidos_itens").update({ status_kds: 'pendente', updated_at: new Date().toISOString() }).eq("pedido_id", pedidoId);
  
  return { success: true };
}

// Quando o caixa recusa
export async function recusarPedidoOnline(pedidoId) {
  if (!isSupabaseReady()) return { error: "Offline" };
  
  await supabase.from("pedidos").update({ status: 'cancelado', updated_at: new Date().toISOString() }).eq("id", pedidoId);
  await supabase.from("pedidos_itens").update({ status_kds: 'cancelado', updated_at: new Date().toISOString() }).eq("pedido_id", pedidoId);
  
  return { success: true };
}

// Quando o pedido delivery é entregue e pago
export async function fecharPedidoOnline(pedidoId, unidadeId) {
  if (!isSupabaseReady()) return { error: "Offline" };
  
  await supabase.from("pedidos").update({ status: 'pago', updated_at: new Date().toISOString() }).eq("id", pedidoId);
  
  // Baixa o estoque e joga pro CMV
  if(unidadeId) {
     processarBaixaEstoqueECMV(pedidoId, unidadeId).catch(console.error);
  }
  
  return { success: true };
}


export async function registrarVenda() { return { success: true }; }
export async function fetchVendas() { return { data: [], error: null }; }
