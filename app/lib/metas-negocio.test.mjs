// Rode: node --test app/lib/metas-negocio.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { contribuicaoMedia, estrategia, estruturaDoMes, gargaloDaEstrutura, lucroDasVendas, menosVendidos, movimentoRecente, pontoDeEquilibrio, porPeriodo, previsaoDoMes, vendasDoMes } from "./metas-negocio.mjs";

const linha = (id, preco, lucro, cmo = 2, fixos = 1) => ({ secao: "marmitas", lucro, ficha: { id }, sim: { com: { valido: true, preco, lucro, cmo, fixos } } });

test("contribuição devolve equipe e custo fixo ao lucro, e pesa pelas vendas", () => {
  assert.deepEqual(contribuicaoMedia([linha("a", 30, 5), linha("b", 40, 9)]), { contribuicao: 10, ticket: 35, cmvPct: 0, ponderada: false });
  assert.equal(contribuicaoMedia([linha("a", 30, 5), linha("b", 40, 9)], [{ ficha_id: "b", quantidade: 3 }]).contribuicao, 12);
  assert.equal(contribuicaoMedia([{ secao: "marmitas", lucro: null }]), null);
});

test("ponto de equilíbrio: 50 marmitas por dia pagam a casa", () => {
  const e = pontoDeEquilibrio({ cmoMes: 15000, fixosMes: 10000, diasMes: 25, contribuicao: 20, ticket: 35 });
  assert.deepEqual([e.custoDia, e.unidadesMes, e.unidadesDia, e.faturamentoDia], [1000, 1250, 50, 1750]);
});

test("sem dado não vira número", () => {
  assert.match(pontoDeEquilibrio({ diasMes: 25, contribuicao: 10 }).motivo, /funcionários e custos fixos/);
  assert.match(pontoDeEquilibrio({ cmoMes: 1, contribuicao: 10 }).motivo, /dias de operação/);
  assert.match(pontoDeEquilibrio({ cmoMes: 1, diasMes: 25, contribuicao: -2 }).motivo, /não cobre/);
});

test("metas por período", () => {
  assert.deepEqual(porPeriodo(150000, 25), { dia: 6000, semana: 34615.38, mes: 150000, ano: 1800000 });
  assert.equal(porPeriodo(null, 25), null);
});

const vendas = [
  { data: "2026-11-01", valor_bruto: 1000, descontos: 50, cancelamentos: 0, quantidade: 30 },
  { data: "2026-11-01", valor_bruto: 200, descontos: 0, cancelamentos: 150, quantidade: 2 },
  { data: "2026-11-02", valor_bruto: 1000, quantidade: 30 },
  { data: "2026-11-03", valor_bruto: 1000, quantidade: 30 },
  { data: "2026-10-31", valor_bruto: 9999, quantidade: 1 },
];

test("vendas do mês ignoram outro mês e tiram desconto e cancelamento", () => {
  const d = vendasDoMes(vendas, "2026-11-03");
  assert.deepEqual(d.map((x) => x.acumulado), [1000, 2000, 3000]);
});

test("com menos de três dias não prevê", () => {
  const p = previsaoDoMes({ dias: vendasDoMes(vendas, "2026-11-03").slice(0, 2), hojeIso: "2026-11-02", diasMes: 25, metaMes: 30000 });
  assert.equal(p.ok, false);
  assert.match(p.motivo, /2 de 3/);
});

test("prevê pelo ritmo e respeita os dias que restam", () => {
  const dias = vendasDoMes(vendas, "2026-11-03");
  const p = previsaoDoMes({ dias, hojeIso: "2026-11-03", diasMes: 25, metaMes: 30000, equilibrioMes: 20000 });
  assert.deepEqual([p.ritmo, p.restantes, p.previsto, p.falta, p.estado, p.precisaPorDia], [1000, 22, 25000, 5000, "abaixo_meta", 1227.27]);
  const fim = previsaoDoMes({ dias, hojeIso: "2026-11-29", diasMes: 25, metaMes: 3500 });
  assert.equal(fim.restantes, 1);
  assert.equal(previsaoDoMes({ dias, hojeIso: "2026-11-03", diasMes: 25, metaMes: 20000 }).estado, "bate_meta");
  assert.equal(previsaoDoMes({ dias, hojeIso: "2026-11-03", diasMes: 25, metaMes: 90000, equilibrioMes: 40000 }).estado, "abaixo_equilibrio");
});

