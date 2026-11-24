// Gastos e rendimento da marmitaria (17/11/2026). TESTADO LOCAL (funções puras).
import test from "node:test";
import assert from "node:assert/strict";
import { resumoDeGastos, estoqueValorizado, planilhaDeGastos, quantidadeTexto, porUnidadeTexto, categoriaDaCompra, categoriaDoTipo } from "./gastos.mjs";

const SEMANA = { de: "2026-11-16", ate: "2026-11-22" };
const insumos = new Map([
  ["frango", { nome: "Filé de frango", unidade_medida: "kg", departamento: "marmitaria" }],
  ["farinha", { nome: "Farinha de rosca", unidade_medida: "kg" }],
  ["pote", { nome: "Pote 750 ml", unidade_medida: "un", departamento: "embalagens" }],
  ["detergente", { nome: "Detergente", unidade_medida: "un", departamento: "limpeza" }],
  ["molho", { nome: "Molho de tomate (pote)", unidade_medida: "un" }],
]);
const estoques = [{ id: "e1", slug: "marmitaria" }, { id: "e2", slug: "embalagens-marmitaria" }, { id: "e3", slug: "limpeza-marmitaria" }, { id: "e9", slug: "bar" }];
const base = {
  periodo: SEMANA, insumos, estoques,
  compras: [
    { id: "c1", status: "confirmada", data_compra: "2026-11-15", data_recebimento: "2026-11-17", valor_frete: 10, valor_desconto: 0, fornecedor_nome: "Atacadão" },
    { id: "c2", status: "rascunho", data_compra: "2026-11-17" },
    { id: "c3", status: "confirmada", data_compra: "2026-11-02", data_recebimento: "2026-11-02" },
  ],
  itensCompra: [
    { compra_id: "c1", insumo_id: "frango", estoque_id: "e1", quantidade_base: 18, unidade_base: "kg", valor_total: 360 },
    { compra_id: "c1", insumo_id: "pote", estoque_id: "e2", quantidade_base: 1000, unidade_base: "un", valor_total: 250 },
    { compra_id: "c1", insumo_id: "detergente", estoque_id: "e3", quantidade_base: 6, unidade_base: "un", valor_total: 18 },
    { compra_id: "c2", insumo_id: "frango", estoque_id: "e1", quantidade_base: 5, unidade_base: "kg", valor_total: 100 },
    { compra_id: "c3", insumo_id: "frango", estoque_id: "e1", quantidade_base: 5, unidade_base: "kg", valor_total: 100 },
  ],
  contas: [
    { id: "k1", descricao: "Frigideira", valor: 89.9, categoria_codigo: "utensilios", data_pagamento: "2026-11-17", data_vencimento: "2026-11-17", origem_tipo: "GASTO" },
    { id: "k2", descricao: "Avental", valor: 70, categoria_codigo: "uniformes_epi", data_pagamento: "2026-11-18", data_vencimento: "2026-11-18", origem_tipo: "GASTO" },
    { id: "k3", descricao: "Compra 1", valor: 628, categoria_codigo: "mercadoria_insumos", data_vencimento: "2026-11-17", origem_tipo: "COMPRA" },
    { id: "k4", descricao: "Energia", valor: 300, categoria_codigo: "utilidades_energia", data_vencimento: "2026-11-20", origem_tipo: "MANUAL" },
    { id: "k5", descricao: "Touca", valor: 15, categoria_codigo: "uniformes_epi", data_vencimento: "2026-11-19", origem_tipo: "GASTO", cancelado_em: "2026-11-19T10:00:00Z" },
  ],
  detalhes: [
    { conta_pagar_id: "k1", data: "2026-11-17", tipo_gasto: "utensilios", item: "Frigideira 28 cm", quantidade: 1, valor_total: 89.9, destino: "geral" },
    { conta_pagar_id: "k2", data: "2026-11-18", tipo_gasto: "uniformes_epi", item: "Avental", quantidade: 2, valor_total: 70, destino: "colaborador", colaborador_id: "ana" },
  ],
  colaboradores: new Map([["ana", "Ana"]]),
  fichas: [{ id: "f-emp", nome_receita: "Frango empanado", rendimento_unidade: "un" }],
  lotes: [{ id: "L1", ficha_id: "f-emp", tipo_demanda: "preparo", quantidade_produzida: 1000, data_producao: "2026-11-17", custo_total: 400,
    rendimento_real_dados: { baixas: [{ insumo_id: "frango", estoque_id: "e1", quantidade: 18 }, { insumo_id: "farinha", estoque_id: "e1", quantidade: 2 }] } }],
  movimentos: [
    { tipo: "saida", insumo_id: "frango", quantidade: 18, unidade_medida: "kg", valor_total: 360, motivo: "producao", data_movimento: "2026-11-17T10:00:00Z", chave_idempotencia: "marm-prep:L1:e1:frango" },
    { tipo: "saida", insumo_id: "farinha", quantidade: 2, unidade_medida: "kg", valor_total: 16, motivo: "producao", data_movimento: "2026-11-17T10:00:00Z", chave_idempotencia: "marm-prep:L1:e1:farinha" },
    { tipo: "saida", insumo_id: "molho", quantidade: 300, unidade_medida: "un", valor_total: null, motivo: "producao", data_movimento: "2026-11-18T10:00:00Z" },
    { tipo: "entrada", insumo_id: "frango", quantidade: 18, unidade_medida: "kg", valor_total: 360, data_movimento: "2026-11-17T09:00:00Z" },
  ],
};

