import { supabase, isSupabaseReady } from "./supabase.js";
import {
  dividirParcelasExatas,
  calcularStatusConta,
  calcularValoresPagamento,
  montarDREGerencial,
  montarFluxoCaixaPrevistoERealizado
} from "./financeiro-domain.js";

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

// ─── CONTAS FINANCEIRAS (BANCOS E CAIXAS) ──────────────────────────────────

export async function fetchContasFinanceiras(unidadeId) {
  if (!isSupabaseReady() || !unidadeId) return { data: [], error: null };
  const { data, error } = await supabase
    .from("contas_financeiras")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("nome");

  if (error && error.code === "42P01") {
    // Retorna conta caixa padrão em fallback se a tabela não existir
    return {
      data: [{ id: "caixa_padrao", unidade_id: unidadeId, nome: "Caixa Restaurante", tipo: "caixa", saldo_atual: 0 }],
      error: null
    };
  }
  return { data: data || [], error: error?.message || null };
}

export async function salvarContaFinanceira(contaFinanceira, unidadeId) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const payload = {
    unidade_id: unidadeId,
    nome: contaFinanceira.nome,
    tipo: contaFinanceira.tipo || "banco",
    saldo_inicial: Number(contaFinanceira.saldo_inicial) || 0,
    saldo_atual: Number(contaFinanceira.saldo_atual) || Number(contaFinanceira.saldo_inicial) || 0,
    ativo: true
  };

  if (contaFinanceira.id) {
    const { error } = await supabase.from("contas_financeiras").update(payload).eq("id", contaFinanceira.id);
    return { error: error?.message || null };
  } else {
    const { data, error } = await supabase.from("contas_financeiras").insert([payload]).select().single();
    return { data, error: error?.message || null };
  }
}

// ─── CONTAS A PAGAR ──────────────────────────────────────────────────────────

export async function fetchContas(unidadeId) {
  if (!isSupabaseReady() || !unidadeId) return { data: [], error: "Offline" };
  const { data, error } = await supabase
    .from("contas_pagar")
    .select("*, fornecedor:fornecedores(id, nome, telefone)")
    .eq("unidade_id", unidadeId)
    .order("data_vencimento", { ascending: true });

  if (error) return { data: [], error: error.message };

  const formatado = (data || []).map(c => ({
    ...c,
    status_calculado: calcularStatusConta(c)
  }));

  return { data: formatado, error: null };
}

export async function salvarConta(conta) {
  if (!isSupabaseReady()) return { error: "Offline" };

  const valOrig = Number(conta.valor_original ?? conta.valor) || 0;
  const numParcelas = Math.max(1, parseInt(conta.total_parcelas) || 1);

  // Se for uma alteração de conta existente
  if (conta.id) {
    const patch = {
      descricao: conta.descricao,
      fornecedor_id: conta.fornecedor_id || null,
      categoria: conta.categoria || "custo_fixo",
      centro_custo: conta.centro_custo || "geral",
      numero_documento: conta.numero_documento || null,
      valor: valOrig,
      valor_original: valOrig,
      data_vencimento: conta.data_vencimento,
      competencia: conta.competencia || conta.data_vencimento,
      forma_pagamento: conta.forma_pagamento || "pix",
      conta_financeira_id: conta.conta_financeira_id || null,
      observacao: conta.observacao || null,
      anexo_url: conta.anexo_url || null,
      recorrente: !!conta.recorrente
    };
    const { error } = await supabase.from("contas_pagar").update(patch).eq("id", conta.id);
    return { error: error?.message || null };
  }

  // Se for um novo lançamento com parcelamento
  if (numParcelas > 1) {
    const grupoId = crypto.randomUUID();
    const parcelas = dividirParcelasExatas(valOrig, numParcelas, conta.data_vencimento);

    const registros = parcelas.map(p => ({
      unidade_id: conta.unidade_id,
      documento_grupo_id: grupoId,
      descricao: `${conta.descricao} (${p.parcela_numero}/${p.total_parcelas})`,
      fornecedor_id: conta.fornecedor_id || null,
      categoria: conta.categoria || "custo_fixo",
      centro_custo: conta.centro_custo || "geral",
      numero_documento: conta.numero_documento || null,
      valor: p.valor,
      valor_original: p.valor,
      valor_pago: 0,
      saldo: p.valor,
      data_vencimento: p.data_vencimento,
      competencia: conta.competencia || conta.data_vencimento,
      forma_pagamento: conta.forma_pagamento || "pix",
      conta_financeira_id: conta.conta_financeira_id || null,
      status: "PENDENTE",
      parcela_numero: p.parcela_numero,
      total_parcelas: p.total_parcelas,
      origem_tipo: conta.origem_tipo || "MANUAL",
      origem_id: conta.origem_id || null,
      observacao: conta.observacao || null,
      anexo_url: conta.anexo_url || null,
      recorrente: false
    }));

    const { error } = await supabase.from("contas_pagar").insert(registros);
    return { error: error?.message || null };
  }

  // Lançamento único (1 parcela)
  const registroUnico = {
    unidade_id: conta.unidade_id,
    descricao: conta.descricao,
    fornecedor_id: conta.fornecedor_id || null,
    categoria: conta.categoria || "custo_fixo",
    centro_custo: conta.centro_custo || "geral",
    numero_documento: conta.numero_documento || null,
    valor: valOrig,
    valor_original: valOrig,
    valor_pago: 0,
    saldo: valOrig,
    data_vencimento: conta.data_vencimento,
    competencia: conta.competencia || conta.data_vencimento,
    forma_pagamento: conta.forma_pagamento || "pix",
    conta_financeira_id: conta.conta_financeira_id || null,
    status: "PENDENTE",
    parcela_numero: 1,
    total_parcelas: 1,
    origem_tipo: conta.origem_tipo || "MANUAL",
    origem_id: conta.origem_id || null,
    observacao: conta.observacao || null,
    anexo_url: conta.anexo_url || null,
    recorrente: !!conta.recorrente
  };

  const { error } = await supabase.from("contas_pagar").insert([registroUnico]);
  return { error: error?.message || null };
}

