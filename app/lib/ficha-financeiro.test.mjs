// Testes do resumo financeiro da ficha (card de Fichas Técnicas). Rode com:
//   node --test app/lib/ficha-financeiro.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { resumoFinanceiroDaFicha, linhasDeCustoDaFicha, statusDaFicha } from "./ficha-financeiro.mjs";
import { porcoesParaCusto, custoDeProduzirFicha } from "./ficha-calculos.mjs";
import { dadosDoPrato } from "./pizza-do-prato.mjs";

// A divisão do preço em si (CMV, variáveis, margem, CMO, operacionais,
// pró-labore, resultado, meta) é testada em composicao-preco.test.mjs. Aqui:
// o resumo da ficha alimenta essa conta com os números certos.
const perto = (a, b, casas = 2) => assert.ok(Math.abs(a - b) < 0.5 * 10 ** -casas, `esperado ${b}, veio ${a}`);
const somaFecha = (c) => assert.equal(
  c.cmv.centavos + c.variaveis.centavos + c.cmo.centavos + c.operacionais.centavos + c.proLabore.centavos + c.resultado.centavos,
  Math.round(c.preco * 100), "os grupos têm de somar o preço");

// ─── Porções: a regra única ─────────────────────────────────────────────────

test("porções: prato sem peso da porção é a receita inteira (não divide pela soma dos pesos)", () => {
  assert.deepEqual(porcoesParaCusto({ rendimento_porcoes: 1.34, rendimento_unidade: "kg" }), { porcoes: 1, definidas: false });
  assert.deepEqual(porcoesParaCusto({ rendimento_porcoes: 0.35, rendimento_unidade: "kg" }), { porcoes: 1, definidas: false });
  assert.deepEqual(porcoesParaCusto({ rendimento_porcoes: 2, rendimento_unidade: "kg", peso_porcao_g: 250 }), { porcoes: 8, definidas: true });
  assert.deepEqual(porcoesParaCusto({ rendimento_porcoes: 6, rendimento_unidade: "porcao" }), { porcoes: 6, definidas: true });
  // pré-preparo: custo por kg do lote
  assert.deepEqual(porcoesParaCusto({ eh_base: true, rendimento_porcoes: 5, rendimento_unidade: "kg" }), { porcoes: 5, definidas: true });
});

// ─── A ficha inteira ────────────────────────────────────────────────────────

const carne = { id: "carne", nome: "Carne de sol", unidade_medida: "kg", preco_normalizado: 39.9, peso_bruto_padrao: 1000, perda_g: 150, perda_pct: 15 };
const farinha = { id: "farinha", nome: "Farinha", unidade_medida: "kg", preco_normalizado: 8 };
const prato = {
  id: "p1", nome_receita: "Carne de sol com farofa", rendimento_porcoes: 0.3, rendimento_unidade: "kg",
  cmv_meta: 30, custo_embalagem: 1.5,
  fichas_ingredientes: [
    { insumo_id: "carne", insumos: carne, quantidade: 0.2, fator_correcao: 17.6471 },
    { insumo_id: "farinha", insumos: farinha, quantidade: 0.1, fator_correcao: 0 },
  ],
};

test("resumo do prato: custo, CMV, status e composição saem de uma conta só", () => {
  const r = resumoFinanceiroDaFicha(prato, { fichas: [prato], produtos: [{ ficha_id: "p1", preco_venda: 45 }], params: {} });
  perto(r.custoReceita, 0.2 * 46.94 + 0.1 * 8);   // 9,39 + 0,80
  assert.equal(r.porcoes, 1);                      // não divide por 0,3 kg
  assert.equal(r.porcoesDefinidas, false);
  perto(r.cmvValor, 10.19 + 1.5);                  // + embalagem por porção
  perto(r.cmvPct, (11.69 / 45) * 100, 1);
  assert.equal(r.preco, 45);
  assert.equal(r.status.rotulo, "Ativa");          // 26% < meta 30%
  perto(r.precoPelaMetaCmv, r.cmvValor / 0.3);   // custo ÷ meta de CMV, como no editor
  perto(r.composicao.cmv.valor, r.cmvValor);              // o CMV da composição é o do card
  perto(r.composicao.variaveis.valor, 45 * 0.04 + 45 * 0.025, 1); // padrões da casa: imposto 4%, maquininha 2,5%
  perto(r.composicao.cmv.partes.reduce((t, p) => t + p.valor, 0), r.composicao.cmv.valor);
  perto(r.linhas.find(l => l.nome === "Farinha").pctVenda, (0.8 / 45) * 100);
  somaFecha(r.composicao);
});

test("preço novo do Cardápio muda tudo que depende dele (sem segunda fonte)", () => {
  const a = resumoFinanceiroDaFicha(prato, { fichas: [prato], produtos: [{ ficha_id: "p1", preco_venda: 62 }] });
  const b = resumoFinanceiroDaFicha(prato, { fichas: [prato], produtos: [{ ficha_id: "p1", preco_venda: 65 }] });
  assert.equal(a.preco, 62); assert.equal(b.preco, 65);
  assert.ok(b.cmvPct < a.cmvPct);
  assert.ok(b.composicao.resultado.valor > a.composicao.resultado.valor);
  somaFecha(b.composicao);
});

