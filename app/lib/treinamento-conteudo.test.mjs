// Trava do conteúdo do treinamento: pergunta sem resposta válida, trilha com
// módulo inexistente ou função sem trilha não passam.
import test from "node:test";
import assert from "node:assert/strict";
import { MODULOS, TRILHAS, pacoteDoTreinamento } from "./treinamento-conteudo/index.mjs";

const CARGOS_REAIS = ["Auxiliar de Barman", "Auxiliar de Cozinha 1", "Auxiliar de Cozinha 2", "Auxiliar de Cozinha 3", "Barman / Bartender", "Chefe de Bar", "Chefe de Cozinha", "Chefe de Fila", "Cozinheiro 1", "Cozinheiro 2", "Cozinheiro 3", "Cumim", "Garçom", "Gerente", "Maître", "Produção"];
const pacote = pacoteDoTreinamento();
const questoes = pacote.modulos.flatMap((m) => m.aulas.flatMap((a) => a.questoes));

test("toda função real da casa tem exatamente uma trilha", () => {
  const cobertos = TRILHAS.flatMap((t) => t.cargos).sort();
  assert.deepEqual(cobertos, [...CARGOS_REAIS].sort());
});

test("trilha só usa módulo que existe, sem repetir, e todos os módulos estão em uso", () => {
  const chaves = new Set(MODULOS.map((m) => m.chave));
  assert.equal(chaves.size, MODULOS.length);
  for (const t of TRILHAS) {
    assert.equal(new Set(t.modulos).size, t.modulos.length, t.chave);
    for (const m of t.modulos) assert.ok(chaves.has(m), `${t.chave}: ${m}`);
    assert.ok(t.pratica.length >= 4, t.chave);
    assert.equal(new Set(t.pratica).size, t.pratica.length, t.chave);
  }
  const usados = new Set(TRILHAS.flatMap((t) => t.modulos));
  for (const m of MODULOS) assert.ok(usados.has(m.chave), `sem trilha: ${m.chave}`);
});

test("toda questão tem resposta válida, opções distintas e explicação", () => {
  for (const q of questoes) {
    assert.ok(q.opcoes.length >= 2 && q.opcoes.length <= 6, q.enunciado);
    assert.equal(new Set(q.opcoes).size, q.opcoes.length, q.enunciado);
    assert.ok(Number.isInteger(q.correta) && q.correta >= 0 && q.correta < q.opcoes.length, q.enunciado);
    assert.ok(q.explicacao.length > 5, q.enunciado);
  }
  assert.equal(new Set(questoes.map((q) => q.chave)).size, questoes.length);
});

test("módulo de aulas pode ser aprovado: 3 questões ou mais, com situação", () => {
  for (const m of pacote.modulos.filter((x) => x.tipo === "aulas")) {
    const qs = m.aulas.flatMap((a) => a.questoes);
    assert.ok(m.aulas.length > 0 && qs.length >= 3, m.chave);
    assert.ok(qs.some((q) => q.tipo === "situacao"), `${m.chave} sem situação`);
  }
});

test("a resposta certa não fica sempre na mesma posição", () => {
  const n = [0, 1, 2].map((i) => questoes.filter((q) => q.correta === i).length);
  assert.ok(Math.max(...n) / questoes.length < 0.75, `posições: ${n}`);
});

test("cada área tem apresentação, pratos, montagem, preparo e liderança", () => {
  const de = (chave) => TRILHAS.find((t) => t.chave === chave).modulos;
  for (const m of ["c-conhecer", "p-coz-conhecer", "p-coz-montar"]) assert.ok(de("coz-aux").includes(m));
  assert.ok(de("coz-cozinheiro").includes("p-coz-preparar"));
  for (const m of ["l-lideranca", "l-organizacao", "l-ficha"]) { assert.ok(de("coz-lider").includes(m)); assert.ok(de("bar-lider").includes(m)); }
  for (const m of ["s-comportamento", "s-situacoes", "s-atendimento"]) assert.ok(de("sal-garcom").includes(m));
});
