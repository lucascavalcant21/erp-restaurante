import { test } from "node:test";
import assert from "node:assert/strict";
import { eventosDePreco, precoNaData, datasDoGrafico, custoDoPratoNoTempo } from "./custo-prato-historico.mjs";

const T = (s) => new Date(s).getTime();
const h = (insumo_id, created_at, anterior, novo) => ({ insumo_id, created_at, preco_normalizado_anterior: anterior, preco_normalizado_novo: novo });

test("preço na data: antes, entre e depois das mudanças", () => {
  const ev = eventosDePreco([h("a", "2026-08-10", 10, 12), h("a", "2026-10-10", 12, 15)]).get("a");
  assert.deepEqual(precoNaData(ev, 15, T("2026-07-01")), { valor: 10, conhecido: true });
  assert.deepEqual(precoNaData(ev, 15, T("2026-09-01")), { valor: 12, conhecido: true });
  assert.deepEqual(precoNaData(ev, 16, T("2026-11-01")), { valor: 16, conhecido: true }); // depois: o cadastro de hoje
  assert.deepEqual(precoNaData([], 9, T("2026-01-01")), { valor: 9, conhecido: true });
});

test("antes do primeiro preço conhecido vale o primeiro, marcado como hipótese", () => {
  const ev = eventosDePreco([h("a", "2026-08-10", null, 12)]).get("a");
  assert.deepEqual(precoNaData(ev, 12, T("2026-07-01")), { valor: 12, conhecido: false });
});

test("correção de unidade (salto de 1000x) não vira variação de preço", () => {
  const ev = eventosDePreco([h("a", "2026-07-10", null, 0.012), h("a", "2026-08-10", 0.012, 12), h("a", "2026-10-10", 12, 14)]).get("a");
  assert.equal(ev.length, 2);
  assert.deepEqual(precoNaData(ev, 14, T("2026-07-20")), { valor: 12, conhecido: false });
  assert.deepEqual(precoNaData(ev, 14, T("2026-09-01")), { valor: 12, conhecido: true });
});

test("datas: dia 1 de cada mês desde o primeiro evento, e hoje", () => {
  const d = datasDoGrafico([{ t: T("2026-08-15T12:00:00") }], new Date("2026-11-28T12:00:00"));
  assert.deepEqual(d.map((x) => `${x.getMonth() + 1}/${x.getDate()}`), ["8/1", "9/1", "10/1", "11/1", "11/28"]);
  assert.equal(datasDoGrafico([], new Date("2026-11-28")).length, 1);
});

test("custo do prato no tempo usa a mesma conta da ficha", () => {
  const arroz = { id: "arroz", unidade_medida: "kg", preco_normalizado: 8, tamanho_embalagem: 1, custo_compra: 8 };
  const base = { id: "base", eh_base: true, rendimento_porcoes: 1, fichas_ingredientes: [{ insumos: arroz, quantidade: 1, unidade: "kg" }] };
  const prato = { id: "prato", rendimento_porcoes: 10, fichas_ingredientes: [{ subficha_id: "base", quantidade: 1 }] };
  const r = custoDoPratoNoTempo({
    ficha: prato, fichas: [prato, base],
    historico: [h("arroz", "2026-09-10T12:00:00", 5, 8)],
    hoje: new Date("2026-11-28T12:00:00"),
  });
  assert.equal(r.temHistorico, true);
  assert.deepEqual(r.pontos.map((p) => p.cmv), [0.5, 0.8, 0.8, 0.8]);
  assert.equal(Math.round(r.variacaoPct), 60);
  assert.equal(r.pontos[0].cobertura, 100);
});

test("vai e volta da implantação (100 → 200 → 3) fica de fora", () => {
  const ev = eventosDePreco([h("x", "2026-07-30", null, 100), h("x", "2026-07-31", 100, 200), h("x", "2026-08-29", 200, 3)]).get("x");
  assert.equal(ev.length, 1);
  assert.deepEqual(precoNaData(ev, 3, T("2026-08-01")), { valor: 3, conhecido: false });
});
