// Testes das regras da CCT Foz 2026/2027 (HDEV-RH-001).
// node --test app/lib/trabalhista/regras-cct.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  validarExperiencia, alertasExperiencia, adicionalNoturno, horasExtras, feriadoTrabalhado, avisoPrevio,
  quinquenio, conferirPiso, auxilioCreche, avosFerias, domingoNoMes, escalaPublicadaATempo, conferirIntervalo,
  prazoRescisao, adiantamentoObrigatorio, contribuicaoNegocial, anosCompletos,
} from "./regras-cct.mjs";
import { CCT_FOZ_2026_2027, citar } from "./cct-foz-2026-2027.mjs";

// ── Experiência: os cinco formatos pedidos ──
for (const [p1, p2, ok, motivo] of [
  [30, 30, true], [30, 60, true], [45, 45, true],
  [45, 30, false, /não pode ser menor que o 1º período/], [60, 30, false, /não pode ser menor que o 1º período/],
]) {
  test(`experiência ${p1}+${p2}: ${ok ? "válida" : "inválida"}`, () => {
    const v = validarExperiencia({ inicio: "2026-05-01", primeiro: p1, prorrogacao: p2 });
    assert.equal(v.ok, ok);
    if (!ok) { assert.match(v.erros[0].msg, motivo); assert.match(v.erros[0].fonte, /cl\. 19 §3º, p\. 4/); }
    assert.equal(v.totalDias, p1 + p2);
    assert.ok(v.fundamentos.some((f) => /cl\. 19/.test(f)));
  });
}

test("experiência: datas contam o dia de início; 30+60 termina no 90º dia", () => {
  const v = validarExperiencia({ inicio: "2026-05-01", primeiro: 30, prorrogacao: 60 });
  assert.equal(v.fimPrimeiro, "2026-05-30");
  assert.equal(v.fimTotal, "2026-07-29");
});

test("experiência: menos de 30 dias e mais de 90 no total são recusados", () => {
  assert.match(validarExperiencia({ inicio: "2026-05-01", primeiro: 20, prorrogacao: 20 }).erros[0].fonte, /cl\. 19 §1º/);
  const v = validarExperiencia({ inicio: "2026-05-01", primeiro: 50, prorrogacao: 50 });
  assert.equal(v.ok, false);
  assert.ok(v.erros.some((e) => /somam 100 dias/.test(e.msg)));
});

test("experiência: readmissão na mesma função antes de 2 anos é vedada; outra função ou depois de 2 anos, não", () => {
  assert.equal(validarExperiencia({ inicio: "2026-06-01", primeiro: 30, readmissao: { desligadoEm: "2025-01-10", mesmaFuncao: true } }).ok, false);
  assert.equal(validarExperiencia({ inicio: "2026-06-01", primeiro: 30, readmissao: { desligadoEm: "2025-01-10", mesmaFuncao: false } }).ok, true);
  assert.equal(validarExperiencia({ inicio: "2027-02-01", primeiro: 30, readmissao: { desligadoEm: "2025-01-10", mesmaFuncao: true } }).ok, true);
});

test("alertas da experiência: 15, 7, 3 e 1 dia antes; depois vence", () => {
  const c = { inicio: "2026-05-01", primeiro: 45, prorrogacao: 45 }; // 1º período termina 14/06
  assert.equal(alertasExperiencia(c, "2026-05-30").marco, 15);
  assert.equal(alertasExperiencia(c, "2026-06-07").marco, 7);
  assert.equal(alertasExperiencia(c, "2026-06-13").marco, 1);
  assert.equal(alertasExperiencia(c, "2026-06-10").alertarHoje, false);
  assert.ok(alertasExperiencia(c, "2026-06-13").decisoes.includes("prorrogar uma vez"));
  const prorrogado = alertasExperiencia({ ...c, prorrogado: true }, "2026-07-29");
  assert.equal(prorrogado.fim, "2026-07-29");
  assert.ok(!prorrogado.decisoes.includes("prorrogar uma vez")); // só uma prorrogação
});

// ── Adicional noturno: 25%, 22h–7h ──
test("noturno: 18h–23h30 paga só 22h–23h30 (90 min de relógio, hora reduzida = 102,86 min)", () => {
  const n = adicionalNoturno({ entrada: "18:00", saida: "23:30", valorHora: 12 });
  assert.equal(n.minutosNoturnosRelogio, 90);
  assert.equal(n.minutosNoturnosPagos, 102.86);
  assert.equal(n.adicionalPct, 25);
  assert.equal(n.valor, 5.14); // 12 × 1,7143 h × 25%
  assert.equal(n.exigeRevisao, false);
  assert.ok(n.fundamentos[0].includes("cl. 13"));
});

