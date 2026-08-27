import { strict as assert } from "node:assert";
import test from "node:test";
import { minutosDoHorario, minutosAteOTurno } from "./jornada-calculo.mjs";

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
