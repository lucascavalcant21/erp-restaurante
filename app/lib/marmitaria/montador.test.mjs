// Criar marmita: versões com e sem empanamento, preço, lucro, desconto e combos.
// Rode: node --test app/lib/marmitaria/montador.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import {
  contaDaVersao, contaDoCombo, vereditoDaVersao, custoDosItens, errosDoMontador, montadorVazio, nomeEmpanado, novoItem, planoDeGravacao, versoesDoMontador,
} from "./montador.mjs";

const ins = (id, nome, un, preco) => [id, { id, nome, unidade_medida: un, custo_compra: preco, tamanho_embalagem: 1 }];
const insumos = new Map([
  ins("peito", "Peito de frango", "kg", 22), ins("farinha", "Farinha de rosca", "kg", 10), ins("ovo", "Ovo", "un", 0.8),
  ins("batata", "Batata", "kg", 6), ins("pote", "Marmitex 750 ml", "un", 1.2),
]);
const fichas = [{ id: "arroz", nome_receita: "Arroz cozido", eh_base: true, rendimento_porcoes: 2, rendimento_unidade: "kg",
  fichas_ingredientes: [{ insumo_id: "x", insumos: { id: "x", nome: "Arroz cru", unidade_medida: "kg", custo_compra: 6, tamanho_embalagem: 1 }, quantidade: 1 }] }];
const ctx = { insumos, fichas };
const canal = { id: "balcao", nome: "Balcão", comissao_pct: 0, taxa_pagamento_pct: 0 };

function frango() {
  return {
    ...montadorVazio(), nome: "Peito de frango com arroz e batata", categoria: "Marmitas de frango",
    proteina: novoItem({ insumo_id: "peito", qtd: "150" }),
    empanamento: [novoItem({ insumo_id: "farinha", qtd: "30" }), novoItem({ insumo_id: "ovo", un: "un", qtd: "0,5" })],
    acompanhamentos: [novoItem({ subficha_id: "arroz", qtd: "200" }), novoItem({ insumo_id: "batata", qtd: "100" })],
    embalagens: [{ key: "e1", insumo_id: "pote", qtd: "1", tipo: "marmitex" }],
    precoSem: "24,90", precoCom: "27,90",
  };
}

test("nome da versão empanada", () => {
  assert.equal(nomeEmpanado("Peito de frango com arroz e batata"), "Peito de frango empanado com arroz e batata");
  assert.equal(nomeEmpanado("Filé de peixe"), "Filé de peixe empanado");
  assert.equal(nomeEmpanado("Frango empanado com arroz"), "Frango empanado com arroz");
});

test("versões: sem empanamento é uma; com empanamento são duas, ou só a empanada", () => {
  const m = frango();
  assert.deepEqual(versoesDoMontador(m).map((v) => v.chave), ["sem"]);
  const dois = { ...m, empanar: true };
  const v = versoesDoMontador(dois);
  assert.deepEqual(v.map((x) => x.chave), ["sem", "com"]);
  assert.equal(v[1].nome, "Peito de frango empanado com arroz e batata");
  assert.equal(v[1].itens.length, 5); // peito + 2 do empanamento + arroz + batata
  assert.deepEqual(versoesDoMontador({ ...dois, vender: "so_empanado" }).map((x) => x.chave), ["com"]);
  assert.equal(versoesDoMontador({ ...dois, nomeCom: "Frango à milanesa", nomeComEditado: true })[1].nome, "Frango à milanesa");
});

test("custo do frango e do empanamento separados", () => {
  const m = frango();
  assert.equal(custoDosItens([m.proteina], ctx).total, 3.3); // 0,15 kg × 22
  assert.equal(custoDosItens(m.empanamento, ctx).total, 0.7); // 0,03 × 10 + 0,5 × 0,80
});

test("conta da versão: custo, sugerido, lucro cheio e com desconto", () => {
  const m = { ...frango(), empanar: true, descontoPct: "10" };
  const embutidos = { cmoPorMarmita: 4, fixosPorMarmita: 3, completo: true };
  const [sem, com] = versoesDoMontador(m);
  const a = contaDaVersao({ m, v: sem, ctx, canal, tributosPct: 0, embutidos, margemAlvoPct: 20 });
  // 3,30 frango + 0,60 arroz (0,2 kg × 3/kg) + 0,60 batata + 1,20 pote = 5,70
  assert.equal(a.custo, 5.7);
  assert.equal(a.lucro, undefined);
  assert.equal(a.cheio.lucro, 12.2); // 24,90 − 5,70 − 4 − 3
  assert.equal(a.precoDesconto, 22.41);
  assert.equal(a.comDesconto.lucro, 9.71);
  // sugerido: (5,70 + 7) ÷ (1 − 0,20) = 15,875 → 15,88
  assert.equal(a.sugerido.preco, 15.88);
  const b = contaDaVersao({ m, v: com, ctx, canal, tributosPct: 0, embutidos, margemAlvoPct: 20 });
  assert.equal(b.custo, 6.4); // + 0,70 do empanamento
  assert.equal(b.cheio.lucro, 14.5);
});

