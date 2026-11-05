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
  assert.deepEqual(padrao.map((c) => c.id), ["ifood", "whatsapp", "balcao"]);
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
