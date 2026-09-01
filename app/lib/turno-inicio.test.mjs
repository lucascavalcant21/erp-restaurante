import { strict as assert } from "node:assert";
import test from "node:test";
import { minutosDoHorario, minutosAteOTurno, entradaContratada } from "./jornada-calculo.mjs";

const em = (h, m) => { const d = new Date(2026, 7, 27, h, m, 0); return d; };

test("lê o horário do turno", () => {
  assert.equal(minutosDoHorario("15:40"), 15 * 60 + 40);
  assert.equal(minutosDoHorario("00:30"), 30);
  assert.equal(minutosDoHorario("9:05"), 9 * 60 + 5);
  assert.equal(minutosDoHorario(""), null);
  assert.equal(minutosDoHorario(null), null);
  assert.equal(minutosDoHorario("25:00"), null);
  assert.equal(minutosDoHorario("15:70"), null);
  assert.equal(minutosDoHorario("quinze e quarenta"), null);
});

test("o caso da Larissa: 15:39 para turno de 15:40 é barrado por 1 minuto", () => {
  assert.equal(minutosAteOTurno("15:40", em(15, 39)), 1);
});

test("em cima da hora e depois, libera", () => {
  assert.equal(minutosAteOTurno("15:40", em(15, 40)), 0);
  assert.equal(minutosAteOTurno("15:40", em(15, 41)), 0);
  assert.equal(minutosAteOTurno("15:40", em(23, 0)), 0);
});

test("sem horário cadastrado não trava ninguém", () => {
  assert.equal(minutosAteOTurno("", em(3, 0)), 0);
  assert.equal(minutosAteOTurno(null, em(3, 0)), 0);
  assert.equal(minutosAteOTurno(undefined, em(3, 0)), 0);
});

test("quem foi chamado bem mais cedo continua batendo", () => {
  // 6h antes é o limite: dentro dele barra, fora dele libera.
  assert.equal(minutosAteOTurno("15:40", em(9, 41)), 359);
  assert.equal(minutosAteOTurno("15:40", em(9, 40)), 360);
  assert.equal(minutosAteOTurno("15:40", em(9, 39)), 0);
  assert.equal(minutosAteOTurno("15:40", em(6, 0)), 0);
});

test("turno de madrugada", () => {
  assert.equal(minutosAteOTurno("00:30", em(0, 29)), 1);
  assert.equal(minutosAteOTurno("00:30", em(0, 30)), 0);
  // 23h da noite anterior: mais de 6h antes das 00:30, então não barra.
  assert.equal(minutosAteOTurno("00:30", em(23, 0)), 0);
});

// 2026-08-27 e uma quinta (dia 4); 2026-08-30 e um domingo (dia 0).
const quinta = (h, m) => new Date(2026, 7, 27, h, m, 0);
const domingo = (h, m) => new Date(2026, 7, 30, h, m, 0);

test("entrada contratada: horario fixo", () => {
  assert.equal(entradaContratada({ horario_entrada: "15:40" }, quinta(10, 0)), "15:40");
  assert.equal(entradaContratada({}, quinta(10, 0)), "");
  assert.equal(entradaContratada(null, quinta(10, 0)), "");
});

test("entrada contratada: domingo tem horario proprio", () => {
  const c = { horario_entrada: "15:40", horario_dom_entrada: "11:00" };
  assert.equal(entradaContratada(c, quinta(10, 0)), "15:40");
  assert.equal(entradaContratada(c, domingo(10, 0)), "11:00");
  // sem horario de domingo cadastrado, vale o fixo
  assert.equal(entradaContratada({ horario_entrada: "15:40" }, domingo(10, 0)), "15:40");
});

test("entrada contratada: jornada por dia ganha de tudo", () => {
  const c = {
    horario_entrada: "15:40", horario_dom_entrada: "11:00",
    horario_por_dia: true,
    horarios_dia: { "4": { e: "09:00", s: "17:00" }, "0": { e: "12:30", s: "20:00" } },
  };
  assert.equal(entradaContratada(c, quinta(8, 0)), "09:00");
  assert.equal(entradaContratada(c, domingo(8, 0)), "12:30");
  // dia sem entrada no mapa cai para a regra de baixo
  const semSabado = { ...c, horarios_dia: { "4": { s: "17:00" } } };
  assert.equal(entradaContratada(semSabado, quinta(8, 0)), "15:40");
  // marcado por dia mas com o mapa vazio: nao inventa horario
  assert.equal(entradaContratada({ horario_por_dia: true, horario_entrada: "15:40" }, quinta(8, 0)), "15:40");
});

test("a trava usa a jornada do dia, nao a fixa", () => {
  const c = { horario_entrada: "15:40", horario_por_dia: true, horarios_dia: { "4": { e: "09:00" } } };
  // 8:59 numa quinta cujo turno comeca 09:00: barra por 1 minuto
  assert.equal(minutosAteOTurno(entradaContratada(c, quinta(8, 59)), quinta(8, 59)), 1);
  // 15:39 nesse mesmo dia ja passou das 09:00: libera
  assert.equal(minutosAteOTurno(entradaContratada(c, quinta(15, 39)), quinta(15, 39)), 0);
});
