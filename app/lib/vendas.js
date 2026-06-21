/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CAMADA DE DADOS: PDV / Vendas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * É a peça que fecha o ciclo do ERP:
 *   venda → receita no fluxo de caixa (lancamentos) → baixa de estoque (ficha técnica)
 *
 * Tabelas (ver docs/vendas.sql):
 *   vendas(id, subtotal, desconto, total, forma_pagamento, cliente, observacao,
 *          status, lancamento_id, unidade_id, created_at)
 *   venda_itens(id, venda_id, cardapio_id, nome, preco_unit, custo_unit,
 *               quantidade, subtotal, unidade_id)
 *
 * A baixa de estoque é "melhor esforço": usa a ficha técnica do prato
 * (fichas_tecnicas → ficha_itens → ingredientes) e desconta do estoque o
 * item com o MESMO nome do ingrediente. Se não houver ficha ou correspondência,
 * a venda é concluída do mesmo jeito (não bloqueia).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase, isSupabaseReady } from "./supabase";
import { escoparPorUnidade, carimbarUnidade } from "./unidades";
import { inserirLancamento, removerLancamento } from "./financeiro";

const norm = (s) => String(s || "").trim().toLowerCase();

// ── Leitura ────────────────────────────────────────────────────────────────────
/**
 * Lista vendas (mais recentes primeiro), com seus itens embutidos.
 * @param {string} unidadeId
 * @param {{desde?: string}} [opts] - ISO date; filtra created_at >= desde
 */
export async function fetchVendas(unidadeId, { desde } = {}) {
  if (!isSupabaseReady()) return { data: [], error: null };
  let query = supabase
    .from("vendas")
    .select("*, venda_itens(*)")
    .order("created_at", { ascending: false });
  if (desde) query = query.gte("created_at", desde);
  const { data, error } = await escoparPorUnidade(query, unidadeId);
  if (error) {
    console.error("[vendas] fetchVendas:", error.message);
    return { data: [], error: error.message };
  }
  return { data: data || [], error: null };
}

// ── Registro de venda ───────────────────────────────────────────────────────────
/**
 * Registra uma venda completa.
 * @param {Object} venda
 * @param {Array}  venda.itens - [{ id, nome, preco, custo, quantidade }]
 * @param {number} [venda.desconto]
 * @param {string} [venda.forma_pagamento] - dinheiro | pix | credito | debito
 * @param {string} [venda.cliente]
 * @param {string} [venda.observacao]
 * @param {string} unidadeId
 */
export async function registrarVenda(
  { itens, desconto = 0, taxa_servico = 0, acrescimo = 0, forma_pagamento = "dinheiro", cliente = "", observacao = "", caixa_id = null },
  unidadeId,
) {
  if (!isSupabaseReady()) return { data: null, error: "Supabase não configurado" };
  if (!itens?.length) return { data: null, error: "Carrinho vazio" };

  const subtotal = itens.reduce((a, it) => a + (Number(it.preco) || 0) * (Number(it.quantidade) || 0), 0);
  const desc = Math.min(Math.max(0, Number(desconto) || 0), subtotal);
  const taxa = Math.max(0, Number(taxa_servico) || 0);
  const acres = Math.max(0, Number(acrescimo) || 0);
  
  const total = Math.max(0, subtotal - desc + taxa + acres);

  // 1) Receita no fluxo de caixa (alimenta Fluxo/DRE/Dashboard).
  //    Feita antes do cabeçalho para guardar o lancamento_id e permitir estorno.
  const { data: lanc } = await inserirLancamento({
    tipo: "entrada",
    categoria: "Vendas",
    descricao: `Venda PDV${cliente ? ` · ${cliente}` : ""} (${forma_pagamento})`,
    valor: total,
    data: new Date().toISOString().slice(0, 10),
  }, unidadeId);

  // 2) Cabeçalho da venda
  const { data: venda, error: errV } = await supabase
    .from("vendas")
    .insert([carimbarUnidade({
      subtotal, desconto: desc, taxa_servico: taxa, acrescimo: acres, total, forma_pagamento,
      cliente: cliente || null, observacao: observacao || null,
      status: "concluida", lancamento_id: lanc?.id || null, caixa_id
    }, unidadeId)])
    .select()
    .single();

  if (errV) {
    // rollback da receita se o cabeçalho falhar
    if (lanc?.id) await removerLancamento(lanc.id);
    console.error("[vendas] registrarVenda:", errV.message);
    return { data: null, error: errV.message };
  }

  // 3) Itens da venda
  const linhas = itens.map((it) => carimbarUnidade({
    venda_id: venda.id,
    cardapio_id: it.id || null,
    nome: it.nome,
    preco_unit: Number(it.preco) || 0,
    custo_unit: Number(it.custo) || 0,
    quantidade: Number(it.quantidade) || 0,
    subtotal: (Number(it.preco) || 0) * (Number(it.quantidade) || 0),
  }, unidadeId));
  const { error: errI } = await supabase.from("venda_itens").insert(linhas);
  if (errI) console.error("[vendas] venda_itens:", errI.message);

  // 4) Baixa de estoque (melhor esforço, não bloqueia a venda)
  const baixa = await baixarEstoqueDaVenda(itens, unidadeId);

  return { data: { ...venda, venda_itens: linhas }, error: null, baixaEstoque: baixa };
}

