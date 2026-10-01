// COMPRAS (registro oficial) → CUSTO MÉDIO → CONTA A PAGAR — F2.4B,
// sobre compras/compras_itens/estoque_custos da F2.1 + db/F2_4B_COMPRAS_CUSTO_MEDIO.sql.
//
//   rascunho    → public.compras (status 'rascunho') + compras_itens (editável)
//   confirmar   → rpc compras_confirmar: compra + custo médio + histórico +
//                 conta a pagar (mercadoria_insumos), tudo numa transação
//   cancelar    → rpc compras_cancelar (desfaz custo e conta, com histórico)
//
// COMPRA ≠ CMV. O custo médio é calculado SÓ no banco (estoque_custo_medio_novo);
// aqui só se mostra prévia/variação. Quantidades em unidade base (g/ml/un) com
// as mesmas regras da contagem (kg→g, L→ml; peças como estão no cadastro).
// Funções com banco recebem o cliente (`db`) por parâmetro (testáveis).

import { hojeLocal, dataValida, lerValor, unidadeValida, novaChave } from "./contas-pagar.mjs";
import { unidadeContagem, daBase, fmtQtd } from "./contagem-estoque.mjs";

export { hojeLocal, novaChave };

const r2 = (n) => Math.round(Number(n) * 100) / 100;
const r3 = (n) => Math.round(Number(n) * 1000) / 1000;
const r6 = (n) => Math.round(Number(n) * 1e6) / 1e6;
function falha(msg) { return { data: null, error: msg }; }
function erroDb(e) { return e ? (e.message || String(e)) : null; }
const num = (v) => (v === "" || v == null ? null : lerValor(v));

export const FORMAS_PAGAMENTO = [
  { codigo: "pix", rotulo: "PIX" }, { codigo: "boleto", rotulo: "Boleto" }, { codigo: "dinheiro", rotulo: "Dinheiro" },
  { codigo: "cartao_credito", rotulo: "Cartão de crédito" }, { codigo: "cartao_debito", rotulo: "Cartão de débito" },
  { codigo: "transferencia", rotulo: "Transferência" }, { codigo: "a_prazo", rotulo: "A prazo (faturado)" }, { codigo: "outro", rotulo: "Outro" },
];
export const rotuloForma = (c) => FORMAS_PAGAMENTO.find((f) => f.codigo === c)?.rotulo || c || "—";
export const STATUS_COMPRA = { rascunho: "Rascunho", confirmada: "Confirmada", cancelada: "Cancelada" };

/**
 * Item digitado → linha de compras_itens. A quantidade é na unidade do cadastro
 * (kg, L, un…) ou em embalagens × conteúdo (ex.: 2 caixas × 5 kg).
 * valor_total = o que foi COBRADO; pedido (opcional) = o que foi pedido.
 */
export function montarItemCompra(it) {
  const ins = it?.insumo;
  if (!ins?.id) return { erro: "Escolha o produto." };
  const uc = unidadeContagem(ins.unidade_medida);
  const emb = num(it.embalagens);
  const cont = num(it.conteudo);
  const qtd = num(it.quantidade);
  let quantidade_embalagens; let conteudo_por_embalagem;
  if (emb != null || cont != null) {
    if (!(emb > 0) || !(cont > 0)) return { erro: `${ins.nome}: informe embalagens e conteúdo por embalagem (maiores que zero).` };
    quantidade_embalagens = r3(emb); conteudo_por_embalagem = r3(cont * uc.fator);
  } else {
    if (!(qtd > 0)) return { erro: `${ins.nome}: informe a quantidade recebida.` };
    quantidade_embalagens = r3(qtd); conteudo_por_embalagem = uc.fator;
  }
  const valor = num(it.valor_total);
  if (!(valor >= 0) || !Number.isFinite(valor)) return { erro: `${ins.nome}: informe o valor total do item.` };
  const pedQtd = num(it.quantidade_pedida);
  const pedValor = num(it.valor_pedido);
  if (pedQtd != null && !(pedQtd > 0)) return { erro: `${ins.nome}: quantidade pedida inválida.` };
  if (pedValor != null && !(pedValor >= 0)) return { erro: `${ins.nome}: valor pedido inválido.` };
  const quantidade_base = r3(quantidade_embalagens * conteudo_por_embalagem);
  return {
    linha: {
      insumo_id: ins.id, estoque_id: it.estoque_id || null, descricao_snapshot: ins.nome,
      quantidade_embalagens, conteudo_por_embalagem, unidade_base: uc.base, valor_total: r2(valor),
      // pedido na mesma forma do recebido: embalagens (se veio em embalagens) ou unidade do cadastro
      quantidade_pedida_embalagens: pedQtd != null ? r3(pedQtd) : null,
      valor_pedido: pedValor != null ? r2(pedValor) : null,
      lote: String(it.lote || "").trim() || null, validade: dataValida(it.validade) ? it.validade : null,
    },
    quantidade_base,
    quantidadeNaUnidade: daBase(quantidade_base, ins.unidade_medida),
    precoPorUnidade: quantidade_base > 0 ? r6(valor / daBase(quantidade_base, ins.unidade_medida)) : null,
    rotulo: uc.rotulo,
  };
}

