// node --test app/lib/vinculos.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { faseDoVinculo, prorrogacaoExigeDocumento } from "./vinculos.mjs";

const exp = (extra = {}) => ({ categoria: "clt_experiencia", inicio: "2026-10-01", experiencia_dias: 30, ...extra });

test("1º período: termina no 30º dia, mostra quanto falta e permite prorrogar/efetivar", () => {
  const f = faseDoVinculo(exp(), "2026-10-13");
  assert.equal(f.id, "experiencia_1"); assert.equal(f.fim, "2026-10-30"); assert.equal(f.faltam, 17);
  assert.deepEqual(f.acoes, ["prorrogacao", "efetivacao", "alteracao_salarial"]);
  assert.equal(f.alerta, null);
  assert.match(faseDoVinculo(exp(), "2026-10-15").alerta, /Decidir até 30\/10\/2026/); // 15 dias
});

test("1º período terminado sem prorrogação: pede contrato ou efetivação", () => {
  const f = faseDoVinculo(exp({ inicio: "2026-06-23" }), "2026-10-13");
  assert.equal(f.id, "experiencia_sem_prorrogacao");
  assert.match(f.alerta, /anexando o contrato/);
  assert.equal(prorrogacaoExigeDocumento(exp({ inicio: "2026-06-23" }), "2026-10-13"), true);
  assert.equal(prorrogacaoExigeDocumento(exp(), "2026-10-13"), false);
});

test("prorrogada: 30+60 termina no 90º dia; não oferece 2ª prorrogação", () => {
  const f = faseDoVinculo(exp({ prorrogacao_dias: 60 }), "2026-12-20");
  assert.equal(f.id, "experiencia_2"); assert.equal(f.fim, "2026-12-29");
  assert.ok(!f.acoes.includes("prorrogacao"));
  assert.equal(faseDoVinculo(exp({ prorrogacao_dias: 60 }), "2027-01-05").id, "experiencia_vencida");
});

test("indeterminado, extra e encerrado", () => {
  assert.equal(faseDoVinculo({ categoria: "clt_indeterminado", inicio: "2026-03-01" }, "2026-10-13").id, "indeterminado");
  const extra = faseDoVinculo({ categoria: "eventual", inicio: "2026-05-02", inicio_estimado: true }, "2026-10-13");
  assert.match(extra.detalhe, /data estimada/); assert.ok(extra.acoes.includes("mudanca_categoria"));
  assert.equal(faseDoVinculo({ categoria: "clt_indeterminado", inicio: "2025-05-08", fim: "2025-12-01", motivo_fim: "pedido de demissão" }, "2026-10-13").id, "encerrado");
  assert.equal(faseDoVinculo(null, "2026-10-13").id, "sem_vinculo");
});

import fs from "node:fs";
test("tela: transições só pelas funções do banco; aba de contratos usa os vínculos", () => {
  const dados = fs.readFileSync(new URL("./vinculos-dados.js", import.meta.url), "utf8");
  assert.match(dados, /rpc\("rh_transicao_solicitar"/);
  assert.match(dados, /rpc\("rh_transicao_decidir"/);
  assert.doesNotMatch(dados, /from\("rh_vinculos"\)\.(insert|update|delete)/);
  const pagina = fs.readFileSync(new URL("../dashboard/rh/funcionario/[id]/page.js", import.meta.url), "utf8");
  assert.match(pagina, /<VinculosAba /);
  assert.match(pagina, /dp\.contratos\.aprovar/);
});
