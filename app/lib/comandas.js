// Comanda do garçom: lê as mesas, abre, envia itens à produção e pede a conta.
// Receber continua no caixa (/dashboard/salao/mesas).

import { supabase, isSupabaseReady } from "./supabase";
import { ORIGENS_BALCAO, itensParaEnviar, planoDoBalcao } from "./comandas.mjs";
import { consumoDaVenda, devolucoesDaVenda, pagamentosDaConta, planejarBaixas } from "./comanda-baixa.mjs";
import { registrarMovimentoMulti } from "./estoques-multiplos";

const OFFLINE = "Sistema indisponível no momento.";
const ITENS = "id, produto_id, quantidade, valor_unitario, observacao, status_kds, created_at, pessoa, produtos ( nome_produto )";

export async function fetchSalao(unidadeId) {
  if (!isSupabaseReady()) return { mesas: [], pedidos: [], error: OFFLINE };
  const [mesas, pedidos] = await Promise.all([
    supabase.from("mesas").select("id, numero, numero_mesa, status").eq("unidade_id", unidadeId),
    supabase.from("pedidos").select(`id, mesa_id, created_at, garcom_nome, identificacao, pedidos_itens ( ${ITENS} )`)
      .eq("unidade_id", unidadeId).eq("status", "aberto").not("mesa_id", "is", null).order("created_at"),
  ]);
  return { mesas: mesas.data || [], pedidos: pedidos.data || [], error: mesas.error?.message || pedidos.error?.message || null };
}

/** Só produto ativo e vendável: o que é pré-preparo não aparece para o garçom. */
export async function fetchCardapioDoSalao(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: OFFLINE };
  const { data, error } = await supabase.from("produtos")
    .select("id, nome_produto, categoria, preco_venda, departamento, ativo, fichas_tecnicas ( tipo_base )")
    .eq("unidade_id", unidadeId).order("categoria").order("nome_produto");
  const vendaveis = (data || []).filter((p) => p.ativo !== false && !["pre", "receita"].includes(String(p.fichas_tecnicas?.tipo_base || "").toLowerCase()));
  return { data: vendaveis, error: error?.message || null };
}

export async function abrirComandaDaMesa(unidadeId, mesa, garcomNome) {
  if (!isSupabaseReady()) return { error: OFFLINE };
  // Outro garçom pode ter aberto a mesa enquanto a tela estava parada.
  const { data: aberto, error: erroLeitura } = await supabase.from("pedidos").select("id").eq("mesa_id", mesa.id).eq("status", "aberto").order("created_at").limit(1);
  if (erroLeitura) return { error: erroLeitura.message };
  if (aberto?.[0]) return { id: aberto[0].id, error: null };
  const { data, error } = await supabase.from("pedidos").insert({
    unidade_id: unidadeId, mesa_id: mesa.id, status: "aberto", tipo_pedido: "salao", valor_total: 0, garcom_nome: garcomNome,
    identificacao: `${mesa.numero_mesa || mesa.numero}.01`,
  }).select("id").single();
  if (error) return { error: error.message };
  const { error: erroMesa } = await supabase.from("mesas").update({ status: "ocupada" }).eq("id", mesa.id);
  return { id: data.id, error: erroMesa?.message || null };
}

export async function enviarParaProducao(pedidoId, mesaId, rascunho) {
  if (!isSupabaseReady()) return { error: OFFLINE };
  const { erro, linhas } = itensParaEnviar(pedidoId, rascunho);
  if (erro) return { error: erro };
  const { error } = await supabase.from("pedidos_itens").insert(linhas);
  if (error) return { error: error.message };
  // Pedido novo depois de pedir a conta: a mesa volta a consumir.
  const { error: erroMesa } = await supabase.from("mesas").update({ status: "ocupada" }).eq("id", mesaId).eq("status", "fechando");
  return { error: erroMesa?.message || null };
}

export async function pedirConta(mesaId, pedir = true) {
  if (!isSupabaseReady()) return { error: OFFLINE };
  const { error } = await supabase.from("mesas").update({ status: pedir ? "fechando" : "ocupada" }).eq("id", mesaId);
  return { error: error?.message || null };
}

/**
 * Baixa pela ficha depois da venda gravada. A chave impede baixar duas vezes, e o
 * que não baixou volta para o caixa: a venda nunca é desfeita por falta de saldo.
 */
