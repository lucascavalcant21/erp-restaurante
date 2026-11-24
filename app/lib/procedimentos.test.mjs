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

import { limparEtapas, limparMidias, procedimentoDoPasso, precisaDeConteudo } from "./procedimentos.mjs";

test("frases da equipe acham rotina, limpeza e equipamento (14/11/2026)", () => {
  const t = (x) => procedimentoParaTexto(MODELOS, x)?.nome || null;
  assert.equal(t("Nico, agora chegou o fechamento, o que eu tenho que fazer?"), "Fechamento do restaurante");
  assert.equal(t("Cheguei na cozinha, o que eu faço agora?"), "Abertura da cozinha");
  assert.equal(t("como limpo a chapa?"), "Limpeza da chapa");
  assert.equal(t("como higienizar o fogão"), "Limpeza do fogão");
  assert.equal(t("como usa o liquidificador?"), "Liquidificador");
  assert.equal(t("Procedimento da casa: Limpeza do piso"), "Limpeza do piso");
});

test("passo com produto, quantidade, vídeo e o procedimento que ele abre: ida e volta", () => {
  const proc = { nome: "Fechamento", tipo: "rotina", area: "geral", apelidos: "fechar, fechamento", passos: [
    { texto: "1. Limpar a chapa", produto: "Desengordurante", quantidade: "50 ml", abreNome: "Limpeza da chapa",
      midias: [{ tipo: "video", url: "https://exemplo.supabase.co/v.mp4" }, { tipo: "foto", url: "javascript:alert(1)" }] },
    "Apagar as luzes",
  ] };
  assert.equal(precisaDeConteudo(proc), true);
  assert.equal(precisaDeConteudo({ nome: "x", passos: ["a"] }), false);
  const e = paraEstrutura(proc, "casa", { comConteudo: true });
  assert.deepEqual(e.processo.conteudo, { tipo: "rotina", midias: [], apelidos: ["fechar", "fechamento"] });
  const itens = e.secoes[0].itens;
  assert.deepEqual(itens[0].conteudo, { produto: "Desengordurante", quantidade: "50 ml", midias: [{ tipo: "video", url: "https://exemplo.supabase.co/v.mp4", legenda: null }], abreNome: "Limpeza da chapa" });
  assert.equal("conteudo" in paraEstrutura(proc, "casa").secoes[0].itens[0], false, "sem a migração não manda a coluna");
  const volta = deEstrutura({ id: "p", ...e.processo, secoes: e.secoes.map((s, i) => ({ ...s, ordem: i, itens: s.itens.map((it, j) => ({ ...it, ordem: j })) })) });
  assert.equal(volta.tipo, "rotina");
  assert.deepEqual(volta.passos, ["Limpar a chapa", "Apagar as luzes"]);
  assert.equal(volta.etapas[0].quantidade, "50 ml");
  assert.equal(procedimentoDoPasso(volta.etapas[0], [{ id: "c1", nome: "Limpeza da chapa" }]).id, "c1");
});

test("mídia só https", () => {
  assert.deepEqual(limparMidias([{ tipo: "foto", url: "http://x" }, { tipo: "x", url: "https://youtu.be/abc" }]), [{ tipo: "link", url: "https://youtu.be/abc", legenda: null }]);
  assert.deepEqual(limparEtapas("a\nb").map((e) => e.texto), ["a", "b"]);
});
