// Metas dos eventos. Rode com: node --test app/lib/evento-metas.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { metasDosEventos, contraMeta } from "./evento-metas.mjs";

const ev = (id, data, etapa, valor, resumo) => ({ id, nome: `Evento ${id}`, data_evento: data, funil_status: etapa, valor_contratado: valor, operacao_detalhes: resumo ? { resumo } : {} });

const EVENTOS = [
  ev("a", "2026-11-07", "CONFIRMADO", 10000, { receita: 10000, lucro: 2000, meta_lucro: 2500, cmv: 3500, equipe: 2000, extras: 1500, taxas: 900, prolabore: 100 }),
  ev("b", "2026-11-20", "SINAL PAGO", 6000, { receita: 6000, lucro: 1600, meta_lucro: 1200, cmv: 2000, equipe: 1200, extras: 600, taxas: 500, prolabore: 100 }),
  ev("c", "2026-11-22", "Aprovado", 4000, null), // fechado sem orçamento novo
  ev("d", "2026-11-28", "NEGOCIACAO", 0, { receita: 8000, lucro: 1800 }),
  ev("e", "2026-11-29", "CANCELADO", 9000, { receita: 9000, lucro: 3000 }),
  ev("f", "2026-03-10", "FINALIZADO", 5000, { receita: 5000, lucro: -200, meta_lucro: 1000 }),
  ev("g", "2026-12-05", "CONFIRMADO", 7000, { receita: 7000, lucro: 1400 }),
];

test("contraMeta: falta, margem de segurança e sem meta", () => {
  assert.deepEqual(contraMeta(800, 1000), { meta: 1000, atual: 800, pct: 80, falta: 200, margem: 0, atingida: false });
  assert.equal(contraMeta(1300, "1000,00").margem, 300);
  assert.equal(contraMeta(500, "").meta, null);
  assert.equal(contraMeta(null, 1000).falta, null, "sem lucro calculado não há falta");
});

test("mês: contratado dos fechados, sem cancelados; lucro só de quem tem orçamento", () => {
  const m = metasDosEventos(EVENTOS, { mes: "2026-11", metaLucroMes: 8000, metaFaturamentoMes: 30000 });
  assert.equal(m.eventos, 4); // a, b, c, d (e cancelado)
  assert.equal(m.fechados, 3);
  assert.equal(m.faturamento, 20000);
  assert.equal(m.lucro, 3600);
  assert.equal(m.semOrcamento, 1);
  assert.equal(m.lucroMedio, 1800);
  assert.equal(m.metaLucro.falta, 4400);
  assert.equal(m.metaLucro.eventosQueFaltam, 3, "4.400 ÷ 1.800 = 2,4 → 3 eventos");
  assert.equal(m.metaFaturamento.falta, 10000);
  assert.equal(m.potencialLucro, 1800);
  assert.equal(m.potencialFaturamento, 8000);
  assert.equal(m.negociacao.length, 1);
});

test("abaixo da meta e para onde vai o dinheiro", () => {
  const m = metasDosEventos(EVENTOS, { mes: "2026-11" });
  assert.deepEqual(m.abaixoDaMeta.map((x) => [x.id, x.falta]), [["a", 500]]);
  assert.equal(m.eventosNaComposicao, 2);
  const cmv = m.composicao.find((c) => c.id === "cmv");
  assert.equal(cmv.valor, 5500);
  assert.equal(cmv.pct, 34.38);
  assert.equal(m.maiorCusto.id, "cmv");
  assert.equal(m.metaLucro.meta, null);
});

test("ano: mês a mês e meta anual = mensal × 12; prejuízo entra no abaixo da meta", () => {
  const m = metasDosEventos(EVENTOS, { mes: "2026-03", metaLucroMes: 1000 });
  assert.deepEqual(m.abaixoDaMeta.map((x) => [x.id, x.prejuizo]), [["f", true]]);
  assert.equal(m.anoResumo.eventos, 5);
  assert.equal(m.anoResumo.lucro, 4800); // 2000 + 1600 − 200 + 1400 (c sem orçamento)
  assert.equal(m.anoResumo.metaLucro.meta, 12000);
  assert.equal(m.anoResumo.meses[10].faturamento, 20000);
  assert.equal(m.anoResumo.meses[0].lucro, null);
});

test("sem eventos: nada inventado", () => {
  const m = metasDosEventos([], { mes: "2026-11", metaLucroMes: 5000 });
  assert.equal(m.lucro, null);
  assert.equal(m.metaLucro.falta, null);
  assert.equal(m.metaLucro.eventosQueFaltam, null);
  assert.equal(m.composicao, null);
});
