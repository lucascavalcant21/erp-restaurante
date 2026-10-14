// node --test app/lib/aniversarios.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { aniversario, aniversariantesDoMes, fraseAniversario } from "./contrato-experiencia.mjs";

const hoje = new Date(2026, 9, 13); // 13/10/2026
const lista = [
  { nome: "Ana Souza", data_nascimento: "2001-10-13" },
  { nome: "Bruno Lima", data_nascimento: "1996-10-28" },
  { nome: "Carla Dias", data_nascimento: "1990-10-02" },
  { nome: "Davi Rocha", data_nascimento: "1985-11-13" },
  { nome: "Eva Desligada", data_nascimento: "1999-10-20", status: "inativo" },
  { nome: "Fábio Sem Data" },
];

test("aniversariantes do mês: só ativos do mês, em ordem de dia, com a idade que vão fazer", () => {
  const r = aniversariantesDoMes(lista, hoje);
  assert.equal(r.mes, "outubro");
  assert.deepEqual(r.itens.map((i) => [i.colaborador.nome, i.dia, i.vaiFazer, i.jaFez, i.ehHoje]), [
    ["Carla Dias", 2, 36, true, false], ["Ana Souza", 13, 25, false, true], ["Bruno Lima", 28, 30, false, false],
  ]);
  assert.equal(r.semData, 1);
  assert.equal(r.ativos, 5);
});

test("frases do aviso", () => {
  const [carla, ana, bruno] = aniversariantesDoMes(lista, hoje).itens;
  assert.equal(fraseAniversario(ana), "Hoje é aniversário de Ana: faz 25 anos.");
  assert.equal(fraseAniversario(bruno), "Dia 28 é aniversário de Bruno: vai fazer 30 anos.");
  assert.equal(fraseAniversario(carla), "Dia 2 foi aniversário de Carla: fez 36 anos.");
});

test("idade: antes e depois do aniversário no ano; sem data, nada", () => {
  assert.equal(aniversario({ data_nascimento: "1985-11-13" }, hoje).idade, 40);
  assert.equal(aniversario({ data_nascimento: "2001-10-13" }, hoje).idade, 25);
  assert.equal(aniversario({}, hoje), null);
});