test("sem custo não há lucro nem preço sugerido (nada inventado)", () => {
  const m = { ...frango(), proteina: novoItem({ insumo_id: "sumiu", qtd: "150" }) };
  const c = contaDaVersao({ m, v: versoesDoMontador(m)[0], ctx, canal, margemAlvoPct: 20 });
  assert.equal(c.custo, null);
  assert.equal(c.cheio, null);
  assert.equal(c.sugerido.preco, null);
});

test("combo: separado, economia do cliente e lucro", () => {
  const catalogo = { bebida: [{ id: "coca", nome: "Coca lata", preco: 6, custo: 3 }], sobremesa: [{ id: "pudim", nome: "Pudim", preco: 8, custo: 2.5 }] };
  const r = contaDoCombo({ combo: { tipo: "bebida_sobremesa", bebida_id: "coca", sobremesa_id: "pudim", preco: "34,90" }, marmita: { preco: 24.9, custo: 5.7 }, catalogo, canal, tributosPct: 0, embutidos: { cmoPorMarmita: 4, fixosPorMarmita: 3 } });
  assert.equal(r.ok, true);
  assert.equal(r.separado, 38.9);
  assert.equal(r.economiaCliente, 4);
  assert.equal(r.custo, 11.2);
  assert.equal(r.lucro, 16.7); // 34,90 − 11,20 − 7
  const falta = contaDoCombo({ combo: { tipo: "bebida", bebida_id: "" }, marmita: { preco: 24.9, custo: 5.7 }, catalogo, canal });
  assert.equal(falta.ok, false);
  const semCusto = contaDoCombo({ combo: { tipo: "bebida", bebida_id: "x" }, marmita: { preco: 1, custo: 1 }, catalogo: { bebida: [{ id: "x", nome: "Suco", preco: 5, custo: null }] }, canal });
  assert.match(semCusto.motivo, /DADOS INSUFICIENTES/);
});

test("erros: diz o que falta antes de salvar", () => {
  const e = errosDoMontador(montadorVazio(), ctx, "balcao");
  assert.ok(e.includes("Dê um nome para a marmita."));
  assert.ok(e.includes("Escolha a proteína."));
  assert.ok(e.includes("Escolha a embalagem."));
  assert.deepEqual(errosDoMontador({ ...frango(), empanar: true }, ctx, "balcao"), []);
  assert.ok(errosDoMontador({ ...frango(), empanar: true, precoCom: "" }, ctx, "balcao").includes("Informe o preço de venda da empanada."));
});

test("plano de gravação: fichas com preço da plataforma, desconto e combos sem duplicar", () => {
  const m = { ...frango(), empanar: true, descontoPct: "10",
    combos: [{ id: "c1", tipo: "bebida", versao: "com", bebida_id: "coca", preco: "31,90" }, { id: "c2", tipo: "bebida", versao: "sem", bebida_id: "", preco: "30" }] };
  const plano = planoDeGravacao({ m, ctx, unidadeId: "marmitaria", canalId: "balcao",
    ofertasAtuais: [{ id: "outra", ficha_id: "f9", tipo: "desconto_pct", valor: "5" }], combosAtuais: [{ id: "antigo", nome: "X", modelo: "comida_bebida", itens: [], preco: "1" }] });
  assert.equal(plano.fichas.length, 2);
  assert.deepEqual(plano.fichas.map((f) => f.precos), [[{ canal: "balcao", preco_venda: 24.9 }], [{ canal: "balcao", preco_venda: 27.9 }]]);
  assert.equal(plano.fichas[1].itens.length, 5);
  assert.equal(plano.fichas[0].custo_embalagens_total, 1.2);
  assert.equal(plano.ofertas.length, 3); // a antiga + uma por versão
  assert.equal(plano.combos.length, 2); // o antigo + o completo (o sem bebida fica de fora)
  const combo = plano.combos[1];
  assert.equal(combo.modelo, "comida_bebida");
  assert.deepEqual(combo.itens, [{ grupo: "marmita", id: m.idCom }, { grupo: "bebida", id: "coca" }]);
  // salvar de novo (mesmo montador) não duplica oferta nem combo
  const de_novo = planoDeGravacao({ m, ctx, unidadeId: "marmitaria", canalId: "balcao", ofertasAtuais: plano.ofertas, combosAtuais: plano.combos });
  assert.equal(de_novo.ofertas.length, 3);
  assert.equal(de_novo.combos.length, 2);
  assert.deepEqual(de_novo.fichas.map((f) => f.id), plano.fichas.map((f) => f.id));
});

test("meta: em reais quando configurada, senão em %", () => {
  const conta = { custo: 5, cheio: { lucro: 3, lucroPct: 14.5 } };
  assert.equal(vereditoDaVersao(conta, { margemAlvoPct: 15, lucroAlvoReais: 3 }).rotulo, "Meta alcançada");
  assert.equal(vereditoDaVersao({ ...conta, cheio: { lucro: 2, lucroPct: 10 } }, { lucroAlvoReais: "3" }).rotulo, "Abaixo da meta (R$ 3,00)");
  assert.equal(vereditoDaVersao({ ...conta, cheio: { lucro: -1 } }, { lucroAlvoReais: 3 }).id, "prejuizo");
  assert.equal(vereditoDaVersao({ custo: null }, {}).rotulo, "Dados insuficientes");
  assert.equal(vereditoDaVersao(conta, { margemAlvoPct: 15 }).id, "baixo");
});