export async function gerarContasRecorrentes(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { criadas: 0 };
  const { data: recorrentes, error } = await supabase.from("contas_pagar")
    .select("*")
    .eq("unidade_id", unidadeId)
    .eq("recorrente", true)
    .order("data_vencimento", { ascending: false });

  if (error || !recorrentes?.length) return { criadas: 0, error: error?.message };

  const mesAtual = new Date().toISOString().slice(0, 7);
  const porDesc = {};
  recorrentes.forEach(c => { if (!porDesc[c.descricao]) porDesc[c.descricao] = c; });

  let criadas = 0;
  for (const c of Object.values(porDesc)) {
    const mesConta = String(c.data_vencimento || "").slice(0, 7);
    if (mesConta >= mesAtual) continue;
    const [ano, mes] = mesAtual.split("-").map(Number);
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const dia = Math.min(Number(String(c.data_vencimento || "").slice(8, 10)) || 5, ultimoDia);
    const dataVenc = `${mesAtual}-${String(dia).padStart(2, "0")}`;

    const { error: errIns } = await supabase.from("contas_pagar").insert([{
      unidade_id: unidadeId,
      descricao: c.descricao,
      fornecedor_id: c.fornecedor_id || null,
      valor: c.valor,
      valor_original: c.valor,
      valor_pago: 0,
      saldo: c.valor,
      data_vencimento: dataVenc,
      competencia: dataVenc,
      categoria: c.categoria,
      centro_custo: c.centro_custo || "geral",
      status: "PENDENTE",
      origem_tipo: "RECORRENTE",
      recorrente: true,
    }]);
    if (!errIns) criadas++;
  }
  return { criadas };
}

// ─── PAGAMENTOS E LIQUIDAÇÕES (ATÔMICA COM RPC) ──────────────────────────────

export async function pagarConta(contaId, opcoes = {}) {
  if (!isSupabaseReady()) return { error: "Offline" };

  // Se opcoes for apenas o ID da unidade ou objeto completo
  const conta = typeof opcoes === "object" ? opcoes : { id: contaId };
  const unidadeId = conta.unidade_id || opcoes.unidadeId;
  const valorPago = Number(conta.valor_pago_agora ?? conta.valor_pago ?? conta.valor) || 0;
  const juros = Number(conta.juros) || 0;
  const multa = Number(conta.multa) || 0;
  const desconto = Number(conta.desconto) || 0;
  const forma = conta.forma_pagamento || "pix";
  const contaFinId = conta.conta_financeira_id || null;
  const obs = conta.observacao || null;
  const user = conta.usuario_nome || "Operador ERP";

  // Tenta via RPC atômica
  const { data, error } = await supabase.rpc("registrar_pagamento_conta", {
    p_conta_pagar_id: contaId,
    p_unidade_id: unidadeId,
    p_valor_pago: valorPago,
    p_juros: juros,
    p_multa: multa,
    p_desconto: desconto,
    p_data_pagamento: conta.data_pagamento ? new Date(conta.data_pagamento).toISOString() : new Date().toISOString(),
    p_forma_pagamento: forma,
    p_conta_financeira_id: contaFinId,
    p_observacao: obs,
    p_usuario_nome: user,
    p_chave_idempotencia: conta.chave_idempotencia || null
  });

  if (error) {
    // Fallback caso a RPC ainda não esteja instalada no Supabase remoto
    console.warn("RPC registrar_pagamento_conta ausente/falhou, executando fallback JS:", error.message);
    const dataHoje = new Date().toISOString().split('T')[0];
    const { error: errUpd } = await supabase.from("contas_pagar").update({ status: 'PAGA', valor_pago: valorPago, saldo: 0, data_pagamento: dataHoje }).eq("id", contaId);
    return { error: errUpd?.message || null };
  }

  return { success: true, data };
}

export async function estornarPagamento(pagamentoId, unidadeId, motivo = "Estorno manual") {
  if (!isSupabaseReady()) return { error: "Offline" };

  const { data, error } = await supabase.rpc("estornar_pagamento_conta", {
    p_pagamento_id: pagamentoId,
    p_unidade_id: unidadeId,
    p_motivo: motivo,
    p_usuario_nome: "Operador ERP"
  });

  if (error) return { error: error.message };
  return { success: true, data };
}

