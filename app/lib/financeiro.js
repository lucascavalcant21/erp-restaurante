import { supabase, isSupabaseReady } from "./supabase.js";
import {
  calcularStatusConta,
  montarDREGerencial,
  montarFluxoCaixaPrevistoERealizado
} from "./financeiro-domain.js";
import {
  CATEGORIAS_CONTA,
  unidadeValida,
  criarContaPagar,
  editarContaPagar,
  pagarContaPagar,
  estornarContaPagar,
  lancarContaPagar
} from "./contas-pagar.mjs";

// Fonte única das categorias: contas-pagar.mjs (inclui "manutencao", usada pela
// Manutenção e antes ausente da lista).
export const CATEGORIAS_CUSTO = CATEGORIAS_CONTA;

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

// Leitura só com colunas reais. Antes havia "fornecedor:fornecedores(...)":
// sem a coluna fornecedor_id não existe relação e o PostgREST recusava a
// consulta inteira — a lista vinha vazia.
export async function fetchContas(unidadeId) {
  if (!isSupabaseReady() || !unidadeValida(unidadeId)) return { data: [], error: "Selecione uma unidade." };
  const { data, error } = await supabase
    .from("contas_pagar")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("data_vencimento", { ascending: true });

  if (error) return { data: [], error: error.message };

  const formatado = (data || []).map(c => ({
    ...c,
    status_calculado: calcularStatusConta(c)
  }));

  return { data: formatado, error: null };
}

// ─── ESCRITA: tudo passa por contas-pagar.mjs (HOTFIX FIN-CP-1) ─────────────
// Contrato mínimo com o schema real de contas_pagar. Fornecedor, documento,
// parcelas, competência, juros/multa/desconto e forma de pagamento NÃO são
// gravados: as colunas não existem. Voltam na F2.

/** Cria (sem id) ou edita (com id) uma conta. Edição nunca muda status/data_pagamento. */
export async function salvarConta(conta) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const r = conta?.id
    ? await editarContaPagar(supabase, conta)
    : await criarContaPagar(supabase, conta);
  return { data: r.data, error: r.error };
}

/** Lança conta de outro módulo (RH, Manutenção). `pagaEm` = data declarada de pagamento. */
export async function lancarConta(conta, opcoes = {}) {
  if (!isSupabaseReady()) return { error: "Offline" };
  return lancarContaPagar(supabase, conta, opcoes);
}

// Recorrência automática DESATIVADA no hotfix: abrir a tela é só leitura. A
// versão anterior tentava inserir contas a cada abertura (e falhava por
// colunas inexistentes). Sem chave de recorrência no banco, recriar no
// cliente pode duplicar contas. Volta na F2 com idempotência no banco.
export const RECORRENCIA_AUTOMATICA_DISPONIVEL = false;
export async function gerarContasRecorrentes() {
  return { criadas: 0, indisponivel: true };
}

/** Marca como paga na data real informada (pagamento integral). */
export async function pagarConta(contaId, { unidade_id, data_pagamento } = {}) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const r = await pagarContaPagar(supabase, { id: contaId, unidade_id, data_pagamento });
  return r.error ? { error: r.error } : { success: true, data: r.data };
}

/** Estorno temporário: volta para pendente, data de pagamento nula. Não apaga a conta. */
export async function estornarPagamento(contaId, unidadeId) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const r = await estornarContaPagar(supabase, { id: contaId, unidade_id: unidadeId });
  return r.error ? { error: r.error } : { success: true, data: r.data };
}

// Não existe histórico de pagamentos no schema atual (uma conta = um
// pagamento integral, registrado em status + data_pagamento).
export async function fetchHistoricoPagamentos() {
  return { data: [], error: null };
}

export async function removerConta(contaId) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { data, error } = await supabase.from("contas_pagar").delete().eq("id", contaId).select("id");
  if (error) return { error: error.message };
  return data?.length ? { error: null } : { error: "Conta não encontrada (nada foi excluído)." };
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
