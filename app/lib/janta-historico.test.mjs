import test from "node:test";
import assert from "node:assert/strict";
import { mesesDoHistorico, registrarNoHistorico, registroDoDia, resumoDoMes, tirarDoHistorico } from "./janta-historico.mjs";

const calc = (pessoas, custo, semCusto = 0) => ({ pessoas, custo, semCusto, pratos: [{ fixo: true, nome: "Todo dia" }, { nome: "Almôndegas" }] });

test("registro do dia: custo, por pessoa e natureza", () => {
  const r = registroDoDia("2026-11-24", "ter", calc(12, 96));
  assert.equal(r.custoPorPessoa, 8);
  assert.equal(r.natureza, "REAL");
  assert.deepEqual(r.pratos, ["Almôndegas"]);
  const est = registroDoDia("2026-11-24", "ter", calc(12, 96, 1));
  assert.equal(est.natureza, "ESTIMATIVA");
  const sem = registroDoDia("2026-11-24", "ter", calc(12, 0, 3));
  assert.equal(sem.custo, null);
  assert.equal(sem.custoPorPessoa, null);
});

test("histórico: um registro por data, mais recente primeiro", () => {
  let h = registrarNoHistorico([], registroDoDia("2026-11-23", "seg", calc(10, 70)));
  h = registrarNoHistorico(h, registroDoDia("2026-11-24", "ter", calc(12, 96)));
  h = registrarNoHistorico(h, registroDoDia("2026-11-24", "ter", calc(14, 112))); // corrigiu o dia
  assert.equal(h.length, 2);
  assert.equal(h[0].data, "2026-11-24");
  assert.equal(h[0].pessoas, 14);
  assert.deepEqual(mesesDoHistorico([...h, { data: "2026-10-01" }]), ["2026-11", "2026-10"]);
  assert.equal(tirarDoHistorico(h, "2026-11-23").length, 1);
});

test("resumo do mês: total, média por dia e por pessoa", () => {
  let h = [];
  h = registrarNoHistorico(h, registroDoDia("2026-11-23", "seg", calc(10, 70)));
  h = registrarNoHistorico(h, registroDoDia("2026-11-24", "ter", calc(14, 112)));
  h = registrarNoHistorico(h, registroDoDia("2026-11-25", "qua", calc(12, 0, 2))); // sem preço
  const r = resumoDoMes(h, "2026-11");
  assert.equal(r.dias, 3);
  assert.equal(r.diasComCusto, 2);
  assert.equal(r.custoTotal, 182);
  assert.equal(r.mediaPorDia, 91);
  assert.equal(r.mediaPorPessoa, 7.58); // 182 ÷ 24 pessoas dos dias com custo
  assert.equal(r.natureza, "ESTIMATIVA"); // um dia ficou sem custo
  assert.equal(resumoDoMes(h, "2026-10").custoTotal, null);
});
