import test from "node:test";
import assert from "node:assert/strict";
import { porcoesDosItens, porcoesDoSaldo, pratosPossiveis, baixaDaRepesagem } from "./porcoes.mjs";

const insumos = new Map([
  ["queijo", { id: "queijo", nome: "Queijo", unidade_medida: "kg" }],
  ["batata", { id: "batata", nome: "Batata palha", unidade_medida: "kg" }],
  ["frango", { id: "frango", nome: "Frango", unidade_medida: "kg" }],
]);
const marmitas = [
  { id: "m1", nome_receita: "Parmegiana", itens: [{ insumo_id: "queijo", quantidade: 0.03 }, { insumo_id: "frango", quantidade: 0.14 }, { insumo_id: "batata", quantidade: 0.05 }], embalagens: [] },
  { id: "m2", nome_receita: "Parmegiana grande", itens: [{ insumo_id: "queijo", quantidade: 0.03 }, { insumo_id: "frango", quantidade: 0.2 }], embalagens: [] },
  { id: "m3", nome_receita: "Frango simples", itens: [{ insumo_id: "frango", quantidade: 0.14 }], embalagens: [] },
  { id: "m4", nome_receita: "Fora", ativo: false, itens: [{ insumo_id: "queijo", quantidade: 1 }], embalagens: [] },
];

test("porção é a quantidade das fichas (a mais usada) e porções = saldo ÷ porção", () => {
  const p = porcoesDosItens({ marmitas, insumos });
  assert.equal(p.get("queijo").porcao, 0.03);
  assert.equal(p.get("frango").porcao, 0.14);
  assert.deepEqual(p.get("frango").variacoes, [0.2]);
  assert.equal(porcoesDoSaldo(3, 0.03), 100);
  assert.equal(porcoesDoSaldo(1.61, 0.14), 11.5);
  assert.equal(porcoesDoSaldo(1, 0), null);
});

test("pratos possíveis: a peça que acaba primeiro manda; o que comprar para a meta", () => {
  const saldo = new Map([["queijo", 3], ["frango", 1.61], ["batata", 2]]);
  const r = pratosPossiveis({ marmitas, insumos, saldo, meta: 20 });
  const parm = r.find((x) => x.marmita.id === "m1");
  assert.equal(parm.pratos, 11);
  assert.equal(parm.limita.nome, "Frango");
  assert.deepEqual(parm.comprar.map((c) => [c.nome, c.falta]), [["Frango", 1.19]]);
  assert.equal(r.length, 3);
});

test("repesagem: baixa a diferença; peso maior não vira entrada", () => {
  assert.deepEqual(baixaDaRepesagem(3, 2.4), { baixa: 0.6, erro: null });
  assert.match(baixaDaRepesagem(1, 2).erro, /maior que o saldo/);
});

test("frango empanado: quantos dá para fazer com o trigo, o panko e o sassami (água não limita)", async () => {
  const { producaoPossivelDoPreparo } = await import("./porcoes.mjs");
  const ins = new Map([
    ["sassami", { id: "sassami", nome: "Frango sassami congelado", unidade_medida: "kg" }],
    ["trigo", { id: "trigo", nome: "Farinha de trigo", unidade_medida: "kg" }],
    ["panko", { id: "panko", nome: "Farinha panko", unidade_medida: "kg" }],
    ["agua", { id: "agua", nome: "Água", unidade_medida: "l" }],
  ]);
  // lote de 100 frangos de 144 g: 6 kg de sassami, 2,4 kg de trigo, 2,4 kg de panko, 3 L de água
  const ficha = { rendimento_porcoes: 100, rendimento_unidade: "un", fichas_ingredientes: [
    { insumo_id: "sassami", quantidade: 6 }, { insumo_id: "trigo", quantidade: 2.4 }, { insumo_id: "panko", quantidade: 2.4 }, { insumo_id: "agua", quantidade: 3 }] };
  const r = producaoPossivelDoPreparo({ ficha, insumos: ins, saldo: new Map([["sassami", 18], ["trigo", 5], ["panko", 1.2]]) });
  assert.equal(r.quantidade, 50);
  assert.equal(r.limita.nome, "Farinha panko");
  assert.equal(r.limita.porUnidade, 0.024);
  assert.match(producaoPossivelDoPreparo({ ficha: { rendimento_porcoes: 0 } }).motivo, /quanto rende/);
});
