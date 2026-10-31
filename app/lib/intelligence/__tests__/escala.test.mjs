// Escala do dia pelo Héfisto: dados do cadastro + folgas lançadas, só da unidade da sessão.
// TESTADO EM MOCK (banco em memória com as duas empresas).
import test from "node:test";
import assert from "node:assert/strict";
import { criarMotorDeMetricas } from "../metrics/engine.mjs";
import { criarDbEscopado } from "../context/db-escopado.mjs";
import { montarContextoInteligencia } from "../context/context-engine.mjs";
import { criarVerificador } from "../permissions/mapa.mjs";
import { criarServicoDeAcoes } from "../actions/servico.mjs";
import { processarComando } from "../commands/command-bus.mjs";
import { criarStoreMemoria } from "../audit/store-memoria.mjs";
import { montarEscala } from "../metrics/rh.mjs";
import { bancoFalso, contexto, depsFalsas } from "./apoio.mjs";
import { tabelasPadrao } from "./fixtures.mjs";

const AGORA = new Date("2026-10-07T17:00:00Z");

async function pedir(texto, { negar = [] } = {}) {
  const deps = depsFalsas({ negar });
  const ctx = await contexto(undefined, "loja-a", deps);
  const ic = montarContextoInteligencia({ requestContext: ctx, tela: null, agora: AGORA });
  const db = bancoFalso(tabelasPadrao());
  const dbe = criarDbEscopado(db, ic.escopo);
  const verificador = criarVerificador(ctx, deps);
  const motor = criarMotorDeMetricas({ dbe, escopo: ic.escopo, verificador, agora: AGORA });
  const store = criarStoreMemoria();
  const servicoAcoes = criarServicoDeAcoes({ store, escopo: ic.escopo, dbe, dbUsuario: db, verificador, nomeUsuario: "Lucas", relogio: () => AGORA });
  return processarComando({ pedido: { texto, chave: "chave-escala-1" }, ic, motor, servicoAcoes, store, provedor: null, nomeUsuario: "Lucas", correlationId: "c1" });
}

test("quem trabalha hoje: cadastro com horário por dia, sem a empresa B", async () => {
  const r = await pedir("Quem trabalha hoje?");
  assert.equal(r.interpretacao.intencao, "rh.escala_dia");
  assert.match(r.texto, /^2 pessoa\(s\) na escala de hoje: Bruno 09:00–17:00, Ana 15:40–00:00\./);
  assert.ok(!JSON.stringify(r).includes("Zé da empresa B"), "vazou colaborador da empresa B");
  assert.ok(JSON.stringify(r.blocos).includes("Carla"), "avisa quem está sem horário no cadastro");
});

test("escala de amanhã mostra a folga lançada", async () => {
  const r = await pedir("Qual a escala de amanhã?");
  assert.match(r.texto, /escala de amanhã \(08\/10\): Bruno 09:00–17:00\. De folga: Ana\./);
});

test("sem permissão de RH, a escala não aparece", async () => {
  const r = await pedir("Quem trabalha hoje?", { negar: ["rh.overview.view", "rh.employees.view", "rh.orgchart.view"] });
  assert.ok(!/Bruno|Ana/.test(r.texto), r.texto);
});

test("montarEscala: desligado e admitido depois não entram; domingo usa o horário de domingo", () => {
  const colaboradores = [
    { id: "a", nome: "A", status: "ativo", dias_trabalho: "0", horario_entrada: "15:00", horario_saida: "23:00", horario_dom_entrada: "09:00", horario_dom_saida: "17:00" },
    { id: "b", nome: "B", status: "ativo", data_desligamento: "2026-10-01", horario_entrada: "08:00", horario_saida: "16:00" },
    { id: "c", nome: "C", status: "ativo", data_admissao: "2026-10-20", horario_entrada: "08:00", horario_saida: "16:00" },
  ];
  const e = montarEscala({ colaboradores, folgas: [], data: "2026-10-11" });
  assert.deepEqual(e.trabalham.map((p) => [p.nome, p.entrada, p.saida]), [["A", "09:00", "17:00"]]);
});
