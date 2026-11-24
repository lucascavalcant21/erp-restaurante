import test from "node:test";
import assert from "node:assert/strict";
import { avisosEquipamentos, conferirMateriais, csvPlanilha, montarEquipamentos, normalizarEquipamentos, planilhaEquipamentos, situacaoDaTarefa, somarDiasEquip, textoMaterial } from "./equipamentos.mjs";

const HOJE = "2026-11-24";
const DADOS = {
  equipamentos: [{ id: "f1", nome: "Fritadeira", tipo: "fritadeira" }, { id: "c1", nome: "Coifa", tipo: "coifa" }],
  procedimentos: {
    m1: { equipamento_id: "f1", tarefa: "limpeza", materiais: [{ nome: "Sal grosso", quantidade: "1", unidade: "kg" }, { nome: "Óleo de algodão", quantidade: null, unidade: "L" }], passos: "Desligar\nLimpar", cuidados: [] },
    m2: { equipamento_id: "c1", tarefa: "limpeza", materiais: [], passos: [] },
    m3: { equipamento_id: "f1", tarefa: "abastecimento" },
  },
};
const MANUT = [
  { id: "m1", proxima_prevista: "2026-11-25", frequencia_dias: 7, historico: [{ data: "2026-11-18T10:00:00Z", responsavel: "Vera" }] },
  { id: "m2", proxima_prevista: "2026-11-26", frequencia_dias: 15, historico: [{ data: "2026-11-11T10:00:00Z", responsavel: "Joseph" }] },
  { id: "m3", proxima_prevista: "2026-11-20", frequencia_dias: 3, historico: [] },
];

test("situação: atrasada, hoje, amanhã, faltam N dias", () => {
  assert.equal(situacaoDaTarefa("2026-11-22", HOJE).texto, "Atrasada há 2 dias");
  assert.equal(situacaoDaTarefa(HOJE, HOJE).texto, "É hoje");
  assert.equal(situacaoDaTarefa("2026-11-25", HOJE).nivel, "amanha");
  assert.equal(situacaoDaTarefa("2026-11-26", HOJE).texto, "Faltam 2 dias");
  assert.equal(somarDiasEquip("2026-11-24", 15), "2026-12-09");
});

test("monta equipamentos com as tarefas na ordem da fritadeira", () => {
  const eq = montarEquipamentos(DADOS, MANUT);
  assert.deepEqual(eq[0].tarefas.map((t) => t.tarefa), ["abastecimento", "limpeza"]);
  assert.equal(eq[0].tarefas[1].procedimento.passos.length, 2);
  assert.equal(eq[1].tarefas.length, 1);
});

test("avisos: atrasada primeiro, amanhã com materiais e o que falta no estoque; quantidade em branco não é inventada", () => {
  const eq = montarEquipamentos(DADOS, MANUT);
  const insumos = [{ id: "i1", nome: "Sal grosso" }];
  const av = avisosEquipamentos(eq, { hoje: HOJE, insumos, saldos: new Map([["i1", 0]]) });
  assert.deepEqual(av.map((a) => a.nivel), ["atrasada", "amanha"]);
  assert.match(av[1].texto, /Amanhã é dia de limpar a Fritadeira/);
  assert.deepEqual(av[1].materiais, ["Sal grosso: 1 kg", "Óleo de algodão: quantidade a definir"]);
  assert.deepEqual(av[1].faltando, ["Sal grosso (sem estoque)", "Óleo de algodão (não está no cadastro do estoque)"]);
  assert.equal(textoMaterial({ nome: "Água", quantidade: 20, unidade: "L" }), "Água: 20 L");
});

test("conferir material pelo nome quando não está ligado ao estoque", () => {
  const r = conferirMateriais([{ nome: "sal grosso", quantidade: 1, unidade: "kg" }], [{ id: "i1", nome: "Sal Grosso" }], new Map([["i1", 3]]));
  assert.equal(r[0].situacao, "tem");
});

test("planilha do mais novo ao mais antigo e CSV com ponto e vírgula", () => {
  const p = planilhaEquipamentos(montarEquipamentos(DADOS, MANUT));
  assert.deepEqual(p.map((l) => l.responsavel), ["Vera", "Joseph"]);
  assert.match(csvPlanilha(p), /^﻿"Data";"Equipamento"/);
  assert.equal(normalizarEquipamentos({ equipamentos: [{ nome: "" }] }).equipamentos.length, 0);
});
