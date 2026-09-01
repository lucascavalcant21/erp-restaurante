import { supabase, isSupabaseReady } from "./supabase";

export const CATEGORIAS_CUSTO = [
  { id: 'cmv', label: 'CMV (Custo de Mercadoria Vendida)', cor: 'bg-orange-500' },
  { id: 'cmo', label: 'CMO (Custo de Mão de Obra)', cor: 'bg-blue-500' },
  { id: 'custo_fixo', label: 'Custo Fixo (Aluguel, Luz, etc)', cor: 'bg-slate-600' },
  { id: 'custo_variavel', label: 'Custos Variáveis', cor: 'bg-violet-500' },
  { id: 'frete', label: 'Fretes e Entregas', cor: 'bg-teal-500' },
  { id: 'limpeza', label: 'Materiais de Limpeza', cor: 'bg-cyan-500' },
  { id: 'marketing', label: 'Custo Marketing', cor: 'bg-pink-500' },
  { id: 'investimento', label: 'Investimentos', cor: 'bg-emerald-500' },
  { id: 'inventarios', label: 'Inventários / Quebras', cor: 'bg-red-500' },
  { id: 'impostos', label: 'Impostos e Taxas', cor: 'bg-amber-500' },
  { id: 'retirada_socio', label: 'Retirada de Sócios (Lucro)', cor: 'bg-indigo-500' }
];

// Busca todas as contas a pagar de um determinado mês/status
export async function fetchContas(unidadeId, mesAno) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  
  // Para simplificar no MVP, trazemos tudo ordenado por data_vencimento
  // O ideal seria filtrar por mês (ex: '2026-06')
  const { data, error } = await supabase.from("contas_pagar")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("data_vencimento", { ascending: true });
    
  return { data: data || [], error: error?.message };
}

// Salva uma nova conta ou edita
export async function salvarConta(conta) {
  if (!isSupabaseReady()) return { error: "Offline" };
  
  if (conta.id) {
    const { error } = await supabase.from("contas_pagar").update(conta).eq("id", conta.id);
    return { error: error?.message };
  } else {
    const { error } = await supabase.from("contas_pagar").insert([conta]);
    return { error: error?.message };
  }
}

// Contas recorrentes (aluguel, luz...): ao abrir a tela de contas, recria no
// mês atual as marcadas como recorrentes que ainda não existem neste mês
// (dedup por descrição), mantendo o dia do vencimento.
export async function gerarContasRecorrentes(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { criadas: 0 };
  const { data: recorrentes, error } = await supabase.from("contas_pagar")
    .select("*")
    .eq("unidade_id", unidadeId)
    .eq("recorrente", true)
    .order("data_vencimento", { ascending: false });
  if (error || !recorrentes?.length) return { criadas: 0, error: error?.message };

  const mesAtual = new Date().toISOString().slice(0, 7);
  // A instância mais recente de cada descrição é o modelo
  const porDesc = {};
  recorrentes.forEach(c => { if (!porDesc[c.descricao]) porDesc[c.descricao] = c; });

  let criadas = 0;
  for (const c of Object.values(porDesc)) {
    const mesConta = String(c.data_vencimento || "").slice(0, 7);
    if (mesConta >= mesAtual) continue; // já existe neste mês (ou é futura)
    const [ano, mes] = mesAtual.split("-").map(Number);
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const dia = Math.min(Number(String(c.data_vencimento || "").slice(8, 10)) || 5, ultimoDia);
    const { error: errIns } = await supabase.from("contas_pagar").insert([{
      unidade_id: unidadeId,
      descricao: c.descricao,
      valor: c.valor,
      data_vencimento: `${mesAtual}-${String(dia).padStart(2, "0")}`,
      categoria: c.categoria,
      status: "pendente",
      recorrente: true,
    }]);
    if (!errIns) criadas++;
  }
  return { criadas };
}

// Baixa (Paga) uma conta
export async function pagarConta(contaId) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const dataHoje = new Date().toISOString().split('T')[0];
  const { error } = await supabase.from("contas_pagar").update({ status: 'pago', data_pagamento: dataHoje }).eq("id", contaId);
  return { error: error?.message };
}

export async function removerConta(contaId) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("contas_pagar").delete().eq("id", contaId);
  return { error: error?.message || null };
}

