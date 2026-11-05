import test from "node:test";
import assert from "node:assert/strict";
import { compararPromocoes, melhorTroca, mudancasDeCusto, painelDeLucro, sugerirCombos } from "./painel-lucro.mjs";
import { cardapioDeVendas, normalizarCombo, itensDoCombo } from "./promocoes.mjs";
import { normalizarCanal } from "./nucleo.mjs";

const canal = normalizarCanal({ id: "ifood", nome: "iFood", comissao_pct: 20, taxa_pagamento_pct: 0 });
const comum = { canal, tributosPct: 0, embutidos: { cmoPorMarmita: 1, fixosPorMarmita: 1, totalPorMarmita: 2 } };

test("embalagem de 20 para 30: mostra a alta, o prato e o lucro menor", () => {
  const pote = { id: "pote", nome: "Marmitex", tipo: "embalagem", unidade_medida: "un", preco_normalizado: 0.3, tamanho_embalagem: 100 };
  const arroz = { id: "arroz", nome: "Arroz", unidade_medida: "un", preco_normalizado: 4.7 };
  const m = { id: "m", nome_receita: "Frango", itens: [{ insumo_id: "arroz", quantidade: 1 }], embalagens: [{ insumo_id: "pote", quantidade: 1 }] };
  const insumos = new Map([["pote", pote], ["arroz", arroz]]);
  const historico = [{ insumo_id: "pote", preco_normalizado_anterior: 0.2, valor_anterior: 20, valor_novo: 30, embalagem_quantidade_anterior: 100, embalagem_quantidade_nova: 100, created_at: "2026-11-02T10:00:00Z" }];
  const linhas = [{ secao: "marmitas", ficha: { id: "m" }, lucro: 10 }];
  const [a] = mudancasDeCusto({ historico, marmitas: [m], fichas: [], insumos, linhas });
  assert.deepEqual([a.valorAntes, a.valorAgora, a.pct, a.subiu, a.embalagem], [20, 30, 50, true, true]);
  const [p] = a.pratos;
  assert.deepEqual([p.custoAntes, p.custoDepois, p.custoPct, p.lucroAntes, p.lucroDepois], [4.9, 5, 2.04, 10.1, 10]);
});

test("preço que caiu aumenta o lucro; o que não mudou ou não é usado não aparece", () => {
  const ins = { id: "a", nome: "Frango", unidade_medida: "un", preco_normalizado: 8 };
  const outro = { id: "b", nome: "Sal", unidade_medida: "un", preco_normalizado: 1 };
  const m = { id: "m", nome_receita: "Frango", itens: [{ insumo_id: "a", quantidade: 1 }], embalagens: [] };
  const historico = [
    { insumo_id: "a", preco_normalizado_anterior: 10, created_at: "2026-11-01" },
    { insumo_id: "b", preco_normalizado_anterior: 2, created_at: "2026-11-01" },
    { insumo_id: "a", preco_normalizado_anterior: 12, created_at: "2026-11-03" },
  ];
  const r = mudancasDeCusto({ historico, marmitas: [m], fichas: [], insumos: new Map([["a", ins], ["b", outro]]), linhas: [{ secao: "marmitas", ficha: { id: "m" }, lucro: 15 }] });
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].subiu, r[0].pct, r[0].valorAntes, r[0].porUnidade, r[0].pratos[0].lucroAntes], [false, -20, 10, true, 13]);
});

test("mudança dentro do pré-preparo chega no prato", () => {
  const ins = { id: "a", nome: "Feijão", unidade_medida: "un", preco_normalizado: 12 };
  const prep = { id: "p", nome_receita: "Feijão pronto", rendimento_porcoes: 10, rendimento_unidade: "un", fichas_ingredientes: [{ insumo_id: "a", insumos: ins, quantidade: 1 }] };
  const m = { id: "m", nome_receita: "Marmita", itens: [{ subficha_id: "p", quantidade: 1 }], embalagens: [] };
  const [a] = mudancasDeCusto({ historico: [{ insumo_id: "a", preco_normalizado_anterior: 10 }], marmitas: [m], fichas: [prep], insumos: new Map([["a", ins]]) });
  assert.equal(a.pratos.length, 1);
  assert.ok(a.pratos[0].custoDepois > a.pratos[0].custoAntes);
  assert.equal(a.pratos[0].lucroAntes, null);
});

