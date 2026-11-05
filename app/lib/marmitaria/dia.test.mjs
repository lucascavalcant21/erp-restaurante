import test from "node:test";
import assert from "node:assert/strict";
import { canaisDisponiveis, panoramaDoDia, precoNoCanal, textoDoCardapio, vendaRapida } from "./dia.mjs";
import { normalizarCanal } from "./nucleo.mjs";

const dia = "2026-11-05";
const frango = { id: "f", nome_receita: "Frango", preco_venda: 25, precos: { ifood: 30 } };
const carne = { id: "c", nome_receita: "Carne", preco_venda: 0, precos: {} };
const fora = { id: "x", nome_receita: "Antiga", ativo: false, preco_venda: 20, precos: {} };

test("canais: sem cadastro usa os modelos sem taxa; com cadastro usa só os ativos", () => {
  const padrao = canaisDisponiveis({ canais: [] });
  assert.deepEqual(padrao.map((c) => c.id), ["ifood", "99food", "keeta", "balcao", "whatsapp"]);
  assert.equal(padrao[0].comissao_pct, null, "nenhuma taxa é presumida");
  const c = [normalizarCanal({ id: "balcao", nome: "Balcão" }), normalizarCanal({ id: "app", nome: "App", ativo: false })];
  assert.deepEqual(canaisDisponiveis({ canais: c }).map((x) => x.id), ["balcao"]);
});

test("panorama: 10 feitas - 1 perda - 4 vendidas = restam 5; ontem não entra", () => {
  const p = panoramaDoDia({ dia, marmitas: [frango, carne, fora],
    lotes: [{ ficha_id: "f", data_producao: dia, quantidade_produzida: 10, quantidade_perdas: 1 }, { ficha_id: "f", data_producao: "2026-11-04", quantidade_produzida: 50 }, { ficha_id: "f", data_producao: dia, quantidade_produzida: 99, status: "cancelado" }],
    vendas: [{ ficha_id: "f", data: dia, quantidade: 4, valor_bruto: 100, descontos: 10 }, { ficha_id: null, data: dia, quantidade: 2, valor_bruto: 50 }, { ficha_id: "f", data: "2026-11-04", quantidade: 7, valor_bruto: 70 }] });
  assert.deepEqual(p.linhas.map((l) => l.id), ["f", "c"]);
  assert.equal(p.linhas[0].restam, 5);
  assert.equal(p.linhas[1].restam, null, "sem produção hoje, saldo desconhecido, não zero");
  assert.equal(p.vendidas, 6);
  assert.equal(p.semMarmita, 2);
  assert.equal(p.receita, 140); // 100 - 10 + 50
});

test("panorama: vendeu mais do que registrou pede conferência, sem saldo negativo", () => {
  const p = panoramaDoDia({ dia, marmitas: [frango], lotes: [{ ficha_id: "f", data_producao: dia, quantidade_produzida: 2 }], vendas: [{ ficha_id: "f", data: dia, quantidade: 3, valor_bruto: 75 }] });
  assert.equal(p.linhas[0].restam, null);
  assert.equal(p.linhas[0].conferir, true);
});

test("venda rápida: taxa só vem do cadastro e fica marcada como estimativa", () => {
  const semTaxa = vendaRapida({ marmita: frango, canal: normalizarCanal({ id: "ifood", nome: "iFood" }), quantidade: 2, valor: 60, dia });
  assert.equal(semTaxa.faltamTaxas, true);
  assert.equal(semTaxa.venda.comissao, undefined);
  assert.equal(semTaxa.venda.taxas_estimadas, true);
  const canal = normalizarCanal({ id: "ifood", nome: "iFood", comissao_pct: 10, taxa_pagamento_pct: 2 });
  const r = vendaRapida({ marmita: frango, canal, quantidade: 2, valor: 60, dia });
  assert.equal(r.faltamTaxas, false);
  assert.equal(r.venda.comissao, 6);        // 10% de 60
  assert.equal(r.venda.taxa_pagamento, 1.2); // 2% de 60
  assert.match(vendaRapida({ marmita: frango, canal, quantidade: 0, valor: 60, dia }).erro, /quantidade/);
  assert.match(vendaRapida({ marmita: frango, canal, quantidade: 1, valor: 0, dia }).erro, /valor/);
});