async function baixarEstoqueDaVenda(pedidoId, vendaId, unidadeId, quem) {
  const [itens, fichas, insumos, estoques, itensEstoque, embalagens] = await Promise.all([
    supabase.from("pedidos_itens").select("quantidade, status_kds, produtos ( nome_produto, departamento, ficha_id, composicao, embalagens )").eq("pedido_id", pedidoId),
    supabase.from("fichas_tecnicas").select("id, rendimento_porcoes, rendimento_unidade, peso_porcao_g, fichas_ingredientes!ficha_id ( quantidade, insumo_id, subficha_id )").eq("unidade_id", unidadeId),
    supabase.from("insumos").select("id, nome, unidade_medida, tamanho_embalagem, permite_fracionado").eq("unidade_id", unidadeId),
    supabase.from("estoques").select("id, slug").eq("unidade_id", unidadeId).eq("status", "ativo"),
    supabase.from("estoque_itens").select("estoque_id, insumo_id, quantidade_atual").eq("unidade_id", unidadeId),
    supabase.from("operacao_embalagens").select("id, insumo_id").eq("unidade_id", unidadeId),
  ]);
  const erroLeitura = [itens, fichas, insumos, estoques, itensEstoque].find((r) => r.error);
  if (erroLeitura) return ["Não consegui calcular a baixa de estoque"];
  const consumo = consumoDaVenda(itens.data, fichas.data, new Map((embalagens.data || []).map((e) => [e.id, e.insumo_id])));
  const { baixas, faltas } = planejarBaixas(consumo, { insumos: new Map(insumos.data.map((i) => [i.id, i])), estoques: estoques.data, itensEstoque: itensEstoque.data });
  for (const b of baixas) {
    const { error } = await registrarMovimentoMulti({
      unidadeId, estoqueId: b.estoque_id, insumoId: b.insumo_id, tipo: "saida", quantidade: b.quantidade, motivo: "consumo",
      usuarioNome: quem || "", observacao: "Venda da comanda", chave: `venda:${vendaId}:${b.estoque_id}:${b.insumo_id}`,
    });
    if (error) faltas.push(`${b.nome}: ${error}`);
  }
  return faltas;
}

export async function receberComanda({ pedidoId, caixaId, unidadeId, pagamentos, desconto = 0, taxaServico = 0, acrescimo = 0, cliente = null, quem = "" }) {
  if (!isSupabaseReady()) return { error: OFFLINE };
  const { data, error } = await supabase.rpc("comanda_fechar", {
    p_pedido_id: pedidoId, p_caixa_id: caixaId, p_pagamentos: pagamentosDaConta(pagamentos),
    p_desconto: desconto, p_taxa_servico: taxaServico, p_acrescimo: acrescimo, p_cliente: cliente,
  });
  if (error) return { error: error.message };
  const faltas = data?.repetido ? [] : await baixarEstoqueDaVenda(pedidoId, data.venda_id, unidadeId, quem).catch(() => ["Não consegui calcular a baixa de estoque"]);
  return { data, faltas, error: null };
}

/* ── Vendas do caixa e cancelamento (COM-4, 07/11/2026) ─────────────────── */

const SEM_COM4 = /venda_cancelar|cancelada_em|motivo_cancelamento/i;

/** Vendas do caixa aberto, da mais nova para a mais antiga, com as formas de pagamento. */
export async function fetchVendasDoCaixa(caixaId) {
  if (!isSupabaseReady()) return { data: [], error: OFFLINE };
  const completo = "id, created_at, total, subtotal, desconto, acrescimo, taxa_servico, status, observacao, cliente, pedido_id, motivo_cancelamento, cancelada_em, venda_pagamentos ( forma, valor )";
  let r = await supabase.from("vendas").select(completo).eq("caixa_id", caixaId).order("created_at", { ascending: false }).limit(200);
  // Banco sem a COM-4: lista sem as colunas de cancelamento (e sem o botão).
  if (r.error && SEM_COM4.test(r.error.message)) {
    r = await supabase.from("vendas").select("id, created_at, total, subtotal, desconto, acrescimo, taxa_servico, status, observacao, cliente, pedido_id, venda_pagamentos ( forma, valor )")
      .eq("caixa_id", caixaId).order("created_at", { ascending: false }).limit(200);
    return { data: r.data || [], error: r.error?.message || null, semCancelamento: !r.error };
  }
  return { data: r.data || [], error: r.error?.message || null, semCancelamento: false };
}

