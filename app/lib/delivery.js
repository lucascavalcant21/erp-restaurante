// ═══════════════════════════════════════════════════════════════
// delivery.js — Motor do Cardápio Digital (App de Delivery)
// ═══════════════════════════════════════════════════════════════

import { supabase, isSupabaseReady } from "./supabase";

// 1. Catálogo de Produtos da Loja (Para clientes)
export async function fetchCardapioDigital(lojaSlug) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  
  // Primeiro tentamos achar a unidade pelo slug (nome). Se não achar, usa como ID genérico.
  // Como simplificação, estamos puxando do cardápio normal.
  const { data, error } = await supabase
    .from("cardapio")
    .select("*")
    .eq("ativo", true)
    .order("categoria");
    
  return { data: data || [], error: error?.message };
}

// 2. Integração com a API do Google Maps para Distância
export async function calcularTaxaEntrega(enderecoOrigem, enderecoDestinoCEP) {
  // Nota: Aqui entraria a chamada real para o Google Maps Distance Matrix API:
  // fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origem}&destinations=${destino}&key=CHAVE_AQUI`)
  
  // SIMULAÇÃO DA API: 
  // Para fins de testes antes de você inserir sua chave real do Google Maps,
  // vamos simular um retorno baseado no tamanho do CEP só para demonstrar o cálculo.
  const distanceKm = (Math.random() * 8 + 1).toFixed(1); // 1 a 9 km
  
  // Regra de precificação de entrega (Ex: R$ 5 fixo + R$ 1,50 por KM)
  const taxaEntrega = 5.0 + (parseFloat(distanceKm) * 1.5);
  
  return {
    distanciaKm: parseFloat(distanceKm),
    taxaReais: parseFloat(taxaEntrega.toFixed(2)),
  };
}

// 3. Integração com o PagSeguro
export async function gerarCheckoutPagSeguro(pedido) {
  // Nota: Chamada real à API do PagSeguro (ex: criacao de PIX ou link de pagamento)
  // Requer credenciais no header (Authorization: Bearer SEU_TOKEN_PAGSEGURO)
  
  // SIMULAÇÃO: Retornamos um Link ou Copia e Cola falso para o checkout não travar.
  return {
    sucesso: true,
    metodo: pedido.formaPagamento, // PIX ou CARTAO
    pixCopiaECola: "00020126580014br.gov.bcb.pix0136abc-1234-pagseguro-simulacao...",
    linkCheckout: "https://pagseguro.uol.com.br/checkout/simulacao-hefisto",
  };
}

// 4. CRM & Gamificação: Adicionar Pontos e Nível
export async function aplicarPontosFogo(clienteTelefone, nome, valorCompra) {
  if (!isSupabaseReady() || !clienteTelefone) return null;
  
  // Busca se o cliente já existe na base de clientes (CRM)
  const { data: clienteExistente } = await supabase
    .from("clientes")
    .select("*")
    .eq("telefone", clienteTelefone)
    .maybeSingle();

  let pontosGanhos = Math.floor(valorCompra); // 1 ponto por real

  if (clienteExistente) {
    // Atualiza
    const novosPontos = (clienteExistente.pontos || 0) + pontosGanhos;
    await supabase.from("clientes").update({ pontos: novosPontos }).eq("id", clienteExistente.id);
    return { pontosTotais: novosPontos, ganhos: pontosGanhos };
  } else {
    // Cria novo cliente
    await supabase.from("clientes").insert([{
      nome: nome || "Cliente Delivery",
      telefone: clienteTelefone,
      pontos: pontosGanhos,
    }]);
    return { pontosTotais: pontosGanhos, ganhos: pontosGanhos };
  }
}

// 5. Salvar o Pedido no KDS (Cozinha)
export async function finalizarPedidoDelivery(pedido, carrinho, unidadeId) {
  if (!isSupabaseReady()) return { error: "Sistema offline" };

  // 1. Aplica a Gamificação
  const gamificacao = await aplicarPontosFogo(pedido.telefone, pedido.nome, pedido.total);

  // 2. Prepara os itens do carrinho para o KDS (mesma estrutura que o salão usa)
  const itemsCozinha = carrinho.map(item => ({
    produto_id: item.id,
    nome: item.nome,
    qtd: item.qtd,
    preco: item.preco,
    obs: item.obs || "",
    status: "Fila", // Status inicial para o KDS
  }));

  // 3. Monta o registro de pedido (delivery)
  const novoPedido = {
    mesa: "DELIVERY - " + pedido.nome, 
    unidade_id: unidadeId,
    status: "Aberto", // Em aberto até ser despachado
    itens: itemsCozinha,
    total: pedido.total,
    obs: `Endereço: ${pedido.endereco} | Pagamento: ${pedido.pagamento} | Taxa: R$ ${pedido.taxaEntrega}`,
  };

  const { data, error } = await supabase.from("pedidos").insert([novoPedido]).select().single();

  return { ok: !error, pedidoId: data?.id, error: error?.message, gamificacao };
}

// ═══════════════════════════════════════════════════════════════
// INTEGRAÇÃO REAL SUPABASE: MOTOBOYS & CONFIGS
// ═══════════════════════════════════════════════════════════════

export async function fetchDeliveryConfigs(unidadeId) {
  if (!isSupabaseReady()) return { data: null, error: "Offline" };
  const { data, error } = await supabase
    .from("delivery_configs")
    .select("*")
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  return { data, error: error?.message };
}

export async function salvarDeliveryConfigs(unidadeId, configs) {
  if (!isSupabaseReady()) return { error: "Offline" };
  
  // Tenta ver se já existe
  const { data: existe } = await supabase
    .from("delivery_configs")
    .select("id")
    .eq("unidade_id", unidadeId)
    .maybeSingle();

  const payload = {
    unidade_id: unidadeId,
    raio_km: configs.raio_km,
    taxa_base: configs.taxa_base,
    taxa_por_km: configs.taxa_por_km,
    tempo_min: configs.tempo_min,
    tempo_max: configs.tempo_max,
    status_loja: configs.status_loja || 'aberto'
  };

  if (existe) {
    const { error } = await supabase.from("delivery_configs").update(payload).eq("id", existe.id);
    return { error: error?.message };
  } else {
    const { error } = await supabase.from("delivery_configs").insert([payload]);
    return { error: error?.message };
  }
}

export async function fetchMotoboys(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  const { data, error } = await supabase
    .from("motoboys")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("nome");
  return { data: data || [], error: error?.message };
}

export async function salvarMotoboy(unidadeId, motoboy) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const payload = {
    unidade_id: unidadeId,
    nome: motoboy.nome,
    telefone: motoboy.telefone,
    placa: motoboy.placa,
    status: motoboy.status || "offline"
  };

  if (motoboy.id && typeof motoboy.id === 'string' && motoboy.id.length > 10) {
    // Update (assuming UUID)
    const { error } = await supabase.from("motoboys").update(payload).eq("id", motoboy.id);
    return { error: error?.message };
  } else {
    // Insert
    const { error } = await supabase.from("motoboys").insert([payload]);
    return { error: error?.message };
  }
}

export async function removerMotoboy(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("motoboys").delete().eq("id", id);
  return { error: error?.message };
}