test("estratégia aponta o item que mais deixa no bolso", () => {
  const e = estrategia({ ok: true, falta: 5000, restantes: 22 }, [{ nome: "Frango", lucro: 5, preco: 30 }, { nome: "Carne", lucro: 9, preco: 40 }, { nome: "Ruim", lucro: -1, preco: 50 }]);
  assert.deepEqual(e, { nome: "Carne", unidades: 125, porDia: 6, lucroExtra: 1125, lucroPorUnidade: 9 });
  assert.equal(estrategia({ ok: true, falta: 0 }, []), null);
});

test("estrutura abre pessoa a pessoa e compara com a referência", () => {
  const r = estruturaDoMes({ faturamento: 100000, cmvPct: 42, cmoLinhas: [{ nome: "Maria", valor: 3000 }, { nome: "João", valor: 5000 }], fixosLinhas: [{ nome: "Aluguel", valor: 5000 }, { nome: "Luz", valor: 2000 }, { nome: "Contador", valor: 1000 }] });
  assert.deepEqual(r.grupos.map((g) => [g.id, g.pct, g.estado]), [["cmv", 42, "acima"], ["equipe", 8, "abaixo"], ["aluguel", 5, "abaixo"], ["utilidades", 2, "abaixo"], ["outras", 1, null]]);
  assert.deepEqual(r.grupos[1].linhas.map((l) => [l.nome, l.pct]), [["João", 5], ["Maria", 3]]);
  assert.equal(estruturaDoMes({ faturamento: 0 }), null);
});

test("faturamento alto não esconde o lucro", () => {
  const r = lucroDasVendas([{ ficha_id: "a", quantidade: 100, valor_bruto: 3000 }, { ficha_id: "x", quantidade: 5, valor_bruto: 100 }], [{ id: "a", lucro: 2 }]);
  assert.deepEqual(r, { lucro: 200, faturamento: 3100, pct: null, semLucro: 5 });
  assert.equal(lucroDasVendas([{ ficha_id: "a", quantidade: 100, valor_bruto: 3000 }], [{ id: "a", lucro: 2 }]).pct, 6.7);
  assert.equal(lucroDasVendas([{ ficha_id: "x", quantidade: 5, valor_bruto: 100 }], [{ id: "a", lucro: 2 }]).lucro, null);
});

test("gargalo é o maior excesso em reais", () => {
  const e = estruturaDoMes({ faturamento: 100000, cmvPct: 45, cmoLinhas: [{ nome: "A", valor: 36000 }], fixosLinhas: [] });
  assert.deepEqual(gargaloDaEstrutura(e), { id: "cmv", rotulo: "CMV", pct: 45, limite: 40, excesso: 5000 });
  assert.equal(gargaloDaEstrutura(estruturaDoMes({ faturamento: 100000, cmvPct: 35 })), null);
});

test("o que não saiu aparece primeiro", () => {
  const r = menosVendidos([{ id: "a", nome: "Suco" }, { id: "b", nome: "Água" }, { id: "c", nome: "Coca" }], [{ ficha_id: "a", quantidade: 3 }, { ficha_id: "c", quantidade: 1 }], 2);
  assert.deepEqual(r.map((i) => [i.nome, i.vendidas]), [["Água", 0], ["Coca", 1]]);
});

test("movimento compara duas semanas sem inventar", () => {
  const v = [{ data: "2026-11-05", quantidade: 30 }, { data: "2026-10-28", quantidade: 40 }];
  assert.deepEqual(movimentoRecente(v, "2026-11-06"), { atual: 30, anterior: 40, variacaoPct: -25 });
  assert.equal(movimentoRecente([{ data: "2026-11-05", quantidade: 30 }], "2026-11-06"), null);
});

