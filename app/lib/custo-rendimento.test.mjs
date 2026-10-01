// Testes da fonte única de custo efetivo. Rode com:
//   node --test app/lib/custo-rendimento.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import {
  rendimentoDoInsumo, custoEfetivoPorRendimento, fatorDaPerda, calcularEmpanamento,
  custoDoInsumo, fatorCorrecaoDoItem, custoUnitarioParaFicha, empanamentoDaComposicao, unidadesDaComposicao,
} from "./custo-rendimento.mjs";
import { custoDeProduzirFicha } from "./ficha-calculos.mjs";
import { itemDeIngrediente, custoDoItem } from "./ficha-editor.mjs";
import { calcularConsumoProducao } from "./producao-calculos.mjs";
import { ingredientesDaFicha } from "./pizza-do-prato.mjs";

const perto = (real, esperado, casas = 2, msg) =>
  assert.ok(Math.abs(real - esperado) < 0.5 * 10 ** -casas, `${msg || ""} esperado ${esperado}, veio ${real}`);

// Carne de sol: R$ 39,90/kg, 1.000 g bruto, 150 g de perda.
const carneDeSol = {
  nome: "Carne de sol", unidade_medida: "kg", tamanho_embalagem: 1, custo_compra: 39.9,
  preco_normalizado: 39.9, peso_bruto_padrao: 1000, perda_g: 150, perda_pct: 15,
};

test("TESTE A — 39,90/kg, 1000 g bruto, 150 g perda", () => {
  const r = rendimentoDoInsumo(carneDeSol);
  assert.equal(r.pesoLiquidoG, 850);
  perto(r.rendimento * 100, 85);
  perto(r.perdaPct, 15);
  const c = custoDoInsumo(carneDeSol);
  perto(c.custoCompra, 39.9);
  perto(c.custoEfetivo, 46.94);
  perto(c.aumentoPct, 17.65);
  // e NÃO 39,90 + 15% = 45,885
  assert.ok(Math.abs(c.custoEfetivo - 45.885) > 1);
});

test("TESTE B — 0% de perda: custo efetivo = custo de compra", () => {
  const c = custoDoInsumo({ ...carneDeSol, perda_g: 0, perda_pct: 0 });
  perto(c.custoEfetivo, 39.9);
  perto(c.rendimento, 1);
  // Sem perda nenhuma cadastrada, idem.
  perto(custoDoInsumo({ unidade_medida: "kg", preco_normalizado: 39.9 }).custoEfetivo, 39.9);
});

test("TESTE C — 50% de perda a R$ 40/kg = R$ 80/kg", () => {
  const c = custoDoInsumo({ unidade_medida: "kg", preco_normalizado: 40, peso_bruto_padrao: 1000, perda_g: 500 });
  perto(c.custoEfetivo, 80);
  perto(custoEfetivoPorRendimento(40, 0.5), 80);
  perto(custoDoInsumo({ unidade_medida: "kg", preco_normalizado: 40, perda_pct: 50 }).custoEfetivo, 80);
});

test("TESTE D — empanado com composição", () => {
  // Frango 1 kg a R$ 30 → 900 g limpos; empanamento 200 g custando R$ 4.
  const e = calcularEmpanamento({
    pesoBrutoG: 1000, perdaG: 100, custoCompraKg: 30,
    itens: [
      { nome: "Farinha de trigo", quantidade: 80, unidade: "g", custoPorBase: 6 },    // 0,48
      { nome: "Farinha panko", quantidade: 70, unidade: "g", custoPorBase: 32 },      // 2,24
      { nome: "Ovo", quantidade: 50, unidade: "g", custoPorBase: 25.6 },              // 1,28
    ],
  });
  assert.equal(e.erro, null);
  assert.equal(e.pesoLiquidoG, 900);       // peso antes do empanamento
  assert.equal(e.pesoAdicionadoG, 200);    // peso do empanamento
  assert.equal(e.pesoFinalG, 1100);        // peso final
  perto(e.custoMateriaPrima, 30);          // custo da matéria-prima (bruto pago)
  perto(e.custoEmpanamento, 4);            // custo do empanamento
  perto(e.custoTotal, 34);
  perto(e.custoPorKgFinal, 30.91);         // 34 / 1,1 — o ganho de peso não é de graça
});

