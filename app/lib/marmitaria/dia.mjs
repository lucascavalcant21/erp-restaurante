// O dia da marmitaria: quanto foi feito, vendido e quanto resta. Conta só o que
// foi registrado hoje; o saldo não herda sobra de ontem, porque marmita pronta
// tem validade curta e quem decide se ela ainda serve é a equipe.

import { MODELOS_CANAL, canalConfigurado, normalizarCanal, r2, resultadoPorCanal } from "./nucleo.mjs";

const numero = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const doDia = (data, dia) => String(data || "").slice(0, 10) === dia;

/** Canais do cadastro; sem cadastro, os modelos sem taxa, para a venda não travar. */
export function canaisDisponiveis(config) {
  const ativos = (config?.canais || []).filter((c) => c.ativo);
  return ativos.length ? ativos : MODELOS_CANAL.map(normalizarCanal);
}

export const precoNoCanal = (marmita, canal) => {
  const preco = marmita?.precos?.[canal?.id] ?? marmita?.preco_venda;
  return numero(preco) > 0 ? numero(preco) : null;
};

/**
 * Feitas, perdidas, vendidas e restantes de cada marmita hoje. Venda maior que
 * a produção registrada não vira saldo negativo: restam fica null e pede conferência.
 */
export function panoramaDoDia({ marmitas = [], lotes = [], vendas = [], dia }) {
  const lotesHoje = lotes.filter((l) => doDia(l.data_producao, dia) && l.status !== "cancelado");
  const vendasHoje = vendas.filter((v) => doDia(v.data, dia));
  const somar = (lista, chave, campo, id) => r2(lista.filter((x) => x[chave] === id).reduce((s, x) => s + numero(x[campo]), 0));
  const linhas = marmitas.filter((m) => m.ativo !== false).map((m) => {
    const feitas = somar(lotesHoje, "ficha_id", "quantidade_produzida", m.id);
    const perdas = somar(lotesHoje, "ficha_id", "quantidade_perdas", m.id);
    const vendidas = somar(vendasHoje, "ficha_id", "quantidade", m.id);
    const restam = r2(feitas - perdas - vendidas);
    const temProducao = lotesHoje.some((l) => l.ficha_id === m.id);
    return { id: m.id, nome: m.nome_receita, feitas, perdas, vendidas, temProducao, conferir: temProducao && restam < 0, restam: temProducao && restam >= 0 ? restam : null };
  });
  const semMarmita = r2(vendasHoje.filter((v) => !v.ficha_id).reduce((s, v) => s + numero(v.quantidade), 0));
  const receita = r2(vendasHoje.reduce((s, v) => s + numero(v.valor_bruto) - numero(v.descontos) - numero(v.cancelamentos), 0));
  return {
    linhas, semMarmita, receita,
    feitas: r2(linhas.reduce((s, l) => s + l.feitas, 0)),
    vendidas: r2(vendasHoje.reduce((s, v) => s + numero(v.quantidade), 0)),
    temVenda: vendasHoje.length > 0,
  };
}

/**
 * Venda de um toque. Com taxas no cadastro, entram como estimativa; sem elas,
 * fica sem taxa e marcada como estimativa, e `faltamTaxas` avisa o dono.
 */
export function vendaRapida({ marmita, canal, quantidade, valor, dia }) {
  const q = numero(quantidade);
  const bruto = numero(valor);
  if (!marmita || !canal) return { erro: "Escolha a marmita e o canal." };
  if (!(q > 0)) return { erro: "Informe a quantidade." };
  if (!(bruto > 0)) return { erro: "Informe o valor vendido." };
  const venda = { data: dia, canal: canal.id, ficha_id: marmita.id, quantidade: q, valor_bruto: r2(bruto), observacao: "Venda rápida", taxas_estimadas: true };
  const configurado = canalConfigurado(canal);
  if (configurado) {
    const r = resultadoPorCanal({ preco: bruto / q, custoTecnico: 0, canal, tributosPct: null });
    venda.comissao = r2((numero(r.comissao) + numero(r.taxaFixa)) * q);
    venda.taxa_pagamento = r2(numero(r.taxaPagamento) * q);
    venda.entrega_subsidiada = r2(numero(r.entrega) * q);
    venda.descontos = r2(numero(r.promocao) * q);
  }
  return { venda, faltamTaxas: !configurado };
}