/** Pedido × recebido de uma linha gravada (na unidade do cadastro). */
export function divergenciaPedido(linha, unidadeMedida) {
  if (linha?.quantidade_pedida_embalagens == null && linha?.valor_pedido == null) return null;
  const fatorEmb = Number(linha.conteudo_por_embalagem) / unidadeContagem(unidadeMedida).fator;   // unidade do cadastro por embalagem
  const recebida = r3(Number(linha.quantidade_embalagens) * fatorEmb);
  const pedida = linha.quantidade_pedida_embalagens != null ? r3(Number(linha.quantidade_pedida_embalagens) * fatorEmb) : null;
  const precoRec = recebida > 0 ? Number(linha.valor_total) / recebida : null;
  const precoPed = pedida > 0 && linha.valor_pedido != null ? Number(linha.valor_pedido) / pedida : null;
  return {
    pedida, recebida, diferencaQtd: pedida != null ? r3(recebida - pedida) : null,
    precoPedido: precoPed != null ? r6(precoPed) : null, precoRecebido: precoRec != null ? r6(precoRec) : null,
    variacaoPrecoPct: precoPed > 0 && precoRec != null ? r2(((precoRec - precoPed) / precoPed) * 100) : null,
  };
}

/** Variação % do preço desta compra contra o custo médio atual (só informação). */
export const variacaoPct = (novo, referencia) => (Number(referencia) > 0 && Number.isFinite(Number(novo)) ? r2(((Number(novo) - Number(referencia)) / Number(referencia)) * 100) : null);

/** Total da nota = itens + frete − desconto (igual à vw_compras e à RPC). */
export function totalCompra(itensValores, frete, desconto) {
  const itens = r2((itensValores || []).reduce((s, v) => s + (Number(v) || 0), 0));
  return { itens, total: r2(itens + (Number(lerValor(frete)) || 0) - (Number(lerValor(desconto)) || 0)) };
}

/** Resumo de um período (só compras CONFIRMADAS): total, nº, top produtos e fornecedores. */
export function resumoCompras(compras, itens, { insumoPorId = new Map(), fornecedorPorId = new Map() } = {}) {
  const confirmadas = (compras || []).filter((c) => c.status === "confirmada");
  const ids = new Set(confirmadas.map((c) => c.id));
  const doPeriodo = (itens || []).filter((i) => ids.has(i.compra_id));
  const porInsumo = new Map();
  for (const i of doPeriodo) {
    const a = porInsumo.get(i.insumo_id) || { insumo_id: i.insumo_id, nome: insumoPorId.get(i.insumo_id)?.nome || i.descricao_snapshot, valor: 0, quantidade_base: 0, unidade_base: i.unidade_base };
    a.valor = r2(a.valor + Number(i.valor_total)); a.quantidade_base = r3(a.quantidade_base + Number(i.quantidade_base ?? Number(i.quantidade_embalagens) * Number(i.conteudo_por_embalagem)));
    porInsumo.set(i.insumo_id, a);
  }
  const porFornecedor = new Map();
  for (const c of confirmadas) {
    const k = c.fornecedor_id || "(sem fornecedor)";
    const a = porFornecedor.get(k) || { fornecedor_id: c.fornecedor_id, nome: fornecedorPorId.get(c.fornecedor_id)?.nome || "Fornecedor não informado", valor: 0, compras: 0 };
    a.valor = r2(a.valor + Number(c.valor_total || 0)); a.compras += 1;
    porFornecedor.set(k, a);
  }
  const produtos = [...porInsumo.values()];
  return {
    total: r2(confirmadas.reduce((s, c) => s + Number(c.valor_total || 0), 0)),
    quantidade: confirmadas.length,
    topValor: [...produtos].sort((a, b) => b.valor - a.valor).slice(0, 10),
    fornecedores: [...porFornecedor.values()].sort((a, b) => b.valor - a.valor),
  };
}

// ─── Banco ───────────────────────────────────────────────────────────────────
function validarCabecalho(c, hoje) {
  if (!unidadeValida(c?.unidade_id)) return "Selecione uma unidade.";
  if (!dataValida(c?.data_compra)) return "Informe a data da compra.";
  if (c.data_compra > hoje) return "A data da compra não pode ser futura.";
  if (c.data_recebimento) {
    if (!dataValida(c.data_recebimento)) return "Data de recebimento inválida.";
    if (c.data_recebimento < c.data_compra) return "O recebimento não pode ser antes da compra.";
    if (c.data_recebimento > hoje) return "A data de recebimento não pode ser futura.";
  }
  if (c.data_vencimento && !dataValida(c.data_vencimento)) return "Vencimento inválido.";
  for (const [k, rot] of [["valor_frete", "Frete"], ["valor_desconto", "Desconto"]]) {
    const v = num(c[k]);
    if (v != null && !(v >= 0)) return `${rot} inválido.`;
  }
  return null;
}

