// Procedimentos da casa (pedido do dono, 08/11/2026). TESTADO EM MOCK.
import test from "node:test";
import assert from "node:assert/strict";
import { MODELOS, limparPassos, paraEstrutura, deEstrutura, validarProcedimento, procedimentoParaTexto, modeloPorNome } from "./procedimentos.mjs";
import { PROBLEMAS_SALAO } from "./intelligence/agents/menu.mjs";

test("passos digitados: um por linha, sem numeração nem vazios", () => {
  assert.deepEqual(limparPassos("1. Limpar a mesa\n\n2) Colocar o prato\n  - Copo à direita"), ["Limpar a mesa", "Colocar o prato", "- Copo à direita"]);
});

test("ida e volta pela Operação Inteligente", () => {
  const e = paraEstrutura({ nome: "  Montar a mesa ", quando: "Antes de abrir", area: "salao", passos: ["A", "B"], gerente: ["Faltar louça"] }, "loja");
  assert.equal(e.processo.categoria, "procedimento");
  assert.equal(e.processo.unidade_id, "loja");
  assert.deepEqual(e.secoes.map((s) => [s.titulo, s.itens.map((i) => i.titulo)]), [["Passo a passo", ["A", "B"]], ["Chame o gerente quando", ["Faltar louça"]]]);
  const volta = deEstrutura({ id: "p1", ...e.processo, secoes: e.secoes.map((s, i) => ({ ...s, ordem: i, itens: s.itens.map((it, j) => ({ ...it, ordem: j })) })) });
  assert.deepEqual([volta.nome, volta.quando, volta.area, volta.passos, volta.gerente], ["Montar a mesa", "Antes de abrir", "salao", ["A", "B"], ["Faltar louça"]]);
  assert.equal(paraEstrutura({ nome: "x", area: "outra", passos: ["a"] }, "l").processo.setor, "salao", "área desconhecida cai no salão");
});

test("validação", () => {
  assert.deepEqual(Object.keys(validarProcedimento({ nome: "", passos: "" })), ["nome", "passos"]);
  assert.deepEqual(validarProcedimento({ nome: "Montar a mesa", passos: "Limpar" }), {});
});

test("cada botão de problema do salão acha o modelo certo (e só ele)", () => {
  for (const p of PROBLEMAS_SALAO) {
    const achado = procedimentoParaTexto(MODELOS, `Situação no salão: ${p.toLowerCase()}. Como resolvo?`);
    assert.ok(achado, `nada para "${p}"`);
  }
  assert.equal(procedimentoParaTexto(MODELOS, "Situação no salão: o cliente passou mal. Como resolvo?").nome, "Cliente passou mal");
  assert.equal(procedimentoParaTexto(MODELOS, "Montagem no salão: como montar a mesa para o serviço").nome, "Montar a mesa");
  assert.equal(procedimentoParaTexto(MODELOS, "Montagem no salão: como montar o jardim").nome, "Montar o jardim");
  assert.equal(procedimentoParaTexto(MODELOS, "Situação no salão: o cliente quer trocar de mesa. Como resolvo?"), null, "sem certeza: nenhum");
  assert.equal(modeloPorNome("montar a mesa").passos.length, 7);
});

test("criticidade dentro do que o banco aceita (op_processos_criticidade_check: baixa, normal, alta, critica)", () => {
  const { processo } = paraEstrutura({ nome: "Montar a mesa", passos: "a" }, "u1");
  assert.ok(["baixa", "normal", "alta", "critica"].includes(processo.criticidade));
});
