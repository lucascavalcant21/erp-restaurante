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
  criarContasPagarEmLote,
  editarContaPagar,
  registrarPagamento,
  estornarPagamento as estornarPagamentoCP,
  cancelarConta,
  lancarContaPagar,
  gerarRecorrentes
} from "./contas-pagar.mjs";
import {
  criarContaReceber,
  editarContaReceber,
  registrarRecebimento,
  estornarRecebimento,
  cancelarContaReceber,
  criarContaFinanceira,
  editarContaFinanceira,
  criarTaxa,
  encerrarTaxa,
  anexarBrutoSemTaxa
} from "./contas-receber.mjs";

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

// ─── CONTAS A PAGAR F2.2 (arquitetura F2.1; escrita em contas-pagar.mjs) ────
// Leitura pela view vw_fin_contas_pagar (saldo, situação, pagamento antigo).
// Fornecedor é buscado à parte e cruzado no app: a view não tem relação para
// embed e o embed antigo derrubava a consulta.

export async function fetchContasPagar(unidadeId) {
  if (!isSupabaseReady() || !unidadeValida(unidadeId)) return { data: [], error: "Selecione uma unidade." };
  const { data, error } = await supabase
    .from("vw_fin_contas_pagar")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("data_vencimento", { ascending: true });
  return { data: data || [], error: error?.message || null };
}

export async function fetchContaPagar(id) {
  if (!isSupabaseReady() || !id) return { data: null, error: "Conta não informada." };
  const { data, error } = await supabase.from("vw_fin_contas_pagar").select("*").eq("id", id).maybeSingle();
  return { data, error: error?.message || (data ? null : "Conta não encontrada.") };
}

/** Categorias, centros de custo, fornecedores e contas financeiras da unidade. */
export async function fetchReferenciasContas(unidadeId) {
  if (!isSupabaseReady() || !unidadeValida(unidadeId)) return { data: null, error: "Selecione uma unidade." };
  const [cat, cc, forn, cf] = await Promise.all([
    supabase.from("fin_categorias").select("*").order("ordem"),
    supabase.from("fin_centros_custo").select("*").eq("ativo", true).order("ordem"),
    supabase.from("fornecedores").select("id, nome").eq("unidade_id", unidadeId).order("nome"),
    supabase.from("fin_contas_financeiras").select("id, nome, tipo").eq("unidade_id", unidadeId).eq("ativa", true).order("nome"),
  ]);
  const erro = cat.error || cc.error;
  return {
    data: {
      categorias: cat.data || [],
      centros: cc.data || [],
      fornecedores: forn.data || [],
      contasFinanceiras: cf.data || [],
    },
    // fornecedores/contas financeiras vazios não impedem lançar (são opcionais)
    error: erro ? erro.message : null,
    avisos: [forn.error && "Não foi possível carregar os fornecedores.", cf.error && "Não foi possível carregar as contas financeiras."].filter(Boolean),
  };
}

export async function fetchPagamentosDaConta(contaId) {
  if (!isSupabaseReady() || !contaId) return { data: [], error: null };
  const { data, error } = await supabase.from("fin_pagamentos").select("*")
    .eq("conta_pagar_id", contaId).order("created_at", { ascending: true });
  return { data: data || [], error: error?.message || null };
}
export const fetchHistoricoPagamentos = fetchPagamentosDaConta;

/** Pagamentos (caixa) de um período, por data de pagamento. */
export async function fetchPagamentosPeriodo(unidadeId, de, ate) {
  if (!isSupabaseReady() || !unidadeValida(unidadeId) || !de || !ate) return { data: [], error: null };
  const { data, error } = await supabase.from("fin_pagamentos")
    .select("id, conta_pagar_id, pago_em, valor_total, estornado_em")
    .eq("unidade_id", unidadeId).gte("pago_em", de).lte("pago_em", ate);
  return { data: data || [], error: error?.message || null };
}

