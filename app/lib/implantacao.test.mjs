import test from "node:test";
import assert from "node:assert/strict";
import {
  ETAPAS, PERGUNTAS, statusDasEtapas, proximaPergunta, validarResposta, responder, respostaDe,
  perfilParaPrompt, conhecimento, perguntaPorId,
} from "./implantacao.mjs";

const unidadeOk = { nome: "Sel de Estrela", endereco: "Rua A, 10", cidade: "Cascavel" };
const contagens = { colaboradoresComHorario: 4, insumos: 30, fichas: 12, fichasBar: 0, produtos: 20, mesas: 0 };

test("cliente novo: tudo pendente e o Jhon ainda não pergunta", () => {
  const s = statusDasEtapas({ unidade: { nome: "" }, params: {}, contagens: { colaboradoresComHorario: 0, insumos: 0, fichas: 0, fichasBar: 0, produtos: 0, mesas: 0 } });
  assert.equal(s.feitas, 0);
  assert.equal(s.total, ETAPAS.length);
  assert.equal(s.basicoPronto, false);
  assert.equal(s.proxima.id, "estabelecimento");
  assert.equal(proximaPergunta({}, { basicoPronto: s.basicoPronto }), null);
});

test("status vem do que está cadastrado; contagem não lida é 'sem_dado'", () => {
  const s = statusDasEtapas({ unidade: unidadeOk, params: { custo_aluguel_mes: 5000, custo_luz_mes: 1200 }, contagens: { ...contagens, produtos: null } });
  const por = Object.fromEntries(s.etapas.map((e) => [e.id, e.status]));
  assert.deepEqual(por, { estabelecimento: "feito", custos: "feito", equipe: "feito", ingredientes: "feito", fichas: "feito", produtos: "sem_dado", bar: "pendente", salao: "pendente", meta: "pendente" });
  assert.equal(s.basicoPronto, true);
});

test("respostas do perfil dispensam etapas que não se aplicam", () => {
  let perfil = responder({}, "tem_bar", "Não");
  perfil = responder(perfil, "servicos", ["Delivery próprio", "iFood"]);
  const s = statusDasEtapas({ unidade: unidadeOk, params: {}, contagens, perfil });
  const por = Object.fromEntries(s.etapas.map((e) => [e.id, e.status]));
  assert.equal(por.bar, "dispensada");
  assert.equal(por.salao, "dispensada");
  assert.equal(s.total, ETAPAS.length - 2);
  perfil = responder(perfil, "faturamento_meta", 120000);
  assert.equal(statusDasEtapas({ unidade: unidadeOk, contagens, perfil }).etapas.find((e) => e.id === "meta").status, "feito");
});

test("o Jhon pergunta uma de cada vez, na ordem, pulando o que não se aplica", () => {
  let perfil = {};
  assert.equal(proximaPergunta(perfil).id, "tipo_negocio");
  perfil = responder(perfil, "tipo_negocio", "Marmitaria");
  perfil = responder(perfil, "servicos", ["Delivery próprio"]);
  perfil = responder(perfil, "tem_bar", "Não");
  perfil = responder(perfil, "horario", "seg a sex, 10h às 15h");
  perfil = responder(perfil, "estilo_cozinha", "caseira");
  assert.equal(proximaPergunta(perfil).id, "maior_dor", "sem salão, não pergunta lugares");
  for (const p of PERGUNTAS) perfil = responder(perfil, p.id, p.tipo === "numero" ? 1 : p.tipo === "multipla" ? [p.opcoes[0]] : p.opcoes?.[0] || "x");
  assert.equal(proximaPergunta(perfil), null);
  assert.deepEqual(conhecimento(perfil), { respondidas: PERGUNTAS.length, total: PERGUNTAS.length, pct: 100 });
});

test("validação das respostas", () => {
  assert.deepEqual(validarResposta(perguntaPorId("tipo_negocio"), "Bar"), { valor: "Bar" });
  assert.ok(validarResposta(perguntaPorId("tipo_negocio"), "Nave espacial").erro);
  assert.deepEqual(validarResposta(perguntaPorId("servicos"), ["iFood", "x", "iFood"]), { valor: ["iFood"] });
  assert.deepEqual(validarResposta(perguntaPorId("faturamento_meta"), "120.000"), { valor: 120000 });
  assert.deepEqual(validarResposta(perguntaPorId("faturamento_atual"), "nao_sei"), { valor: "nao_sei" });
  assert.ok(validarResposta(perguntaPorId("faturamento_meta"), "nao_sei").erro, "meta não aceita 'não sei'");
  assert.ok(validarResposta(perguntaPorId("objetivo"), " ").erro);
});

test("o Nico recebe só a operação; o Jhon recebe tudo", () => {
  let perfil = responder({}, "tipo_negocio", "Restaurante");
  perfil = responder(perfil, "faturamento_meta", 150000);
  perfil = responder(perfil, "maior_dor", ["CMV alto"]);
  const jhon = perfilParaPrompt(perfil, { para: "jhon" });
  const nico = perfilParaPrompt(perfil, { para: "nico" });
  assert.match(jhon, /R\$ 150\.000 por mês/);
  assert.match(jhon, /CMV alto/);
  assert.match(nico, /Restaurante/);
  assert.doesNotMatch(nico, /R\$|CMV|faturar/);
  assert.equal(perfilParaPrompt({}), "");
  assert.equal(respostaDe(perfil, "objetivo"), undefined);
});
