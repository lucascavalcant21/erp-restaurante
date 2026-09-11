import test from "node:test";
import assert from "node:assert/strict";
import { calcularTotaisPDV, formatarTempoMesa, separarItensPorSetor } from "./vendas-pdv-utils.mjs";

test("calcula desconto, acréscimo e taxa sem produzir total negativo", () => {
  const itens = [{ preco: 20, quantidade: 2 }, { preco: 10, quantidade: 1 }];
  assert.deepEqual(calcularTotaisPDV(itens, { desconto: 5, acrescimo: 10, taxaPercentual: 10 }), {
    subtotal: 50, desconto: 5, acrescimo: 10, taxaPercentual: 10, taxa: 5.5, total: 60.5,
  });
  assert.equal(calcularTotaisPDV(itens, { desconto: 999 }).total, 0);
});

test("separa a via de produção entre cozinha e bar", () => {
  const grupos = separarItensPorSetor([
    { nome: "Prato", departamento: "cozinha" },
    { nome: "Drink", departamento: "BAR" },
    { nome: "Inválido" },
  ]);
  assert.equal(grupos.cozinha.length, 1);
  assert.equal(grupos.bar.length, 1);
  assert.equal(grupos.semSetor.length, 1);
});

test("resume tempos longos sem cortar o cartão da mesa", () => {
  assert.equal(formatarTempoMesa(17), "17 min");
  assert.equal(formatarTempoMesa(125), "2h 5min");
  assert.equal(formatarTempoMesa(2885), "2d 0h");
});