test("preço e cardápio: preço do canal vence; sem preço não entra e nada é inventado", () => {
  const whats = normalizarCanal({ id: "whatsapp", nome: "WhatsApp" });
  const ifood = normalizarCanal({ id: "ifood", nome: "iFood" });
  assert.equal(precoNoCanal(frango, ifood), 30);
  assert.equal(precoNoCanal(frango, whats), 25);
  assert.equal(precoNoCanal(carne, whats), null);
  const semProducao = panoramaDoDia({ dia, marmitas: [frango, carne] });
  const t = textoDoCardapio({ marmitas: [frango, carne, fora], panorama: semProducao, canal: whats, dataTexto: "05/11" });
  assert.match(t, /Frango: R\$\s25,00/);
  assert.doesNotMatch(t, /Carne|Antiga/);
  const esgotou = panoramaDoDia({ dia, marmitas: [frango], lotes: [{ ficha_id: "f", data_producao: dia, quantidade_produzida: 1 }], vendas: [{ ficha_id: "f", data: dia, quantidade: 1, valor_bruto: 25 }] });
  assert.equal(textoDoCardapio({ marmitas: [frango], panorama: esgotou, canal: whats, dataTexto: "05/11" }), null);
});

test("cardápio online: entra pela ficha do produto, só pedido aceito, desconto repartido e sem repetir", async () => {
  const { vendasDoCardapioOnline, markupDaMarmita, precoPorMarkup, nomeDoCanal } = await import("./dia.mjs");
  const pedidos = [
    { id: "p1", status: "preparando_delivery", tipo_pedido: "delivery", desconto: 10 },
    { id: "p2", status: "novo_online", tipo_pedido: "delivery" },
    { id: "p3", status: "cancelado", tipo_pedido: "delivery" },
    { id: "p4", status: "pronto", tipo_pedido: "salao" },
  ];
  const itens = [
    { id: "i1", pedido_id: "p1", produto_id: "pm", quantidade: 2, valor_unitario: 30 },  // 60 de 100
    { id: "i2", pedido_id: "p1", produto_id: "pb", quantidade: 1, valor_unitario: 40 },  // bebida: não é marmita
    { id: "i3", pedido_id: "p2", produto_id: "pm", quantidade: 1, valor_unitario: 30 },
    { id: "i4", pedido_id: "p3", produto_id: "pm", quantidade: 1, valor_unitario: 30 },
    { id: "i5", pedido_id: "p4", produto_id: "pm", quantidade: 1, valor_unitario: 30 },
  ];
  const fichasDeProduto = new Map([["pm", "f"], ["pb", "bebida"]]);
  const v = vendasDoCardapioOnline({ pedidos, itens, fichasDeProduto, marmitas: [frango], dia });
  assert.equal(v.length, 1);
  assert.deepEqual([v[0].quantidade, v[0].valor_bruto, v[0].descontos, v[0].referencia_externa, v[0].canal], [2, 60, 6, "i1", "cardapio_online"]);
  assert.equal(vendasDoCardapioOnline({ pedidos, itens, fichasDeProduto, marmitas: [frango], jaImportadas: new Set(["i1"]), dia }).length, 0);
  assert.equal(nomeDoCanal("cardapio_online"), "Cardápio online");

  assert.equal(markupDaMarmita(40, { total: 12.5, completo: true }), 3.2);    // 40 ÷ 12,50
  assert.equal(markupDaMarmita(40, { total: 12.5, completo: false }), null);  // custo incompleto não vira número
  assert.equal(markupDaMarmita(0, { total: 12.5, completo: true }), null);
  assert.equal(precoPorMarkup(12.5, 3), 37.5);
  assert.equal(precoPorMarkup(0, 3), null);
});