export async function usuarioAtualId() {
  if (!isSupabaseReady()) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

/** Cria (sem id) ou edita (com id + contaAtual). `chave` obrigatória na criação. */
export async function salvarConta(conta, { chave, categorias = null, origem_tipo = "MANUAL", origem_id = null } = {}) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const r = conta?.id
    ? await editarContaPagar(supabase, conta, { categorias })
    : await criarContaPagar(supabase, conta, { chave, categorias, origem_tipo, origem_id });
  return { data: r.data, error: r.error, idempotente: r.idempotente };
}

/** Conta vinda de outro módulo (RH, Manutenção); `pagaEm` = pagamento declarado. */
export async function lancarConta(conta, opcoes = {}) {
  if (!isSupabaseReady()) return { error: "Offline" };
  return lancarContaPagar(supabase, conta, opcoes);
}

/** Lote tudo-ou-nada (fechamento de folha). */
export async function lancarContasEmLote(lista, opcoes = {}) {
  if (!isSupabaseReady()) return { error: "Offline" };
  return criarContasPagarEmLote(supabase, lista, opcoes);
}

/** Pagamento parcial/integral pela RPC fin_registrar_pagamento. */
export async function pagarConta(pagamento) {
  if (!isSupabaseReady()) return { error: "Offline" };
  return registrarPagamento(supabase, pagamento);
}

/** Estorno pela RPC fin_estornar_pagamento (motivo obrigatório; nada é apagado). */
export async function estornarPagamento(pagamentoId, motivo) {
  if (!isSupabaseReady()) return { error: "Offline" };
  return estornarPagamentoCP(supabase, { pagamento_id: pagamentoId, motivo });
}

/** Cancelamento pela RPC fin_cancelar_conta_pagar (motivo obrigatório; nada é apagado). */
export async function cancelarContaPagar(contaId, motivo) {
  if (!isSupabaseReady()) return { error: "Offline" };
  return cancelarConta(supabase, { conta_pagar_id: contaId, motivo });
}

// Recorrência: só quando o usuário pede (botão), nunca ao abrir a tela.
export async function gerarContasRecorrentes(unidadeId, contas, competenciaAlvo) {
  if (!isSupabaseReady()) return { error: "Offline" };
  return gerarRecorrentes(supabase, { unidade_id: unidadeId, contas, competenciaAlvo });
}

// ─── CONTAS A RECEBER / CAIXA F2.3 (arquitetura F2.1; escrita em contas-receber.mjs) ──

/** Recebíveis: view (saldo, situação) + campos de detalhe da tabela base. */
export async function fetchContasReceber(unidadeId) {
  if (!isSupabaseReady() || !unidadeValida(unidadeId)) return { data: [], error: "Selecione uma unidade." };
  const [v, b] = await Promise.all([
    supabase.from("vw_fin_contas_receber").select("*").eq("unidade_id", unidadeId).order("data_prevista", { ascending: true }),
    supabase.from("fin_contas_receber")
      .select("id, nsu, autorizacao, observacao, conta_financeira_prevista_id, taxa_percentual_prevista, taxa_fixa_prevista, taxa_regra_id, cancelado_em, motivo_cancelamento, updated_at, atualizado_por")
      .eq("unidade_id", unidadeId),
  ]);
  if (v.error || b.error) return { data: [], error: (v.error || b.error).message };
  const extra = new Map((b.data || []).map((x) => [x.id, x]));
  return { data: (v.data || []).map((c) => ({ ...extra.get(c.id), ...c })), error: null };
}

export async function fetchRecebimentosDaConta(contaId) {
  if (!isSupabaseReady() || !contaId) return { data: [], error: null };
  const { data, error } = await supabase.from("fin_recebimentos").select("*")
    .eq("conta_receber_id", contaId).order("created_at", { ascending: true });
  return { data: data || [], error: error?.message || null };
}

/** Recebimentos (caixa) de um período, por data do recebimento. */
export async function fetchRecebimentosPeriodo(unidadeId, de, ate) {
  if (!isSupabaseReady() || !unidadeValida(unidadeId) || !de || !ate) return { data: [], error: null };
  const { data, error } = await supabase.from("fin_recebimentos")
    .select("id, conta_receber_id, recebido_em, valor_bruto_baixado, valor_liquido_recebido, valor_taxa_efetiva, estornado_em")
    .eq("unidade_id", unidadeId).gte("recebido_em", de).lte("recebido_em", ate);
  return { data: data || [], error: error?.message || null };
}

