import test from "node:test";
import assert from "node:assert/strict";
import { baseDosCustos, canaisDoCardapio, composicaoDoPreco, custosEmbutidos, grupoDaCategoria, mesAnterior, ordenarCategorias, rotuloDoLucro } from "./cardapio.mjs";
import { cardapioDeVendas, catalogoParaCombo, pedidoDaOferta, simularOferta } from "./promocoes.mjs";
import { canalConfigurado, normalizarCanal } from "./nucleo.mjs";

test("categoria define a parte do combo", () => {
  assert.equal(grupoDaCategoria("Marmitas de carne"), "marmita");
  assert.equal(grupoDaCategoria("Refrigerantes"), "bebida");
  assert.equal(grupoDaCategoria("Sucos"), "bebida");
  assert.equal(grupoDaCategoria("Sobremesas"), "sobremesa");
  assert.equal(grupoDaCategoria(""), "marmita");
  assert.deepEqual(ordenarCategorias(["Fit", "Sucos", "Marmitas de carne", "Marmitas de frango", "Sucos"]), ["Marmitas de frango", "Marmitas de carne", "Sucos", "Fit"]);
});

test("mês fechado anterior, inclusive na virada do ano", () => {
  assert.equal(mesAnterior("2026-11-05"), "2026-10");
  assert.equal(mesAnterior("2026-01-31"), "2025-12");
});

test("sem cadastro, as quatro plataformas aparecem sem taxa; balcão não tem comissão", () => {
  const padrao = canaisDoCardapio({ canais: [] });
  assert.deepEqual(padrao.map((c) => c.nome), ["iFood", "99", "Keeta", "Balcão"]);
  assert.equal(padrao.some(canalConfigurado), false);
  assert.equal(padrao[3].comissao_pct, 0);
  assert.equal(canalConfigurado({ ...padrao[3], taxa_pagamento_pct: 3 }), true);
  const salvo = normalizarCanal({ id: "keeta", nome: "Keeta" });
  assert.deepEqual(canaisDoCardapio({ canais: [salvo] }).map((c) => c.id), ["keeta"]);
});

test("separa equipe de custo fixo no DRE do mês", () => {
  const dre = { linhas: [{ id: "operacionais", filhos: [{ rotulo: "CMO (mão de obra alocada)", valor: 2000 }, { rotulo: "Ocupação (inclui rateio)", valor: 700 }, { rotulo: "Outras despesas", valor: 300 }] }] };
  assert.deepEqual(baseDosCustos({ dre, vendas: [{ quantidade: 300 }, { quantidade: 100 }] }), { cmoMes: 2000, cmoLinhas: [], fixosContasMes: 1000, vendidasMes: 400 });
  assert.deepEqual(baseDosCustos(null), { cmoMes: 0, cmoLinhas: [], fixosContasMes: 0, vendidasMes: 0 });
});

test("equipe e fixos por marmita: conta do mês ÷ marmitas do mês", () => {
  const e = custosEmbutidos({ cmoMes: 2000, fixosContasMes: 1000, vendidasMes: 400 });
  assert.deepEqual([e.cmoPorMarmita, e.fixosPorMarmita, e.totalPorMarmita, e.completo], [5, 2.5, 7.5, true]);
  assert.equal(rotuloDoLucro(e), "Lucro");
});

test("o que o dono digita vale sobre o sistema; zero digitado é zero, vazio é falta", () => {
  const e = custosEmbutidos({ cmoMes: 2000, fixosContasMes: 1000, vendidasMes: 400, config: { rateio: { marmitas_mes: "1000", cmo_mes: "0", fixos_mes: "1500,50" } } });
  assert.deepEqual([e.marmitasMes, e.cmoPorMarmita, e.fixosPorMarmita, e.completo], [1000, 0, 1.5, true]);
  const sem = custosEmbutidos({ config: { rateio: { marmitas_mes: "", cmo_mes: "", fixos_mes: "" } } });
  assert.deepEqual(sem.faltando, ["marmitas por mês", "equipe", "custos fixos"]);
  assert.equal(sem.totalPorMarmita, null);
  assert.equal(rotuloDoLucro(sem), "Lucro antes da equipe e dos custos fixos");
  assert.equal(rotuloDoLucro(custosEmbutidos({ cmoMes: 100, vendidasMes: 10 })), "Lucro antes de custos fixos");
});

const ifood = normalizarCanal({ id: "ifood", nome: "iFood", comissao_pct: 20, taxa_pagamento_pct: 3, entrega_subsidiada_pedido: 5 });
const embutidos = { cmoPorMarmita: 4, fixosPorMarmita: 2, totalPorMarmita: 6, completo: true, faltando: [] };

test("compre 1 e ganhe outra: o custo, a equipe e os fixos saem em dobro e o MEI não paga imposto", () => {
  const s = simularOferta({ itens: [{ nome: "Frango", preco: 40, custo: 10, grupo: "marmita", qtd: 1 }], oferta: { tipo: "leve_pague", leve: 2, pague: 1 }, canal: ifood, tributosPct: 0, embutidos });
  // 40 − 8 comissão − 1,20 maquininha − 5 entrega − 20 custo − 8 equipe − 4 fixos = −6,20
  assert.equal(s.com.tributos, 0);
  assert.equal(s.com.lucro, -6.2);
  assert.equal(s.prejuizo, true);
  assert.equal(s.sem.lucro, 9.8);
});

