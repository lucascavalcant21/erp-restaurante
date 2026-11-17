// Cadastros do delivery pelo Jhon e "vamos montar uma unidade de delivery"
// (dono, 17/11/2026). TESTADO EM MOCK: banco em memória.
import test from "node:test";
import assert from "node:assert/strict";
import { criarMotorDeMetricas } from "../metrics/engine.mjs";
import { criarDbEscopado } from "../context/db-escopado.mjs";
import { montarContextoInteligencia } from "../context/context-engine.mjs";
import { criarVerificador } from "../permissions/mapa.mjs";
import { criarServicoDeAcoes, acoesSomenteLeitura } from "../actions/servico.mjs";
import { processarComando } from "../commands/command-bus.mjs";
import { criarStoreMemoria } from "../audit/store-memoria.mjs";
import { custosDoTexto, juntarCanais, juntarCustos } from "../actions/cadastros-delivery.mjs";
import { bancoFalso, contexto, depsFalsas, AGORA } from "./apoio.mjs";
import { tabelasPadrao } from "./fixtures.mjs";

const A = "loja-a";

async function montar({ negar = [], somenteLeitura = false, config = null } = {}) {
  const deps = depsFalsas({ negar });
  const ctx = await contexto(undefined, A, deps);
  const ic = montarContextoInteligencia({ requestContext: ctx, tela: null, agora: AGORA });
  const t = tabelasPadrao();
  t.marmitaria_configuracoes = [config || { unidade_id: A, canais: [{ id: "ifood", nome: "iFood", ativo: true, comissao_pct: 12, taxa_pagamento_pct: 3.2 }], rateio: { marmitas_mes: 900, custos_fixos: [{ nome: "Aluguel", valor: 2000 }] } }];
  t.colaboradores = [...(t.colaboradores || []), { id: "col-1", unidade_id: A, nome: "Maria Souza", status: "ativo" }];
  t.marmitaria_rh_alocacoes = [];
  const db = bancoFalso(t);
  const dbe = criarDbEscopado(db, ic.escopo);
  const verificador = criarVerificador(ctx, deps);
  const motor = criarMotorDeMetricas({ dbe, escopo: ic.escopo, verificador, agora: AGORA });
  const store = criarStoreMemoria();
  const base = criarServicoDeAcoes({ store, escopo: ic.escopo, dbe, dbUsuario: db, verificador, nomeUsuario: "Lucas", relogio: () => AGORA });
  const servicoAcoes = somenteLeitura ? acoesSomenteLeitura(base) : base;
  let n = 0;
  const pedir = (texto) => processarComando({ pedido: { chave: `chave-cad-${++n}`, texto }, ic, motor, servicoAcoes, store, correlationId: `c${n}` });
  const responder = (acaoId, valor) => processarComando({ pedido: { continuar: { acaoId, campo: "resposta", valor } }, ic, motor, servicoAcoes, store, correlationId: `r${++n}` });
  const confirmar = (acaoId) => servicoAcoes.confirmar({ acaoId, correlationId: "ok" });
  const linha = async (tabela) => (await db.from(tabela).select("*").eq("unidade_id", A)).data;
  return { pedir, responder, confirmar, linha };
}

/** Responde em sequência até a confirmação; devolve as perguntas feitas. */
async function conversa(m, texto, respostas) {
  let r = await m.pedir(texto);
  const perguntas = [];
  for (let i = 0; r.tipo === "pergunta" && i < 30; i++) {
    perguntas.push(r.texto);
    assert.ok(respostas.length, `sem resposta para: ${r.texto}`);
    r = await m.responder(r.pergunta.acaoId, respostas.shift());
  }
  return { r, perguntas };
}

test("plataformas: 'vamos cadastrar 2 plataformas' → nome e taxas de cada, prévia, grava; mesmo nome atualiza", async () => {
  const m = await montar();
  const { r, perguntas } = await conversa(m, "Jhon, vamos cadastrar 2 plataformas", ["99Food", "7% de comissão e 3% de pagamento", "ifood", "13% e 3,2%"]);
  assert.match(perguntas[0], /^Plataforma 1 de 2: qual o nome\?/);
  assert.match(perguntas[1], /Quantos por cento o 99Food cobra/);
  assert.equal(r.tipo, "confirmacao");
  assert.ok(r.confirmacao.linhas.some((l) => /já existe: atualiza as taxas/.test(l.valor)));
  const ok = await m.confirmar(r.confirmacao.acaoId);
  assert.equal(ok.tipo, "resultado_acao", ok.texto);
  const canais = (await m.linha("marmitaria_configuracoes"))[0].canais;
  assert.deepEqual(canais.map((c) => [c.id, c.comissao_pct, c.taxa_pagamento_pct]), [["ifood", 13, 3.2], ["99food", 7, 3]]);
  assert.equal(canais[1].plataforma, "99food");
});

test("balcão: venda direta sem taxa, direto para a prévia", async () => {
  const m = await montar();
  const r = await m.pedir("É balcão: cadastrar o balcão como plataforma sem taxa");
  assert.equal(r.tipo, "confirmacao");
  assert.match(JSON.stringify(r.confirmacao.linhas), /Balcão.*0% de comissão \+ 0% de pagamento/);
});

