// A folha só usa a CCT quando ativada, na vigência e em competência aberta.
// node --test app/lib/trabalhista/regras-competencia.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { regrasDaCompetencia, regrasDaConvencao } from "./regras-competencia.mjs";
import { calcularAdicionaisMes, REGRAS_CLT } from "../jornada-calculo.mjs";

const ativa = { status: "ativa" };
const ponto = (data, ent, sai) => ({ data_referencia: data, hora_entrada: `${data}T${ent}:00`, hora_saida: sai });

test("sem ativação, fora da vigência ou competência fechada: CLT (nada muda)", () => {
  assert.equal(regrasDaCompetencia("2026-10").regras.id, "clt");
  assert.equal(regrasDaCompetencia("2026-10", { convencao: { status: "pendente_revisao" } }).regras.id, "clt");
  assert.equal(regrasDaCompetencia("2026-04", { convencao: ativa }).regras.id, "clt");
  assert.equal(regrasDaCompetencia("2027-05", { convencao: ativa }).regras.id, "clt");
  assert.equal(regrasDaCompetencia("2026-09", { convencao: ativa, fechada: true }).regras.id, "clt");
  assert.equal(regrasDaCompetencia("2026-10", { convencao: ativa }).regras.id, "cct-foz-hoteis-restaurantes-2026-2027");
});

test("CLT padrão: 20% noturno 22h–5h e extra +50% (comportamento de sempre)", () => {
  // 22h às 6h do dia seguinte, salário 2.200 (hora 10), jornada contratada de 7h20 = 440 min
  const pts = [ponto("2026-10-05", "22:00", "2026-10-06T06:00:00")];
  const r = calcularAdicionaisMes(pts, 2200, [], { contratadaDoDia: () => 440 });
  assert.equal(r.regras, "clt");
  assert.equal(r.minNoturno, 480); // 7h de relógio (22h–5h) com hora ficta = 480
  assert.equal(r.minExtra, 40);
  assert.equal(r.valorNoturno, 16);      // 8h × 10 × 20%
  assert.equal(r.valorExtra, 10);        // 40 min × 10 × 1,5
});

test("CCT ativa: 25% noturno até 7h, extra +100%, cita cláusulas", () => {
  const regras = regrasDaConvencao();
  const pts = [ponto("2026-10-05", "22:00", "2026-10-06T06:00:00")];
  const r = calcularAdicionaisMes(pts, 2200, [], { contratadaDoDia: () => 440, regras });
  assert.equal(r.minNoturno, 540);       // 480 (22h–5h ficta) + 60 (5h–6h relógio)
  assert.equal(r.valorNoturno, 22.5);    // 9h × 10 × 25%
  assert.equal(r.valorExtra, 13.33);     // 40 min × 10 × 2
  assert.ok(r.fundamentos.some((f) => /cl\. 13/.test(f)) && r.fundamentos.some((f) => /cl\. 10/.test(f)));
});

test("CCT ativa: jornada que começa às 5h30 não tem noturno; 18h–23h30 tem", () => {
  const regras = regrasDaConvencao();
  const manha = calcularAdicionaisMes([ponto("2026-10-05", "05:30", "2026-10-05T13:30:00")], 2200, [], { regras });
  assert.equal(manha.minNoturno, 0);
  const noite = calcularAdicionaisMes([ponto("2026-10-05", "18:00", "2026-10-05T23:30:00")], 2200, [], { regras });
  assert.equal(noite.minNoturno, 103); // 90 min de relógio com hora ficta
});

test("REGRAS_CLT continua congelado e citando a lei", () => {
  assert.ok(Object.isFrozen(REGRAS_CLT));
  assert.ok(REGRAS_CLT.fundamentos.some((f) => /CLT art\. 73/.test(f)));
});