/**
 * Cancela a venda pelo banco (venda_cancelar: uma transação, com permissão e
 * motivo). Se pedido, devolve ao estoque o que a venda tirou, com chave própria
 * para não devolver duas vezes. Falha na devolução não desfaz o cancelamento:
 * volta como aviso.
 */
export async function cancelarVenda({ vendaId, motivo, devolverEstoque = false, unidadeId, quem = "" }) {
  if (!isSupabaseReady()) return { error: OFFLINE };
  const { data, error } = await supabase.rpc("venda_cancelar", { p_venda_id: vendaId, p_motivo: motivo });
  if (error) {
    if (/function .*venda_cancelar.* does not exist|Could not find the function/i.test(error.message)) {
      return { error: "O banco ainda não tem o cancelamento de vendas. Peça a aplicação da COM-4." };
    }
    return { error: error.message };
  }
  const avisos = [];
  if (devolverEstoque && !data?.repetido) {
    const movs = await supabase.from("estoque_movimentacoes_multi").select("tipo, estoque_id, insumo_id, quantidade, chave_idempotencia")
      .eq("unidade_id", unidadeId).like("chave_idempotencia", `venda:${vendaId}:%`);
    if (movs.error) avisos.push("Não consegui ler o que a venda tirou do estoque. Lance a devolução pelo Estoque.");
    else {
      const devolver = devolucoesDaVenda(movs.data, vendaId);
      if (!devolver.length) avisos.push("Esta venda não tinha baixa de estoque para devolver.");
      for (const d of devolver) {
        const { error: e } = await registrarMovimentoMulti({
          unidadeId, estoqueId: d.estoque_id, insumoId: d.insumo_id, tipo: "entrada", quantidade: d.quantidade, motivo: "devolucao",
          usuarioNome: quem || "", observacao: `Venda cancelada: ${motivo}`.slice(0, 300), chave: d.chave,
        });
        if (e) avisos.push(`Estoque não devolvido: ${e}`);
      }
    }
  }
  return { data, avisos, error: null };
}

/**
 * Venda no balcão (e abas iFood / Cardápio digital) pelo mesmo fechamento da
 * comanda (07/11/2026). Antes ia direto para `lancamentos` e não aparecia no
 * caixa nem no faturamento do dia. Se algo falhar depois de criar o pedido, o
 * pedido e os itens são cancelados para não ficarem abertos nem no KDS.
 */
export async function venderNoBalcao({ unidadeId, caixaId, itens, pagamentos, desconto = 0, acrescimo = 0, cliente = null, origem = "balcao", quem = "" }) {
  if (!isSupabaseReady()) return { error: OFFLINE };
  const plano = planoDoBalcao({ itens, pagamentos, desconto, acrescimo });
  if (plano.erro) return { error: plano.erro };
  const nome = String(cliente || "").trim() || null;

  const { data: pedido, error: errPed } = await supabase.from("pedidos").insert({
    unidade_id: unidadeId, status: "aberto", tipo_pedido: origem, identificacao: ORIGENS_BALCAO[origem] || "Balcão", cliente_nome: nome,
  }).select("id").single();
  if (errPed) return { error: errPed.message };

  const desfazer = async () => {
    await supabase.from("pedidos_itens").update({ status_kds: "cancelado" }).eq("pedido_id", pedido.id);
    await supabase.from("pedidos").update({ status: "cancelado" }).eq("id", pedido.id).eq("status", "aberto");
  };
  const { error: errItens } = await supabase.from("pedidos_itens").insert(plano.linhas.map((l) => ({ ...l, pedido_id: pedido.id })));
  if (errItens) { await desfazer(); return { error: errItens.message }; }

  const r = await receberComanda({
    pedidoId: pedido.id, caixaId, unidadeId, pagamentos: plano.pagamentos,
    desconto: plano.desconto, taxaServico: 0, acrescimo: plano.acrescimo, cliente: nome, quem,
  });
  if (r.error) { await desfazer(); return { error: r.error }; }
  return { data: { id: pedido.id, venda_id: r.data?.venda_id, total: plano.total }, faltas: r.faltas || [], error: null };
}