const moeda = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Texto do cardápio do dia para o WhatsApp, só com marmita de preço cadastrado.
 * Com produção registrada hoje, mostra só o que ainda tem.
 */
export function textoDoCardapio({ marmitas = [], panorama, canal, dataTexto }) {
  const linhas = panorama?.linhas || [];
  const algumaFeita = linhas.some((l) => l.temProducao);
  const itens = marmitas.filter((m) => m.ativo !== false).map((m) => {
    const l = linhas.find((x) => x.id === m.id);
    const preco = precoNoCanal(m, canal);
    if (!preco || (algumaFeita && !(l?.restam > 0))) return null;
    return `• ${m.nome_comercial || m.nome_receita}: ${moeda(preco)}`;
  }).filter(Boolean);
  return itens.length ? `Marmitas de hoje (${dataTexto})\n${itens.join("\n")}` : null;
}

export const CANAL_ONLINE = "cardapio_online";
const NOMES_EXTRAS = { [CANAL_ONLINE]: "Cardápio online" };
export const nomeDoCanal = (id, canais = []) => canais.find((c) => c.id === id)?.nome || NOMES_EXTRAS[id] || id;

// Só pedido que a casa aceitou. Novo ainda pode ser recusado; salão não é marmita.
const PEDIDO_FORA = new Set(["novo_online", "aberto", "pendente", "aguardando_aceite"]);
const pedidoConta = (p) => p.tipo_pedido !== "salao" && !PEDIDO_FORA.has(p.status) && !/cancel|recus/i.test(String(p.status || ""));

/**
 * Vendas de marmita nos pedidos online. O vínculo é produtos.ficha_id, nunca o
 * nome. O desconto do pedido é repartido pelo valor dos itens, e cada item vira
 * uma venda com referência própria, para não entrar duas vezes.
 */
export function vendasDoCardapioOnline({ pedidos = [], itens = [], fichasDeProduto = new Map(), marmitas = [], jaImportadas = new Set(), dia }) {
  const ids = new Set(marmitas.map((m) => m.id));
  const validos = new Map(pedidos.filter(pedidoConta).map((p) => [p.id, p]));
  const totalPorPedido = new Map();
  for (const i of itens) totalPorPedido.set(i.pedido_id, (totalPorPedido.get(i.pedido_id) || 0) + numero(i.quantidade) * numero(i.valor_unitario));
  const vendas = [];
  for (const i of itens) {
    const pedido = validos.get(i.pedido_id);
    const ficha = fichasDeProduto.get(i.produto_id);
    if (!pedido || !ids.has(ficha) || jaImportadas.has(String(i.id))) continue;
    const bruto = numero(i.quantidade) * numero(i.valor_unitario);
    const total = totalPorPedido.get(i.pedido_id) || 0;
    vendas.push({
      data: dia, canal: CANAL_ONLINE, ficha_id: ficha, quantidade: numero(i.quantidade), valor_bruto: r2(bruto),
      descontos: total > 0 ? r2(numero(pedido.desconto) * (bruto / total)) : 0,
      referencia_externa: String(i.id), observacao: "Importada do cardápio online",
    });
  }
  return vendas;
}

/** Preço para chegar ao markup pedido, em cima do custo técnico da ficha. */
export function precoPorMarkup(custo, markup) {
  return numero(custo) > 0 && numero(markup) > 0 ? r2(numero(custo) * numero(markup)) : null;
}

/** Markup = preço ÷ custo técnico. Custo incompleto não gera número. */
export function markupDaMarmita(preco, custo) {
  if (!(numero(preco) > 0) || !custo?.completo || !(numero(custo.total) > 0)) return null;
  return r2(numero(preco) / numero(custo.total));
}
