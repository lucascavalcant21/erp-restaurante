import test from "node:test";
import assert from "node:assert/strict";
import { guiaDoPrePreparo, quantidadeLegivel } from "./guia-prepreparo.mjs";
import { htmlDosGuias } from "./guia-impresso.mjs";

test("ficha impressa da base: ingredientes legíveis, rendimento e modo de preparo; sem embalagens", () => {
  assert.equal(quantidadeLegivel(0.07, "kg"), "70 g");
  assert.equal(quantidadeLegivel(1.8, "l"), "1,8 L");
  const insumos = new Map([["arroz", { nome: "Arroz branco", unidade_medida: "kg" }], ["alho", { nome: "Alho", unidade_medida: "kg" }]]);
  const g = guiaDoPrePreparo({ nome_receita: "Arroz <b>", rendimento_porcoes: 2.5, rendimento_unidade: "kg", validade_dias: 3, tempo_preparo: 25,
    modo_preparo: "1. Refogar o alho\n2. Cozinhar", fichas_ingredientes: [{ insumo_id: "arroz", quantidade: 1 }, { insumo_id: "alho", quantidade: 0.07 }] }, insumos);
  assert.deepEqual(g.componentes, [{ nome: "Arroz branco", quantidade: "1 kg" }, { nome: "Alho", quantidade: "70 g" }]);
  assert.equal(g.descricao, "Rende 2,5 kg · validade 3 dia(s) · tempo total 25 min");
  const html = htmlDosGuias([g]);
  assert.match(html, /Ingredientes do lote/);
  assert.match(html, /Refogar o alho/);
  assert.doesNotMatch(html, /Embalagens/);
  assert.match(html, /Arroz &lt;b&gt;/);
});
