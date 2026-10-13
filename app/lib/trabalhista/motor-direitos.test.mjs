// node --test app/lib/trabalhista/motor-direitos.test.mjs
// Valores esperados conferidos à mão contra as tabelas de 2026.
import test from "node:test";
import assert from "node:assert/strict";
import { divisorMensal, valorHora, dsrSobreVariaveis, inssEmpregado, fgts, irrf, provisoesMensais, calcularMes } from "./motor-direitos.mjs";
import { tabelaDaCompetencia } from "./tabelas-oficiais.mjs";
import { regrasDaConvencao } from "./regras-competencia.mjs";

const perto = (a, b) => assert.ok(Math.abs(a - b) <= 0.01, `${a} ≠ ${b}`);

test("tabela pela competência: 2025 usa a de 2025, 2026 a de 2026, antes de 2025 não há", () => {
  assert.equal(tabelaDaCompetencia("2025-12").desde, "2025-01");
  assert.equal(tabelaDaCompetencia("2026-10").desde, "2026-01");
  assert.equal(tabelaDaCompetencia("2024-06"), null);
});

test("valor-hora: divisor 220 para 44h, proporcional para jornada menor; diária sem horas não inventa", () => {
  assert.equal(divisorMensal(44), 220);
  assert.equal(divisorMensal(36), 180);
  perto(valorHora({ regra: "mensal", salario: 2321.4 }).valor, 10.55);
  assert.equal(valorHora({ regra: "diaria", salario: 120 }).valor, null);
  assert.equal(valorHora({ regra: "diaria", salario: 120, horasDia: 8 }).valor, 15);
});

test("DSR sobre variáveis: variáveis ÷ dias úteis × dias de descanso", () => {
  assert.equal(dsrSobreVariaveis({ variaveis: 300, diasUteis: 25, diasDescanso: 5 }).valor, 60);
  assert.ok(dsrSobreVariaveis({ variaveis: 300 }).faltando);
});

test("INSS 2026 progressivo: piso da CCT e teto", () => {
  perto(inssEmpregado(2321.4, "2026-10").valor, 184.61);
  perto(inssEmpregado(8475.55, "2026-10").valor, 988.09);
  perto(inssEmpregado(20000, "2026-10").valor, 988.09);
  assert.equal(inssEmpregado(20000, "2026-10").acimaDoTeto, true);
  perto(inssEmpregado(1518, "2025-06").valor, 113.85);
  assert.equal(inssEmpregado(2000, "2024-01").valor, null);
});

test("FGTS 8%, aprendiz 2%", () => {
  assert.equal(fgts(2321.4).valor, 185.71);
  assert.equal(fgts(1000, { aprendiz: true }).valor, 20);
});

test("IRRF 2026: isento até R$ 5.000; redução da Lei 15.270 entre 5.000 e 7.350; sem tabela não calcula", () => {
  assert.equal(irrf({ rendimento: 4000, inss: inssEmpregado(4000, "2026-10").valor }, "2026-10").valor, 0);
  assert.equal(irrf({ rendimento: 5000, inss: inssEmpregado(5000, "2026-10").valor }, "2026-10").valor, 0);
  perto(irrf({ rendimento: 6000, inss: inssEmpregado(6000, "2026-10").valor }, "2026-10").valor, 385.10);
  // acima de 7.350: sem redução
  const i = inssEmpregado(10000, "2026-10").valor;
  perto(irrf({ rendimento: 10000, inss: i }, "2026-10").valor, (10000 - i) * 0.275 - 908.73);
  assert.equal(irrf({ rendimento: 6000 }, "2025-10").valor, null);
});

test("provisões: 1/12 de férias, 1/3, 1/12 de 13º e FGTS sobre elas", () => {
  const p = Object.fromEntries(provisoesMensais({ remuneracao: 1200 }).map((l) => [l.codigo, l.valor]));
  assert.deepEqual(p, { prov_ferias: 100, prov_terco: 33.33, prov_13: 100, prov_fgts: 18.67 });
});

const regras = regrasDaConvencao();

