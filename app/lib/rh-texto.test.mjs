import test from "node:test";
import assert from "node:assert/strict";
import { pessoasDoTexto, periodoDoTexto, nomeDoFeriado } from "./rh-texto.mjs";

const EQ = [
  { id: "e", nome: "Eduarda Lima" }, { id: "b", nome: "Bruno Souza" },
  { id: "a1", nome: "Ana Paula Reis" }, { id: "a2", nome: "Ana Costa" }, { id: "x", nome: "Velho", status: "inativo" },
];
const HOJE = "2026-11-24"; // terça

test("quem: primeiro nome, dois nomes, ambíguo, inativo fora", () => {
  assert.deepEqual(pessoasDoTexto("dá folga pra Eduarda amanhã", EQ).ids, ["e"]);
  assert.deepEqual(pessoasDoTexto("folga pra eduarda e bruno sábado", EQ).ids, ["e", "b"]);
  const amb = pessoasDoTexto("a Ana está doente", EQ);
  assert.deepEqual([amb.ids, amb.ambiguos[0].opcoes.length], [[], 2]);
  assert.deepEqual(pessoasDoTexto("Ana Costa está doente", EQ).ids, ["a2"]);
  assert.deepEqual(pessoasDoTexto("folga pro velho", EQ).ids, []);
  assert.deepEqual(pessoasDoTexto("o Souza faltou", EQ).ids, ["b"]);
});

test("quando: relativos, dia da semana, dia do mês, barra, intervalo, quantos dias", () => {
  assert.deepEqual(periodoDoTexto("amanhã", HOJE), { inicio: "2026-11-25", fim: "2026-11-25", dias: 1 });
  assert.equal(periodoDoTexto("hoje", HOJE).inicio, HOJE);
  assert.equal(periodoDoTexto("ontem", HOJE).inicio, "2026-11-23");
  assert.equal(periodoDoTexto("sábado", HOJE).inicio, "2026-11-28");
  assert.equal(periodoDoTexto("terça que vem", HOJE).inicio, "2026-12-01");
  assert.equal(periodoDoTexto("dia 30", HOJE).inicio, "2026-11-30");
  assert.equal(periodoDoTexto("dia 3", HOJE).inicio, "2026-12-03");
  assert.equal(periodoDoTexto("dia 25/12", HOJE).inicio, "2026-12-25");
  assert.deepEqual(periodoDoTexto("de 25 a 27", HOJE), { inicio: "2026-11-25", fim: "2026-11-27", dias: 3 });
  assert.deepEqual(periodoDoTexto("está doente, 2 dias de atestado desde hoje", HOJE), { inicio: HOJE, fim: "2026-11-25", dias: 2 });
  assert.deepEqual(periodoDoTexto("por três dias a partir de amanhã", HOJE), { inicio: "2026-11-25", fim: "2026-11-27", dias: 3 });
  assert.deepEqual(periodoDoTexto("a Eduarda está doente", HOJE), { inicio: null, fim: null, dias: null });
  assert.equal(periodoDoTexto("3 dias", HOJE).dias, 3);
});

test("nome do feriado", () => {
  assert.equal(nomeDoFeriado("lança feriado da padroeira dia 8"), "Padroeira");
  assert.equal(nomeDoFeriado("feriado de aniversário da cidade no dia 2"), "Aniversário da cidade");
  assert.equal(nomeDoFeriado("dia 8 é feriado"), null);
});

test("quando: faixa por dia da semana e dia com mês", () => {
  assert.deepEqual(periodoDoTexto("atestado de hoje a sexta", HOJE), { inicio: HOJE, fim: "2026-11-27", dias: 4 });
  assert.deepEqual(periodoDoTexto("de amanhã até domingo", HOJE), { inicio: "2026-11-25", fim: "2026-11-29", dias: 5 });
  assert.equal(periodoDoTexto("feriado dia 25 de dezembro", HOJE).inicio, "2026-12-25");
  assert.equal(periodoDoTexto("20 de novembro", HOJE).inicio, "2026-11-20");
});
