import test from "node:test";
import assert from "node:assert/strict";
import { normalizarJanta, cardapioDoDia, rotuloPeso, pessoasDoDia } from "./janta-funcionarios.mjs";

const insumos = new Map([
  ["mac", { id: "mac", nome: "Macarrão", unidade_medida: "kg", preco_normalizado: 8 }],
  ["car", { id: "car", nome: "Carne moída", unidade_medida: "kg", preco_normalizado: 30 }],
]);
const janta = normalizarJanta({ pessoas_padrao: 10, dias: { seg: { pessoas: "", pratos: [{ nome: "Macarronada", preparo: "Cozinhe a massa…", itens: [
  { nome: "Macarrão", insumo_id: "mac", g_pessoa: "120" },
  { nome: "Carne moída", insumo_id: "car", g_pessoa: "100" },
  { nome: "Queijo ralado", g_pessoa: "15" },
] }] } } });

test("macarrão: 1 pessoa e 6 pessoas pela gramatura por pessoa", () => {
  const um = cardapioDoDia(janta, "seg", { pessoas: 1, insumos });
  assert.deepEqual(um.pratos[0].itens.map((i) => i.totalG), [120, 100, 15]);
  const seis = cardapioDoDia(janta, "seg", { pessoas: 6, insumos });
  assert.deepEqual(seis.pratos[0].itens.map((i) => i.rotulo), ["720 g", "600 g", "90 g"]);
  // 0,72 kg × R$ 8 + 0,6 kg × R$ 30 = 5,76 + 18 = 23,76; queijo sem produto ligado
  assert.equal(seis.custo, 23.76);
  assert.equal(seis.custoPorPessoa, 3.96);
  assert.equal(seis.semCusto, 1);
  assert.equal(seis.natureza, "ESTIMATIVA");
});

test("sem número do dia vale o padrão; kg a partir de 1.000 g", () => {
  assert.equal(pessoasDoDia(janta, "seg"), 10);
  assert.equal(cardapioDoDia(janta, "seg", { insumos }).pratos[0].itens[0].rotulo, "1,2 kg");
  assert.equal(rotuloPeso(0), "—");
  assert.equal(normalizarJanta(null).dias.dom.pratos.length, 0);
});

// ── escala da janta: o número de pessoas sai da escala do dia ────────────────
import { escalaDaJanta, pessoasDaJanta, dataDoDia } from "./janta-funcionarios.mjs";

const equipe = [
  { id: "a", nome: "Ana", status: "ativo", dias_trabalho: "1,2,3,4,5", horario_entrada: "15:00", horario_saida: "23:00" },
  { id: "b", nome: "Bia", status: "ativo", dias_trabalho: "1,3", horario_entrada: "16:00", horario_saida: "00:00" },
  { id: "c", nome: "Caio", status: "ativo", dias_trabalho: "1", horario_entrada: "17:00", horario_saida: "23:00", janta_ofertada: false },
  { id: "d", nome: "Davi", status: "desligado", dias_trabalho: "1", horario_entrada: "17:00", horario_saida: "23:00" },
];

test("dataDoDia: próxima data daquele dia da semana, hoje inclusive", () => {
  assert.equal(dataDoDia("sab", "2026-10-31"), "2026-10-31"); // sábado
  assert.equal(dataDoDia("seg", "2026-10-31"), "2026-11-02");
  assert.equal(dataDoDia("sex", "2026-10-31"), "2026-11-06");
});

test("escala da janta: quem trabalha, menos folga, menos quem não janta, menos quem foi tirado, mais extras", () => {
  const j = normalizarJanta({ dias: { seg: { fora: ["b"], extras: "2", pratos: [] } } });
  const folgas = [{ colaborador_id: "a", data_folga: "2026-11-02" }];
  const e = escalaDaJanta(j, "seg", { colaboradores: equipe, folgas, hojeIso: "2026-10-31" });
  assert.equal(e.data, "2026-11-02");
  assert.deepEqual(e.jantam.map((p) => p.nome), []);
  assert.deepEqual(e.tirados.map((p) => p.nome), ["Bia"]);
  assert.deepEqual(e.semJanta.map((p) => p.nome), ["Caio"]);
  assert.deepEqual(e.folgas.map((p) => p.nome), ["Ana"]);
  assert.deepEqual(pessoasDaJanta(j, "seg", e), { total: 2, origem: "escala" }, "só os 2 extras");
});

test("pessoas da janta: digitado vence; sem escala usa o padrão; sem nada, sem dado", () => {
  const e = escalaDaJanta(normalizarJanta(null), "qua", { colaboradores: equipe, folgas: [], hojeIso: "2026-10-31" });
  assert.deepEqual(e.jantam.map((p) => p.nome), ["Ana", "Bia"]);
  assert.deepEqual(pessoasDaJanta(normalizarJanta(null), "qua", e), { total: 2, origem: "escala" });
  assert.deepEqual(pessoasDaJanta(normalizarJanta({ dias: { qua: { pessoas: "9" } } }), "qua", e), { total: 9, origem: "manual" });
  assert.deepEqual(pessoasDaJanta(normalizarJanta({ pessoas_padrao: 7 }), "dom", { jantam: [], extras: 0 }), { total: 7, origem: "padrao" });
  assert.deepEqual(pessoasDaJanta(normalizarJanta(null), "dom", { jantam: [], extras: 0 }), { total: 0, origem: "sem_dado" });
});
