// CMV real da unidade com transferências ENTRE UNIDADES (UNID-MARM-1):
// a mercadoria que sai para outro negócio não é consumo; a que chega conta
// como compra. Sem transferência, o resultado é o mesmo de antes.
//   node --test app/lib/cmv-transferencias.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { apurarPeriodo } from "./cmv-real.mjs";

const INS = new Map([["arroz", { id: "arroz", nome: "Arroz", departamento: "cozinha", categoria: "Grãos" }]]);
const periodo = { id: "p", de: "2026-10-01", ateExclusivo: "2026-11-01", inicio: { id: "c1" }, fim: { id: "c2" } };
const contagens = new Map([
  ["c1", [{ insumo_id: "arroz", quantidade_contada: 50000, unidade_base: "g", valor_total: 250 }]],   // 50 kg, R$ 250
  ["c2", [{ insumo_id: "arroz", quantidade_contada: 30000, unidade_base: "g", valor_total: 150 }]],   // 30 kg, R$ 150
]);
const apurar = (transferencias) => apurarPeriodo(periodo, { itensPorContagem: contagens, compras: [], comprasItens: [], transferencias, insumoPorId: INS });

test("sem transferência: CMV igual ao de sempre (250 − 150 = 100)", () => {
  const r = apurar([]);
  assert.equal(r.status, "apurado");
  assert.equal(r.cmv.valor, 100);
  assert.equal(r.transferenciasUnidades.quantidade, 0);
});

test("10 kg enviados à marmitaria (R$ 50) não são consumo do restaurante", () => {
  const r = apurar([{ insumo_id: "arroz", sentido: "saida", quantidade_base: 10000, unidade_base: "g", valor: 50, data: "2026-10-10" }]);
  assert.equal(r.cmv.valor, 50);
  const p = r.produtos.find((x) => x.insumo_id === "arroz");
  assert.equal(p.consumo_q, 10000);
  assert.equal(r.transferenciasUnidades.valor, -50);
});

test("transferência recebida conta como compra", () => {
  const r = apurar([{ insumo_id: "arroz", sentido: "entrada", quantidade_base: 5000, unidade_base: "g", valor: 30, data: "2026-10-12" }]);
  assert.equal(r.cmv.valor, 130);
});

test("transferência fora do período não entra", () => {
  assert.equal(apurar([{ insumo_id: "arroz", sentido: "saida", quantidade_base: 10000, unidade_base: "g", valor: 50, data: "2026-11-01" }]).cmv.valor, 100);
});

test("transferência sem valor (origem sem custo médio): CMV não apurado, com motivo", () => {
  const r = apurar([{ insumo_id: "arroz", sentido: "saida", quantidade_base: 10000, unidade_base: "g", valor: null, data: "2026-10-10" }]);
  assert.equal(r.status, "nao_apurado");
  assert.equal(r.cmv.valor, null);
  assert.ok(r.motivos.some((m) => /sem custo médio na origem/.test(m)));
});