test("noturno: atravessa a meia-noite (23h–3h) com intervalo de 1h não pago", () => {
  const n = adicionalNoturno({ entrada: "23:00", saida: "03:00", intervalos: [["01:00", "02:00"]], valorHora: 10 });
  assert.equal(n.minutosNoturnosRelogio, 180);
});

test("noturno: 22h–7h conta a faixa da CCT até 7h; 5h–7h vai para revisão (hora reduzida)", () => {
  const n = adicionalNoturno({ entrada: "22:00", saida: "07:00", valorHora: 10 });
  assert.equal(n.minutosNoturnosRelogio, 540);
  assert.equal(n.minutosEntre22e05, 420);
  assert.equal(n.exigeRevisao, true);
  const janela = adicionalNoturno({ entrada: "22:00", saida: "07:00", valorHora: 10, horaReduzida: "janela" });
  assert.ok(janela.minutosNoturnosPagos > n.minutosNoturnosPagos); // as duas leituras ficam à vista
});

test("noturno: jornada que começa depois das 5h não é noturna (cl. 13 §2º)", () => {
  const n = adicionalNoturno({ entrada: "05:30", saida: "14:00", valorHora: 10 });
  assert.equal(n.minutosNoturnosRelogio, 0);
  assert.equal(n.excluidaPorInicioAposCinco, true);
  assert.equal(n.valor, 0);
  // começou às 4h: 4h–7h conta
  assert.equal(adicionalNoturno({ entrada: "04:00", saida: "12:00" }).minutosNoturnosRelogio, 180);
});

test("noturno: jornada diurna não tem adicional", () => {
  assert.equal(adicionalNoturno({ entrada: "08:00", saida: "16:00", valorHora: 10 }).valor, 0);
});

// ── Horas extras: 100% ──
test("horas extras com adicional de 100% (cl. 10)", () => {
  const h = horasExtras({ minutos: 90, valorHora: 10.55 });
  assert.equal(h.adicionalPct, 100);
  assert.equal(h.valorTotal, 31.65); // 1,5 h × 10,55 × 2
  assert.equal(h.valorAdicional, 15.83);
  assert.match(h.fundamentos[0], /cl\. 10, p\. 2/);
});

// ── Feriados trabalhados ──
test("feriado: compensado no prazo, antecipado no mês, fora do prazo e vencido em dobro", () => {
  assert.equal(feriadoTrabalhado({ feriado: "2026-11-02", compensadoEm: "2026-11-20", hoje: "2026-11-25" }).situacao, "compensado");
  assert.equal(feriadoTrabalhado({ feriado: "2026-11-15", compensadoEm: "2026-11-03", hoje: "2026-11-25" }).situacao, "compensado");
  assert.equal(feriadoTrabalhado({ feriado: "2026-11-02", compensadoEm: "2026-10-28", hoje: "2026-11-25" }).situacao, "compensacao_fora_do_prazo");
  const venc = feriadoTrabalhado({ feriado: "2026-11-02", hoje: "2026-12-05" });
  assert.equal(venc.situacao, "pagar_em_dobro");
  assert.equal(venc.prazo, "2026-12-02");
  assert.equal(feriadoTrabalhado({ feriado: "2026-11-02", hoje: "2026-11-10" }).situacao, "pendente");
});

// ── Aviso prévio ──
test("aviso prévio: tabela da cl. 23 (30 + 3/ano, até 90), cumprido até 30 e resto indenizado", () => {
  assert.equal(avisoPrevio({ admissao: "2026-01-10", desligamento: "2026-10-10" }).diasTotais, 30);
  const a = avisoPrevio({ admissao: "2021-03-01", desligamento: "2026-10-10" }); // 5 anos
  assert.equal(a.diasTotais, 45); assert.equal(a.diasCumpridos, 30); assert.equal(a.diasIndenizados, 15);
  assert.equal(avisoPrevio({ admissao: "2000-01-01", desligamento: "2026-10-10" }).diasTotais, 90);
  assert.equal(a.exigeRevisao, true);
});

test("quinquênio: 2% a cada 5 anos desde 01/07/2005, teto 10%", () => {
  assert.equal(quinquenio({ admissao: "2020-01-01", referencia: "2026-10-01", salarioBase: 2321.40 }).pct, 2);
  const velho = quinquenio({ admissao: "1999-01-01", referencia: "2036-10-01", salarioBase: 3000 });
  assert.equal(velho.contadoDesde, "2005-07-01"); assert.equal(velho.pct, 10); assert.equal(velho.valor, 300);
});