test("empanado: ganho de peso medido diferente da composição usada", () => {
  // Usou 200 g de mistura, mas só 120 g grudaram.
  const e = calcularEmpanamento({ pesoBrutoG: 1000, perdaG: 100, custoCompraKg: 30,
    itens: [{ quantidade: 200, unidade: "g", custoPorBase: 20 }], pesoAdicionadoG: 120 });
  assert.equal(e.pesoFinalG, 1020);
  perto(e.custoPorKgFinal, 34 / 1.02);
});

test("empanado com os campos atuais do cadastro aplica a perda ANTES do empanamento", () => {
  // 1 kg bruto a R$ 30, 100 g de perda, ganho de 22,22% sobre o limpo (900 → 1100 g),
  // empanamento R$ 4 no lote = R$ 3,6364 por kg final.
  const c = custoDoInsumo({ unidade_medida: "kg", preco_normalizado: 30, peso_bruto_padrao: 1000, perda_g: 100,
    empanado: true, ganho_pct: 200 / 9, custo_empanado_kg: 4 / 1.1 });
  perto(c.empanado.pesoFinalG, 1100, 1);
  perto(c.empanado.custoTotal, 34);
  perto(c.custoEfetivo, 30.91);
  // A ficha usa o custo por kg final sem fator (a perda já está dentro).
  assert.equal(fatorCorrecaoDoItem({ empanado: true, perda_pct: 10 }, 25), 0);
  perto(custoUnitarioParaFicha({ unidade_medida: "kg", preco_normalizado: 30, peso_bruto_padrao: 1000, perda_g: 100,
    empanado: true, ganho_pct: 200 / 9, custo_empanado_kg: 4 / 1.1 }), 30.91);
});

test("fator da ficha: 15% de perda vira +17,647% sobre o líquido, não +15%", () => {
  perto(fatorDaPerda(15), 17.647, 3);
  perto(fatorDaPerda(50), 100);
  assert.equal(fatorDaPerda(0), 0);
  assert.equal(fatorDaPerda(100), 0);
  // perda do cadastro manda sobre o FC gravado (que podia estar com 15 da versão antiga)
  perto(fatorCorrecaoDoItem(carneDeSol, 15), 17.647, 3);
  // sem perda no cadastro, vale o FC digitado na ficha
  assert.equal(fatorCorrecaoDoItem({ unidade_medida: "kg" }, 20), 20);
});

test("perda impossível é recusada, não divide por zero", () => {
  assert.ok(rendimentoDoInsumo({ peso_bruto_padrao: 1000, perda_g: 1000 }).erro);
  assert.ok(rendimentoDoInsumo({ peso_bruto_padrao: 1000, perda_g: 1200 }).erro);
  assert.ok(rendimentoDoInsumo({ perda_pct: 100 }).erro);
  perto(custoDoInsumo({ unidade_medida: "kg", preco_normalizado: 40, peso_bruto_padrao: 1000, perda_g: 1000 }).custoEfetivo, 40);
  assert.ok(calcularEmpanamento({ pesoBrutoG: 1000, perdaG: 1000, custoCompraKg: 30 }).erro);
});

// ─── A ficha técnica usa o custo efetivo ─────────────────────────────────────

// 200 g de carne de sol já limpa = 200 g × R$ 46,94/kg = R$ 9,39 (e não R$ 7,98 nem R$ 9,18).
const ficha = (fator) => ({
  id: "f1", rendimento_porcoes: 1,
  fichas_ingredientes: [{ insumo_id: "c", insumos: { id: "c", ...carneDeSol }, quantidade: 0.2, fator_correcao: fator }],
});

test("custo da ficha (cards, CMV, relatórios): 200 g limpos × R$ 46,94/kg", () => {
  perto(custoDeProduzirFicha(ficha(15), []), 9.39);   // linha gravada pela versão antiga
  perto(custoDeProduzirFicha(ficha(0), []), 9.39);
  perto(custoDeProduzirFicha(ficha(17.6471), []), 9.39);
});

test("editor da ficha: mesmo custo da listagem", () => {
  const item = itemDeIngrediente(ficha(15).fichas_ingredientes[0], []);
  perto(custoDoItem(item), 9.39);
  perto(item.custo_unitario * (1 + item.fator / 100), 46.94);
});

test("abertura do CMV por ingrediente: mesmo número", () => {
  const linhas = ingredientesDaFicha(ficha(15), [], 1);
  perto(linhas[0].valor, 9.39);
});

