// Organizador de plataforma pelo Jhon (17/11/2026): prints da tela do app →
// platform.screen (prévia, confirmar, grava só a vitrine desse app) e
// "vamos organizar a nossa tela" (marmitaria.organizador).
// TESTADO EM MOCK: banco em memória.
import test from "node:test";
import assert from "node:assert/strict";
import { criarMotorDeMetricas } from "../metrics/engine.mjs";
import { criarDbEscopado } from "../context/db-escopado.mjs";
import { montarContextoInteligencia } from "../context/context-engine.mjs";
import { criarVerificador } from "../permissions/mapa.mjs";
import { criarServicoDeAcoes, acoesSomenteLeitura } from "../actions/servico.mjs";
import { processarComando, pedidoSchema } from "../commands/command-bus.mjs";
import { criarStoreMemoria } from "../audit/store-memoria.mjs";
import { interpretarPorRegras } from "../commands/interpretador-regras.mjs";
import { acaoPorId } from "../actions/registry.mjs";
import { cardapioDoOcr } from "../../marmitaria/concorrentes.mjs";
import { CHAVE_PARAMS, vitrineDe } from "../../marmitaria/organizador.mjs";
import { bancoFalso, contexto, depsFalsas, AGORA } from "./apoio.mjs";
import { tabelasPadrao } from "./fixtures.mjs";

const A = "loja-a";
const TELA = cardapioDoOcr({
  plataforma: "",
  itens: [
    { tipo: "prato", categoria: "Executivos do Chef", nome: "Strogonoff de Carne", descricao: "Tiras de alcatra e cogumelos", preco: "28,00", preco_original: "40,00" },
    { tipo: "prato", categoria: "Executivos do Chef", nome: "Brasileirinho de Frango", descricao: "Filé de peito de frango", preco: "23,80", preco_original: "34,00" },
  ],
});

async function montar({ negar = [], comRpc = true, vitrineAntes = null, somenteLeitura = false } = {}) {
  const deps = depsFalsas({ negar });
  const ctx = await contexto(undefined, A, deps);
  const ic = montarContextoInteligencia({ requestContext: ctx, tela: null, agora: AGORA });
  const t = tabelasPadrao();
  t.config_sistema = [{ id: "cfg-a", unidade_id: A, params: { meta_cmv: 30, ...(vitrineAntes ? { [CHAVE_PARAMS]: vitrineAntes } : {}) } }];
  const patches = [];
  const db = bancoFalso(t, comRpc ? { rpcs: { merge_config_sistema_params: async (a) => { patches.push(a); return true; } } } : {});
  const dbe = criarDbEscopado(db, ic.escopo);
  const verificador = criarVerificador(ctx, deps);
  const motor = criarMotorDeMetricas({ dbe, escopo: ic.escopo, verificador, agora: AGORA });
  const store = criarStoreMemoria();
  const base = criarServicoDeAcoes({ store, escopo: ic.escopo, dbe, dbUsuario: db, verificador, nomeUsuario: "Lucas", relogio: () => AGORA });
  const servicoAcoes = somenteLeitura ? acoesSomenteLeitura(base) : base;
  let n = 0;
  const pedir = (pedido) => processarComando({ pedido: { chave: `chave-tela-${++n}`, ...pedido }, ic, motor, servicoAcoes, store, correlationId: `c${n}` });
  const responder = (acaoId, valor) => processarComando({ pedido: { continuar: { acaoId, campo: "resposta", valor } }, ic, motor, servicoAcoes, store, correlationId: "r" });
  const confirmar = (acaoId) => servicoAcoes.confirmar({ acaoId, correlationId: "ok" });
  const params = async () => (await db.from("config_sistema").select("params").eq("unidade_id", A)).data[0].params;
  return { pedir, responder, confirmar, patches, params };
}

test("frases: organizar a tela vai para o organizador, não para concorrentes", () => {
  for (const frase of ["Jhon, vamos organizar a nossa tela", "monta a tela do iFood", "o que falta na nossa vitrine?", "Jhon, vamos organizar a nossa tela da plataforma"]) {
    assert.equal(interpretarPorRegras(frase).valor.intencao, "marmitaria.organizador", frase);
  }
  assert.equal(interpretarPorRegras("Jhon, vou te mandar o cardápio de um concorrente").valor.intencao, "marmitaria.concorrente_ler");
});

test("pedidoSchema aceita destino vitrine e recusa destino desconhecido", () => {
  assert.equal(pedidoSchema.parse({ chave: "chave-12345678", cardapio: TELA, destino: "vitrine" }).ok, true);
  assert.equal(pedidoSchema.parse({ chave: "chave-12345678", cardapio: TELA, destino: "outro" }).ok, false);
});

