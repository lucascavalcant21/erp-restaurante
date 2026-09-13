// Testes do cálculo de adicionais. Rode com: node app/lib/jornada-calculo.test.mjs
//
// Os casos usam a jornada real da casa (15:40 → 00:00 com 1h de intervalo)
// porque é nela que o erro do noturno aparecia todo dia.

import {
  minutosNoturnosRelogio, comHoraFicta, minutosTrabalhados, aplicarTolerancia,
  jornadaContratadaMin, calcularAdicionaisPorDia, calcularAdicionaisMes,
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

// Teto de 2h de hora extra por dia (CLT art. 59, caput) — tambem o limite do
// acordo de banco de horas da casa. Passar disso nao apaga o direito: marca.
const esticado = [{
  data_referencia: "2026-08-04",
  hora_entrada: em("2026-08-04T15:40"), hora_saida: em("2026-08-05T03:00"),
  hora_saida_intervalo: em("2026-08-04T17:00"), hora_retorno_intervalo: em("2026-08-04T18:00"),
}];
const r5 = calcularAdicionaisPorDia(esticado, [], { contratadaDoDia })[0];
conferir("3h alem do contrato contam inteiras como extra", r5.minExtra, 180);
conferir("o que passa de 2h vem marcado", r5.extraAcimaDoLimite, 60);
conferir("dentro das 2h nao marca nada",
  calcularAdicionaisPorDia(comExtra, [], { contratadaDoDia })[0].extraAcimaDoLimite, 0);


// ── Entrada antes do turno: o cálculo começa na hora do turno ──────────────
// Quem chega 15:00 num turno que abre 15:40 ficou 40 min à disposição por
// conta própria. Contar dava hora extra a quem só chegou cedo. A batida real
// segue intocada no livro — carimbar 15:40 por cima dela seria horário
// predeterminado, proibido pelo art. 74, II.
const regCedo = {
  data_referencia: "2026-08-30",
  hora_entrada: em("2026-08-30T15:00"),
  hora_saida: em("2026-08-30T23:00"),
};
conferir("sem horario do turno, conta da batida", minutosTrabalhados(regCedo), 480);
conferir("com turno 15:40, os 40 min de antecipacao nao contam",
  minutosTrabalhados(regCedo, "15:40"), 440);

conferir("chegar depois do turno continua contando da batida",
  minutosTrabalhados({ ...regCedo, hora_entrada: em("2026-08-30T16:10") }, "15:40"), 410);

conferir("o intervalo continua sendo descontado",
  minutosTrabalhados({
    ...regCedo,
    hora_saida_intervalo: em("2026-08-30T18:00"),
    hora_retorno_intervalo: em("2026-08-30T19:00"),
  }, "15:40"), 380);

for (const h of [null, "", "abc", "99:99", "15"]) {
  conferir(`horario invalido (${h}) nao muda nada`, minutosTrabalhados(regCedo, h), 480);
}

// Turno da madrugada: batida 00:10 com turno que abre 22:00. O inicio
// calculado sobre a data da batida cairia 22h depois e zeraria a jornada.
conferir("turno que vira a madrugada nao e empurrado para o dia seguinte",
  minutosTrabalhados({
    data_referencia: "2026-08-30",
    hora_entrada: em("2026-08-31T00:10"),
    hora_saida: em("2026-08-31T06:00"),
  }, "22:00"), 350);

// E a regra ligada de ponta a ponta: sem ela sobrariam 40 min de extra.
conferir("entradaDoDia zera a extra de quem so chegou cedo",
  calcularAdicionaisPorDia([regCedo], [], {
    contratadaDoDia: () => 440,
    entradaDoDia: () => "15:40",
  })[0].minExtra, 0);

// ── Os minutos virados em dinheiro ───────────────────────────────────────
// Esta era a conta que decide quanto se paga, e estava sem teste porque morava
// em rh.js, que importa o Supabase e o node nao consegue carregar.
//
// Salario de R$ 2.200 foi escolhido para a hora dar redondo: 2200/220 = R$ 10.
const SALARIO = 2200;

// Jornada noturna: 22h as 2h. Sem jornada contratada informada, nao ha extra.
const noiteInteira = [{
  data_referencia: "2026-08-10",
  hora_entrada: em("2026-08-10T22:00"),
  hora_saida: em("2026-08-11T02:00"),
}];
const adNoite = calcularAdicionaisMes(noiteInteira, SALARIO, []);
// 4h cheias dentro da faixa noturna. Com hora ficta (52,5 min valem 60), os
// 240 minutos de relogio contam mais — por isso o valor sai acima de 4h.
conferir("noturno: o adicional e 20% da hora, nao a hora inteira",
  adNoite.valorNoturno, Math.round((adNoite.minNoturno / 60) * 10 * 0.20 * 100) / 100);
conferir("noturno: hora de R$ 10 com 20% da menos que a hora cheia",
  adNoite.valorNoturno < (adNoite.minNoturno / 60) * 10, "true");

// Sem salario nao ha valor, mas os minutos continuam sendo contados: eles vao
// para o espelho de ponto mesmo quando o salario nao esta cadastrado.
const semSalario = calcularAdicionaisMes(noiteInteira, 0, []);
conferir("sem salario o valor e zero", semSalario.valorNoturno, 0);
conferir("sem salario os minutos continuam", semSalario.minNoturno, adNoite.minNoturno);
conferir("salario invalido nao vira NaN", calcularAdicionaisMes(noiteInteira, "abc", []).valorNoturno, 0);

// Feriado trabalhado: adicional de 100%, ou seja, a hora de novo por cima.
const feriado = [{
  data_referencia: "2026-09-07",
  hora_entrada: em("2026-09-07T10:00"),
  hora_saida: em("2026-09-07T14:00"),
}];
const adFeriado = calcularAdicionaisMes(feriado, SALARIO, ["2026-09-07"]);
conferir("feriado: 4h a R$ 10 dao R$ 40 de adicional", adFeriado.valorFeriado, 40);
conferir("feriado fora da lista nao paga adicional",
  calcularAdicionaisMes(feriado, SALARIO, []).valorFeriado, 0);

// Hora extra: hora CHEIA mais 50%, porque a extra nao esta no salario.
// Jornada contratada de 4h, trabalhou 6h -> 2h extras a R$ 15 = R$ 30.
const extra = [{
  data_referencia: "2026-08-12",
  hora_entrada: em("2026-08-12T10:00"),
  hora_saida: em("2026-08-12T16:00"),
}];
const adExtra = calcularAdicionaisMes(extra, SALARIO, [], { contratadaDoDia: () => 240 });
conferir("extra: 120 minutos alem da jornada", adExtra.minExtra, 120);
conferir("extra: 2h a R$ 15 (hora + 50%) dao R$ 30", adExtra.valorExtra, 30);
conferir("dentro da jornada nao ha extra",
  calcularAdicionaisMes(extra, SALARIO, [], { contratadaDoDia: () => 480 }).minExtra, 0);

// Os valores saem arredondados ao centavo — a folha nao paga fracao de centavo.
const quebrado = calcularAdicionaisMes(extra, 2137.77, [], { contratadaDoDia: () => 240 });
conferir("valor arredondado ao centavo",
  Math.round(quebrado.valorExtra * 100) === quebrado.valorExtra * 100, "true");

// Mes sem batida nenhuma: zero em tudo, sem quebrar.
const vazio = calcularAdicionaisMes([], SALARIO, []);
conferir("mes vazio: minutos zerados", vazio.minNoturno + vazio.minExtra + vazio.minFeriado, 0);
conferir("mes vazio: valores zerados", vazio.valorNoturno + vazio.valorExtra + vazio.valorFeriado, 0);
conferir("sem argumento nao quebra", calcularAdicionaisMes().valorExtra, 0);

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);