import test from "node:test";
import assert from "node:assert/strict";
import { textoDosDias, textoDoHorario, horaCurta } from "./horario-funcionamento.mjs";

test("dias: sequência vira 'a', soltos com vírgula, semana toda", () => {
  assert.equal(textoDosDias([2, 3, 4, 5, 6, 0]), "Ter a Dom");
  assert.equal(textoDosDias([1, 3, 5]), "Seg, Qua e Sex");
  assert.equal(textoDosDias([0, 1, 2, 3, 4, 5, 6]), "Todos os dias");
  assert.equal(textoDosDias([5, 6]), "Sex e Sáb");
  assert.equal(textoDosDias([1, 2, 3, 5]), "Seg a Qua e Sex");
});

test("horário completo, dois turnos, e o que falta", () => {
  assert.deepEqual(textoDoHorario({ dias: [2, 3, 4, 5, 6, 0], turnos: [{ abre: "11:00", fecha: "23:00" }] }), { texto: "Ter a Dom, 11h às 23h" });
  assert.deepEqual(textoDoHorario({ dias: [1], turnos: [{ abre: "11:00", fecha: "15:00" }, { abre: "18:30", fecha: "00:00" }] }), { texto: "Seg, 11h às 15h e 18h30 às 0h" });
  assert.match(textoDoHorario({ dias: [], turnos: [{ abre: "11:00", fecha: "23:00" }] }).erro, /dias/);
  assert.match(textoDoHorario({ dias: [1], turnos: [{ abre: "", fecha: "" }] }).erro, /hora/);
  assert.equal(horaCurta("15:40"), "15h40");
});