export async function fetchTaxasMeioPagamento(unidadeId) {
  if (!isSupabaseReady() || !unidadeValida(unidadeId)) return { data: [], error: null };
  const { data, error } = await supabase.from("fin_taxas_meio_pagamento").select("*")
    .eq("unidade_id", unidadeId).order("meio").order("vigente_desde", { ascending: false });
  return { data: data || [], error: error?.message || null };
}

/** Contas financeiras com saldo GERENCIAL (saldo inicial + recebimentos − pagamentos). */
export async function fetchSaldosContasFinanceiras(unidadeId) {
  if (!isSupabaseReady() || !unidadeValida(unidadeId)) return { data: [], error: null };
  const [s, c] = await Promise.all([
    supabase.from("vw_fin_saldo_contas_financeiras").select("*").eq("unidade_id", unidadeId).order("nome"),
    supabase.from("fin_contas_financeiras").select("id, ativa").eq("unidade_id", unidadeId),
  ]);
  if (s.error) return { data: [], error: s.error.message };
  const ativa = new Map((c.data || []).map((x) => [x.id, x.ativa]));
  return { data: (s.data || []).map((x) => ({ ...x, ativa: ativa.get(x.id) !== false })), error: null };
}

/**
 * Fluxo de caixa (realizado × previsto) num intervalo de datas. Recebível com
 * taxa não informada vem com valor nulo; busca o saldo bruto dele à parte para
 * a tela mostrar o bruto em aberto (o líquido continua não informado).
 */
export async function fetchFluxoCaixa(unidadeId, de, ate) {
  if (!isSupabaseReady() || !unidadeValida(unidadeId) || !de || !ate) return { data: [], error: null };
  const { data, error } = await supabase.from("vw_fin_fluxo_caixa").select("*")
    .eq("unidade_id", unidadeId).gte("data", de).lte("data", ate).order("data", { ascending: true });
  const linhas = data || [];
  const ids = [...new Set(linhas.filter((l) => l.natureza === "previsto" && l.origem === "conta_receber" && l.valor == null).map((l) => l.referencia_id))];
  if (error || !ids.length) return { data: linhas, error: error?.message || null };
  const r = await supabase.from("vw_fin_contas_receber").select("id, saldo_bruto").eq("unidade_id", unidadeId).in("id", ids);
  return { data: r.error ? linhas : anexarBrutoSemTaxa(linhas, r.data), error: null };
}

export async function salvarContaReceber(conta, opcoes = {}) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const r = conta?.id ? await editarContaReceber(supabase, conta) : await criarContaReceber(supabase, conta, opcoes);
  return { data: r.data, error: r.error, idempotente: r.idempotente };
}
export async function receberConta(p) {
  if (!isSupabaseReady()) return { error: "Offline" };
  return registrarRecebimento(supabase, p);
}
export async function estornarRecebimentoConta(recebimentoId, motivo) {
  if (!isSupabaseReady()) return { error: "Offline" };
  return estornarRecebimento(supabase, { recebimento_id: recebimentoId, motivo });
}
export async function cancelarRecebivel(id, unidadeId, motivo) {
  if (!isSupabaseReady()) return { error: "Offline" };
  return cancelarContaReceber(supabase, { id, unidade_id: unidadeId, motivo });
}
export async function salvarContaFinanceiraF23(conta) {
  if (!isSupabaseReady()) return { error: "Offline" };
  return conta?.id ? editarContaFinanceira(supabase, conta) : criarContaFinanceira(supabase, conta);
}
export async function cadastrarTaxa(taxa) {
  if (!isSupabaseReady()) return { error: "Offline" };
  return criarTaxa(supabase, taxa);
}
export async function encerrarTaxaMeio(id, unidadeId) {
  if (!isSupabaseReady()) return { error: "Offline" };
  return encerrarTaxa(supabase, { id, unidade_id: unidadeId });
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
