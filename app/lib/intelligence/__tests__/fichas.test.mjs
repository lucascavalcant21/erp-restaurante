// Ficha técnica pelo Héfisto: ingredientes e preparo cadastrados, só da unidade da sessão.
// TESTADO EM MOCK (banco em memória com as duas empresas).
import test from "node:test";
import assert from "node:assert/strict";
import { criarMotorDeMetricas } from "../metrics/engine.mjs";
import { criarDbEscopado, ErroDeIsolamento } from "../context/db-escopado.mjs";
import { montarContextoInteligencia } from "../context/context-engine.mjs";
import { criarVerificador } from "../permissions/mapa.mjs";
import { criarServicoDeAcoes } from "../actions/servico.mjs";
import { processarComando } from "../commands/command-bus.mjs";
import { criarStoreMemoria } from "../audit/store-memoria.mjs";
import { quantidadeLegivel } from "../metrics/fichas.mjs";
import { bancoFalso, contexto, depsFalsas } from "./apoio.mjs";
import { tabelasPadrao } from "./fixtures.mjs";

const AGORA = new Date("2026-10-07T17:00:00Z");

async function montar({ negar = [] } = {}) {
  const deps = depsFalsas({ negar });
  const ctx = await contexto(undefined, "loja-a", deps);
  const ic = montarContextoInteligencia({ requestContext: ctx, tela: null, agora: AGORA });
  const db = bancoFalso(tabelasPadrao());
  const dbe = criarDbEscopado(db, ic.escopo);
  const verificador = criarVerificador(ctx, deps);
  const motor = criarMotorDeMetricas({ dbe, escopo: ic.escopo, verificador, agora: AGORA });
  const store = criarStoreMemoria();
  const servicoAcoes = criarServicoDeAcoes({ store, escopo: ic.escopo, dbe, dbUsuario: db, verificador, nomeUsuario: "Lucas", relogio: () => AGORA });
  const pedir = (texto) => processarComando({ pedido: { texto, chave: "chave-ficha-1" }, ic, motor, servicoAcoes, store, provedor: null, nomeUsuario: "Lucas", correlationId: "c1" });
  return { pedir, dbe };
}

test("como faz o vatapá: ingredientes, base da casa e etapas em ordem, sem a empresa B", async () => {
  const { pedir } = await montar();
  const r = await pedir("Como faz o vatapá?");
  assert.equal(r.interpretacao.intencao, "fichas.preparo");
  assert.match(r.texto, /^Vatapá Baiano rende 10 porções \(porção de 250 g\)\. Ingredientes: 500 g de Camarão 40\/60; 100 ml de Óleo de soja; 1,5 L de Caldo de camarão \(base da casa\)\. Preparo: 1\) Refogar o camarão no óleo\. 2\) Juntar o caldo/);
  assert.ok(!JSON.stringify(r).includes("999999") && !JSON.stringify(r).includes("segredo da B"), "vazou ficha da empresa B");
});

test("prato sem ficha: DADOS INSUFICIENTES, sem inventar receita", async () => {
  const { pedir } = await montar();
  const r = await pedir("Qual a receita da moqueca?");
  assert.equal(r.interpretacao.intencao, "fichas.preparo");
  assert.match(r.texto, /DADOS INSUFICIENTES/);
  assert.match(r.texto, /moqueca/);
});

test("sem permissão de fichas, a receita não aparece", async () => {
  const { pedir } = await montar({ negar: ["fichas.recipes.view", "cozinha.recipes.view", "bar.recipes.view"] });
  const r = await pedir("Como faz o vatapá?");
  assert.ok(!/Camarão|Refogar/.test(r.texto), r.texto);
});

test("ingredientes só da ficha já conferida desta unidade (regra pai do banco escopado)", async () => {
  const { dbe } = await montar();
  assert.throws(() => dbe.from("fichas_ingredientes").select("quantidade").eq("ficha_id", "fb"), ErroDeIsolamento, "ficha da B nunca lida");
  await assert.rejects(async () => await dbe.from("fichas_ingredientes").select("quantidade"), ErroDeIsolamento, "sem filtro pela ficha");
  await dbe.from("fichas_tecnicas").select("id");
  assert.throws(() => dbe.from("fichas_ingredientes").select("quantidade").in("ficha_id", ["f1", "fb"]), ErroDeIsolamento, "B continua fora mesmo misturada");
  const { data } = await dbe.from("fichas_ingredientes").select("quantidade").eq("ficha_id", "f1");
  assert.equal(data.length, 3);
});

test("quantidadeLegivel: kg e L pequenos viram g e ml", () => {
  assert.equal(quantidadeLegivel(0.25, "kg"), "250 g");
  assert.equal(quantidadeLegivel(2, "kg"), "2 kg");
  assert.equal(quantidadeLegivel(0.05, "L"), "50 ml");
  assert.equal(quantidadeLegivel(3, "un"), "3 un");
});
