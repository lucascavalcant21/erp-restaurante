import { test } from "node:test";
import assert from "node:assert/strict";
import { comprovantesDoMes, mascararCpf, rotuloDaMarcacao } from "./ponto-comprovante.mjs";

test("CPF mascarado mostra só o fim", () => {
  assert.equal(mascararCpf("702.028.382-93"), "•••.•••.382-93");
  assert.equal(mascararCpf("70202838293"), "•••.•••.382-93");
  assert.equal(mascararCpf("123"), null);
  assert.equal(mascararCpf(null), null);
});

test("rótulo da marcação", () => {
  assert.equal(rotuloDaMarcacao({ tipo: "entrada" }), "Entrada");
  assert.equal(rotuloDaMarcacao({ tipo: "saida_trabalho", origem: "tablet" }), "Saída do trabalho");
  assert.equal(rotuloDaMarcacao({ tipo: "inclusao", tipo_alvo: "entrada", origem: "correcao" }), "Entrada (correção)");
  assert.equal(rotuloDaMarcacao({ tipo: "ajuste", tipo_alvo: "saida_trabalho", origem: "ajuste" }), "Saída do trabalho (correção)");
  assert.equal(rotuloDaMarcacao({ tipo: "x" }), "Marcação");
});

test("comprovantes do mês em ordem do mais novo", () => {
  const r = comprovantesDoMes([
    { id: "a", nsr: 10, tipo: "entrada", marcado_em: "2026-11-24T19:01:39Z", data_referencia: "2026-11-24", hash: "h1" },
    { id: "b", nsr: 12, tipo: "saida_intervalo", marcado_em: "2026-11-24T21:00:00Z", data_referencia: "2026-11-24" },
    { id: "c", nsr: null, tipo: "entrada" },
  ]);
  assert.deepEqual(r.map((x) => x.nsr), [12, 10]);
  assert.equal(r[1].hash, "h1");
  assert.equal(r[0].rotulo, "Saída p/ intervalo");
});
