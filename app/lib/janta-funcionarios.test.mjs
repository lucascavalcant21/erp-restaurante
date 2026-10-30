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