/**
 * Cancela uma venda: marca como cancelada e estorna a receita gerada no
 * fluxo de caixa. (Estoque NÃO é restaurado automaticamente — fazer manualmente
 * via entrada no Estoque se necessário.)
 */
export async function cancelarVenda(venda) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { error } = await supabase.from("vendas").update({ status: "cancelada" }).eq("id", venda.id);
  if (error) {
    console.error("[vendas] cancelarVenda:", error.message);
    return { error: error.message };
  }
  if (venda.lancamento_id) await removerLancamento(venda.lancamento_id);
  return { error: null };
}

// ── Baixa de estoque via ficha técnica (interno, melhor esforço) ─────────────────
async function baixarEstoqueDaVenda(itens, unidadeId) {
  try {
    const { data: estoque } = await escoparPorUnidade(
      supabase.from("estoque").select("id, nome, quantidade"),
      unidadeId,
    );
    if (!estoque?.length) return { baixados: 0, semEstoque: true };

    const porNome = new Map(estoque.map((e) => [norm(e.nome), e]));
    let baixados = 0;

    for (const it of itens) {
      if (!it.id) continue;
      const qtdVendida = Number(it.quantidade) || 0;
      if (qtdVendida <= 0) continue;

      // Ficha técnica do prato
      const { data: ficha } = await supabase
        .from("fichas_tecnicas").select("id").eq("prato_id", it.id).maybeSingle();
      if (!ficha) continue;

      const { data: fitens } = await supabase
        .from("ficha_itens").select("ingrediente_id, quantidade").eq("ficha_id", ficha.id);
      if (!fitens?.length) continue;

      // Nomes dos ingredientes da ficha
      const ids = fitens.map((f) => f.ingrediente_id);
      const { data: ings } = await supabase.from("ingredientes").select("id, nome").in("id", ids);
      const nomeDe = Object.fromEntries((ings || []).map((i) => [i.id, i.nome]));

      for (const f of fitens) {
        const alvo = porNome.get(norm(nomeDe[f.ingrediente_id]));
        if (!alvo) continue;
        const consumo = (Number(f.quantidade) || 0) * qtdVendida;
        if (consumo <= 0) continue;
        const novaQtd = Math.max(0, (Number(alvo.quantidade) || 0) - consumo);
        await supabase.from("estoque")
          .update({ quantidade: novaQtd, updated_at: new Date().toISOString() })
          .eq("id", alvo.id);
        await supabase.from("estoque_movimentacoes").insert([
          carimbarUnidade({ estoque_id: alvo.id, tipo: "saida", quantidade: consumo, obs: "Venda PDV" }, unidadeId),
        ]);
        alvo.quantidade = novaQtd; // mantém o mapa coerente p/ itens repetidos
        baixados++;
      }
    }
    return { baixados };
  } catch (e) {
    console.error("[vendas] baixarEstoqueDaVenda:", e.message);
    return { baixados: 0, erro: e.message };
  }
}

// ── Rótulos de forma de pagamento ────────────────────────────────────────────────
export const FORMAS_PAGAMENTO = [
  { id: "dinheiro", label: "Dinheiro" },
  { id: "pix",      label: "PIX" },
  { id: "credito",  label: "Crédito" },
  { id: "debito",   label: "Débito" },
];

export function labelPagamento(id) {
  return FORMAS_PAGAMENTO.find((f) => f.id === id)?.label || id;
}