test("prints da tela: pergunta o app, mostra a prévia e só grava ao confirmar (cupom do 'a partir de')", async () => {
  const { pedir, responder, confirmar, patches } = await montar();
  let r = await pedir({ cardapio: TELA, destino: "vitrine" });
  assert.equal(r.interpretacao.intencao, "marmitaria.organizador");
  assert.equal(r.tipo, "pergunta");
  assert.match(r.texto, /^Li 2 itens da tela\. Essa tela é de qual app\?/);
  assert.ok(r.pergunta.opcoes.some((o) => o.id === "ifood"));
  r = await responder(r.pergunta.acaoId, "ifood");
  assert.equal(r.tipo, "confirmacao");
  const linhas = Object.fromEntries(r.confirmacao.linhas.map((l) => [l.rotulo, l.valor]));
  const pratos = r.confirmacao.linhas.filter((l) => l.rotulo === "Executivos do Chef").map((l) => l.valor);
  assert.equal(linhas.App, "iFood");
  assert.equal(linhas["Novos na vitrine"], "2");
  assert.match(pratos[0], /Strogonoff de Carne — R\$\s?40,00 \(cupom R\$\s?28,00\)/);
  assert.equal(patches.length, 0, "nada gravado antes de confirmar");
  const ok = await confirmar(r.confirmacao.acaoId);
  assert.equal(ok.tipo, "resultado_acao");
  assert.match(ok.texto, /Vitrine do iFood atualizada: 2 itens novos/);
  assert.equal(patches.length, 1);
  assert.equal(patches[0].p_unidade_id, A);
  const v = vitrineDe(patches[0].p_patch[CHAVE_PARAMS], "ifood");
  assert.equal(v.categorias[0].nome, "Executivos do Chef");
  assert.deepEqual(v.categorias[0].itens.map((i) => [i.nome, i.preco, i.preco_cupom]), [["Strogonoff de Carne", 40, 28], ["Brasileirinho de Frango", 34, 23.8]]);
});

test("sem a função de junção no banco: relê e grava só a chave do organizador, sem apagar os outros parâmetros nem a outra vitrine", async () => {
  const antes = { versao: 1, plataformas: { keeta: { categorias: [{ id: "c1", nome: "Marmitas", itens: [{ id: "i1", nome: "Feijoada", preco: 30 }] }] } } };
  const { pedir, responder, confirmar, params: lerParams } = await montar({ comRpc: false, vitrineAntes: antes });
  let r = await pedir({ cardapio: TELA, destino: "vitrine" });
  r = await responder(r.pergunta.acaoId, "iFood");
  const ok = await confirmar(r.confirmacao.acaoId);
  assert.equal(ok.tipo, "resultado_acao", ok.texto);
  const params = await lerParams();
  assert.equal(params.meta_cmv, 30);
  assert.equal(vitrineDe(params[CHAVE_PARAMS], "keeta").categorias[0].itens[0].nome, "Feijoada");
  assert.equal(vitrineDe(params[CHAVE_PARAMS], "ifood").categorias[0].itens.length, 2);
});

test("Nico (só transmite) não monta a vitrine", async () => {
  const { pedir, patches } = await montar({ somenteLeitura: true });
  const r = await pedir({ cardapio: { ...TELA, plataforma: "ifood" }, destino: "vitrine" });
  assert.notEqual(r.tipo, "confirmacao");
  assert.equal(patches.length, 0);
});

test("sem permissão de alterar o cardápio: bloqueado", async () => {
  const { pedir } = await montar({ negar: ["marmitaria.recipes.edit", "marmitaria.recipes.create"] });
  const r = await pedir({ cardapio: { ...TELA, plataforma: "ifood" }, destino: "vitrine" });
  assert.equal(r.tipo, "bloqueado");
});

test("'vamos organizar a nossa tela': diz como está cada vitrine e o que falta", async () => {
  const antes = { versao: 1, plataformas: { ifood: { categorias: [{ id: "c1", nome: "Executivos", itens: [{ id: "i1", nome: "Strogonoff", preco: 40 }, { id: "i2", nome: "Parmegiana" }] }] } } };
  const { pedir } = await montar({ vitrineAntes: antes });
  const r = await pedir({ texto: "Jhon, vamos organizar a nossa tela" });
  assert.equal(r.interpretacao.intencao, "marmitaria.organizador");
  const txt = JSON.stringify(r);
  assert.match(txt, /1 categoria, 2 itens; 2 sem foto, 2 sem descrição, 1 sem preço/);
  assert.match(txt, /Parmegiana \(iFood\): sem preço/);
  assert.match(txt, /Tela da plataforma/);
  assert.match(txt, /\/dashboard\/marmitaria\/marmitas\/organizador/);
});

test("a ação está no registro com capacidade própria", () => {
  const def = acaoPorId("platform.screen");
  assert.equal(def.capacidade, "organizador_gravar");
  assert.equal(def.precisaConfirmacao, true);
});
