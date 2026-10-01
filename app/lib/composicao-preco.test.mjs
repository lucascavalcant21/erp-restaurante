// Testes da composição do preço e do formato "R$ · %". Rode com:
//   node --test app/lib/composicao-preco.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import {
  percentualDe, diferencaPP, fmtReais, fmtPct, fmtPP, fmtValorPct, arred2,
} from "./valor-percentual.mjs";
import {
  composicaoDoPreco, baseDoRateio, ratear, cmoDoMes, proLaboreDoMes, despesasOperacionaisDoMes,
  pesoNoFaturamento, resultadoGerencialDoMes,
} from "./composicao-preco.mjs";

// ─── Percentual e formato ───────────────────────────────────────────────────

test("percentual sobre o preço de venda (valores do pedido)", () => {
  assert.equal(percentualDe(25, 62), 40.32);
  assert.equal(percentualDe(2.7, 62), 4.35);
  assert.equal(percentualDe(27.7, 62), 44.68);
  assert.equal(percentualDe(5.58, 62), 9);
  assert.equal(percentualDe(7.83, 62), 12.63);
  assert.equal(percentualDe(1.92, 62), 3.1);
  assert.equal(percentualDe(1.54, 62), 2.48);
  assert.equal(percentualDe(0.58, 62), 0.94);
  assert.equal(percentualDe(0.19, 62), 0.31);
  assert.equal(percentualDe(14.74, 62), 23.77);
});

test("preço zero ou ausente não tem percentual; valor zero é 0%", () => {
  assert.equal(percentualDe(10, 0), null);
  assert.equal(percentualDe(10, null), null);
  assert.equal(percentualDe(10, -5), null);
  assert.equal(percentualDe(0, 62), 0);
});

test("arredondamento financeiro em 2 casas", () => {
  assert.equal(arred2(1.005), 1.01);
  assert.equal(arred2(2.675), 2.68);
  assert.equal(arred2(-1.005), -1.01);
});

test("formato pt-BR", () => {
  assert.equal(fmtReais(1234.56), "R$ 1.234,56");
  assert.equal(fmtReais(7.83), "R$ 7,83");
  assert.equal(fmtReais(-3.8), "-R$ 3,80");
  assert.equal(fmtPct(12.63), "12,63%");
  assert.equal(fmtPct(9), "9,00%");
  assert.equal(fmtPct(null), "—");
  assert.equal(fmtValorPct(7.83, 62), "R$ 7,83 · 12,63%");
  assert.equal(fmtValorPct(7.83, 0), "R$ 7,83");
  assert.equal(fmtPP(8.77), "+8,77 p.p.");
  assert.equal(fmtPP(-2.5), "−2,50 p.p.");
});

test("diferença para a meta em pontos percentuais", () => {
  assert.equal(diferencaPP(23.77, 15), 8.77);
  assert.equal(diferencaPP(12, 15), -3);
  assert.equal(diferencaPP(null, 15), null);
});

// ─── O exemplo da tela (Açaí 1L) ────────────────────────────────────────────
// 1.000 pratos no mês: CMO de R$ 7.830 vira R$ 7,83 por prato; aluguel de
// R$ 1.920 vira R$ 1,92; e assim por diante. Imposto 9%, maquininha 0%.
const PARAMS_EXEMPLO = {
  dias_operacao_mes: 25, pratos_por_dia: 40,
  custo_cmo_mes: 7830, custo_aluguel_mes: 1920, custo_luz_mes: 1920, custo_gas_mes: 1540,
  custo_agua_mes: 580, custo_limpeza_mes: 190, imposto_pct: 9, taxa_cartao_pct: 0, margem_alvo_pct: 15,
};
const ACAI = { preco: 62, cmvItens: [{ rotulo: "Açaí", valor: 25 }, { rotulo: "Farinha de mandioca", valor: 2.7 }], params: PARAMS_EXEMPLO };

