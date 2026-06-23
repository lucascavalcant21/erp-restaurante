import { supabase, isSupabaseReady } from "./supabase";

export const CATEGORIAS_CUSTO = [
  { id: 'cmv', label: 'CMV (Custo de Mercadoria Vendida)', cor: 'bg-orange-500' },
  { id: 'cmo', label: 'CMO (Custo de Mão de Obra)', cor: 'bg-blue-500' },
  { id: 'custo_fixo', label: 'Custo Fixo (Aluguel, Luz, etc)', cor: 'bg-slate-600' },
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

// Baixa (Paga) uma conta
export async function pagarConta(contaId) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const dataHoje = new Date().toISOString().split('T')[0];
  const { error } = await supabase.from("contas_pagar").update({ status: 'pago', data_pagamento: dataHoje }).eq("id", contaId);
  return { error: error?.message };
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
    .select("valor, categoria")
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
  CATEGORIAS_CUSTO.forEach(c => custosPorCategoria[c.id] = 0);
  
  (contas || []).forEach(c => {
     if(custosPorCategoria[c.categoria] !== undefined) {
         custosPorCategoria[c.categoria] += Number(c.valor);
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
        custosPorCategoria
     }
  };
}

export async function fetchLancamentos() { return { data: [], error: null }; }

export const fetchDocumentos = async () => { return { data: [], error: null }; };
export const inserirDocumento = async () => { return { error: null }; };
export const atualizarDocumento = async () => { return { error: null }; };
export const removerDocumento = async () => { return { error: null }; };
export const inserirLancamento = async () => { return { error: null }; };
export const removerLancamento = async () => { return { error: null }; };
