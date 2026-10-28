// Ritmo do estoque e sugestão de mínimo/máximo: contas exatas, nada inventado.
import test from "node:test";
import assert from "node:assert/strict";
import { ritmoDoProduto, sugerirMinMax, coberturaDias, situacaoDoItem, unidadeInteira, movimentoConta } from "./estoque-ritmo.mjs";

const HOJE = new Date("2026-10-27T12:00:00Z");
const diasAtras = (n) => new Date(HOJE.getTime() - n * 86400000).toISOString();
const mov = (tipo, q, dias, extra = {}) => ({ tipo, quantidade: q, created_at: diasAtras(dias), ...extra });

test("ritmo: 28 dias de histórico, 14 kg saíram → 0,5 kg/dia, 3,5/semana, 15/mês; entradas à parte", () => {
  const movs = [mov("entrada", 10, 28), mov("saida", 4, 25), mov("saida", 5, 15), mov("saida", 5, 3), mov("entrada", 6, 10)];
  const r = ritmoDoProduto(movs, { hoje: HOJE });
  assert.equal(r.diasHistorico, 28);
  assert.deepEqual(r.saida, { dia: 0.5, semana: 3.5, mes: 15, total: 14, vezes: 3 });
  assert.equal(r.entrada.total, 16);
  assert.equal(r.entrada.vezes, 2);
  assert.equal(r.insuficiente, null);
  assert.equal(r.natureza, "REAL");
});

test("estorno, ajuste de contagem, inventário e movimento estornado não contam como uso", () => {
  assert.equal(movimentoConta({ tipo: "saida", quantidade: 1, motivo: "consumo" }), true);
  assert.equal(movimentoConta({ tipo: "saida", quantidade: 1, motivo: "perda" }), true);
  assert.equal(movimentoConta({ tipo: "saida", quantidade: 1, motivo: "transferencia_enviada" }), true);
  assert.equal(movimentoConta({ tipo: "entrada", quantidade: 1, motivo: "estorno" }), false);
  assert.equal(movimentoConta({ tipo: "saida", quantidade: 1, motivo: "ajuste_autorizado" }), false);
  assert.equal(movimentoConta({ tipo: "saida", quantidade: 1, estorno_de_id: "x" }), false);
  assert.equal(movimentoConta({ tipo: "saida", quantidade: 1, inventario_id: "i" }), false);
  assert.equal(movimentoConta({ tipo: "saida", quantidade: 1, estornado: true }), false);
  const r = ritmoDoProduto([mov("saida", 2, 20), mov("saida", 2, 10), mov("saida", 2, 5), mov("saida", 50, 4, { motivo: "ajuste_autorizado" })], { hoje: HOJE });
  assert.equal(r.saida.total, 6);
});

test("fora da janela de 60 dias não entra; produto novo divide só pelos dias que existe", () => {
  const r = ritmoDoProduto([mov("saida", 100, 90), mov("saida", 3, 20), mov("saida", 3, 10), mov("saida", 4, 2)], { hoje: HOJE });
  assert.equal(r.saida.total, 10);
  assert.equal(r.diasHistorico, 20);
  assert.equal(r.saida.dia, 0.5);
});

test("dados insuficientes: sem movimento, pouco tempo ou poucas retiradas → sem sugestão, com o motivo", () => {
  assert.match(ritmoDoProduto([], { hoje: HOJE }).insuficiente, /Sem entradas nem retiradas/);
  assert.match(ritmoDoProduto([mov("saida", 1, 5), mov("saida", 1, 3), mov("saida", 1, 1)], { hoje: HOJE }).insuficiente, /5 dia\(s\)/);
  assert.match(ritmoDoProduto([mov("entrada", 9, 40), mov("saida", 1, 30)], { hoje: HOJE }).insuficiente, /1 retirada/);
  const s = sugerirMinMax(ritmoDoProduto([], { hoje: HOJE }));
  assert.equal(s.ok, false);
  assert.equal(s.natureza, "DADOS INSUFICIENTES");
});

test("sugestão: 0,5/dia → mínimo 2 (4 dias), máximo 5,5 (+7 dias); inteiro arredonda para cima", () => {
  const r = ritmoDoProduto([mov("saida", 4, 25), mov("saida", 5, 15), mov("saida", 5, 3), mov("entrada", 10, 28)], { hoje: HOJE });
  const s = sugerirMinMax(r);
  assert.equal(s.ok, true);
  assert.equal(s.natureza, "ESTIMATIVA");
  assert.equal(s.minimo, 2);
  assert.equal(s.maximo, 5.5);
  assert.match(s.explicacao, /0,5\/dia/);
  const garrafas = sugerirMinMax(r, { inteiro: true });
  assert.deepEqual([garrafas.minimo, garrafas.maximo], [2, 6]);
  const dono = sugerirMinMax(r, { prazoReposicaoDias: 1, segurancaDias: 1, intervaloCompraDias: 14 });
  assert.deepEqual([dono.minimo, dono.maximo], [1, 8]);
});

test("cobertura em dias, situação do item e unidade inteira", () => {
  const r = ritmoDoProduto([mov("saida", 4, 25), mov("saida", 5, 15), mov("saida", 5, 3), mov("entrada", 10, 28)], { hoje: HOJE });
  assert.equal(coberturaDias(3.4, r), 6);
  assert.equal(coberturaDias(3, { insuficiente: "x" }), null);
  assert.equal(situacaoDoItem({ saldo: 0, minimo: 2 }), "zerado");
  assert.equal(situacaoDoItem({ saldo: 1, minimo: 2 }), "baixo");
  assert.equal(situacaoDoItem({ saldo: 9, minimo: 2, maximo: 6 }), "acima");
  assert.equal(situacaoDoItem({ saldo: 4, minimo: 2, maximo: 6 }), "ok");
  assert.equal(unidadeInteira("garrafa"), true);
  assert.equal(unidadeInteira("kg"), false);
});
