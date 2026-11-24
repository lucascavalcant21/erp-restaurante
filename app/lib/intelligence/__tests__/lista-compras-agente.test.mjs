// Lista de compras pelo Jhon (14/11/2026). TESTADO EM MOCK: banco em memória.
import test from "node:test";
import assert from "node:assert/strict";
import { HANDLERS_LISTA_COMPRAS, casarNoCadastro } from "../agents/lista-compras-agente.mjs";

function motorFalso({ params = {}, insumos = [], abaixo = [] } = {}) {
  const tabelas = { insumos, config_sistema: [{ params }] };
  const q = (t) => { const r = { data: tabelas[t] || [], error: null }; const o = { select: () => o, eq: () => o, limit: () => o, in: () => o, order: () => o, then: (f, g) => Promise.resolve(r).then(f, g) }; return o; };
  return {
    ambiente: { dbe: { from: q, consultas: [] }, hoje: "2026-11-14" },
    getLowStock: async () => ({ status: "ok", valor: abaixo.length, detalhes: { lista: abaixo } }),
  };
}
const INSUMOS = [{ id: "i1", nome: "Arroz agulhinha", unidade_medida: "kg" }, { id: "i2", nome: "Feijão carioca", unidade_medida: "kg" }, { id: "i3", nome: "Óleo de soja", unidade_medida: "l" }];

test("monta a lista, liga ao cadastro, traz o que faltou e o que está abaixo do mínimo", async () => {
  const anterior = { data: "2026-11-13", itens: [{ id: "l1", nome: "Tomate", status: "faltou" }, { id: "l2", nome: "Arroz", insumoId: "i1", status: "comprado" }] };
  const out = await HANDLERS_LISTA_COMPRAS["compras.lista_montar"]({
    motor: motorFalso({ params: { lista_compras: anterior }, insumos: INSUMOS, abaixo: [{ insumo_id: "i3", produto: "Óleo de soja", saldo: 1, minimo: 6, unidade: "L" }] }),
    params: { texto: "Jhon, minha lista de compras para hoje é 10 kg de arroz, feijão 5 kg e alface" },
  });
  const b = out.blocos[0];
  assert.equal(b.tipo, "lista_compras");
  assert.deepEqual(b.itens.map((i) => [i.nomeCadastro || i.nome, i.quantidade ?? null]), [["Arroz agulhinha", 10], ["Feijão carioca", 5], ["Alface", null], ["Tomate", null]]);
  assert.deepEqual(b.sugestoes.map((s) => s.produto), ["Óleo de soja"]);
  assert.match(out.texto, /Voltaram da última compra \(faltaram\): Tomate/);
  assert.doesNotMatch(out.texto, /R\$/);
});

test("lista vazia pergunta; sem lista salva, 'comprei tudo' leva para a foto da nota", async () => {
  const vazio = await HANDLERS_LISTA_COMPRAS["compras.lista_montar"]({ motor: motorFalso(), params: { texto: "lista de compras" } });
  assert.equal(vazio.pergunta.campo, "lista");
  const sem = await HANDLERS_LISTA_COMPRAS["compras.lista_comprei"]({ motor: motorFalso(), params: { texto: "comprei tudo" } });
  assert.equal(sem.pergunta.opcoes[0].comando, "Vou mandar a foto da danfe");
});

test("'comprei tudo, faltou o tomate': confere com a lista salva", async () => {
  const salva = { data: "2026-11-14", itens: [{ id: "l1", nome: "Arroz", nomeCadastro: "Arroz agulhinha", insumoId: "i1", quantidade: 10, unidade: "kg", status: "pendente" }, { id: "l2", nome: "Tomate", status: "pendente" }] };
  const out = await HANDLERS_LISTA_COMPRAS["compras.lista_comprei"]({ motor: motorFalso({ params: { lista_compras: salva } }), params: { texto: "Jhon, comprei tudo, faltou o tomate" } });
  assert.match(out.texto, /Veio: Arroz agulhinha\. Faltou: Tomate/);
  assert.equal(out.blocos[0].tipo, "lista_compras_conferencia");
  assert.deepEqual(out.blocos[0].lista.map((i) => i.status), ["comprado", "faltou"]);
  assert.equal(out.pergunta.opcoes[0].comando, "Vou mandar a foto da danfe");
});

test("casar no cadastro só sem dúvida", () => {
  assert.equal(casarNoCadastro(INSUMOS, "arroz")?.id, "i1");
  assert.equal(casarNoCadastro(INSUMOS, "alface"), null);
});
