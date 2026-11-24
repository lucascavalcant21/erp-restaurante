import test from "node:test";
import assert from "node:assert/strict";
import { assistenteDoEvento, itemDoEvento, filtrar, porDia, rotuloDoDia } from "./historico-conversas.mjs";

const nomes = new Map([["u1", "Lucas"], ["u2", "Maria"]]);
const ev = [
  { id: 1, created_at: "2026-11-17T15:00:00Z", etapa: "pedido", auth_user_id: "u1", canal: "voz", comando: "Marmita", recomendacao: "Sobre as marmitas, o que vamos fazer?", resultado: { assistente: { id: "jhon", nome: "Jhon" } } },
  { id: 2, created_at: "2026-11-17T15:01:00Z", etapa: "acao_executada", auth_user_id: "u1", acao_tipo: "channel.register", resultado: { assistente: "Jhon" } },
  { id: 3, created_at: "2026-11-16T10:00:00Z", etapa: "pedido", auth_user_id: "u2", canal: "texto", comando: "Como faz o vatapá?", recomendacao: "Passo a passo…", resultado: { assistente: { nome: "Nico" } } },
  { id: 4, created_at: "2026-11-16T09:00:00Z", etapa: "pedido", auth_user_id: "u9", comando: "oi", recomendacao: null, resultado: {} },
];

test("quem respondeu e o que foi dito", () => {
  assert.equal(assistenteDoEvento(ev[0]), "jhon");
  assert.equal(assistenteDoEvento(ev[2]), "nico");
  assert.equal(assistenteDoEvento(ev[3]), null);
  const i = itemDoEvento(ev[0], nomes);
  assert.deepEqual([i.pessoa, i.canal, i.pergunta, i.resposta], ["Lucas", "voz", "Marmita", "Sobre as marmitas, o que vamos fazer?"]);
  assert.equal(itemDoEvento(ev[1], nomes).marco, "Feito: channel.register");
  assert.equal(itemDoEvento(ev[3], nomes).pessoa, "Usuário");
});

test("filtros e dias", () => {
  const itens = ev.map((e) => itemDoEvento(e, nomes));
  assert.equal(filtrar(itens, { assistente: "nico" }).length, 1);
  assert.equal(filtrar(itens, { pessoa: "Lucas" }).length, 2);
  assert.equal(filtrar(itens, { busca: "VATAPA" }).length, 1);
  const dias = porDia(itens);
  assert.deepEqual(dias.map((d) => d.dia), ["2026-11-17", "2026-11-16"]);
  assert.deepEqual(dias[1].itens.map((i) => i.id), [4, 3]);
  assert.equal(rotuloDoDia("2026-11-17", "2026-11-17"), "Hoje");
  assert.equal(rotuloDoDia("2026-11-16", "2026-11-17"), "Ontem");
  assert.equal(rotuloDoDia("2026-11-01", "2026-11-17"), "01/11/2026");
});
