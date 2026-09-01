import test from "node:test";
import assert from "node:assert/strict";
import {
  rankingPorPessoa, rankingPorSetor, serieDiaria, processosQueMaisFalham,
  MINIMO_PARA_RANQUEAR,
} from "./operacao-ranking.mjs";

// Execução concluída, com itens todos conformes salvo indicação contrária.
const feita = (over = {}) => ({
  id: over.id || Math.random().toString(36).slice(2),
  status: "CONCLUIDA", data_referencia: "2026-08-30",
  itens_conformes: 4, itens_nao_conformes: 0,
  responsavel_id: "p1", responsavel_nome: "Eduarda",
  processo: { nome: "Abertura do bar", setor: "bar" },
  ...over,
});

const varias = (n, over = {}) => Array.from({ length: n }, (_, i) => feita({ id: `${over.responsavel_id || "p"}-${i}`, ...over }));

test("rotina sem responsável não é jogada na conta de ninguém", () => {
  // Execução só ganha dono quando alguém INICIA. A que ninguém tocou é
  // justamente a que mais pesa: não pode ser atribuída nem sumir.
  const r = rankingPorPessoa([
    ...varias(3, { responsavel_id: "p1", responsavel_nome: "Eduarda" }),
    feita({ id: "orfa", responsavel_id: null, responsavel_nome: null, status: "ATRASADA" }),
  ]);
  assert.equal(r.ranqueados.length, 1);
  assert.equal(r.ranqueados[0].total, 3);
  assert.equal(r.semResponsavel.total, 1);
  assert.equal(r.semResponsavel.atrasadas, 1);
});

test("quem fez pouco não encabeça o ranking com 100%", () => {
  // Uma rotina certa dá 100%. Ranquear isso acima de quem fez muitas e acertou
  // quase tudo premiaria quem trabalhou menos.
  const r = rankingPorPessoa([
    ...varias(10, { responsavel_id: "muitas", responsavel_nome: "Larissa" }),
    feita({ id: "u", responsavel_id: "poucas", responsavel_nome: "Novato" }),
  ]);
  assert.deepEqual(r.ranqueados.map(p => p.nome), ["Larissa"]);
  assert.deepEqual(r.poucosDados.map(p => p.nome), ["Novato"]);
  assert.equal(r.minimo, MINIMO_PARA_RANQUEAR);
});

test("empate no score desempata por quem fez mais", () => {
  const r = rankingPorPessoa([
    ...varias(3, { responsavel_id: "a", responsavel_nome: "Ana" }),
    ...varias(8, { responsavel_id: "b", responsavel_nome: "Bruno" }),
  ]);
  assert.deepEqual(r.ranqueados.map(p => p.nome), ["Bruno", "Ana"]);
});

test("atraso e não conformidade puxam o score para baixo", () => {
  const r = rankingPorPessoa([
    ...varias(3, { responsavel_id: "bom", responsavel_nome: "Bom" }),
    ...varias(2, { responsavel_id: "ruim", responsavel_nome: "Ruim", status: "CONCLUIDA_COM_ATRASO", itens_conformes: 2, itens_nao_conformes: 2 }),
    feita({ id: "r3", responsavel_id: "ruim", responsavel_nome: "Ruim", status: "ATRASADA" }),
  ]);
  const [primeiro, segundo] = r.ranqueados;
  assert.equal(primeiro.nome, "Bom");
  assert.equal(segundo.nome, "Ruim");
  assert.ok(primeiro.score > segundo.score, `${primeiro.score} deveria ser > ${segundo.score}`);
  assert.equal(segundo.comAtraso, 2);
  assert.equal(segundo.atrasadas, 1);
  assert.equal(segundo.naoConformes, 4);
});

test("cancelada não entra em nenhuma conta", () => {
  const r = rankingPorPessoa([
    ...varias(3, { responsavel_id: "p1" }),
    feita({ id: "cancel", status: "CANCELADA", responsavel_id: "p1" }),
  ]);
  assert.equal(r.ranqueados[0].total, 3);
});

test("setor cobre tudo, inclusive o que ninguém iniciou", () => {
  const setores = rankingPorSetor([
    feita({ processo: { nome: "x", setor: "bar" }, responsavel_id: null }),
    feita({ processo: { nome: "y", setor: "cozinha" }, status: "ATRASADA" }),
    feita({ processo: { nome: "z", setor: "Bar" } }),   // caixa alta é o mesmo setor
  ]);
  const bar = setores.find(s => s.setor === "bar");
  assert.equal(bar.total, 2);
  assert.equal(setores.length, 2);
});

test("processo sem setor não vira grupo sumido", () => {
  const setores = rankingPorSetor([feita({ processo: { nome: "x" } })]);
  assert.equal(setores[0].setor, "sem setor");
});

test("a série sai em ordem de data", () => {
  const s = serieDiaria([
    feita({ data_referencia: "2026-08-30" }),
    feita({ data_referencia: "2026-08-28" }),
    feita({ data_referencia: "2026-08-29", status: "ATRASADA" }),
  ]);
  assert.deepEqual(s.map(d => d.dia), ["2026-08-28", "2026-08-29", "2026-08-30"]);
  assert.equal(s[1].concluidas, 0);
});

test("as rotinas que mais falham vêm primeiro, e as que nunca falharam ficam fora", () => {
  const p = processosQueMaisFalham([
    feita({ processo: { nome: "Sempre certa", setor: "bar" } }),
    ...varias(3, { processo: { nome: "Problemática", setor: "bar" }, status: "ATRASADA" }),
    feita({ processo: { nome: "Meia-boca", setor: "cozinha" }, itens_nao_conformes: 2 }),
  ]);
  assert.deepEqual(p.map(x => x.nome), ["Problemática", "Meia-boca"]);
  assert.equal(p[0].falhas, 3);
});

test("lista vazia ou com buraco não quebra nada", () => {
  assert.deepEqual(rankingPorPessoa([]).ranqueados, []);
  assert.deepEqual(rankingPorSetor([]), []);
  assert.deepEqual(serieDiaria([]), []);
  assert.deepEqual(processosQueMaisFalham([]), []);
  assert.equal(rankingPorPessoa([null, undefined]).semResponsavel.total, 0);
  assert.deepEqual(rankingPorSetor([null]), []);
});
