// Procedimentos da casa no Assistente: o jeito da casa (REAL) vence a orientação
// padrão (SUGESTÃO), e só da unidade da sessão.
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
import { bancoFalso, contexto, depsFalsas } from "./apoio.mjs";
import { tabelasPadrao } from "./fixtures.mjs";

const AGORA = new Date("2026-10-07T17:00:00Z");
const PA = "c0000000-0000-4000-8000-0000000000a1";
const PJ = "c0000000-0000-4000-8000-0000000000a2";
const PB = "c0000000-0000-4000-8000-0000000000b1";

function comProcedimentos(t) {
  t.op_processos = [
    { id: PA, unidade_id: "loja-a", nome: "Cliente reclamou da comida", descricao: "Qualquer reclamação de prato", setor: "salao", categoria: "procedimento", arquivado: false },
    { id: PJ, unidade_id: "loja-a", nome: "Montar o jardim", descricao: "Antes do jantar de sexta", setor: "salao", categoria: "procedimento", arquivado: false },
    { id: PB, unidade_id: "loja-b", nome: "Cliente reclamou da comida", descricao: "segredo da B", setor: "salao", categoria: "procedimento", arquivado: false },
  ];
  t.op_secoes = [
    { id: "s1", processo_id: PA, titulo: "Passo a passo", ordem: 0 },
    { id: "s2", processo_id: PA, titulo: "Chame o gerente quando", ordem: 1 },
    { id: "s3", processo_id: PJ, titulo: "Passo a passo", ordem: 0 },
    { id: "s9", processo_id: PB, titulo: "Passo a passo", ordem: 0 },
  ];
  t.op_itens = [
    { id: "i2", processo_id: PA, secao_id: "s1", titulo: "Leve o prato de volta para a cozinha na hora", ordem: 1 },
    { id: "i1", processo_id: PA, secao_id: "s1", titulo: "Peça desculpas e escute sem discutir", ordem: 0 },
    { id: "i3", processo_id: PA, secao_id: "s2", titulo: "O cliente pedir para tirar da conta", ordem: 0 },
    { id: "i4", processo_id: PJ, secao_id: "s3", titulo: "Acenda as luzes do pergolado", ordem: 0 },
    { id: "i9", processo_id: PB, secao_id: "s9", titulo: "segredo da B", ordem: 0 },
  ];
}

async function montar({ extra = comProcedimentos } = {}) {
  const deps = depsFalsas({});
  const ctx = await contexto(undefined, "loja-a", deps);
  const ic = montarContextoInteligencia({ requestContext: ctx, tela: null, agora: AGORA });
  const tabelas = tabelasPadrao();
  if (extra) extra(tabelas);
  const db = bancoFalso(tabelas);
  const dbe = criarDbEscopado(db, ic.escopo);
  const verificador = criarVerificador(ctx, deps);
  const motor = criarMotorDeMetricas({ dbe, escopo: ic.escopo, verificador, agora: AGORA });
  const store = criarStoreMemoria();
  const servicoAcoes = criarServicoDeAcoes({ store, escopo: ic.escopo, dbe, dbUsuario: db, verificador, nomeUsuario: "Lucas", relogio: () => AGORA });
  const pedir = (texto) => processarComando({ pedido: { texto, chave: "chave-proc-1" }, ic, motor, servicoAcoes, store, provedor: null, nomeUsuario: "Lucas", correlationId: "c1" });
  return { pedir, dbe };
}

test("problema com procedimento cadastrado: o jeito da casa, em ordem, REAL e sem a empresa B", async () => {
  const { pedir } = await montar();
  const r = await pedir("Situação no salão: o cliente reclamou da comida. Como resolvo?");
  assert.equal(r.interpretacao.intencao, "salao.orientacao");
  assert.equal(r.natureza, "REAL");
  const b = r.blocos.find((x) => x.tipo === "passos");
  assert.deepEqual(b.passos, ["Peça desculpas e escute sem discutir", "Leve o prato de volta para a cozinha na hora"]);
  assert.deepEqual(b.gerente, ["O cliente pedir para tirar da conta"]);
  assert.match(r.texto, /^Cliente reclamou da comida, do jeito da casa:\n1\. Peça desculpas/);
  assert.ok(!JSON.stringify(r).includes("segredo da B"), "vazou procedimento da empresa B");
  assert.ok(r.acoes.some((a) => a.rota === "/dashboard/inteligencia/procedimentos?novo=Cliente%20reclamou%20da%20comida"));
});

test("montagem do jardim cadastrada responde pelo atalho do ambiente", async () => {
  const { pedir } = await montar();
  const menu = await pedir("Atalhos: ambiente");
  const jardim = menu.pergunta.opcoes.find((o) => o.rotulo === "Montar o jardim");
  assert.ok(jardim, "o ambiente cadastrado vira botão");
  const r = await pedir(jardim.comando);
  assert.equal(r.blocos.find((x) => x.tipo === "passos")?.titulo, "Montar o jardim");
});

test("menu de problemas: cadastrados primeiro, sem repetir o padrão do mesmo assunto", async () => {
  const { pedir } = await montar();
  const p = await pedir("Atalhos: problemas");
  const rotulos = p.pergunta.opcoes.map((o) => o.rotulo);
  assert.equal(rotulos[0], "Cliente reclamou da comida");
  assert.ok(!rotulos.includes("O cliente reclamou da comida"));
  assert.ok(rotulos.includes("O cliente tem alergia"));
  assert.ok(!rotulos.includes("Montar o jardim"), "montagem não é problema");
  const outro = await pedir("Atalhos: outro problema");
  assert.equal(outro.pergunta.livre, true, "outro problema abre o campo de escrever");
});

test("sem procedimento: orientação padrão e o botão para cadastrar já com o modelo", async () => {
  const { pedir } = await montar({ extra: null });
  const r = await pedir("Situação no salão: derramou bebida no cliente. Como resolvo?");
  assert.deepEqual(r.agentes, ["geral"]);
  assert.ok(!r.blocos?.some((x) => x.tipo === "passos"));
  assert.ok(r.acoes.some((a) => a.rotulo === "Cadastrar o jeito da casa" && a.rota === "/dashboard/inteligencia/procedimentos?novo=Derramou%20bebida%20no%20cliente"));
});

test("itens do procedimento só do processo já conferido desta unidade", async () => {
  const { dbe } = await montar();
  assert.throws(() => dbe.from("op_itens").select("titulo").eq("processo_id", PB), ErroDeIsolamento);
  await assert.rejects(async () => await dbe.from("op_secoes").select("titulo"), ErroDeIsolamento);
});