const catalogo = {
  marmita: [{ id: "m1", nome: "Frango", preco: 30, custo: 10, grupo: "marmita" }, { id: "m2", nome: "Picanha", preco: 30, custo: 24, grupo: "marmita" }],
  bebida: [{ id: "b1", nome: "Suco", preco: 8, custo: 2, grupo: "bebida" }, { id: "b2", nome: "Importada", preco: 8, custo: 7, grupo: "bebida" }, { id: "b3", nome: "Sem custo", preco: 8, custo: null, grupo: "bebida" }],
  sobremesa: [{ id: "s1", nome: "Pudim", preco: 10, custo: 3, grupo: "sobremesa" }, { id: "s2", nome: "Mousse", preco: 9, custo: 3, grupo: "sobremesa" }],
};

test("painel: ranking, média, ganho real e combo contra separado", () => {
  const linhas = cardapioDeVendas({ catalogo, canal, tributosPct: 0, embutidos: comum.embutidos, marmitas: [{ id: "m1", nome_receita: "Frango" }, { id: "m2", nome_receita: "Picanha" }],
    combos: [{ id: "c", nome: "Combo", modelo: "comida_bebida", itens: [{ grupo: "marmita", id: "m1" }, { grupo: "bebida", id: "b1" }], preco: "34" }],
    ofertas: [{ id: "o", ficha_id: "m1", tipo: "leve_pague", leve: 2, pague: 1 }] });
  const p = painelDeLucro({ linhas, vendas: [{ ficha_id: "m1", quantidade: 10 }, { ficha_id: "m2", quantidade: 30 }] });
  assert.deepEqual(p.pratos.map((x) => [x.nome, x.lucro]), [["Frango", 12], ["Picanha", -2]]);
  assert.deepEqual(p.maisGanho.map((x) => [x.nome, x.ganho]), [["Frango", 120], ["Picanha", -60]]);
  assert.equal(p.mediaPonderada, true);
  assert.equal(p.combos[0].lucro, 13.2);
  assert.equal(p.combos[0].lucroSem, 16.4);
  assert.equal(p.combos[0].diferenca, -3.2);
  assert.equal(p.promocoes[0].prejuizo, false);
});

test("compara 2 por 1 com desconto, do melhor para o pior", () => {
  const r = compararPromocoes({ item: catalogo.marmita[0], comum });
  // 3 por 2 lucra o mesmo no pedido, mas com 3 marmitas: 4 por unidade.
  assert.deepEqual(r.map((x) => x.id), ["cheio", "3p2", "d10", "d20", "2p1"]);
  assert.deepEqual(r.map((x) => x.lucro), [12, 12, 9.6, 7.2, 0]);
  assert.deepEqual(r.map((x) => x.lucroPorUnidade), [12, 4, 9.6, 7.2, 0]);
});

test("sugere a melhor combinação e aponta a ruim, ignorando item sem custo", () => {
  const s = sugerirCombos({ catalogo, modeloId: "comida_bebida", comum, descontoPct: 10, alvoPct: 25 });
  assert.equal(s.total, 4);
  assert.equal(s.melhores[0].id, "m1+b1");
  assert.deepEqual([s.melhores[0].preco, s.melhores[0].lucro, s.melhores[0].noAlvo], [34.2, 13.36, true]);
  assert.equal(s.piores[0].id, "m2+b2");
  assert.ok(s.piores[0].lucro < 0);
  assert.ok(s.piores[0].precoParaAlvo > s.piores[0].soma);
});

test("só sobremesas: duas diferentes, sem dupla invertida, sem equipe nem fixos", () => {
  const s = sugerirCombos({ catalogo, modeloId: "so_sobremesas", comum, descontoPct: 0 });
  assert.equal(s.total, 1);
  assert.equal(s.melhores[0].id, "s1+s2");
  assert.equal(s.melhores[0].lucro, 9.2);
  assert.deepEqual(normalizarCombo({ modelo: "so_bebidas", itens: [{ grupo: "bebida", id: "b1" }, { grupo: "bebida", id: "b2" }] }).itens.map((i) => i.id), ["b1", "b2"]);
  assert.equal(itensDoCombo(normalizarCombo({ modelo: "so_bebidas", itens: [{ grupo: "bebida", id: "b1" }, { grupo: "bebida", id: "b2" }] }), catalogo).length, 2);
});

test("troca de item no mesmo preço aumenta o lucro", () => {
  const t = melhorTroca({ itens: [catalogo.marmita[0], catalogo.bebida[1]], preco: 36, catalogo, comum });
  assert.deepEqual([t.sai.nome, t.entra.nome, t.ganho], ["Importada", "Suco", 5]);
  assert.equal(melhorTroca({ itens: [catalogo.marmita[0], catalogo.bebida[0]], preco: 36, catalogo, comum }), null);
});
