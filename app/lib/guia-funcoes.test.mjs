import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizarConteudo,
  ordenarBlocos,
  periodoDoHorario,
  tarefasDoHorario,
} from "./guia-funcoes.mjs";

test("preserva as atividades antigas dentro de um período editável", () => {
  const blocos = normalizarConteudo([
    { hora: "15:40", fim: "15:59", atividade: "Levantar cadeiras" },
    { hora: "16:00", atividade: "Limpar mesas" },
  ]);

  assert.equal(blocos.length, 1);
  assert.equal(blocos[0].titulo, "Rotina do turno");
  assert.deepEqual(blocos[0].horarios[0].tarefas, ["Levantar cadeiras"]);
  assert.deepEqual(blocos[0].horarios[1].tarefas, ["Limpar mesas"]);
});

test("aceita várias tarefas separadas dentro do mesmo horário", () => {
  const horario = {
    hora: "15:40",
    fim: "15:59",
    tarefas: ["Levantar cadeiras", "Limpar mesas"],
  };

  assert.deepEqual(tarefasDoHorario(horario), ["Levantar cadeiras", "Limpar mesas"]);
});

test("organiza períodos e seus horários internos em ordem cronológica", () => {
  const blocos = ordenarBlocos([
    {
      titulo: "Atendimento",
      hora: "18:00",
      fim: "23:00",
      horarios: [{ hora: "19:00", tarefas: ["Receber clientes"] }],
    },
    {
      titulo: "Abertura do Salão 1",
      hora: "15:40",
      fim: "18:00",
      horarios: [
        { hora: "16:00", tarefas: ["Limpar mesas"] },
        { hora: "15:40", fim: "15:59", tarefas: ["Levantar cadeiras"] },
      ],
    },
  ]);

  assert.equal(blocos[0].titulo, "Abertura do Salão 1");
  assert.equal(blocos[0].horarios[0].hora, "15:40");
  assert.equal(blocos[0].horarios[1].hora, "16:00");
});

test("diferencia faixa de horário de um horário único", () => {
  assert.equal(periodoDoHorario({ hora: "15:40", fim: "15:59" }), "15:40 às 15:59");
  assert.equal(periodoDoHorario({ hora: "16:00" }), "às 16:00");
});