test("produção: baixa o BRUTO (200 g limpos = 235,3 g brutos) e custeia igual", () => {
  const f = ficha(15);
  f.fichas_ingredientes[0].insumos.unidade_medida = "kg";
  const r = calcularConsumoProducao(f, 1, []);
  assert.deepEqual(r.erros, []);
  perto(r.itens[0].quantidade, 0.2353, 4);
  perto(r.custoEstimado, 9.39);
});

// ─── Composição do empanamento gravada no cadastro ──────────────────────────

const farinha = { id: "farinha", nome: "Farinha de trigo", unidade_medida: "kg", preco_normalizado: 6 };
const panko = { id: "panko", nome: "Farinha panko", unidade_medida: "kg", preco_normalizado: 32 };
const ovo = { id: "ovo", nome: "Ovo", unidade_medida: "kg", preco_normalizado: 25.6 };
const frangoEmpanado = {
  id: "frango", nome: "Frango empanado", unidade_medida: "kg", preco_normalizado: 30,
  peso_bruto_padrao: 1000, perda_g: 100, empanado: true,
  empanamento_itens: [
    { insumo_id: "farinha", quantidade: 80, unidade: "g" },
    { insumo_id: "panko", quantidade: 70, unidade: "g" },
    { insumo_id: "ovo", quantidade: 50, unidade: "g" },
  ],
};

test("TESTE D pelo cadastro: composição → custo por kg final com preço atual dos componentes", () => {
  const r = empanamentoDaComposicao(frangoEmpanado, [farinha, panko, ovo]);
  assert.equal(r.erro, null);
  assert.equal(r.detalhe.pesoLiquidoG, 900);
  assert.equal(r.detalhe.pesoAdicionadoG, 200);
  assert.equal(r.detalhe.pesoFinalG, 1100);
  perto(r.detalhe.custoMateriaPrima, 30);
  perto(r.detalhe.custoEmpanamento, 4);
  perto(r.detalhe.custoTotal, 34);
  perto(r.detalhe.custoPorKgFinal, 30.91);
  // Os números gravados reproduzem a mesma conta na ficha técnica.
  const gravado = { ...frangoEmpanado, ganho_pct: r.ganho_pct, custo_empanado_kg: r.custo_empanado_kg };
  perto(custoDoInsumo(gravado).custoEfetivo, 30.91);
  perto(custoUnitarioParaFicha(gravado), 30.91);
  // Farinha subiu para R$ 12/kg: +0,48 no lote.
  const r2 = empanamentoDaComposicao(frangoEmpanado, [{ ...farinha, preco_normalizado: 12 }, panko, ovo]);
  perto(r2.detalhe.custoTotal, 34.48);
});

test("composição: peso medido, unidade errada, sem peso bruto, componente sumido", () => {
  const medido = empanamentoDaComposicao({ ...frangoEmpanado, empanamento_peso_g: 120 }, [farinha, panko, ovo]);
  assert.equal(medido.detalhe.pesoFinalG, 1020);
  assert.match(empanamentoDaComposicao({ ...frangoEmpanado, empanamento_itens: [{ insumo_id: "ovo", quantidade: 2, unidade: "un" }] }, [ovo]).erro, /use g ou kg/);
  assert.match(empanamentoDaComposicao({ ...frangoEmpanado, peso_bruto_padrao: null, perda_g: null }, [farinha, panko, ovo]).erro, /peso bruto/);
  assert.match(empanamentoDaComposicao(frangoEmpanado, [farinha]).erro, /não encontrado/);
  assert.match(empanamentoDaComposicao({ ...frangoEmpanado, empanamento_itens: [{ insumo_id: "frango", quantidade: 10, unidade: "g" }] }, [frangoEmpanado]).erro, /própria composição/);
  assert.equal(empanamentoDaComposicao({ ...frangoEmpanado, empanamento_itens: [] }, []), null);
  assert.deepEqual(unidadesDaComposicao({ unidade_medida: "L" }), ["ml", "l"]);
  assert.deepEqual(unidadesDaComposicao({ unidade_medida: "un" }), ["un"]);
});

test("peso bruto sem perda: lote sem perda, empanamento funciona", () => {
  const r = empanamentoDaComposicao({ ...frangoEmpanado, perda_g: "" }, [farinha, panko, ovo]);
  assert.equal(r.erro, null);
  assert.equal(r.detalhe.pesoLiquidoG, 1000);
  assert.equal(fatorCorrecaoDoItem({ peso_bruto_padrao: 1000 }, 20), 20);
});
