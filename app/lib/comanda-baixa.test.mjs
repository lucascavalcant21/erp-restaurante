// Rode: node --test app/lib/comanda-baixa.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { consumoDaVenda, pagamentosDaConta, planejarBaixas, porcoesDaFicha } from "./comanda-baixa.mjs";

const fichas = [
  { id: "f", rendimento_porcoes: 4, rendimento_unidade: "porcao", fichas_ingredientes: [{ quantidade: 400, insumo_id: "camarao" }, { quantidade: 1, subficha_id: "b" }] },
  { id: "b", rendimento_porcoes: 2, rendimento_unidade: "L", peso_porcao_g: 0, fichas_ingredientes: [{ quantidade: 100, insumo_id: "tucupi" }] },
];
const item = (o = {}) => ({ quantidade: 2, status_kds: "pronto", produtos: { nome_produto: "Tacacá", departamento: "cozinha", ficha_id: "f" }, ...o });

test("baixa por porção, descendo na sub-receita", () => {
  const { porSetor, semFicha } = consumoDaVenda([item()], fichas);
  assert.equal(porSetor.cozinha.get("camarao"), 200);
  assert.equal(porSetor.cozinha.get("tucupi"), 25);
  assert.deepEqual(semFicha, []);
});

test("item cancelado não baixa, e produto sem ficha aparece", () => {
  const r = consumoDaVenda([item({ status_kds: "cancelado" }), item({ produtos: { nome_produto: "Água", departamento: "bar" } })], fichas);
  assert.equal(r.porSetor.cozinha.size, 0);
  assert.deepEqual(r.semFicha, ["Água"]);
});

test("escolhe o local do setor e não baixa além do saldo", () => {
  const estoques = [{ id: "c", slug: "cozinha" }, { id: "p", slug: "pre-preparos-cozinha" }, { id: "x", slug: "bar" }];
  const itensEstoque = [{ estoque_id: "c", insumo_id: "camarao", quantidade_atual: 150 }, { estoque_id: "p", insumo_id: "camarao", quantidade_atual: 500 }, { estoque_id: "x", insumo_id: "tucupi", quantidade_atual: 900 }];
  const r = planejarBaixas(consumoDaVenda([item()], fichas), { insumos: new Map([["camarao", { nome: "Camarão" }], ["tucupi", { nome: "Tucupi" }]]), estoques, itensEstoque });
  assert.deepEqual(r.baixas, [{ estoque_id: "p", insumo_id: "camarao", nome: "Camarão", quantidade: 200 }]);
  assert.deepEqual(r.faltas, ["Tucupi: sem saldo"]);
});

test("rendimento em quilo usa o peso da porção", () => {
  assert.equal(porcoesDaFicha({ rendimento_porcoes: 2, rendimento_unidade: "kg", peso_porcao_g: 400 }), 5);
});

test("pagamentos em centavos exatos", () => {
  assert.deepEqual(pagamentosDaConta([{ forma: "pix", valor: 10.004 }, { forma: "dinheiro", valor: 0 }, { forma: "vr", valor: 5 }]), [{ forma: "pix", valor: 10 }, { forma: "voucher", valor: 5 }]);
});

test("devolução do cancelamento: só o que a venda tirou, somado por estoque e insumo", async () => {
  const { devolucoesDaVenda } = await import("./comanda-baixa.mjs");
  const movs = [
    { tipo: "saida", chave_idempotencia: "venda:v1:e1:i1", estoque_id: "e1", insumo_id: "i1", quantidade: 0.2 },
    { tipo: "saida", chave_idempotencia: "venda:v1:e1:i1", estoque_id: "e1", insumo_id: "i1", quantidade: 0.1 },
    { tipo: "saida", chave_idempotencia: "venda:v1:e2:i2", estoque_id: "e2", insumo_id: "i2", quantidade: 3 },
    { tipo: "saida", chave_idempotencia: "venda:v10:e1:i1", estoque_id: "e1", insumo_id: "i1", quantidade: 9 },
    { tipo: "entrada", chave_idempotencia: "venda:v1:e1:i1", estoque_id: "e1", insumo_id: "i1", quantidade: 5 },
  ];
  assert.deepEqual(devolucoesDaVenda(movs, "v1"), [
    { estoque_id: "e1", insumo_id: "i1", quantidade: 0.3, chave: "cancelamento:v1:e1:i1" },
    { estoque_id: "e2", insumo_id: "i2", quantidade: 3, chave: "cancelamento:v1:e2:i2" },
  ]);
  assert.deepEqual(devolucoesDaVenda([], "v1"), []);
});
