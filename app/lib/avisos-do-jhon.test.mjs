import test from "node:test";
import assert from "node:assert/strict";
import { avisosDoJhon, ajusteDaEscolha, horaISO, horaSP, semDispensados } from "./avisos-do-jhon.mjs";

// Sábado, 14/11/2026, 10:42 em Brasília.
const AGORA = new Date("2026-11-14T10:42:00-03:00");
const HOJE = "2026-11-14";

const maria = { id: "c1", nome: "Maria Souza", telefone: "45999990000", status: "ativo", dias_trabalho: "1,2,3,4,5,6", horario_entrada: "08:00", horario_saida: "16:20" };
const joao = { id: "c2", nome: "João Lima", telefone: "", status: "ativo", dias_trabalho: "2,3,4,5,6,0", horario_entrada: "15:40", horario_saida: "00:00" };
const ana = { id: "c3", nome: "Ana", status: "ativo", dias_trabalho: "1,2,3,4,5,6", horario_entrada: "09:00", horario_saida: "17:00" };

const iso = (hhmm, data = HOJE) => new Date(`${data}T${hhmm}:00-03:00`).toISOString();

test("quem não bateu e já passou da tolerância vira aviso, com WhatsApp", () => {
  const { avisos } = avisosDoJhon({ agora: AGORA, colaboradores: [maria], pontosHoje: [], pontosAbertos: [], execucoes: [], ncs: [] });
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].titulo, "Maria não bateu o ponto");
  assert.equal(avisos[0].gravidade, "critico"); // 162 min
  assert.match(avisos[0].whatsapp, /^https:\/\/wa\.me\/5545999990000\?text=/);
});

test("escala que ainda não começou, folga e atestado não geram aviso", () => {
  const base = { agora: AGORA, pontosHoje: [], pontosAbertos: [], execucoes: [], ncs: [] };
  assert.equal(avisosDoJhon({ ...base, colaboradores: [joao] }).avisos.length, 0);
  assert.equal(avisosDoJhon({ ...base, colaboradores: [maria], folgasHoje: ["c1"] }).avisos.length, 0);
  assert.equal(avisosDoJhon({ ...base, colaboradores: [maria], atestadosHoje: ["c1"] }).avisos.length, 0);
  assert.equal(avisosDoJhon({ ...base, colaboradores: [{ ...maria, status: "inativo" }] }).avisos.length, 0);
});

test("dentro da tolerância não é atraso", () => {
  const agora = new Date("2026-11-14T08:09:00-03:00");
  assert.equal(avisosDoJhon({ agora, colaboradores: [maria], pontosHoje: [], pontosAbertos: [] }).avisos.filter(a => a.origem === "ponto").length, 0);
});

test("entrada muito longe da escala: o Jhon pergunta qual vale, não cobra", () => {
  const pontosHoje = [{ colaborador_id: "c1", data_referencia: HOJE, hora_entrada: iso("14:02") }];
  const agora = new Date("2026-11-14T14:30:00-03:00");
  const { avisos } = avisosDoJhon({ agora, colaboradores: [maria], pontosHoje, pontosAbertos: [] });
  const a = avisos.find(x => x.chave.startsWith("entrada-estranha"));
  assert.ok(a);
  assert.equal(a.titulo, "Maria bateu a entrada às 14:02");
  assert.equal(a.acao.tipo, "ajustar_ponto");
  assert.equal(a.acao.horaRegistrada, "14:02");
  assert.equal(a.acao.horaSugerida, "08:00");
  assert.equal(avisos.some(x => x.chave.startsWith("atrasou")), false);
});

test("atraso comum é cobrança, sem proposta de ajuste", () => {
  const pontosHoje = [{ colaborador_id: "c1", data_referencia: HOJE, hora_entrada: iso("08:35") }];
  const { avisos } = avisosDoJhon({ agora: AGORA, colaboradores: [maria], pontosHoje, pontosAbertos: [] });
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].titulo, "Maria chegou 35 min atrasado");
  assert.equal(avisos[0].acao.tipo, "cobrar");
});

test("toque duplo no tablet vira pergunta sobre a batida certa", () => {
  const pontosHoje = [{ colaborador_id: "c3", data_referencia: HOJE, hora_entrada: iso("09:00"), hora_saida_intervalo: iso("09:02") }];
  const { avisos } = avisosDoJhon({ agora: AGORA, colaboradores: [ana], pontosHoje, pontosAbertos: [] });
  const a = avisos.find(x => x.chave.startsWith("toque-duplo"));
  assert.ok(a);
  assert.equal(a.acao.batida, "saida_intervalo");
  assert.equal(a.acao.horaSugerida, null);
});