export async function fetchHistoricoPagamentos(contaId) {
  if (!isSupabaseReady() || !contaId) return { data: [], error: null };
  const { data, error } = await supabase
    .from("contas_pagar_pagamentos")
    .select("*, conta_financeira:contas_financeiras(id, nome)")
    .eq("conta_pagar_id", contaId)
    .order("created_at", { ascending: false });

  if (error && error.code === "42P01") return { data: [], error: null };
  return { data: data || [], error: error?.message || null };
}

export async function removerConta(contaId) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("contas_pagar").delete().eq("id", contaId);
  return { error: error?.message || null };
}

// ─── DRE E FLUXO DE CAIXA DE ALTA PERFORMANCE ──────────────────────────────

export async function fetchDRE(unidadeId) {
  if (!isSupabaseReady()) return { data: null, error: "Offline" };

  const [resVendas, resContas, resColab, resRecibos] = await Promise.all([
    supabase.from("vendas").select("total, status").eq("unidade_id", unidadeId).neq("status", "cancelada"),
    supabase.from("contas_pagar").select("*").eq("unidade_id", unidadeId),
    supabase.from("colaboradores").select("salario_base").eq("unidade_id", unidadeId),
    supabase.from("rh_recibos_prestacao").select("valor_total, pagamento_realizado").eq("unidade_id", unidadeId).eq("pagamento_realizado", true)
  ]);

  const faturamentoTotal = (resVendas.data || []).reduce((s, v) => s + Number(v.total || 0), 0);
  const folha = (resColab.data || []).reduce((s, c) => s + Number(c.salario_base || 0), 0);
  const extras = (resRecibos.data || []).reduce((s, r) => s + Number(r.valor_total || 0), 0);
  const cmoTotal = folha + extras;

  const contasPagar = resContas.data || [];
  const dre = montarDREGerencial({
    faturamentoTotal,
    despesasContasPagar: contasPagar,
    cmoTotal
  });

  return { data: { ...dre, faturamentoTotal, totalCustos: dre.despesasOperacionais + dre.cmo, lucroLiquido: dre.resultadoOperacional, margem: dre.margemOperacionalPct } };
}

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
    tipo: dados.tipo,
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

export function obterParametrosPontoEquilibrio(unidadeId) {
  const padrao = {
    diasTrabalho: 26, luz: 1200, agua: 450, internet: 200, gas: 800, limpeza: 350, manutencao: 500, gastosExtras: 300, impostoPct: 4.0, taxaCartaoPct: 2.5,
  };
  if (typeof window === "undefined" || !unidadeId) return padrao;
  try {
    const salvo = localStorage.getItem(`ponto_equilibrio_params_${unidadeId}`);
    return salvo ? { ...padrao, ...JSON.parse(salvo) } : padrao;
  } catch {
    return padrao;
  }
}

export function salvarParametrosPontoEquilibrio(unidadeId, params) {
  if (typeof window === "undefined" || !unidadeId) return;
  try {
    localStorage.setItem(`ponto_equilibrio_params_${unidadeId}`, JSON.stringify(params));
  } catch {}
}

export async function registrarVendaManual({ unidadeId, total, formaPagamento, cliente }) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { data, error } = await supabase.from("vendas").insert([{
    unidade_id: unidadeId,
    total: Number(total),
    subtotal: Number(total),
    forma_pagamento: formaPagamento || "pix",
    cliente: cliente || "Lançamento manual do dia",
    status: "concluida",
    created_at: new Date().toISOString(),
  }]).select("id").single();
  return { data, error: error?.message };
}

export async function fetchPainelCaixa(unidadeId, inicioIso, fimIso) {
  if (!isSupabaseReady()) return { data: { vendas: [], despesas: [] }, error: "Offline" };

  const [resVendas, resDespesas] = await Promise.all([
    supabase.from("vendas").select("*").eq("unidade_id", unidadeId).neq("status", "cancelada").gte("created_at", inicioIso).lt("created_at", fimIso),
    supabase.from("contas_pagar").select("*").eq("unidade_id", unidadeId)
  ]);

  return {
    data: {
      vendas: resVendas.data || [],
      despesas: resDespesas.data || []
    },
    error: null
  };
}

export async function fetchEntradasEstoqueFinanceiro(unidadeId, inicioIso, fimIso) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [], error: null };
  const { data, error } = await supabase.from("estoque_movimentacoes_multi")
    .select("*, insumo:insumos(nome,custo_unitario,custo_compra)")
    .eq("unidade_id", unidadeId)
    .eq("tipo", "entrada")
    .gte("data_movimento", inicioIso)
    .lt("data_movimento", fimIso);

  return { data: data || [], error: error?.message || null };
}

export const fetchDocumentos = async () => { return { data: [], error: null }; };
export const inserirDocumento = async () => { return { error: null }; };
export const atualizarDocumento = async () => { return { error: null }; };
export const removerDocumento = async () => { return { error: null }; };
