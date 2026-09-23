import test from "node:test";
import assert from "node:assert/strict";
import { contaPagarDaPendencia, resumoDoProcessamento, CATEGORIA_PERDA } from "./etiqueta-financeiro.mjs";

const pendencia = {
  id: "p1",
  unidade_id: "u1",
  valor: "12.50",
  competencia: "2026-09-23",
  descricao: "Perda de validade: Creme de leite (0.5 l) — Caiu no chão",
};

test("pendência vira conta paga, na competência da perda", () => {
  const conta = contaPagarDaPendencia(pendencia);
  assert.deepEqual(conta, {
    unidade_id: "u1",
    descricao: "Perda de validade: Creme de leite (0.5 l) — Caiu no chão",
    valor: 12.5,
    data_vencimento: "2026-09-23",
    data_pagamento: "2026-09-23",
    categoria: CATEGORIA_PERDA,
    status: "pago",
  });
  // A perda já é dinheiro gasto: entra paga, não como dívida a vencer.
  assert.equal(conta.status, "pago");
  assert.equal(conta.data_vencimento, conta.data_pagamento);
});

test("competência com hora é cortada na data", () => {
  assert.equal(contaPagarDaPendencia({ ...pendencia, competencia: "2026-09-23T14:05:00Z" }).data_vencimento, "2026-09-23");
});

test("perda sem custo cadastrado não vira lançamento", () => {
  assert.equal(contaPagarDaPendencia({ ...pendencia, valor: 0 }), null);
  assert.equal(contaPagarDaPendencia({ ...pendencia, valor: null }), null);
  assert.equal(contaPagarDaPendencia({ ...pendencia, valor: "abc" }), null);
});

test("resumo diz o que aconteceu, inclusive o que falhou", () => {
  const r = resumoDoProcessamento([
    { status: "lancado", valor: 10 },
    { status: "lancado", valor: 2.5 },
    { status: "dispensado", valor: 0 },
    { status: "erro", erro: "sem permissão" },
  ]);
  assert.deepEqual(r, {
    total: 4, lancados: 2, dispensados: 1, falhas: 1,
    valorLancado: 12.5, erros: ["sem permissão"],
  });
  // Fila vazia é um resultado legítimo, não um erro.
  assert.deepEqual(resumoDoProcessamento([]),
    { total: 0, lancados: 0, dispensados: 0, falhas: 0, valorLancado: 0, erros: [] });
});
