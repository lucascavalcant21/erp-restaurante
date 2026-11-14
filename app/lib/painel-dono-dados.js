"use client";

// Dados do Início do dono ao vivo (app/lib/painel-dono.mjs faz as contas).
// Lê as vendas da janela da meta e de hoje, os itens vendidos, os produtos com
// a margem pelas fichas (mesma conta da Pizza do prato) e os parâmetros da
// casa (imposto, taxa da maquininha, meta). Tudo da unidade aberta, sob RLS.

import { supabase, isSupabaseReady } from "./supabase";
import { fetchFichas } from "./operacao";
import { fetchProdutos } from "./vendas";
import { fetchMetaVendas, fetchParams, PARAMS_PADRAO } from "./parametros";
import { dadosDoPrato } from "./pizza-do-prato.mjs";
import { produtoDaFicha } from "./ficha-calculos.mjs";
import { contribuicaoDoPrato } from "./metas-negocio.mjs";
import { janelaDaMeta, metaValida } from "./painel-dono.mjs";

const FUSO = "-03:00";

/** Margem de contribuição de cada produto (null quando a ficha não sustenta o número). */
function margensDosProdutos(produtos = [], fichas = [], params = {}) {
  return produtos.map((p) => {
    const ficha = fichas.find((f) => f.id === p.ficha_id) || fichas.find((f) => produtoDaFicha(f, [p])?.id === p.id && !f.eh_base);
    const preco = Number(p.preco_venda) || 0;
    if (!ficha) return { id: p.id, nome: p.nome_produto, preco, margem: null };
    const e = dadosDoPrato(ficha, { fichas, produtos, params });
    return { id: p.id, nome: p.nome_produto, preco: e.preco || preco, margem: contribuicaoDoPrato(e) };
  });
}

async function itensDasVendas(vendas) {
  const ids = [...new Set(vendas.map((v) => v.pedido_id).filter(Boolean))];
  const itens = [];
  for (let i = 0; i < ids.length; i += 150) {
    const r = await supabase.from("pedidos_itens").select("produto_id, quantidade, valor_unitario, status_kds").in("pedido_id", ids.slice(i, i + 150));
    if (r.error) return { itens: [], erro: true };
    itens.push(...(r.data || []));
  }
  return { itens, erro: false };
}

/**
 * @returns {Promise<{ ok: boolean, erro?: string, meta, janela, vendasJanela, vendasHoje, itensHoje, produtos, params }>}
 */
export async function carregarPainelDono(unidadeId, hojeIso) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { ok: false, erro: "Selecione uma unidade." };
  const [rMeta, rParams] = await Promise.all([fetchMetaVendas(unidadeId), fetchParams(unidadeId)]);
  const meta = metaValida(rMeta.data);
  const janela = janelaDaMeta(meta?.periodo || "dia", hojeIso);
  const mes = janelaDaMeta("mes", hojeIso);
  const desde = janela.inicio < mes.inicio ? janela.inicio : mes.inicio;
  const r = await supabase.from("vendas")
    .select("id, subtotal, desconto, total, acrescimo, taxa_servico, forma_pagamento, status, created_at, cancelada_em, pedido_id")
    .eq("unidade_id", unidadeId)
    .gte("created_at", `${desde}T00:00:00${FUSO}`)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (r.error) return { ok: false, erro: "Não foi possível ler as vendas." };
  const todas = r.data || [];
  const dia = (v) => new Date(v.created_at).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const vendasHoje = todas.filter((v) => dia(v) === hojeIso);
  const vendasJanela = todas.filter((v) => dia(v) >= janela.inicio && dia(v) <= janela.fim);
  const vendasMes = todas.filter((v) => dia(v) >= mes.inicio && dia(v) <= mes.fim);

  const [rItens, rFichas, rProdutos] = await Promise.all([itensDasVendas(vendasHoje), fetchFichas(unidadeId), fetchProdutos(unidadeId)]);
  const params = { ...PARAMS_PADRAO, ...(rParams.data || {}) };
  return {
    ok: true,
    meta, janela, vendasJanela, vendasHoje, vendasMes, params,
    itensHoje: rItens.itens,
    itensErro: rItens.erro,
    produtos: margensDosProdutos(rProdutos.data || [], rFichas.data || [], params),
  };
}
