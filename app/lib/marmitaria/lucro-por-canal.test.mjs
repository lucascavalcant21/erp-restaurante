// Rode: node --test app/lib/marmitaria/lucro-por-canal.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { lucroPorCanal, porQueCai } from "./lucro-por-canal.mjs";
import { normalizarCanal } from "./nucleo.mjs";

const canal = (id, nome, comissao, entrega = 0) => normalizarCanal({ id, nome, ativo: true, comissao_pct: comissao, taxa_pagamento_pct: 3, entrega_subsidiada_pedido: entrega });
const balcao = canal("balcao", "Balcão", 0);
const app = canal("ifood", "iFood", 25, 4);
const marmitas = [
  { id: "a", nome_receita: "Frango", preco_venda: 30, precos: { ifood: 30 }, categoria: "Marmitas de frango" },
  { id: "b", nome_receita: "Carne", preco_venda: 40, categoria: "Marmitas de carne" },
  { id: "c", nome_receita: "Sem custo", preco_venda: 20, categoria: "Marmitas de carne" },
];
const custos = new Map([["a", { total: 14, embalagens: 1, completo: true }], ["b", { total: 16, embalagens: 1, completo: true }]]);
const base = { marmitas, custos, canais: [balcao, app], tributosPct: 6 };

test("cada canal tem o seu lucro, e o de maior diferença vem primeiro", () => {
  const { itens, faltas } = lucroPorCanal(base);
  assert.deepEqual(faltas, []);
  assert.equal(itens[0].nome, "Carne");
  assert.equal(itens[0].melhor.canal, "Balcão");
  assert.equal(itens[0].pior.canal, "iFood");
  assert.ok(itens[0].valores.balcao.lucro > itens[0].valores.ifood.lucro);
});

test("sem custo não vira lucro: fica sem número", () => {
  const item = lucroPorCanal(base).itens.find((i) => i.nome === "Sem custo");
  assert.equal(item.valores.balcao.lucro, null);
  assert.equal(item.melhor, null);
  assert.equal(item.diferenca, null);
});

test("canal sem taxas aparece como faltando, e não como lucro", () => {
  const r = lucroPorCanal({ ...base, canais: [balcao, normalizarCanal({ id: "keeta", nome: "Keeta", ativo: true })] });
  assert.deepEqual(r.faltas, ["Faltam as taxas do Keeta"]);
  assert.equal(r.itens[0].valores.keeta.lucro, null);
});

test("sem imposto informado não há lucro em canal nenhum", () => {
  const r = lucroPorCanal({ ...base, tributosPct: null });
  assert.ok(r.faltas.includes("Falta informar os impostos"));
  assert.equal(r.itens[0].melhor, null);
});

test("os motivos somam exatamente a queda do lucro", () => {
  const { itens } = lucroPorCanal(base);
  for (const item of itens.filter((i) => i.diferenca != null)) {
    const motivos = porQueCai(item, { custos });
    const soma = motivos.reduce((t, m) => t + m.valor, 0);
    assert.ok(motivos.length > 0);
    assert.ok(Math.abs(soma - item.diferenca) <= 0.02, `${item.nome}: ${soma} × ${item.diferenca}`);
  }
});

test("preço diferente no canal entra como motivo", () => {
  const caro = [{ ...marmitas[0], precos: { ifood: 25 } }];
  const { itens } = lucroPorCanal({ ...base, marmitas: caro, custos });
  assert.ok(porQueCai(itens[0], { custos }).some((m) => m.rotulo === "Preço menor"));
});
