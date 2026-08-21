// Testes do cálculo de adicionais. Rode com: node app/lib/jornada-calculo.test.mjs
//
// Os casos usam a jornada real da casa (15:40 → 00:00 com 1h de intervalo)
// porque é nela que o erro do noturno aparecia todo dia.

import {
  minutosNoturnosRelogio, comHoraFicta, minutosTrabalhados, aplicarTolerancia,
  jornadaContratadaMin, calcularAdicionaisPorDia,
} from "./jornada-calculo.mjs";

let falhas = 0;
function conferir(nome, obtido, esperado) {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `  (obtido ${obtido}, esperado ${esperado})`}`);
}

const em = (dataHora) => new Date(`${dataHora}:00`).toISOString();

// ── Noturno: a faixa é 22h–5h, não 23h30–00h ───────────────────────────────
conferir("turno 15:40-00:00 tem 2h de relogio na faixa noturna",
  minutosNoturnosRelogio(em("2026-08-04T15:40"), em("2026-08-05T00:00")), 120);

conferir("2h de relogio viram 137 min com a hora ficta",
  comHoraFicta(120), 137);

conferir("intervalo fora da faixa nao muda o noturno",
  minutosNoturnosRelogio(em("2026-08-04T15:40"), em("2026-08-05T00:00"),
    em("2026-08-04T17:00"), em("2026-08-04T18:00")), 120);

conferir("intervalo DENTRO da faixa e descontado",
  minutosNoturnosRelogio(em("2026-08-04T21:00"), em("2026-08-05T01:00"),
    em("2026-08-04T22:30"), em("2026-08-04T23:00")), 150);

conferir("madrugada ate 05:00 conta inteira",
  minutosNoturnosRelogio(em("2026-08-04T23:00"), em("2026-08-05T05:00")), 360);

conferir("depois das 05:00 nao e mais noturno",
  minutosNoturnosRelogio(em("2026-08-04T23:00"), em("2026-08-05T07:00")), 360);

conferir("quem entra 01:00 pega a noite que comecou ontem",
  minutosNoturnosRelogio(em("2026-08-05T01:00"), em("2026-08-05T04:00")), 180);

conferir("turno diurno nao tem noturno",
  minutosNoturnosRelogio(em("2026-08-04T09:00"), em("2026-08-04T17:20")), 0);

// ── Minutos trabalhados ────────────────────────────────────────────────────
conferir("15:40 as 00:00 com 1h de intervalo sao 7h20",
  minutosTrabalhados({
    hora_entrada: em("2026-08-04T15:40"), hora_saida: em("2026-08-05T00:00"),
    hora_saida_intervalo: em("2026-08-04T17:00"), hora_retorno_intervalo: em("2026-08-04T18:00"),
  }), 440);

conferir("sem intervalo registrado conta o periodo inteiro",
  minutosTrabalhados({ hora_entrada: em("2026-08-04T15:40"), hora_saida: em("2026-08-05T00:00") }), 500);

// ── Tolerância (art. 58 §1º + Súmula 366) ──────────────────────────────────
conferir("5 min de excedente nao viram extra", aplicarTolerancia(5).minutos, 0);
conferir("6 min viram 6, nao 1 (Sumula 366)", aplicarTolerancia(6).minutos, 6);
conferir("dentro da tolerancia consome o teto do dia", aplicarTolerancia(4).consumido, 4);
conferir("teto do dia esgotado acaba a folga", aplicarTolerancia(3, 5, 0).minutos, 3);
conferir("teto restante menor que a tolerancia limita a folga", aplicarTolerancia(4, 5, 2).minutos, 4);

// ── Jornada contratada ─────────────────────────────────────────────────────
const alice = {
  horario_entrada: "15:40", horario_saida: "00:00", tempo_intervalo: 60,
  horario_dom_entrada: "11:00", horario_dom_saida: "19:20",
};
conferir("terca: 15:40-00:00 menos 1h = 440 min", jornadaContratadaMin(alice, "2026-08-04"), 440);
conferir("domingo usa o horario proprio", jornadaContratadaMin(alice, "2026-08-02"), 440);
conferir("sem horario cadastrado devolve null", jornadaContratadaMin({}, "2026-08-04"), null);

// ── Cálculo do dia inteiro ─────────────────────────────────────────────────
const contratadaDoDia = (data) => jornadaContratadaMin(alice, data);

const umDia = [{
  data_referencia: "2026-08-04",
  hora_entrada: em("2026-08-04T15:40"), hora_saida: em("2026-08-05T00:00"),
  hora_saida_intervalo: em("2026-08-04T17:00"), hora_retorno_intervalo: em("2026-08-04T18:00"),
}];

const r1 = calcularAdicionaisPorDia(umDia, [], { contratadaDoDia })[0];
conferir("dia cheio: noturno de 137 min", r1.minNoturno, 137);
conferir("dia cheio: sem hora extra", r1.minExtra, 0);

// Saiu 00:24 — 24 min acima da jornada, fora da tolerância.
const comExtra = [{
  data_referencia: "2026-08-04",
  hora_entrada: em("2026-08-04T15:40"), hora_saida: em("2026-08-05T00:24"),
  hora_saida_intervalo: em("2026-08-04T17:00"), hora_retorno_intervalo: em("2026-08-04T18:00"),
}];
const r2 = calcularAdicionaisPorDia(comExtra, [], { contratadaDoDia })[0];
conferir("saiu 00:24 gera 24 min de extra", r2.minExtra, 24);
// A faixa noturna vai ate 05h: quem fica ate 00:24 tem 144 min de relogio na
// faixa, nao 120. O noturno cresce junto com a hora extra.
conferir("saiu 00:24 estende o noturno para 144 min de relogio", r2.minNoturno, 165);

// Saiu 00:03 — dentro da tolerância.
const dentroTol = [{
  data_referencia: "2026-08-04",
  hora_entrada: em("2026-08-04T15:40"), hora_saida: em("2026-08-05T00:03"),
  hora_saida_intervalo: em("2026-08-04T17:00"), hora_retorno_intervalo: em("2026-08-04T18:00"),
}];
conferir("saiu 00:03 nao gera extra",
  calcularAdicionaisPorDia(dentroTol, [], { contratadaDoDia })[0].minExtra, 0);

// Turno de domingo da chefe de cozinha: 09:00-17:20, sem noturno nenhum.
const chefe = { horario_entrada: "09:00", horario_saida: "17:20", tempo_intervalo: 60 };
const domingoChefe = [{
  data_referencia: "2026-08-02",
  hora_entrada: em("2026-08-02T09:00"), hora_saida: em("2026-08-02T20:00"),
  hora_saida_intervalo: em("2026-08-02T10:30"), hora_retorno_intervalo: em("2026-08-02T11:30"),
}];
const r3 = calcularAdicionaisPorDia(domingoChefe, [], {
  contratadaDoDia: (d) => jornadaContratadaMin(chefe, d),
})[0];
conferir("turno diurno esticado ate 20h gera extra", r3.minExtra, 160);
conferir("turno diurno esticado nao gera noturno", r3.minNoturno, 0);

// Sem jornada contratada, o dia nao inventa hora extra.
conferir("sem contrato conhecido nao gera extra",
  calcularAdicionaisPorDia(comExtra, [], {})[0].minExtra, 0);

// Feriado trabalhado paga o dia inteiro.
const r4 = calcularAdicionaisPorDia(umDia, [{ data: "2026-08-04" }], { contratadaDoDia })[0];
conferir("feriado trabalhado conta os 440 min do dia", r4.minFeriado, 440);

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