test("exemplo da tela: reproduz R$ 14,74 · 23,77% e explica cada parte", () => {
  const c = composicaoDoPreco(ACAI);
  assert.deepEqual([c.cmv.valor, c.cmv.pct], [27.7, 44.68]);
  assert.deepEqual(c.cmv.partes.map((p) => [p.rotulo, p.valor, p.pct]), [["Açaí", 25, 40.32], ["Farinha de mandioca", 2.7, 4.35]]);
  assert.deepEqual([c.variaveis.valor, c.variaveis.pct], [5.58, 9]);
  assert.deepEqual([c.margemContribuicao.valor, c.margemContribuicao.pct], [28.72, 46.32]);
  assert.deepEqual([c.cmo.valor, c.cmo.pct], [7.83, 12.63]);
  assert.equal(c.cmo.natureza, "rateado");
  const op = Object.fromEntries(c.operacionais.partes.map((p) => [p.rotulo, [p.valor, p.pct]]));
  assert.deepEqual(op, { Aluguel: [1.92, 3.1], Energia: [1.92, 3.1], "Água": [0.58, 0.94], "Gás": [1.54, 2.48], Limpeza: [0.19, 0.31] });
  assert.equal(c.operacionais.valor, 6.15);
  assert.equal(c.proLabore.valor, 0);
  assert.match(c.proLabore.motivo, /Nenhum pró-labore/);
  assert.deepEqual([c.resultado.valor, c.resultado.pct], [14.74, 23.77]);
  assert.deepEqual([c.meta.pct, c.meta.diferencaPP], [15, 8.77]);
});

const fecha = (c) => assert.equal(
  c.cmv.centavos + c.variaveis.centavos + c.cmo.centavos + c.operacionais.centavos + c.proLabore.centavos + c.resultado.centavos,
  Math.round(c.preco * 100), "a soma dos grupos tem de dar o preço");
const partesFecham = (g) => assert.equal(Math.round(g.partes.reduce((t, p) => t + p.valor, 0) * 100), g.centavos, `${g.id}: partes ≠ grupo`);

test("a soma fecha no centavo, grupos e partes, com números quebrados", () => {
  const params = { ...PARAMS_EXEMPLO, pratos_por_dia: 97, custo_internet_mes: 199.9, custo_contabilidade_mes: 850,
    comissao_pct: 3.3, marketplace_pct: 12.5, outras_variaveis_pct: 0.7, custo_cmo_mes: 21000.13, cmo_folha_mes: 18000.13, cmo_extras_mes: 1500, cmo_encargos_mes: 1500,
    pro_labore: [{ socio: "Sócio A", valor_mensal: 5000 }, { socio: "Sócio B", valor_mensal: 3333.33 }] };
  for (const preco of [59.9, 12, 395, 8.5]) {
    const c = composicaoDoPreco({ preco, cmvItens: [{ rotulo: "a", valor: preco * 0.3333 }, { rotulo: "b", valor: 1.111 }, { rotulo: "c", valor: 0.005 }], params });
    fecha(c);
    [c.cmv, c.variaveis, c.cmo, c.operacionais, c.proLabore].forEach(partesFecham);
  }
});

test("despesas variáveis: cada uma separada, sobre o preço; a da ficha substitui a da casa", () => {
  const c = composicaoDoPreco({ preco: 100, cmvItens: [], impostoPct: 6, taxaMaquininhaPct: 3,
    params: { imposto_pct: 9, taxa_cartao_pct: 1, comissao_pct: 2, marketplace_pct: 12, outras_variaveis_pct: 1 } });
  assert.deepEqual(c.variaveis.partes.map((p) => [p.rotulo, p.valor, p.pct]), [
    ["Impostos", 6, 6], ["Maquininha", 3, 3], ["Comissão", 2, 2], ["Marketplace / iFood", 12, 12], ["Outras despesas variáveis", 1, 1]]);
  assert.equal(c.margemContribuicao.valor, 76);
});

test("CMO: partes do RH + encargos, em grupo próprio (fora das despesas operacionais)", () => {
  assert.deepEqual(cmoDoMes({ cmo_folha_mes: 20000, cmo_extras_mes: 3000, cmo_encargos_mes: 2000, custo_cmo_mes: 25000 }).partes.map((p) => p.rotulo),
    ["Salários e benefícios (RH)", "Extras e diárias pagas", "Encargos e provisões (configurado)"]);
  // retrato antigo (só o total gravado) continua valendo
  assert.equal(cmoDoMes({ custo_cmo_mes: 7830 }).total, 7830);
  const c = composicaoDoPreco(ACAI);
  assert.ok(!c.operacionais.partes.some((p) => /CMO|obra/i.test(p.rotulo)));
  // % do CMO na operação: CMO do mês ÷ faturamento
  assert.equal(pesoNoFaturamento(25000, 100000), 25);
});