test("restaurante: margem de contribuição do prato e recusa quando a ficha não sustenta", async () => {
  const { contribuicaoDoPrato } = await import("./metas-negocio.mjs");
  // 50 − 15 − 1 − 50 × (4 + 3)% = 30,50
  assert.equal(contribuicaoDoPrato({ preco: 50, custoIngredientes: 15, custoEmbalagem: 1, impostoPct: 4, taxaMaquininhaPct: 3 }), 30.5);
  assert.equal(contribuicaoDoPrato({ preco: 50, semCusto: true }), null);
  assert.equal(contribuicaoDoPrato({ preco: 50, semRendimento: true, custoIngredientes: 10 }), null);
  assert.equal(contribuicaoDoPrato({ preco: 0, custoIngredientes: 1 }), null);
});

test("restaurante: vendas por prato, mais margem, parados e candidatos da estratégia", async () => {
  const { vendasPorPrato, estrategia } = await import("./metas-negocio.mjs");
  const produtos = [
    { id: "a", nome: "Tacacá", departamento: "Cozinha", preco: 35, contribuicao: 20 },
    { id: "b", nome: "Pato no tucupi", departamento: "cozinha", preco: 80, contribuicao: 45 },
    { id: "c", nome: "Maniçoba", departamento: "cozinha", preco: 60, contribuicao: null },
    { id: "d", nome: "Suco de cupuaçu", departamento: "Bar", preco: 12, contribuicao: 8 },
    { id: "e", nome: "Caipirinha", departamento: "bar", preco: 25, contribuicao: 18 },
    { id: "z", nome: "Inativo", departamento: "cozinha", preco: 10, contribuicao: 5, ativo: false },
  ];
  const itens = [
    { produto_id: "a", quantidade: 10, valor_unitario: 35 },
    { produto_id: "b", quantidade: 2, valor_unitario: 80 },
    { produto_id: "b", quantidade: 1, valor_unitario: 80, status_kds: "cancelado" },
    { produto_id: "c", quantidade: 3, valor_unitario: 60 },
    { produto_id: "d", quantidade: 4, valor_unitario: 12 },
    { produto_id: null, quantidade: 1, valor_unitario: 5 },
  ];
  const v = vendasPorPrato(itens, produtos);
  assert.equal(v.temVendas, true);
  assert.equal(v.totalUnidades, 19);
  assert.equal(v.semProduto, 1);
  assert.deepEqual(v.maisMargem.map((l) => [l.nome, l.margemNoMes]), [["Tacacá", 200], ["Pato no tucupi", 90], ["Suco de cupuaçu", 32]]);
  assert.deepEqual(v.pratosParados.map((l) => [l.nome, l.unidades]), [["Pato no tucupi", 2], ["Maniçoba", 3], ["Tacacá", 10]]);
  assert.deepEqual(v.bebidasParadas.map((l) => [l.nome, l.unidades]), [["Caipirinha", 0], ["Suco de cupuaçu", 4]]);
  assert.equal(v.semMargem, 1, "Maniçoba vendeu, mas a ficha não sustenta a margem");
  // A estratégia escolhe a maior margem por unidade entre os que já venderam.
  const e = estrategia({ ok: true, falta: 1600, restantes: 10 }, v.candidatos);
  assert.deepEqual([e.nome, e.unidades, e.porDia, e.lucroExtra], ["Pato no tucupi", 20, 2, 900]);
});

test("restaurante: sem vendas no mês não há parados nem estratégia", async () => {
  const { vendasPorPrato } = await import("./metas-negocio.mjs");
  const v = vendasPorPrato([], [{ id: "a", nome: "Tacacá", preco: 35, contribuicao: 20 }]);
  assert.equal(v.temVendas, false);
  assert.deepEqual(v.pratosParados, []);
  assert.deepEqual(v.candidatos, []);
});