test("CMV acima da meta → CMV Alto (mesmo critério do card antigo)", () => {
  const r = resumoFinanceiroDaFicha(prato, { fichas: [prato], produtos: [{ ficha_id: "p1", preco_venda: 20 }] });
  assert.equal(r.status.rotulo, "CMV Alto");
  assert.equal(statusDaFicha({ status: "rascunho" }, 90, 30).rotulo, "Rascunho");
});

test("composição do custo: linhas somam o custo da receita e mostram a perda", () => {
  const linhas = linhasDeCustoDaFicha(prato, [prato]);
  perto(linhas.reduce((t, l) => t + l.custo, 0), custoDeProduzirFicha(prato, [prato]));
  const l = linhas.find(x => x.nome === "Carne de sol");
  perto(l.perdaPct, 15);
  perto(l.custoCompra, 39.9);
  perto(l.custoUnitario, 46.94);
  perto(l.quantidadeBruta, 0.2353, 4);
});

test("pré-preparo: custo por kg do lote, sem preço nem composição", () => {
  const base = { id: "b1", eh_base: true, nome_receita: "Farofa", rendimento_porcoes: 2, rendimento_unidade: "kg",
    fichas_ingredientes: [{ insumo_id: "farinha", insumos: farinha, quantidade: 2, fator_correcao: 0 }] };
  const r = resumoFinanceiroDaFicha(base, { fichas: [base] });
  assert.equal(r.tipo, "preparo");
  perto(r.custoPorcaoReceita, 8);
  assert.equal(r.composicao, null);
  assert.equal(r.preco, 0);
});

test("a pizza do prato usa os mesmos números do card", () => {
  const produtos = [{ ficha_id: "p1", preco_venda: 45 }];
  const params = { imposto_pct: 6, taxa_cartao_pct: 0 };
  const r = resumoFinanceiroDaFicha(prato, { fichas: [prato], produtos, params });
  const d = dadosDoPrato(prato, { fichas: [prato], produtos, params });
  assert.equal(d.preco, r.preco);
  perto(d.custoIngredientes + d.custoEmbalagem, r.cmvValor);
  assert.equal(d.impostoPct, r.impostoPct);
  assert.equal(d.taxaMaquininhaPct, r.taxaMaquininhaPct);
});

// ─── Atualização imediata depois de salvar ──────────────────────────────────
import { produtosComPrecoSalvo } from "./ficha-financeiro.mjs";

test("TESTE 2/3 (lógica): preço salvo entra no estado e o card recalcula sem reler o banco", () => {
  const produtos = [{ id: "prod1", ficha_id: "p1", nome_produto: "Carne de sol com farofa", preco_venda: 62, categoria: "Pratos" },
    { id: "prod2", ficha_id: "outra", preco_venda: 10 }];
  const antes = resumoFinanceiroDaFicha(prato, { fichas: [prato], produtos });
  const depois = produtosComPrecoSalvo(produtos, { produtoId: "prod1", fichaId: "p1", nome: "x", preco: 65 });
  const r = resumoFinanceiroDaFicha(prato, { fichas: [prato], produtos: depois });
  assert.equal(antes.preco, 62);
  assert.equal(r.preco, 65);                                // card fechado
  assert.ok(r.cmvPct < antes.cmvPct);                       // CMV
  assert.ok(r.composicao.resultado.valor > antes.composicao.resultado.valor); // lucro do card aberto
  somaFecha(r.composicao);
  assert.equal(depois[0].categoria, "Pratos");              // não perde o resto do produto
  assert.equal(depois[1].preco_venda, 10);                  // nem mexe nos outros
  // produto novo (não existia na lista): entra na hora
  const novo = produtosComPrecoSalvo([], { produtoId: "n1", fichaId: "p1", nome: "Prato", preco: 30 });
  assert.equal(resumoFinanceiroDaFicha(prato, { fichas: [prato], produtos: novo }).preco, 30);
});

// ─── Preço sugerido pela meta de lucro ──────────────────────────────────────
import { composicaoDoPreco as compor } from "./composicao-preco.mjs";

test("preço sugerido: o resultado da composição nesse preço bate a meta de lucro", () => {
  const acai = { id: "a1", nome_receita: "Açaí", rendimento_porcoes: 1, rendimento_unidade: "porcao", imposto_pct: 9, taxa_maquininha: 0,
    fichas_ingredientes: [{ insumo_id: "x", insumos: { id: "x", nome: "Açaí", unidade_medida: "kg", preco_normalizado: 27.7 }, quantidade: 1, fator_correcao: 0 }] };
  const params = { dias_operacao_mes: 25, pratos_por_dia: 40, custo_cmo_mes: 7830, custo_aluguel_mes: 1920, custo_luz_mes: 1920,
    custo_gas_mes: 1540, custo_agua_mes: 580, custo_limpeza_mes: 190, margem_alvo_pct: 15, cmv_meta: 30 };
  const r = resumoFinanceiroDaFicha(acai, { fichas: [acai], produtos: [{ ficha_id: "a1", preco_venda: 62 }], params });
  // (27,70 + 13,98 rateado) / (1 − 9% − 15%) = 54,84
  perto(r.precoSugerido, 41.68 / 0.76);
  const c = compor({ preco: r.precoSugerido, cmvItens: [{ rotulo: "Açaí", valor: 27.7 }], impostoPct: 9, taxaMaquininhaPct: 0, params });
  perto(c.resultado.pct, 15, 1);
  perto(r.precoPelaMetaCmv, 27.7 / 0.3);
  assert.equal(r.metaLucro, 15);
});