test("mês CLT: rótulos vêm da regra vigente (CCT 100% / 25%), INSS 2026, FGTS e provisões; nasce simulação", () => {
  const r = calcularMes({ categoria: "clt_indeterminado", regra_remuneracao: "mensal", salario_base: 2321.4 },
    { competencia: "2026-10", adicionais: { valorExtra: 100, valorNoturno: 50 }, diasUteis: 25, diasDescanso: 6, taxaServico: 300, valeAlimentacao: 200, regras });
  assert.equal(r.situacao, "simulacao");
  const l = Object.fromEntries(r.linhas.map((x) => [x.codigo, x]));
  assert.equal(l.extra.descricao, "Horas extras (+100%)");
  assert.equal(l.noturno.descricao, "Adicional noturno (+25%)");
  assert.equal(l.dsr.valor, 36);
  // base tributável: salário + extras + noturno + DSR + taxa (VA fora)
  perto(r.totais.baseTributavel, 2321.4 + 100 + 50 + 36 + 300);
  perto(l.inss.valor, inssEmpregado(2807.4, "2026-10").valor);
  perto(l.fgts.valor, 2807.4 * 0.08);
  assert.equal(r.totais.liquido, Math.round((2807.4 + 200 - l.inss.valor) * 100) / 100);
  assert.ok(l.prov_13 && l.va.exigeRevisao);
  assert.ok(r.pendencias.some((p) => p.includes("regime tributário")));
});

test("mês sem dias úteis: DSR vira pendência, não um número", () => {
  const r = calcularMes({ categoria: "clt_experiencia", salario_base: 2321.4 }, { competencia: "2026-10", adicionais: { valorExtra: 100 }, regras });
  assert.ok(!r.linhas.some((x) => x.codigo === "dsr"));
  assert.ok(r.pendencias.some((p) => p.includes("DSR")));
});

test("eventual, outro e sem vínculo não viram folha CLT", () => {
  const ev = calcularMes({ categoria: "eventual", salario_base: 150 }, { competencia: "2026-10" });
  assert.equal(ev.totais, null);
  assert.ok(ev.pendencias.some((p) => p.includes("habitualidade")));
  assert.equal(calcularMes({ categoria: "outro" }, { competencia: "2026-10" }).totais, null);
  assert.equal(calcularMes(null, { competencia: "2026-10" }).totais, null);
});

test("intermitente: paga férias + 1/3 e 13º proporcionais na parcela, sem provisão, marcado para revisão", () => {
  const r = calcularMes({ categoria: "intermitente", salario_base: 1200 }, { competencia: "2026-10", regras });
  const l = Object.fromEntries(r.linhas.map((x) => [x.codigo, x]));
  assert.equal(l.int_ferias.valor, 133.33);
  assert.equal(l.int_13.valor, 100);
  assert.ok(l.int_13.exigeRevisao);
  assert.ok(!l.prov_ferias);
});

test("competência sem tabela oficial: INSS vira pendência, não usa a tabela mais próxima", () => {
  const r = calcularMes({ categoria: "clt_indeterminado", salario_base: 2000 }, { competencia: "2024-05", regras });
  assert.ok(!r.linhas.some((x) => x.codigo === "inss"));
  assert.ok(r.pendencias.some((p) => p.startsWith("INSS não calculado")));
});

import { diasDoMes } from "./motor-direitos.mjs";
test("dias do mês: outubro/2026 tem 4 domingos; feriado de 12/10 (segunda) soma ao descanso", () => {
  assert.deepEqual(diasDoMes("2026-10"), { diasUteis: 27, diasDescanso: 4 });
  assert.deepEqual(diasDoMes("2026-10", [{ data: "2026-10-12" }]), { diasUteis: 26, diasDescanso: 5 });
  assert.deepEqual(diasDoMes("2026-10", [{ data: "2026-10-04" }]), { diasUteis: 27, diasDescanso: 4 }); // domingo não conta 2x
});

import { mesmoResultado, SITUACOES } from "./motor-direitos.mjs";
test("cálculo gravado x atual: iguais nos centavos; diferente quando o ponto muda", () => {
  const a = { totais: { proventos: 100, beneficios: 0, descontos: 7.5, liquido: 92.5, encargos: 8, provisoes: 22 } };
  assert.equal(mesmoResultado(a, { totais: { ...a.totais, liquido: 92.5000001 } }), true);
  assert.equal(mesmoResultado(a, { totais: { ...a.totais, liquido: 93 } }), false);
  assert.equal(mesmoResultado(null, a), false);
  // as situações da tela são as mesmas do banco (RH-5)
  assert.deepEqual(Object.keys(SITUACOES), ["simulacao", "calculo_validado", "pagamento_registrado", "obrigacao_cumprida", "substituido"]);
});
