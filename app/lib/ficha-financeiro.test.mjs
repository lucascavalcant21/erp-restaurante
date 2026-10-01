// Testes do resumo financeiro da ficha (card de Fichas Técnicas). Rode com:
//   node --test app/lib/ficha-financeiro.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { composicaoDoPreco, resumoFinanceiroDaFicha, linhasDeCustoDaFicha, statusDaFicha } from "./ficha-financeiro.mjs";
import { porcoesParaCusto, custoDeProduzirFicha } from "./ficha-calculos.mjs";
import { dadosDoPrato } from "./pizza-do-prato.mjs";

const perto = (a, b, casas = 2) => assert.ok(Math.abs(a - b) < 0.5 * 10 ** -casas, `esperado ${b}, veio ${a}`);
const somaFecha = (c) => assert.equal(
  Math.round(c.variaveis.valor * 100) + Math.round(c.fixos.valor * 100) + Math.round(c.lucro.valor * 100),
  Math.round(c.preco * 100), "variáveis + fixos + lucro tem de dar o preço");
const pctFecha = (c) => perto(c.variaveis.pct + c.fixos.pct + c.lucro.pct, 100);

test("exemplo do pedido: R$ 62 = 20,67 variáveis + 12,40 fixos + 28,93 lucro", () => {
  const c = composicaoDoPreco({ preco: 62, custoProduto: 20.67, params: { dias_operacao_mes: 1, pratos_por_dia: 1, custo_aluguel_mes: 12.40 } });
  assert.equal(c.variaveis.valor, 20.67);
  assert.equal(c.variaveis.pct, 33.34);
  assert.equal(c.fixos.valor, 12.40);
  assert.equal(c.fixos.pct, 20);
  assert.equal(c.lucro.valor, 28.93);
  assert.equal(c.lucro.pct, 46.66);
  somaFecha(c); pctFecha(c);
});

test("a soma fecha no centavo mesmo com números quebrados", () => {
  const params = { dias_operacao_mes: 26, pratos_por_dia: 97, custo_aluguel_mes: 6123.33, custo_luz_mes: 1301.07,
    custo_gas_mes: 701, custo_agua_mes: 399.99, custo_limpeza_mes: 211.1, custo_outros_mes: 77.7, custo_cmo_mes: 16604.41 };
  for (const [preco, custo, imp, tx] of [[59.9, 17.333, 6.5, 3.19], [12, 4.005, 4, 2.5], [395, 151.2849, 0, 1.99], [8.5, 1.111, 7.3, 0]]) {
    const c = composicaoDoPreco({ preco, custoProduto: custo, impostoPct: imp, taxaMaquininhaPct: tx, params });
    somaFecha(c); pctFecha(c);
    assert.ok(c.fixos.rateado);
    // As partes também fecham no segmento.
    assert.equal(Math.round(c.variaveis.partes.reduce((t, p) => t + p.valor, 0) * 100), Math.round(c.variaveis.valor * 100));
    assert.equal(Math.round(c.fixos.partes.reduce((t, p) => t + p.valor, 0) * 100), Math.round(c.fixos.valor * 100));
  }
});

test("imposto e maquininha são custo variável; CMO é custo fixo", () => {
  const c = composicaoDoPreco({ preco: 100, custoProduto: 30, impostoPct: 4, taxaMaquininhaPct: 2.5,
    params: { dias_operacao_mes: 10, pratos_por_dia: 10, custo_aluguel_mes: 500, custo_cmo_mes: 1000 } });
  assert.equal(c.variaveis.valor, 36.5);
  assert.equal(c.fixos.valor, 15);
  assert.deepEqual(c.fixos.partes.map(p => p.rotulo), ["Aluguel", "Mão de obra (CMO)"]);
  assert.equal(c.lucro.valor, 48.5);
  assert.equal(c.margemContribuicao.valor, 63.5); // preço − variáveis: não é lucro
});

test("sem rateio configurado: não inventa custo fixo e não chama a sobra de lucro", () => {
  const semVolume = composicaoDoPreco({ preco: 62, custoProduto: 20.67, params: { custo_aluguel_mes: 6000 } });
  assert.equal(semVolume.fixos.rateado, false);
  assert.equal(semVolume.fixos.valor, 0);
  assert.match(semVolume.fixos.motivo, /ainda não rateado/);
  assert.equal(semVolume.lucro.rotulo, "Sobra antes dos custos fixos");
  somaFecha(semVolume); pctFecha(semVolume);
  const semCustos = composicaoDoPreco({ preco: 62, custoProduto: 20.67, params: { dias_operacao_mes: 26, pratos_por_dia: 100 } });
  assert.equal(semCustos.fixos.rateado, false);
  assert.match(semCustos.fixos.motivo, /nenhum custo fixo/);
});

test("prejuízo: lucro negativo, soma continua fechando, barra divide o custo", () => {
  const c = composicaoDoPreco({ preco: 20, custoProduto: 18, impostoPct: 4, params: { dias_operacao_mes: 1, pratos_por_dia: 1, custo_aluguel_mes: 5 } });
  assert.equal(c.lucro.prejuizo, true);
  assert.equal(c.lucro.valor, -3.8);
  somaFecha(c);
  perto(c.barra.reduce((t, s) => t + s.largura, 0), 100);
  assert.ok(!c.barra.some(s => s.id === "lucro"));
});

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
  perto(r.precoSugerido, r.cmvValor / 0.3);   // custo ÷ meta, como no editor
  perto(r.composicao.variaveis.valor, r.cmvValor + 45 * 0.04 + 45 * 0.025, 1); // cada parte em centavos
  somaFecha(r.composicao);
});

test("preço novo do Cardápio muda tudo que depende dele (sem segunda fonte)", () => {
  const a = resumoFinanceiroDaFicha(prato, { fichas: [prato], produtos: [{ ficha_id: "p1", preco_venda: 62 }] });
  const b = resumoFinanceiroDaFicha(prato, { fichas: [prato], produtos: [{ ficha_id: "p1", preco_venda: 65 }] });
  assert.equal(a.preco, 62); assert.equal(b.preco, 65);
  assert.ok(b.cmvPct < a.cmvPct);
  assert.ok(b.composicao.lucro.valor > a.composicao.lucro.valor);
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
  assert.ok(r.composicao.lucro.valor > antes.composicao.lucro.valor); // lucro do card aberto
  somaFecha(r.composicao);
  assert.equal(depois[0].categoria, "Pratos");              // não perde o resto do produto
  assert.equal(depois[1].preco_venda, 10);                  // nem mexe nos outros
  // produto novo (não existia na lista): entra na hora
  const novo = produtosComPrecoSalvo([], { produtoId: "n1", fichaId: "p1", nome: "Prato", preco: 30 });
  assert.equal(resumoFinanceiroDaFicha(prato, { fichas: [prato], produtos: novo }).preco, 30);
});