test("bebida e sobremesa não carregam equipe nem fixos; o combo conta uma marmita", () => {
  const itens = [{ preco: 40, custo: 10, grupo: "marmita", qtd: 1 }, { preco: 8, custo: 3, grupo: "bebida", qtd: 1 }, { preco: 10, custo: 4, grupo: "sobremesa", qtd: 1 }];
  assert.equal(pedidoDaOferta(itens, { tipo: "preco_fixo", valor: 50 }).marmitas, 1);
  assert.equal(pedidoDaOferta([itens[1]], { tipo: "nenhuma" }).marmitas, 0);
});

test("itens da Ficha técnica vão para o grupo da categoria", () => {
  const marmitas = [
    { id: "m", nome_receita: "Bife", categoria: "Marmitas de carne", preco_venda: 30, precos: { ifood: 35 } },
    { id: "r", nome_receita: "Guaraná", categoria: "Refrigerantes", preco_venda: 7, precos: {} },
    { id: "s", nome_receita: "Pudim", categoria: "Sobremesas", preco_venda: 9, precos: {} },
    { id: "x", nome_receita: "Fora", categoria: "Sucos", preco_venda: 9, precos: {}, ativo: false },
  ];
  const custos = new Map(marmitas.map((m) => [m.id, { total: 3, completo: true }]));
  const catalogo = catalogoParaCombo({ marmitas, custos, canalId: "ifood" });
  assert.deepEqual([catalogo.marmita.map((i) => i.id), catalogo.bebida.map((i) => i.id), catalogo.sobremesa.map((i) => i.id)], [["m"], ["r"], ["s"]]);
  assert.equal(catalogo.marmita[0].preco, 35);
  const linhas = cardapioDeVendas({ catalogo, marmitas, canal: ifood, tributosPct: 0, embutidos });
  assert.deepEqual(linhas.map((l) => [l.nome, l.categoria]), [["Bife", "Marmitas de carne"], ["Guaraná", "Refrigerantes"], ["Pudim", "Sobremesas"]]);
  assert.deepEqual([linhas[0].custo, linhas[0].markup, linhas[0].cmvPct], [3, 11.67, 8.57]);
});

test("sem taxa da plataforma ou sem imposto não há lucro: taxa em branco não é zero", () => {
  const catalogo = { marmita: [{ id: "m", nome: "Bife", preco: 30, custo: 10, grupo: "marmita" }], bebida: [], sobremesa: [] };
  const semTaxa = cardapioDeVendas({ catalogo, canal: normalizarCanal({ id: "keeta", nome: "Keeta" }), tributosPct: 0 })[0];
  assert.equal(semTaxa.lucro, null);
  assert.equal(semTaxa.veredito.rotulo, "Faltam as taxas do Keeta");
  assert.equal(semTaxa.markup, 3);
  const semImposto = cardapioDeVendas({ catalogo, canal: ifood, tributosPct: null })[0];
  assert.equal(semImposto.lucro, null);
  assert.equal(semImposto.falta, "Falta informar os impostos");
});

test("composição do preço: soma o preço e abre por funcionário e por conta", () => {
  const embutidos = custosEmbutidos({ cmoMes: 1000, cmoLinhas: [{ nome: "Ana", valor: 600 }, { nome: "Bia", valor: 400 }], vendidasMes: 100,
    config: { rateio: { custos_fixos: [{ nome: "Aluguel", valor: "300" }, { nome: "Luz", valor: 200 }, { nome: "Sem valor", valor: "" }] } } });
  assert.deepEqual([embutidos.fixosMes, embutidos.cmoPorMarmita, embutidos.fixosPorMarmita], [500, 10, 5]);
  const s = simularOferta({ itens: [{ preco: 100, custo: 25, grupo: "marmita", qtd: 1 }], oferta: { tipo: "nenhuma" }, canal: ifood, tributosPct: 0, embutidos });
  const c = composicaoDoPreco({ linha: { sim: s }, custoFicha: { embalagens: 5 }, embutidos });
  assert.equal(c.markupPct, 300);
  const por = Object.fromEntries(c.linhas.map((l) => [l.id, l]));
  assert.deepEqual([por.cmv.valor, por.embalagens.valor, por.cmo.pct, por.fixos.pct, por.taxas.valor, por.lucro.valor], [20, 5, 10, 5, 28, 32]);
  assert.deepEqual(por.cmo.filhos, [{ rotulo: "Ana", valor: 6, pct: 6 }, { rotulo: "Bia", valor: 4, pct: 4 }]);
  assert.deepEqual(por.fixos.filhos.map((f) => [f.rotulo, f.pct]), [["Aluguel", 3], ["Luz", 2]]);
  assert.deepEqual(por.taxas.filhos.map((f) => f.rotulo), ["Comissão da plataforma", "Maquininha e pagamento", "Entrega"]);
  assert.equal(c.linhas.reduce((t, l) => t + l.valor, 0), 100);
});
