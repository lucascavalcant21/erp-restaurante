import test from "node:test";
import assert from "node:assert/strict";
import { montarEstoqueBases, filtrarBases, textoSaldo, lerQuantidade, unidadesDeDigitar, paraUnidadeDoSaldo } from "./estoque-bases.mjs";

const EST = [{ id: "ec", slug: "pre-preparos-cozinha" }, { id: "eb", slug: "pre-preparos-bar" }];
const LINHAS = [
  { id: "1", estoque_id: "ec", insumo_id: "i1", ficha_tecnica_id: "f1", quantidade_atual: 0, insumos: { nome: "Arroz branco (base)", unidade_medida: "kg" } },
  { id: "2", estoque_id: "ec", insumo_id: "i2", ficha_tecnica_id: "f2", quantidade_atual: 2.5, insumos: { nome: "Vatapá de camarão (base)", unidade_medida: "kg" } },
  { id: "3", estoque_id: "eb", insumo_id: "i3", ficha_tecnica_id: "f3", quantidade_atual: 0.75, insumos: { nome: "Xarope de cupuaçu (base)", unidade_medida: "l" } },
  { id: "4", estoque_id: "ec", insumo_id: "i4", ficha_tecnica_id: null, quantidade_atual: 0, insumos: { nome: "Item antigo" } },
  { id: "5", estoque_id: "ec", insumo_id: "i5", ficha_tecnica_id: null, quantidade_atual: 1, insumos: { nome: "Antigo com saldo", unidade_medida: "un" } },
  { id: "6", estoque_id: "outro", insumo_id: "i6", ficha_tecnica_id: "f6", quantidade_atual: 9, insumos: { nome: "Arroz cru" } },
];

test("lista: bases atuais e qualquer saldo; com saldo primeiro", () => {
  const l = montarEstoqueBases(LINHAS, EST);
  assert.deepEqual(l.map((b) => b.id), ["5", "2", "3", "1"]);
  assert.equal(l.find((b) => b.id === "3").setor, "bar");
  assert.deepEqual(filtrarBases(l, { setor: "bar" }).map((b) => b.id), ["3"]);
  assert.deepEqual(filtrarBases(l, { busca: "vatapa" }).map((b) => b.id), ["2"]);
});

test("saldo legível e quantidade digitada", () => {
  assert.equal(textoSaldo(2.5, "kg"), "2,5 kg");
  assert.equal(textoSaldo(0.75, "l"), "750 ml");
  assert.equal(textoSaldo(0.4, "kg"), "400 g");
  assert.equal(textoSaldo(0, "kg"), "0 kg");
  assert.equal(lerQuantidade("1,8"), 1.8);
  assert.equal(lerQuantidade("1.8"), 1.8);
  assert.equal(lerQuantidade("0"), null);
  assert.deepEqual(unidadesDeDigitar("kg").map((u) => u.id), ["kg", "g"]);
  assert.equal(paraUnidadeDoSaldo(1800, unidadesDeDigitar("kg")[1].fator), 1.8);
  assert.equal(paraUnidadeDoSaldo(500, unidadesDeDigitar("l")[1].fator), 0.5);
});
