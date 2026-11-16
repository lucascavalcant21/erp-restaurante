import test from "node:test";
import assert from "node:assert/strict";
import { PASSOS, statusDaJornada } from "./jornada.mjs";

const ehEmbalagem = (i) => i.departamento === "embalagens";
const precoDoInsumo = (i) => Number(i.preco) || 0;
const base = {
  unidade: { nome: "Sel de Estrela" },
  config: { tributos_pct: 6, canais: [{ id: "ifood", nome: "iFood", comissao_pct: 12, taxa_pagamento_pct: 3.2 }, { id: "keeta", nome: "Keeta" }], rateio: { custos_fixos: [{ nome: "Aluguel", valor: "3000" }, { nome: "Pró-labore", valor: 5000 }], marmitas_mes: 1500 } },
  insumosLista: [{ id: "a", nome: "Arroz", preco: 5 }, { id: "p", nome: "Pote", departamento: "embalagens", preco: 0.8 }],
  marmitas: [{ id: "m1", nome_receita: "Frango", precos: { ifood: 24.9 } }],
  custos: new Map([["m1", { completo: true }]]),
  processos: { m1: { etapas: [{ id: "1", grupo: "montagem", titulo: "Arroz", texto: "No fundo" }] } },
  alocacoes: 3, temVendas: true, ehEmbalagem, precoDoInsumo,
};

test("a sequência é a do dono, em nove passos", () => {
  assert.deepEqual(PASSOS.map((p) => `${p.numero}. ${p.titulo}`), [
    "1. Delivery e equipe", "2. Custos fixos e variáveis", "3. Apps e taxas", "4. Ingredientes", "5. Embalagens",
    "6. Ficha técnica", "7. Preço e combos", "8. Guia de montagem", "9. DRE",
  ]);
});

test("tudo cadastrado: concluída, e o sistema muda", () => {
  const j = statusDaJornada(base);
  assert.equal(j.feitos, 9);
  assert.equal(j.concluida, true);
  assert.equal(j.acabouDeConcluir, true);
  assert.equal(j.proximo, null);
  assert.equal(statusDaJornada({ ...base, concluidaSalva: true }).acabouDeConcluir, false);
});

test("empresa nova: começa no passo 1 e cada passo diz o que falta", () => {
  const j = statusDaJornada({ unidade: { nome: "" }, config: { canais: [], rateio: {} }, insumosLista: [], marmitas: [], custos: new Map(), processos: {}, alocacoes: 0, temVendas: false, ehEmbalagem, precoDoInsumo });
  assert.equal(j.feitos, 0);
  assert.equal(j.concluida, false);
  assert.equal(j.proximo.id, "empresa");
  const por = Object.fromEntries(j.passos.map((p) => [p.id, p.detalhe]));
  assert.equal(por.custos, "Falta: custos fixos, imposto, marmitas por mês.");
  assert.equal(por.fichas, "Nenhuma marmita ainda.");
});

test("precisão: sem preço não conta, ficha incompleta não conta, marmita sem guia não conta", () => {
  const j = statusDaJornada({
    ...base,
    insumosLista: [{ id: "a", nome: "Arroz", preco: 0 }, { id: "p", nome: "Pote", departamento: "embalagens", preco: 0.8 }],
    marmitas: [...base.marmitas, { id: "m2", nome_receita: "Carne", precos: {} }],
    custos: new Map([["m1", { completo: true }], ["m2", { completo: false }]]),
  });
  const por = Object.fromEntries(j.passos.map((p) => [p.id, [p.status, p.detalhe]]));
  assert.deepEqual(por.ingredientes, ["pendente", "0 com preço · 1 sem preço"]);
  assert.deepEqual(por.fichas, ["pendente", "1 sem custo completo"]);
  assert.deepEqual(por.preco, ["pendente", "1 sem preço"]);
  assert.deepEqual(por.montagem, ["pendente", "1 sem guia"]);
  assert.deepEqual(por.apps, ["feito", "1 de 2 com taxas"]);
});

test("MEI não precisa de alíquota; fonte não lida fica 'sem_dado'", () => {
  const mei = statusDaJornada({ ...base, config: { ...base.config, tributos_pct: null, rateio: { ...base.config.rateio, regime: "mei" } } });
  assert.equal(mei.passos.find((p) => p.id === "custos").status, "feito");
  const semLer = statusDaJornada({ ...base, alocacoes: null, processos: null, temVendas: null });
  assert.deepEqual(["empresa", "montagem", "dre"].map((id) => semLer.passos.find((p) => p.id === id).status), ["sem_dado", "sem_dado", "sem_dado"]);
  assert.equal(semLer.concluida, false);
});

test("depois de concluída, fica concluída mesmo que falte algo depois", () => {
  const j = statusDaJornada({ ...base, temVendas: false, concluidaSalva: true });
  assert.equal(j.concluida, true);
  assert.equal(j.proximo.id, "dre");
});