test("turno da madrugada de ontem ainda aberto não vira 'não bateu hoje'", () => {
  const agora = new Date("2026-11-14T00:40:00-03:00");
  const notivago = { ...joao, id: "c9", dias_trabalho: "0,1,2,3,4,5,6", horario_entrada: "00:00", horario_saida: "06:00" };
  const pontosHoje = [{ colaborador_id: "c9", data_referencia: "2026-11-13", hora_entrada: iso("15:40", "2026-11-13") }];
  const { avisos } = avisosDoJhon({ agora, colaboradores: [notivago], pontosHoje, pontosAbertos: [] });
  assert.equal(avisos.filter(a => a.origem === "ponto").length, 0);
});

test("saída esquecida propõe a saída da escala, no dia seguinte se o turno vira a noite", () => {
  const pontosAbertos = [{ colaborador_id: "c2", data_referencia: "2026-11-13", hora_entrada: iso("15:41", "2026-11-13") }];
  const { avisos } = avisosDoJhon({ agora: AGORA, colaboradores: [joao], pontosHoje: [], pontosAbertos });
  const a = avisos.find(x => x.chave.startsWith("sem-saida"));
  assert.equal(a.titulo, "João não bateu a saída em 13/11");
  assert.equal(a.acao.horaSugerida, "00:00");
  assert.equal(a.acao.diaSeguinte, true);
  assert.equal(a.whatsapp, null); // sem telefone, sem link

  const ajuste = ajusteDaEscolha(a.acao, "sugerida", { quemAprovou: "Lucas" });
  assert.equal(ajuste.novaHoraISO, iso("00:00", "2026-11-14"));
  assert.equal(ajuste.tipo, "saida_trabalho");
  assert.match(ajuste.motivo, /Ajuste aprovado por Lucas no aviso do Jhon/);
});

test("ajusteDaEscolha: manter não grava; outro horário exige hora válida e quem aprovou", () => {
  const acao = { tipo: "ajustar_ponto", colaboradorId: "c1", dataReferencia: HOJE, batida: "entrada", rotuloBatida: "entrada", horaRegistrada: "14:02", horaSugerida: "08:00" };
  assert.equal(ajusteDaEscolha(acao, "manter"), null);
  assert.deepEqual(ajusteDaEscolha(acao, "sugerida"), { erro: "Falta quem aprovou o ajuste." });
  assert.ok(ajusteDaEscolha(acao, "outro", { horaDigitada: "25:00", quemAprovou: "Lucas" }).erro);
  assert.equal(ajusteDaEscolha(acao, "outro", { horaDigitada: "14:02", quemAprovou: "Lucas" }), null);
  const ok = ajusteDaEscolha(acao, "outro", { horaDigitada: "08:15", quemAprovou: "Lucas" });
  assert.equal(ok.novaHoraISO, iso("08:15"));
  assert.equal(ok.unidadeId, null); // tenant vem da sessão
  assert.match(ok.motivo, /entrada: 14:02 → 08:15 \(horário informado pelo dono\)/);
});

test("fonte não lida aparece como sem dado, e sensores sempre aparecem", () => {
  const { avisos, fontesSemDado } = avisosDoJhon({ agora: AGORA });
  assert.equal(avisos.length, 0);
  const fontes = fontesSemDado.map(f => f.fonte);
  assert.ok(fontes.includes("Ponto de hoje"));
  assert.ok(fontes.includes("Checklists e produção"));
  assert.ok(fontes.includes("Ar-condicionado, luzes e temperatura"));
});

test("rotina atrasada da operação entra junto, depois do ponto na mesma gravidade", () => {
  const execucoes = [{ id: "e1", responsavel_id: "c3", prazo_ate: iso("10:00"), previsto_para: iso("09:00"), status: "AGENDADA", processo: { nome: "Checklist de abertura", criticidade: "MEDIA" } }];
  const pontosHoje = [{ colaborador_id: "c1", data_referencia: HOJE, hora_entrada: iso("08:35") }];
  const { avisos } = avisosDoJhon({ agora: AGORA, colaboradores: [maria, ana], pontosHoje, pontosAbertos: [], execucoes, ncs: [] });
  const origens = avisos.map(a => a.origem);
  assert.ok(origens.includes("operacao"));
  assert.ok(origens.indexOf("ponto") < origens.indexOf("operacao") || avisos[0].gravidade === "critico");
});

test("horários no fuso da casa", () => {
  assert.equal(horaSP("2026-11-14T13:42:00Z"), "10:42");
  assert.equal(horaISO("2026-11-14", "08:00"), "2026-11-14T11:00:00.000Z");
  assert.equal(horaISO("2026-11-14", "00:30", true), "2026-11-15T03:30:00.000Z");
  assert.equal(horaISO("ontem", "08:00"), null);
});

test("dispensados somem só pela chave", () => {
  const lista = [{ chave: "a" }, { chave: "b" }];
  assert.deepEqual(semDispensados(lista, ["a"]), [{ chave: "b" }]);
});
