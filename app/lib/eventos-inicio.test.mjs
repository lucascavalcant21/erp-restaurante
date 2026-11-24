import { test } from "node:test";
import assert from "node:assert/strict";
import { blocoDaData, inicioDosEventos, pagamentoDoEvento, quandoFalta, somarDias } from "./eventos-inicio.mjs";

const HOJE = "2026-11-24";
const ev = (id, data, status, valor = 0, pags = []) => ({ id, data_evento: data, funil_status: status, valor_contratado: valor, historico_pagamentos: pags });

test("somarDias atravessa o mês", () => {
  assert.equal(somarDias("2026-11-28", 5), "2026-12-03");
});

test("blocoDaData e quandoFalta", () => {
  const b = blocoDaData("2026-11-28");
  assert.equal(b.dia, "28");
  assert.match(b.mes, /NOV/);
  assert.equal(blocoDaData(""), null);
  assert.equal(quandoFalta(HOJE, HOJE), "Hoje");
  assert.equal(quandoFalta("2026-11-25", HOJE), "Amanhã");
  assert.equal(quandoFalta("2026-11-29", HOJE), "Em 5 dias");
  assert.equal(quandoFalta("2026-11-22", HOJE), "Há 2 dias");
});

test("início separa hoje, próximos, abertos, mês e a receber", () => {
  const lista = [
    ev("a", HOJE, "CONFIRMADO", 5000, [{ valor: 2000 }]),
    ev("b", "2026-11-30", "SINAL PAGO", 8000, [{ valor: 3000 }]),
    ev("c", "2026-12-10", "PROPOSTA ENVIADA", 4000),
    ev("d", "", "NOVO CONTATO"),
    ev("e", "2026-11-26", "CANCELADO", 9000),
    ev("f", "2027-03-01", "CONFIRMADO", 7000),
    ev("g", "2026-11-10", "FINALIZADO", 3000, [{ valor: 3000 }]),
  ];
  const r = inicioDosEventos(lista, HOJE);
  assert.deepEqual(r.hoje.map((e) => e.id), ["a"]);
  assert.deepEqual(r.proximos.map((e) => e.id), ["b", "c"]); // cancelado e longe ficam de fora
  assert.equal(r.abertos.n, 2);
  assert.equal(r.abertos.valor, 4000);
  assert.equal(r.abertos.semValor, 1);
  assert.equal(r.fechadosMes.n, 3); // a, b e g (finalizado no mês)
  assert.equal(r.fechadosMes.valor, 16000);
  assert.equal(r.aReceber, 3000 + 5000 + 7000); // finalizado não conta
  assert.equal(r.semData, 1);
});

test("sem evento fechado, a receber é null (não zero inventado)", () => {
  const r = inicioDosEventos([ev("x", "2026-12-01", "NOVO CONTATO")], HOJE);
  assert.equal(r.aReceber, null);
  assert.equal(r.fechadosMes.n, 0);
});

test("evento atrasado sem atualizar a etapa", () => {
  const r = inicioDosEventos([ev("x", "2026-11-01", "PROPOSTA ENVIADA")], HOJE);
  assert.equal(r.atrasados, 1);
});

test("pagamento do evento", () => {
  assert.deepEqual(pagamentoDoEvento(ev("a", HOJE, "CONFIRMADO", 1000, [{ valor: 400 }])), { valor: 1000, recebido: 400, falta: 600, quitado: false });
  assert.equal(pagamentoDoEvento(ev("a", HOJE, "CONFIRMADO")).falta, null);
});
