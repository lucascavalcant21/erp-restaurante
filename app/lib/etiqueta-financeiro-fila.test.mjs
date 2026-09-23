import test from "node:test";
import assert from "node:assert/strict";
import { autorizacaoDoCron, saudeDaFila, STATUS, MAX_TENTATIVAS } from "./etiqueta-financeiro-fila.mjs";

test("sem CRON_SECRET configurado, o drenador não abre", () => {
  // Um endpoint que lança em contas a pagar não pode ficar aberto porque
  // alguém esqueceu de configurar o segredo.
  assert.equal(autorizacaoDoCron({ segredoEsperado: "" }).ok, false);
  assert.equal(autorizacaoDoCron({ segredoEsperado: "   " }).ok, false);
  assert.equal(autorizacaoDoCron({ authorization: "Bearer x", segredoEsperado: "" }).ok, false);
  assert.equal(autorizacaoDoCron({ vercelCron: "1", segredoEsperado: "" }).ok, false);
});

test("as três formas de entrar, e só elas", () => {
  const s = "segredo-123";
  assert.deepEqual(autorizacaoDoCron({ vercelCron: "1", segredoEsperado: s }), { ok: true, origem: "vercel-cron" });
  assert.deepEqual(autorizacaoDoCron({ authorization: "Bearer segredo-123", segredoEsperado: s }), { ok: true, origem: "bearer" });
  assert.deepEqual(autorizacaoDoCron({ segredoParam: "segredo-123", segredoEsperado: s }), { ok: true, origem: "query" });

  assert.equal(autorizacaoDoCron({ authorization: "Bearer errado", segredoEsperado: s }).ok, false);
  assert.equal(autorizacaoDoCron({ segredoParam: "errado", segredoEsperado: s }).ok, false);
  assert.equal(autorizacaoDoCron({ authorization: "segredo-123", segredoEsperado: s }).ok, false); // sem "Bearer "
  assert.equal(autorizacaoDoCron({ segredoEsperado: s }).ok, false);
});

test("fila saudável não pede atenção", () => {
  const agora = new Date("2026-09-23T18:00:00Z");
  const r = saudeDaFila([
    { unidade_id: "u1", pendentes: 2, processando: 0, com_erro: 0, valor_em_aberto: "31.50", mais_antiga: "2026-09-23T17:30:00Z" },
  ], { agora });
  assert.equal(r.pendentes, 2);
  assert.equal(r.comErro, 0);
  assert.equal(r.valorEmAberto, 31.5);
  assert.equal(r.atrasoHoras, 0.5);
  assert.equal(r.precisaAtencao, false);
});

test("erro pede atenção na hora; atraso longo também, mesmo sem erro", () => {
  const agora = new Date("2026-09-23T18:00:00Z");
  assert.equal(saudeDaFila([{ pendentes: 0, com_erro: 1, valor_em_aberto: 10, mais_antiga: "2026-09-23T17:59:00Z" }], { agora }).precisaAtencao, true);
  // Sem erro, mas a mais antiga tem 30 h: o cron parou de rodar.
  assert.equal(saudeDaFila([{ pendentes: 3, com_erro: 0, valor_em_aberto: 10, mais_antiga: "2026-09-22T12:00:00Z" }], { agora }).precisaAtencao, true);
  // Fila vazia é saudável, não é alerta.
  assert.equal(saudeDaFila([], { agora }).precisaAtencao, false);
  assert.equal(saudeDaFila([], { agora }).maisAntiga, null);
});

test("soma várias unidades e pega a pendência mais antiga de todas", () => {
  const agora = new Date("2026-09-23T18:00:00Z");
  const r = saudeDaFila([
    { unidade_id: "u1", pendentes: 1, processando: 1, com_erro: 0, valor_em_aberto: 10, mais_antiga: "2026-09-23T16:00:00Z" },
    { unidade_id: "u2", pendentes: 2, processando: 0, com_erro: 2, valor_em_aberto: 5.25, mais_antiga: "2026-09-23T10:00:00Z" },
  ], { agora });
  assert.equal(r.pendentes, 3);
  assert.equal(r.processando, 1);
  assert.equal(r.comErro, 2);
  assert.equal(r.valorEmAberto, 15.25);
  assert.equal(r.atrasoHoras, 8);
  assert.equal(r.precisaAtencao, true);
});

test("os estados da fila são os cinco combinados", () => {
  assert.deepEqual(Object.values(STATUS).sort(),
    ["dispensado", "erro", "lancado", "pendente", "processando"]);
  assert.equal(MAX_TENTATIVAS, 5);
});