/**
 * Salva (cria ou atualiza) um RASCUNHO com os itens. Os itens do rascunho são
 * substituídos por inteiro. `chave` torna a criação segura contra clique duplo.
 */
export async function salvarRascunho(db, { compra, itens, chave }, { hoje = hojeLocal() } = {}) {
  if (!db) return falha("Banco indisponível.");
  const erro = validarCabecalho(compra, hoje);
  if (erro) return falha(erro);
  if (!itens?.length) return falha("Adicione pelo menos um produto.");
  const linhas = [];
  for (const it of itens) {
    const m = montarItemCompra(it);
    if (m.erro) return falha(m.erro);
    linhas.push(m.linha);
  }
  const cab = {
    unidade_id: compra.unidade_id, fornecedor_id: compra.fornecedor_id || null,
    numero_documento: String(compra.numero_documento || "").trim() || null,
    data_compra: compra.data_compra, data_recebimento: compra.data_recebimento || null,
    forma_pagamento: compra.forma_pagamento || null, data_vencimento: compra.data_vencimento || null,
    valor_frete: r2(num(compra.valor_frete) || 0), valor_desconto: r2(num(compra.valor_desconto) || 0),
    observacao: String(compra.observacao || "").trim() || null,
  };
  let id = compra.id || null;
  if (id) {
    const u = await db.from("compras").update(cab).eq("id", id).eq("status", "rascunho").select("id");
    if (u.error) return falha(erroDb(u.error));
    if (!u.data?.length) return falha("Esta compra não é mais rascunho: não pode ser alterada.");
    const d = await db.from("compras_itens").delete().eq("compra_id", id);
    if (d.error) return falha(erroDb(d.error));
  } else {
    if (!chave) return falha("Chave de idempotência ausente.");
    const ins = await db.from("compras").insert({ ...cab, status: "rascunho", chave_idempotencia: chave }).select("id").single();
    if (ins.error && ins.error.code === "23505") {
      const ja = await db.from("compras").select("id, status").eq("unidade_id", compra.unidade_id).eq("chave_idempotencia", chave);
      if (ja.error) return falha(erroDb(ja.error));
      if (ja.data?.length) return { data: { id: ja.data[0].id, idempotente: true }, error: null };
      // não é retry: é a mesma nota do mesmo fornecedor lançada de novo
      return falha(`Já existe uma compra com o documento "${cab.numero_documento}" deste fornecedor. Confira se a nota não foi lançada antes.`);
    }
    if (ins.error) return falha(erroDb(ins.error));
    id = ins.data.id;
  }
  const it = await db.from("compras_itens").insert(linhas.map((l) => ({ ...l, unidade_id: compra.unidade_id, compra_id: id })));
  if (it.error) return falha(erroDb(it.error));
  return { data: { id, idempotente: false }, error: null };
}

/** Confirma: o banco grava compra + custo médio + histórico + conta a pagar (tudo ou nada). */
export async function confirmarCompra(db, { compra_id, gerar_conta_pagar = true, data_vencimento = null }) {
  if (!db) return falha("Banco indisponível.");
  if (!compra_id) return falha("Compra não informada.");
  if (gerar_conta_pagar && data_vencimento && !dataValida(data_vencimento)) return falha("Vencimento inválido.");
  const { data, error } = await db.rpc("compras_confirmar", {
    p_compra_id: compra_id, p_gerar_conta_pagar: !!gerar_conta_pagar, p_data_vencimento: data_vencimento || null,
  });
  if (error) return falha(erroDb(error));
  return { data, error: null };
}

export async function cancelarCompra(db, { compra_id, motivo }) {
  if (!db) return falha("Banco indisponível.");
  if (!String(motivo || "").trim()) return falha("Informe o motivo do cancelamento.");
  const { data, error } = await db.rpc("compras_cancelar", { p_compra_id: compra_id, p_motivo: String(motivo).trim() });
  if (error) return falha(erroDb(error));
  return { data, error: null };
}

export async function criarFornecedor(db, { unidade_id, nome }) {
  const n = String(nome || "").trim();
  if (n.length < 2) return falha("Informe o nome do fornecedor.");
  if (!unidadeValida(unidade_id)) return falha("Selecione uma unidade.");
  const { data, error } = await db.from("fornecedores").insert({ unidade_id, nome: n, ativo: true }).select("id, nome").single();
  if (error) return falha(erroDb(error));
  return { data, error: null };
}

/** Custo atual (estoque_custos) para exibir: R$ por unidade do cadastro. */
export function custoNaUnidade(custoBase, unidadeMedida) {
  return custoBase == null ? null : r6(Number(custoBase) * unidadeContagem(unidadeMedida).fator);
}

export { fmtQtd };
