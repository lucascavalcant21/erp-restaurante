// Comanda do garçom: lê as mesas, abre, envia itens à produção e pede a conta.
// Receber continua no caixa (/dashboard/salao/mesas).

import { supabase, isSupabaseReady } from "./supabase";
import { itensParaEnviar } from "./comandas.mjs";
import { consumoDaVenda, pagamentosDaConta, planejarBaixas } from "./comanda-baixa.mjs";
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