test("piso: R$ 2.321,40; aprendiz pelo salário mínimo; jornada parcial vai para revisão", () => {
  assert.equal(conferirPiso({ salarioMensal: 2200 }).abaixoDoPiso, true);
  assert.equal(conferirPiso({ salarioMensal: 2200 }).diferenca, 121.40);
  assert.equal(conferirPiso({ salarioMensal: 2400 }).abaixoDoPiso, false);
  assert.equal(conferirPiso({ salarioMensal: 1500, aprendiz: true }).abaixoDoPiso, null);
  assert.equal(conferirPiso({ salarioMensal: 1200, jornadaParcial: true }).exigeRevisao, true);
});

test("auxílio-creche: até R$ 633, só com requerimento no prazo e nota em nome do empregado", () => {
  const base = { matricula: "2026-02-01", requeridoEm: "2026-02-20", fimPeriodoLetivoSeisAnos: "2028-12-15", mesReferencia: "2026-10", notaEmNomeDoEmpregado: true };
  assert.equal(auxilioCreche({ ...base, valorNota: 900 }).valorReembolso, 633);
  assert.equal(auxilioCreche({ ...base, valorNota: 400 }).valorReembolso, 400);
  assert.equal(auxilioCreche({ ...base, requeridoEm: "2026-04-01", valorNota: 400 }).elegivel, false);
  assert.equal(auxilioCreche({ ...base, notaEmNomeDoEmpregado: false, valorNota: 400 }).valorReembolso, 0);
  assert.equal(auxilioCreche({ ...base, mesReferencia: "2029-02", valorNota: 400 }).elegivel, false);
});

test("férias proporcionais: 1/12 por mês ou fração acima de 14 dias; justa causa sem avos", () => {
  assert.equal(avosFerias({ inicioPeriodo: "2026-01-10", fim: "2026-04-24" }).avos, 4); // 3 meses + 15 dias
  assert.equal(avosFerias({ inicioPeriodo: "2026-01-10", fim: "2026-04-20" }).avos, 3); // 3 meses + 11 dias
  assert.equal(avosFerias({ inicioPeriodo: "2026-01-10", fim: "2026-04-20", justaCausa: true }).avos, 0);
});

test("escala: domingo de folga no mês, publicação 7 dias antes e intervalo de 1h a 5h", () => {
  assert.equal(domingoNoMes({ folgas: ["2026-10-04", "2026-10-15"], ano: 2026, mes: 10 }).ok, true); // 04/10/2026 é domingo
  assert.equal(domingoNoMes({ folgas: ["2026-10-06"], ano: 2026, mes: 10 }).ok, false);
  assert.equal(escalaPublicadaATempo({ publicadaEm: "2026-10-01", inicioEscala: "2026-10-08" }).ok, true);
  assert.equal(escalaPublicadaATempo({ publicadaEm: "2026-10-03", inicioEscala: "2026-10-08" }).ok, false);
  assert.equal(conferirIntervalo({ jornadaMin: 480, intervaloMin: 240 }).ok, true);
  assert.equal(conferirIntervalo({ jornadaMin: 480, intervaloMin: 330 }).ok, false);
  assert.equal(conferirIntervalo({ jornadaMin: 480, intervaloMin: 45 }).ok, false);
});

test("rescisão em 8 dias, adiantamento só com 20+ empregados, contribuição negocial nunca automática", () => {
  assert.equal(prazoRescisao({ termino: "2026-10-10" }).pagarAte, "2026-10-18");
  assert.equal(adiantamentoObrigatorio({ empregados: 16 }).obrigatorio, false);
  assert.equal(adiantamentoObrigatorio({ empregados: 25 }).obrigatorio, true);
  assert.equal(adiantamentoObrigatorio({ empregados: 25, recusaExpressa: true }).obrigatorio, false);
  const c = contribuicaoNegocial();
  assert.equal(c.descontoAutomatico, false); assert.equal(c.exigeRevisao, true);
});

test("fonte: toda regra com cálculo cita cláusula e página", () => {
  for (const [nome, regra] of Object.entries(CCT_FOZ_2026_2027)) {
    if (regra && typeof regra === "object" && "status" in regra) {
      assert.ok(regra.fonte?.clausula && regra.fonte?.pagina, `${nome} sem cláusula/página`);
      assert.ok(["implementada", "parametrizacao", "juridica", "informativa"].includes(regra.status), `${nome} status`);
    }
  }
  assert.equal(citar({ clausula: 13, paragrafo: "2º", pagina: 3 }), "CCT Foz 2026/2027, cl. 13 §2º, p. 3");
  assert.equal(citar({ clausula: 3, paragrafo: "único", pagina: 1 }), "CCT Foz 2026/2027, cl. 3 parágrafo único, p. 1");
  assert.equal(anosCompletos("2021-10-14", "2026-10-13"), 4);
});