test("custos fixos: botões luz/água…, 'outro' com nome, 'pronto'; mesmo nome troca o valor; mantém o resto do rateio", async () => {
  const m = await montar();
  const { r, perguntas } = await conversa(m, "Jhon, quero cadastrar os custos fixos", ["Luz", "300", "Embalagem do motoboy", "80", "aluguel 2.500", "pronto"]);
  assert.match(perguntas[0], /Qual é o primeiro\?/);
  assert.match(perguntas[1], /Quanto é a conta de Luz por mês\?/);
  assert.equal(r.tipo, "confirmacao");
  const txt = JSON.stringify(r.confirmacao.linhas);
  assert.match(txt, /Aluguel.*R\$\s?2\.000,00 → R\$\s?2\.500,00/);
  assert.match(txt, /Total de custos fixos.*R\$\s?2\.880,00/);
  await m.confirmar(r.confirmacao.acaoId);
  const rateio = (await m.linha("marmitaria_configuracoes"))[0].rateio;
  assert.equal(rateio.marmitas_mes, 900);
  assert.deepEqual(rateio.custos_fixos.map((c) => [c.nome, c.valor]), [["Aluguel", 2500], ["Luz", 300], ["Embalagem do motoboy", 80]]);
});

test("'faltou o gás nos custos fixos, 150' já vem com nome e valor", async () => {
  assert.deepEqual(custosDoTexto("faltou o gás nos custos fixos, 150"), []);
  assert.deepEqual(custosDoTexto("custos fixos: gás 150, internet 99,90 e luz de 300"), [{ nome: "Gás", valor: 150 }, { nome: "Internet", valor: 99.9 }, { nome: "Luz", valor: 300 }]);
  const m = await montar();
  const { r } = await conversa(m, "faltou nos custos fixos: gás 150", ["pronto"]);
  assert.equal(r.tipo, "confirmacao");
  assert.match(JSON.stringify(r.confirmacao.linhas), /Gás.*R\$\s?150,00 por mês/);
});

test("funcionários: nome, função (botões), salário; nome já ativo não duplica", async () => {
  const m = await montar();
  const { r, perguntas } = await conversa(m, "Jhon, vamos cadastrar 2 funcionários", ["joão pereira", "Entregador(a)", "1.800", "Maria Souza", "Cozinheiro(a)", "2200"]);
  assert.match(perguntas[0], /^Funcionário 1 de 2: qual o nome completo\?/);
  assert.match(perguntas[1], /Qual a função de João Pereira\?/);
  assert.match(perguntas[2], /salário de João Pereira por mês/);
  assert.equal(r.tipo, "confirmacao");
  assert.match(JSON.stringify(r.confirmacao.linhas), /Maria Souza.*já cadastrado: não duplica/);
  const ok = await m.confirmar(r.confirmacao.acaoId);
  assert.match(ok.texto, /Cadastrei João Pereira na equipe do delivery\. Já estavam cadastrados: Maria Souza/);
  const cols = await m.linha("colaboradores");
  assert.equal(cols.filter((c) => c.nome === "João Pereira").length, 1);
  assert.equal(cols.filter((c) => c.nome === "Maria Souza").length, 1);
  const aloc = await m.linha("marmitaria_rh_alocacoes");
  assert.equal(aloc.length, 1);
  assert.equal(aloc[0].percentual_tempo, 100);
});

test("Nico não cadastra; sem permissão das configurações: bloqueado", async () => {
  const nico = await montar({ somenteLeitura: true });
  const r1 = await nico.pedir("Jhon, vamos cadastrar 2 plataformas");
  assert.notEqual(r1.tipo, "confirmacao");
  assert.notEqual(r1.tipo, "pergunta");
  const sem = await montar({ negar: ["marmitaria.settings.edit"] });
  assert.equal((await sem.pedir("Jhon, quero cadastrar os custos fixos")).tipo, "bloqueado");
});

test("montar o delivery do zero: confere o que falta e puxa o próximo passo", async () => {
  const vazio = await montar({ config: { unidade_id: A, canais: [], rateio: {} } });
  let r = await vazio.pedir("Jhon, vamos montar uma unidade de delivery");
  assert.equal(r.interpretacao.intencao, "delivery.montar");
  assert.match(r.texto, /plataforma de delivery .* ou no balcão\?/);
  assert.deepEqual(r.sugestoes, ["É plataforma de delivery: vamos cadastrar as plataformas", "É balcão: cadastrar o balcão como plataforma sem taxa"]);
  const meio = await montar();
  r = await meio.pedir("Jhon, vamos montar o delivery");
  assert.match(r.texto, /Já está pronto: onde vende, custos fixos do mês\. Próximo passo: equipe\./);
  assert.equal(r.sugestoes[0], "Vamos cadastrar funcionários");
});

test("juntar: id de app novo não repete e custo com o mesmo nome troca o valor", () => {
  const { canais, novos } = juntarCanais([{ id: "app", nome: "App" }], [{ nome: "App!", comissao: 5, pagamento: 0 }]);
  assert.deepEqual(novos, ["App!"]);
  assert.equal(canais[1].id, "app_2");
  assert.deepEqual(juntarCustos([{ nome: "Luz", valor: 1 }], [{ nome: "luz", valor: 2 }]).lista, [{ nome: "Luz", valor: 2 }]);
});

test("palavra errada ou cortada (texto ou áudio) ainda acha o pedido", async () => {
  const { interpretarPorRegras } = await import("../commands/interpretador-regras.mjs");
  const casos = {
    "Jhon vamos cadatrar 3 plataformsa": "delivery.cadastrar_plataformas",
    "jhon quero cadast os custos fixo": "delivery.cadastrar_custos_fixos",
    "vamos cadastrar 2 funcionaro": "delivery.cadastrar_funcionarios",
    "vamos motar umas marmitas": "marmitaria.criar",
    "Jhon vamos organizar a nosa tela": "marmitaria.organizador",
    "vamos montar uma unidade de delivey": "delivery.montar",
  };
  for (const [frase, esperado] of Object.entries(casos)) assert.equal(interpretarPorRegras(frase).valor.intencao, esperado, frase);
  assert.equal(interpretarPorRegras("qual o faturamento de hoje").valor.confianca, "alta");
});
