import { test } from "node:test";
import assert from "node:assert/strict";
import { regrasDoCanalDelivery, regrasDoSalao, compararCanais, precoRecomendado } from "./index.mjs";
import { precoSugerido } from "../../marmitaria/nucleo.mjs";

const IFOOD = { id: "ifood", nome: "iFood", comissao_pct: 23, taxa_pagamento_pct: 3.5, promocao_pct: 10, taxa_fixa_pedido: 1, entrega_subsidiada_pedido: 2, itens_por_pedido: 2 };

test("motor e Delivery dão o mesmo preço para o mesmo app (diferença ≤ 1 centavo)", () => {
  for (const canal of [IFOOD, { ...IFOOD, comissao_base: "bruto" }, { ...IFOOD, pagamento_na_comissao: true }, { id: "balcao", nome: "Balcão", comissao_pct: 0 }]) {
    const antigo = precoSugerido({ custoTecnico: 14.37, canal, tributosPct: 6, margemAlvoPct: 25 });
    const r = regrasDoCanalDelivery(canal, 6);
    const novo = precoRecomendado({ custoC: 1437, regras: r.regras, margemPct: 25, descontoLojaPct: r.descontoLojaPct, itensPorPedido: r.itensPorPedido });
    assert.equal(novo.status, "OK");
    assert.ok(Math.abs(novo.minimoC - Math.round(antigo.preco * 100)) <= 1, `${canal.id}: ${novo.minimoC} × ${antigo.preco}`);
  }
});

test("fatura: ofertas viram desconto da loja e taxas incidem sobre o preço", () => {
  const r = regrasDoCanalDelivery({ id: "99food", nome: "99", usar_fatura: true, fatura_ganhos: 799.8, fatura_ofertas: 85.92, fatura_taxas: 107.02 });
  assert.equal(r.natureza, "HIPÓTESE");
  assert.ok(Math.abs(r.descontoLojaPct - 10.74) < 0.01);
  assert.ok(Math.abs(r.regras[0].valor - 13.38) < 0.01);
});

test("compara todos os canais e marca preço abaixo do mínimo", () => {
  const canais = [
    { ...regrasDoSalao({ taxaCartaoPct: 2.5, impostoPct: 9 }), precoAtualC: 3990 },
    { ...regrasDoCanalDelivery(IFOOD, 9), precoAtualC: 3990 },
  ];
  const lista = compararCanais({ custoC: 1500, canais, margemPct: 25 });
  assert.equal(lista.length, 2);
  assert.ok(lista[1].preco.minimoC > lista[0].preco.minimoC); // app custa mais que o salão
  assert.equal(lista[0].abaixoDoMinimo, false);
  assert.equal(lista[1].abaixoDoMinimo, true);
  assert.ok(lista[1].margemAtualC < lista[0].margemAtualC);
});

test("sem custo: DADOS INSUFICIENTES em todos", () => {
  const lista = compararCanais({ custoC: null, canais: [regrasDoSalao({})], margemPct: 20 });
  assert.equal(lista[0].preco.status, "DADOS INSUFICIENTES");
  assert.equal(lista[0].margemAtualC, null);
});
