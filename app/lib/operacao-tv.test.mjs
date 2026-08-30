import test from "node:test";
import assert from "node:assert/strict";
import { painelDoDia, linhaDaExecucao } from "./operacao-tv.mjs";

const AGORA = new Date("2026-08-30T15:00:00");
const em = (h, m = 0) => new Date(`2026-08-30T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`).toISOString();

const exec = (over = {}) => ({
  id: over.id || "x", previsto_para: over.previsto_para || em(14),
  prazo_ate: over.prazo_ate ?? em(23), status: over.status || "AGENDADA",
  ...over,
});

test("separa em atrasado, em curso e a seguir pelo relógio de agora", () => {
  const p = painelDoDia([
    exec({ id: "venceu", previsto_para: em(9), prazo_ate: em(10) }),
    exec({ id: "liberada", previsto_para: em(14), prazo_ate: em(18) }),
    exec({ id: "rodando", previsto_para: em(13), prazo_ate: em(18), status: "EM_ANDAMENTO" }),
    exec({ id: "futura", previsto_para: em(19), prazo_ate: em(22) }),
    exec({ id: "feita", status: "CONCLUIDA" }),
  ], [], AGORA);

  assert.deepEqual(p.atrasadas.map(e => e.id), ["venceu"]);
  assert.deepEqual(p.emCurso.map(e => e.id).sort(), ["liberada", "rodando"]);
  assert.deepEqual(p.aSeguir.map(e => e.id), ["futura"]);
  assert.deepEqual(p.concluidas.map(e => e.id), ["feita"]);
});

test("o status vem do relógio, não do que estava salvo no banco", () => {
  // A TV fica horas na parede entre uma busca e outra. Uma rotina gravada como
  // "AGENDADA" cujo prazo já passou tem de virar atraso sozinha na tela.
  const p = painelDoDia([
    exec({ id: "vencida", previsto_para: em(9), prazo_ate: em(10), status: "AGENDADA" }),
  ], [], AGORA);
  assert.equal(p.atrasadas.length, 1);
  assert.equal(p.aSeguir.length, 0);
});

test("cada bloco sai em ordem de horário", () => {
  const p = painelDoDia([
    exec({ id: "tarde", previsto_para: em(21) }),
    exec({ id: "cedo", previsto_para: em(17) }),
    exec({ id: "meio", previsto_para: em(19) }),
  ], [], AGORA);
  assert.deepEqual(p.aSeguir.map(e => e.id), ["cedo", "meio", "tarde"]);
});

test("cancelada não entra na conta do progresso", () => {
  // Um dia com tudo cancelado apareceria como 0% e a cozinha leria como atraso.
  const p = painelDoDia([
    exec({ id: "a", status: "CONCLUIDA" }),
    exec({ id: "b", status: "CANCELADA" }),
  ], [], AGORA);
  assert.equal(p.contadores.total, 1);
  assert.equal(p.contadores.progresso, 100);
});

test("dia sem rotina não vira divisão por zero", () => {
  const p = painelDoDia([], [], AGORA);
  assert.equal(p.contadores.total, 0);
  assert.equal(p.contadores.progresso, 0);
});

test("aguenta lista com buraco e execução sem processo", () => {
  const p = painelDoDia([null, undefined, exec({ id: "solta" })], [], AGORA);
  assert.equal(p.contadores.total, 1);
  assert.equal(linhaDaExecucao(p.emCurso[0]).nome, "Rotina");
});

test("a linha traz hora, responsável e progresso prontos para a tela", () => {
  const l = linhaDaExecucao(exec({
    previsto_para: em(14, 30), responsavel_nome: "Eduarda",
    total_itens: 8, itens_respondidos: 2,
    processo: { nome: "Abertura do bar", setor: "bar", criticidade: "ALTA" },
  }));
  assert.equal(l.hora, "14:30");
  assert.equal(l.nome, "Abertura do bar");
  assert.equal(l.responsavel, "Eduarda");
  assert.equal(l.critica, true);
  assert.equal(l.progresso, 25);
});

test("sem itens, progresso é nulo e não zero", () => {
  // Zero por cento diz "não começou"; nulo diz "não há o que medir". Pintar
  // barra vazia numa rotina sem itens faria a TV acusar atraso que não existe.
  assert.equal(linhaDaExecucao(exec({ total_itens: 0 })).progresso, null);
});

test("não conformidades entram no contador", () => {
  const p = painelDoDia([exec({})], [{ id: 1 }, { id: 2 }], AGORA);
  assert.equal(p.contadores.ncs, 2);
});

test("todas devolve a lista inteira com o status recalculado", () => {
  // Serve ao score: sem isso ele teria de remontar a lista concatenando os
  // blocos, e bastaria esquecer um para o número sair errado sem avisar.
  const p = painelDoDia([
    exec({ id: "a", previsto_para: em(9), prazo_ate: em(10), status: "AGENDADA" }),
    exec({ id: "b", status: "CONCLUIDA" }),
  ], [], AGORA);
  assert.equal(p.todas.length, 2);
  assert.equal(p.todas.find(e => e.id === "a").status, "ATRASADA");
});