// Painel unificado do caixa: vendas do PDV novo + pedidos pagos do módulo de
// salão/balcão legado. Cada origem é normalizada no mesmo formato para não
// perder histórico durante a transição entre as duas telas.
export async function fetchPainelCaixa(unidadeId, inicioIso, fimIso) {
  if (!isSupabaseReady()) return { data: { vendas: [], despesas: [] }, error: "Offline" };

  let vendasQuery = supabase.from("vendas")
    .select("id,total,subtotal,desconto,forma_pagamento,cliente,status,created_at,venda_itens(id,nome,quantidade,preco_unit,subtotal,custo_unit)")
    .eq("unidade_id", unidadeId)
    .neq("status", "cancelada")
    .gte("created_at", inicioIso)
    .lt("created_at", fimIso)
    .order("created_at", { ascending: false });

  let pedidosQuery = supabase.from("pedidos")
    .select("id,valor_total,forma_pagamento,tipo_pedido,identificacao,cliente_nome,status,created_at,pedidos_itens(id,quantidade,valor_unitario,produtos(nome_produto,departamento,categoria))")
    .eq("unidade_id", unidadeId)
    .eq("status", "pago")
    .gte("created_at", inicioIso)
    .lt("created_at", fimIso)
    .order("created_at", { ascending: false });

  const [resVendas, resPedidos, resDespesas, resProdutos] = await Promise.all([
    vendasQuery,
    pedidosQuery,
    supabase.from("contas_pagar").select("*").eq("unidade_id", unidadeId).order("data_vencimento", { ascending: false }),
    supabase.from("produtos").select("nome_produto,departamento,categoria").eq("unidade_id", unidadeId),
  ]);

  const chaveNome = valor => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const setorPorNome = new Map((resProdutos.data || []).map(produto => [chaveNome(produto.nome_produto), produto]));
  const setorDoProduto = produto => {
    const departamento = String(produto?.departamento || "").toLowerCase();
    if (departamento.includes("bar")) return "bar";
    if (departamento.includes("cozinha")) return "cozinha";
    const texto = chaveNome(`${produto?.categoria || ""} ${produto?.nome_produto || produto?.nome || ""}`);
    return /(drink|bebida|cerveja|vinho|whisk|vodka|gin|rum|tequila|suco|refrigerante|agua|chopp)/.test(texto) ? "bar" : "cozinha";
  };

  const vendasNovas = (resVendas.data || []).map(venda => ({
    id: venda.id,
    total: Number(venda.total) || 0,
    forma_pagamento: venda.forma_pagamento || "nao_informado",
    cliente: venda.cliente || "Balcão",
    origem: "PDV",
    created_at: venda.created_at,
    itens: (venda.venda_itens || []).map(item => ({
      nome: item.nome || "Item", quantidade: Number(item.quantidade) || 0,
      valor_unitario: Number(item.preco_unit) || 0, custo_unitario: Number(item.custo_unit) || 0,
      setor: setorDoProduto({ nome_produto: item.nome, ...(setorPorNome.get(chaveNome(item.nome)) || {}) }),
    })),
  }));

  const pedidosAntigos = (resPedidos.data || []).map(pedido => ({
    id: pedido.id,
    total: Number(pedido.valor_total) || (pedido.pedidos_itens || []).reduce((s, item) => s + Number(item.valor_unitario || 0) * Number(item.quantidade || 0), 0),
    forma_pagamento: pedido.forma_pagamento || "nao_informado",
    cliente: pedido.cliente_nome || pedido.identificacao || "Cliente",
    origem: pedido.tipo_pedido || "Salão",
    created_at: pedido.created_at,
    itens: (pedido.pedidos_itens || []).map(item => ({
      nome: item.produtos?.nome_produto || "Item", quantidade: Number(item.quantidade) || 0,
      valor_unitario: Number(item.valor_unitario) || 0, custo_unitario: 0,
      setor: setorDoProduto(item.produtos || {}),
    })),
  }));

  const inicio = new Date(inicioIso).getTime();
  const fim = new Date(fimIso).getTime();
  const despesas = (resDespesas.data || []).filter(conta => {
    const data = new Date(conta.data_pagamento || conta.data_vencimento || conta.created_at).getTime();
    return Number.isFinite(data) && data >= inicio && data < fim;
  });

  const erros = [resVendas.error, resPedidos.error, resDespesas.error, resProdutos.error].filter(Boolean).map(e => e.message).join(" · ");
  return { data: { vendas: [...vendasNovas, ...pedidosAntigos].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), despesas }, error: erros || null };
}