test("gastos da semana: compras confirmadas por item + contas fora de compra, sem duplicar a conta da compra", () => {
  const r = resumoDeGastos(base);
  const itens = r.gastos.map((g) => `${g.categoria}|${g.item}|${g.valor}`);
  assert.deepEqual(itens.sort(), [
    "Embalagens|Pote 750 ml|250", "Energia|Energia|300", "Frete de compras|Frete|10", "Ingredientes|Filé de frango|360",
    "Limpeza e higiene|Detergente|18", "Uniformes e EPI|Avental|70", "Utensílios e equipamentos|Frigideira 28 cm|89.9",
  ]);
  assert.equal(r.totalGastos, 1097.9);
  assert.equal(r.porCategoria[0].categoria, "Ingredientes");
  assert.deepEqual(r.porPessoa, [{ nome: "Ana", valor: 70 }]);
  assert.equal(r.gastos.find((g) => g.item === "Frigideira 28 cm").destino, "Geral");
  assert.deepEqual(r.porDia.map((d) => d.data), ["2026-11-17", "2026-11-18", "2026-11-20"]);
});

test("dia e mês mudam o recorte", () => {
  assert.equal(resumoDeGastos({ ...base, periodo: { de: "2026-11-18", ate: "2026-11-18" } }).totalGastos, 70);
  const mes = resumoDeGastos({ ...base, periodo: { de: "2026-11-01", ate: "2026-11-30" } });
  assert.ok(mes.gastos.some((g) => g.data === "2026-11-02"), "a compra do dia 2 entra no mês");
});

test("rendimento: 18 kg de frango viraram 1000 empanados = 18 g e R$ 0,376 cada", () => {
  const r = resumoDeGastos(base);
  const emp = r.rendimento[0];
  assert.equal(emp.nome, "Frango empanado");
  assert.equal(emp.produzido, 1000);
  assert.equal(emp.entradas[0].porUnidade, "18 g");
  assert.equal(emp.custo, 376);
  assert.equal(emp.custoPorUnidade, 0.376);
});

test("uso: saída sem custo médio fica sem valor (nunca zero) e é contada", () => {
  const r = resumoDeGastos(base);
  const molho = r.uso.find((u) => u.item === "Molho de tomate (pote)");
  assert.equal(molho.valor, null);
  assert.equal(molho.quantidade, 300);
  assert.equal(r.usoSemValor, 1);
  assert.equal(r.totalUso, 376);
  assert.ok(!r.uso.some((u) => u.quantidade === 36), "entrada não conta como uso");
});

test("rendimento sem valor de alguma baixa: custo nulo", () => {
  const movimentos = base.movimentos.map((m) => (m.insumo_id === "farinha" ? { ...m, valor_total: null } : m));
  const r = resumoDeGastos({ ...base, movimentos });
  assert.equal(r.rendimento[0].custo, null);
  assert.equal(r.rendimento[0].custoPorUnidade, null);
});

test("estoque valorizado pelo custo médio; sem custo, sem valor", () => {
  const e = estoqueValorizado({
    itensEstoque: [{ estoque_id: "e2", insumo_id: "pote", quantidade_atual: 700 }, { estoque_id: "e1", insumo_id: "molho", quantidade_atual: 700 }, { estoque_id: "e9", insumo_id: "frango", quantidade_atual: 5 }],
    estoques, insumos, custos: new Map([["pote", { custo_medio_base: 0.25, unidade_base: "un" }]]), slugs: ["marmitaria", "embalagens-marmitaria"],
  });
  assert.deepEqual(e.linhas.map((l) => [l.item, l.quantidade, l.valor]), [["Pote 750 ml", 700, 175], ["Molho de tomate (pote)", 700, null]]);
  assert.equal(e.total, 175);
  assert.equal(e.semCusto, 1);
});

test("planilha: ; e vírgula decimal, com BOM, seções e totais", () => {
  const r = resumoDeGastos(base);
  const csv = planilhaDeGastos(r);
  assert.ok(csv.startsWith("﻿"));
  assert.match(csv, /Gastos da marmitaria de 16\/11\/2026 a 22\/11\/2026/);
  assert.match(csv, /17\/11\/2026;Utensílios e equipamentos;Frigideira 28 cm;1;un;89,9;Geral;Conta a pagar/);
  assert.match(csv, /;;;;Total;1097,9/);
  assert.match(csv, /17\/11\/2026;Frango empanado;1000;un;Filé de frango;18;kg;18 g;360;0,38/);
});

test("textos de quantidade e categorias", () => {
  assert.equal(quantidadeTexto(18000, "g"), "18 kg");
  assert.equal(quantidadeTexto(1000, "un"), "1.000 un");
  assert.equal(porUnidadeTexto(18, "kg", 1000), "18 g");
  assert.equal(porUnidadeTexto(300, "un", 100), "3 un");
  assert.equal(categoriaDaCompra({}, { departamento: "Embalagens" }, null), "Embalagens");
  assert.equal(categoriaDoTipo("uniformes_epi"), "uniformes_epi");
  assert.equal(categoriaDoTipo("x"), "outros");
});
