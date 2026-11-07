// Agente geral do Assistente: responde o que nenhum comando pronto entende,
// com os dados DESTA unidade e sem inventar número. TESTADO EM MOCK.
import test from "node:test";
import assert from "node:assert/strict";
import { criarMotorDeMetricas } from "../metrics/engine.mjs";
import { criarDbEscopado } from "../context/db-escopado.mjs";
import { montarContextoInteligencia } from "../context/context-engine.mjs";
import { criarVerificador } from "../permissions/mapa.mjs";
import { criarServicoDeAcoes } from "../actions/servico.mjs";
import { processarComando } from "../commands/command-bus.mjs";
import { criarStoreMemoria } from "../audit/store-memoria.mjs";
import { travarNumeros, sugestoesValidas, respostaLivreSchema } from "../agents/geral.mjs";
import { bancoFalso, contexto, depsFalsas } from "./apoio.mjs";
import { tabelasPadrao } from "./fixtures.mjs";

const AGORA = new Date("2026-10-07T17:00:00Z");
const PERGUNTA = "o vatapá baiano combina com que acompanhamento no almoço?";

function provedorFalso(saida) {
  const chamadas = [];
  return { chamadas, nome: "falso", modelo: "modelo-teste", disponivel: () => true, async interpretar(p) { chamadas.push(p); return typeof saida === "function" ? saida(p) : saida; } };
}
const respostaIA = (resposta, sugestoes = [], faltaDado = null) => ({ ok: true, dados: { resposta, sugestoes, faltaDado }, uso: { entrada: 1200, saida: 90 }, latenciaMs: 400 });
// o interpretador recebe "desconhecido" e o agente geral recebe a resposta
const duasEtapas = (resp) => (p) => (p.tarefa === "responder" ? resp : { ok: true, dados: { intencao: "desconhecido", confianca: "baixa" } });

async function montar({ provedor = null, negar = [] } = {}) {
  const deps = depsFalsas({ negar });
  const ctx = await contexto(undefined, "loja-a", deps);
  const ic = montarContextoInteligencia({ requestContext: ctx, tela: null, agora: AGORA });
  const db = bancoFalso(tabelasPadrao());
  const dbe = criarDbEscopado(db, ic.escopo);
  const verificador = criarVerificador(ctx, deps);
  const motor = criarMotorDeMetricas({ dbe, escopo: ic.escopo, verificador, agora: AGORA });
  const store = criarStoreMemoria();
  const servicoAcoes = criarServicoDeAcoes({ store, escopo: ic.escopo, dbe, dbUsuario: db, verificador, nomeUsuario: "Lucas", relogio: () => AGORA });
  const pedir = (texto) => processarComando({ pedido: { texto, chave: `k-${Math.random()}` }, ic, motor, servicoAcoes, store, provedor, nomeUsuario: "Lucas", correlationId: "c1" });
  return { pedir, store };
}

test("pergunta fora do catálogo: o agente recebe a ficha citada desta unidade (nada da B) e responde", async () => {
  const prov = provedorFalso(duasEtapas(respostaIA("O Vatapá Baiano leva 500 g de Camarão 40/60. Sugestão: sirva com arroz branco e farofa de dendê.", ["Como faz o vatapá?", "isso não é comando"])));
  const { pedir, store } = await montar({ provedor: prov });
  const r = await pedir(PERGUNTA);
  assert.equal(r.tipo, "resposta");
  assert.deepEqual(r.agentes, ["geral"]);
  assert.match(r.texto, /500 g de Camarão 40\/60/);
  assert.deepEqual(r.sugestoes, ["Como faz o vatapá?", "Como faz Vatapá Baiano?"], "sugestão que o Assistente não entende é descartada");
  const enviado = prov.chamadas.find((c) => c.tarefa === "responder").texto;
  assert.match(enviado, /Vatapá Baiano/);
  assert.match(enviado, /Camarão 40\/60/);
  assert.ok(!enviado.includes("999999") && !enviado.includes("segredo da B"), "dado da empresa B foi para o modelo");
  assert.equal(store.eventos.at(-1).modelo_ia, "modelo-teste");
});

test("valor que não está nos dados é cortado (o modelo não inventa número de negócio)", async () => {
  const prov = provedorFalso(duasEtapas(respostaIA("Seu vatapá custa R$ 12,40 por porção e vende 30% mais no almoço. Sugestão: sirva com arroz.")));
  const { pedir } = await montar({ provedor: prov });
  const r = await pedir(PERGUNTA);
  assert.doesNotMatch(r.texto, /12,40|30%/);
  assert.match(r.texto, /Sugestão: sirva com arroz/);
  assert.match(JSON.stringify(r.blocos), /tirei um valor que não está no sistema/);
});

test("sem permissão de fichas, a ficha não vai para o modelo", async () => {
  const prov = provedorFalso(duasEtapas(respostaIA("Sugestão: arroz branco.")));
  const { pedir } = await montar({ provedor: prov, negar: ["fichas.recipes.view", "cozinha.recipes.view", "bar.recipes.view"] });
  await pedir(PERGUNTA);
  const enviado = prov.chamadas.find((c) => c.tarefa === "responder").texto;
  assert.doesNotMatch(enviado, /Vatapá Baiano|500 g de Camarão/);
});

test("sem IA: responde com o que achou no sistema e botões, nunca 'não sei'", async () => {
  const { pedir } = await montar();
  const r = await pedir(PERGUNTA);
  assert.equal(r.tipo, "resposta");
  assert.match(r.texto, /Vatapá Baiano: vai 500 g de Camarão 40\/60/);
  assert.ok(r.sugestoes.includes("Como faz Vatapá Baiano?"));
  assert.doesNotMatch(r.texto, /não sei|não entendi/i);
});

test("prato sem ficha: oferece montar a ficha na hora", async () => {
  const { pedir } = await montar();
  const r = await pedir("Como faz a moqueca?");
  assert.equal(r.tipo, "pergunta");
  assert.equal(r.pergunta.opcoes[0].comando, "Vamos montar uma receita, o nome vai ser moqueca");
});

test("trava de números e sugestões (funções puras)", () => {
  const dados = { indicadores: ["CMV: 31,2% — mês"], saldos: [{ produto: "Picanha", saldo: "3,5 kg" }] };
  assert.deepEqual(travarNumeros("Seu CMV está em 31,2%. A meta boa é 28%.", dados), { texto: "Seu CMV está em 31,2%.", cortadas: 1 });
  assert.equal(travarNumeros("Você tem 3,5 kg de picanha.", dados).cortadas, 0);
  assert.equal(travarNumeros("Você tem 8 kg de picanha.", dados).cortadas, 1);
  assert.equal(travarNumeros("Asse a 180 graus por 20 minutos.", dados).cortadas, 0, "técnica de cozinha não é número do negócio");
  assert.deepEqual(sugestoesValidas(["Quanto tenho de picanha?", "blá blá", "Como está meu CMV?"]), ["Quanto tenho de picanha?", "Como está meu CMV?"]);
  assert.equal(respostaLivreSchema.parse({ resposta: "ok", sugestoes: [], faltaDado: null, empresa_id: "b" }).ok, false, "campo extra do modelo é recusado");
});