test("custos operacionais: rateio por prato ou proporcional ao faturamento", () => {
  const porPrato = baseDoRateio({ dias_operacao_mes: 25, pratos_por_dia: 40 });
  assert.equal(ratear(1920, porPrato, 62), 1.92);
  assert.equal(ratear(1920, porPrato, 10), 1.92); // por prato: igual para qualquer preço
  const porFat = baseDoRateio({ rateio_por_faturamento: 1, faturamento_mes_ref: 100000 });
  assert.equal(ratear(25000, porFat, 62), 15.5); // 25% de 62
  assert.equal(ratear(25000, porFat, 10), 2.5);  // 25% de 10
  const c = composicaoDoPreco({ preco: 62, cmvItens: [], params: { rateio_por_faturamento: 1, faturamento_mes_ref: 100000, custo_cmo_mes: 25000 } });
  assert.deepEqual([c.cmo.valor, c.cmo.pct], [15.5, 25]);
  // sem base: nada rateado, e o resultado não se chama lucro
  const sem = composicaoDoPreco({ preco: 62, cmvItens: [], params: { custo_aluguel_mes: 5000 } });
  assert.equal(sem.operacionais.valor, 0);
  assert.match(sem.operacionais.motivo, /dias de operação/);
  assert.equal(sem.resultado.rotulo, "Resultado antes dos custos rateados");
  fecha(sem);
  assert.match(baseDoRateio({ rateio_por_faturamento: 1 }).motivo, /faturamento mensal de referência/);
  assert.equal(despesasOperacionaisDoMes({ custo_internet_mes: 150, custo_seguros_mes: 90 }).total, 240);
});

test("pró-labore: categoria própria, só a competência vigente", () => {
  const lista = [{ socio: "Ana", valor_mensal: 6000 }, { socio: "Bia", valor_mensal: 4000, competencia: "2099-01" }];
  assert.equal(proLaboreDoMes(lista, new Date(2026, 9, 1)).total, 6000);
  const c = composicaoDoPreco({ preco: 62, cmvItens: [], params: { dias_operacao_mes: 25, pratos_por_dia: 40, pro_labore: lista } });
  assert.deepEqual([c.proLabore.valor, c.proLabore.pct], [6, 9.68]);
  assert.equal(c.proLabore.natureza, "rateado");
  assert.ok(!c.cmo.partes.length);
});

test("resultado e meta: o resultado não é ajustado para a meta; sem meta, sem diferença", () => {
  const c = composicaoDoPreco({ ...ACAI, params: { ...PARAMS_EXEMPLO, margem_alvo_pct: 30 } });
  assert.equal(c.resultado.pct, 23.77);
  assert.equal(c.meta.diferencaPP, -6.23);
  const semMeta = composicaoDoPreco({ ...ACAI, params: { ...PARAMS_EXEMPLO, margem_alvo_pct: 0 } });
  assert.equal(semMeta.meta.pct, null);
  assert.equal(semMeta.meta.diferencaPP, null);
});

test("prejuízo: resultado negativo, soma fecha, barra divide o custo", () => {
  const c = composicaoDoPreco({ preco: 20, cmvItens: [{ rotulo: "x", valor: 18 }], params: PARAMS_EXEMPLO });
  assert.equal(c.resultado.prejuizo, true);
  fecha(c);
  assert.ok(Math.abs(c.barra.reduce((t, s) => t + s.largura, 0) - 100) < 1e-9);
});

test("preço zero: valores em R$ continuam, percentuais somem", () => {
  const c = composicaoDoPreco({ preco: 0, cmvItens: [{ rotulo: "x", valor: 5 }], params: PARAMS_EXEMPLO });
  assert.equal(c.temPreco, false);
  assert.equal(c.cmv.valor, 5);
  assert.equal(c.cmv.pct, null);
  assert.equal(c.resultado.pct, null);
});

// ─── Visão gerencial ────────────────────────────────────────────────────────

test("visão gerencial do mês: % do faturamento e sem número inventado", () => {
  const l = Object.fromEntries(resultadoGerencialDoMes({ faturamento: 100000, cmvReal: 32000, despesasVariaveis: 9000,
    cmo: 25000, operacionais: 12000, proLabore: 8000 }).map((x) => [x.id, x]));
  assert.deepEqual([l.cmv.pct, l.margem_bruta.valor, l.contribuicao.valor, l.resultado.valor, l.resultado.pct], [32, 68000, 59000, 14000, 14]);
  const parcial = Object.fromEntries(resultadoGerencialDoMes({ faturamento: 100000, cmvReal: null }).map((x) => [x.id, x]));
  assert.equal(parcial.cmv.valor, null);       // sem fonte: sem dado, não zero
  assert.equal(parcial.resultado.valor, null);
});