// Entradas físicas registradas no estoque. O Financeiro usa estas compras
// para formar o CMV realizado do período sem pedir um segundo lançamento.
export async function fetchEntradasEstoqueFinanceiro(unidadeId, inicioIso, fimIso) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [], error: null };
  const base = () => supabase.from("estoque_movimentacoes_multi")
    .eq("unidade_id", unidadeId)
    .eq("tipo", "entrada")
    .gte("data_movimento", inicioIso)
    .lt("data_movimento", fimIso)
    .order("data_movimento", { ascending: false });

  let resposta = await base().select("id,estoque_id,insumo_id,tipo,quantidade,valor_total,valor_unitario,data_movimento,insumo:insumos(nome,custo_unitario,custo_compra)");
  if (resposta.error && /valor_total|valor_unitario/i.test(resposta.error.message || "")) {
    resposta = await base().select("id,estoque_id,insumo_id,tipo,quantidade,data_movimento,insumo:insumos(nome,custo_unitario,custo_compra)");
  }
  return { data: resposta.data || [], error: resposta.error?.message || null };
}

// ============================================================================
// MOTOR DE DRE (Demonstrativo de Resultados) E DASHBOARD
// ============================================================================

export async function fetchDRE(unidadeId) {
  if (!isSupabaseReady()) return { data: null, error: "Offline" };
  
  // 1. Busca todo o FATURAMENTO (Pedidos Pagos)
  const { data: pedidos } = await supabase.from("pedidos")
    .select("valor_total, tipo_pedido, forma_pagamento")
    .eq("unidade_id", unidadeId)
    .eq("status", "pago");

  // 2. Busca todos os CUSTOS (Contas Pagas)
  const { data: contas } = await supabase.from("contas_pagar")
    .select("id, descricao, valor, categoria, data_pagamento")
    .eq("unidade_id", unidadeId)
    .eq("status", "pago");

  // -- Cálculos do Faturamento --
  const faturamentoTotal = (pedidos || []).reduce((acc, p) => acc + Number(p.valor_total), 0);
  
  const fatPorCanal = { salao: 0, delivery: 0, qrcode: 0 };
  const fatPorPagamento = { pix: 0, credito: 0, debito: 0, dinheiro: 0, nao_informado: 0 };
  
  (pedidos || []).forEach(p => {
     if(fatPorCanal[p.tipo_pedido] !== undefined) fatPorCanal[p.tipo_pedido] += Number(p.valor_total);
     if(fatPorPagamento[p.forma_pagamento] !== undefined) fatPorPagamento[p.forma_pagamento] += Number(p.valor_total);
  });

  // -- Cálculos de Despesas --
  const custosPorCategoria = {};
  const detalhesPorCategoria = {};
  CATEGORIAS_CUSTO.forEach(c => {
      custosPorCategoria[c.id] = 0;
      detalhesPorCategoria[c.id] = [];
  });
  
  (contas || []).forEach(c => {
     if(custosPorCategoria[c.categoria] !== undefined) {
         custosPorCategoria[c.categoria] += Number(c.valor);
         detalhesPorCategoria[c.categoria].push(c);
     }
  });

  const totalCustos = (contas || []).reduce((acc, c) => acc + Number(c.valor), 0);
  const lucroLiquido = faturamentoTotal - totalCustos;
  const margem = faturamentoTotal > 0 ? ((lucroLiquido / faturamentoTotal) * 100).toFixed(1) : 0;

  return {
     data: {
        faturamentoTotal,
        totalCustos,
        lucroLiquido,
        margem,
        fatPorCanal,
        fatPorPagamento,
        custosPorCategoria,
        detalhesPorCategoria
     }
  };
}

// ============================================================================
// FLUXO DE CAIXA (Lançamentos manuais + entradas automáticas de venda)
// Tabela `lancamentos` — ver migração em supabase_lancamentos.sql
// ============================================================================

export async function fetchLancamentos(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  let query = supabase.from("lancamentos").select("*").order("data", { ascending: false });
  if (unidadeId) query = query.eq("unidade_id", unidadeId);
  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

export async function inserirLancamento(dados, unidadeId) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const payload = {
    unidade_id: unidadeId,
    tipo: dados.tipo,                 // 'entrada' | 'saida'
    categoria: dados.categoria || null,
    descricao: dados.descricao || null,
    valor: Number(dados.valor) || 0,
    data: dados.data || new Date().toISOString(),
  };
  const { data, error } = await supabase.from("lancamentos").insert([payload]).select().single();
  return { data, error: error?.message };
}

export async function removerLancamento(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("lancamentos").delete().eq("id", id);
  return { error: error?.message };
}

export const fetchDocumentos = async () => { return { data: [], error: null }; };
export const inserirDocumento = async () => { return { error: null }; };
export const atualizarDocumento = async () => { return { error: null }; };
export const removerDocumento = async () => { return { error: null }; };
