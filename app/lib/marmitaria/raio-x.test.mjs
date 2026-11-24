import test from "node:test";
import assert from "node:assert/strict";
import { raioXDaMarmita, textoDoRaioX, resumoDasMarmitas, canalDaPergunta, itensDoRaioX } from "./raio-x.mjs";
import { custosEmbutidos } from "./cardapio.mjs";

const custo = {
  linhas: [{ nome: "Arroz branco", custo: 1.2, tipo: "pre_preparo" }, { nome: "Filé de frango empanado", custo: 4.8, tipo: "ingrediente" }, { nome: "Molho", custo: 1.5, tipo: "ingrediente" }],
  linhasEmbalagens: [{ nome: "Pote 750 ml", custo: 0.9 }], total: 8.4, pendencias: [], completo: true,
};
const canal = { id: "ifood", nome: "iFood", ativo: true, comissao_pct: 12, taxa_pagamento_pct: 3.2 };
const embutidos = custosEmbutidos({ config: { rateio: { marmitas_mes: 1000, cmo_mes: 9000, custos_fixos: [{ nome: "Pró-labore", valor: 3000 }, { nome: "Aluguel", valor: 2000 }, { nome: "Energia", valor: 800 }], custos_variaveis: [{ nome: "Óleo", valor: 0.3 }] } } });

test("raio-x de uma marmita de R$ 30: cada pedaço e o lucro fecham no preço", () => {
  const rx = raioXDaMarmita({ marmita: { nome_receita: "Frango empanado", precos: { ifood: 30 } }, custo, canal, tributosPct: 0, embutidos, pessoasEquipe: 3 });
  assert.equal(rx.valido, true);
  assert.equal(rx.preco, 30);
  const soma = rx.linhas.reduce((t, l) => t + l.valor, 0) + rx.lucro;
  assert.ok(Math.abs(soma - 30) < 0.02);
  assert.equal(rx.linhas.find((l) => l.grupo === "equipe").valor, 9);
  assert.equal(rx.linhas.find((l) => l.grupo === "equipe").pct, 30);
  assert.equal(rx.linhas.find((l) => l.rotulo === "Pró-labore").valor, 3);
  assert.equal(rx.linhas.find((l) => l.rotulo === "Óleo").valor, 0.3);
  assert.equal(rx.maisCaro.rotulo, "Filé de frango empanado");
  // 30 − 8,4 − 4,56 (12% + 3,2%) − 9 − 3 − 2 − 0,8 − 0,3 = 1,94
  assert.equal(rx.lucro, 1.94);
  assert.equal(rx.natureza, "ESTIMATIVA");
  const t = textoDoRaioX(rx);
  assert.match(t, /equipe \(3 pessoas\) leva R\$\s9,00 \(30%\)/);
  assert.match(t, /mais caro é Filé de frango empanado/);
  assert.equal(itensDoRaioX(rx).at(-1).rotulo, "Lucro");
});

test("sem preço ou sem ficha: DADOS INSUFICIENTES com o motivo", () => {
  const semPreco = raioXDaMarmita({ marmita: { nome_receita: "Carne" }, custo, canal });
  assert.equal(semPreco.valido, false);
  assert.match(textoDoRaioX(semPreco), /^DADOS INSUFICIENTES: Carne está sem preço no iFood/);
  const semFicha = raioXDaMarmita({ marmita: { nome_receita: "Carne", preco_venda: 25 }, custo: { linhas: [] }, canal });
  assert.match(semFicha.motivo, /sem ficha técnica/);
});

test("sem equipe e imposto cadastrados, avisa que o lucro está maior que o real", () => {
  const rx = raioXDaMarmita({ marmita: { nome_receita: "Frango", preco_venda: 30 }, custo, canal, embutidos: custosEmbutidos({ config: { rateio: {} } }) });
  assert.ok(rx.faltando.includes("imposto"));
  assert.ok(rx.faltando.includes("equipe"));
  assert.match(textoDoRaioX(rx), /lucro está maior do que o real/);
  assert.equal(rx.completo, false);
});

test("app citado na frase vale; senão o primeiro com preço", () => {
  const canais = [canal, { id: "99food", nome: "99Food", ativo: true }, { id: "balcao", nome: "Balcão", ativo: true }];
  assert.equal(canalDaPergunta(canais, "quanto sobra no balcao?").id, "balcao");
  assert.equal(canalDaPergunta(canais, "e no 99food", null).id, "99food");
  assert.equal(canalDaPergunta(canais, "quanto sobra", { precos: { balcao: 20 } }).id, "balcao");
});

test("resumo das marmitas: melhor, pior e prejuízo", () => {
  const a = raioXDaMarmita({ marmita: { nome_receita: "A", precos: { ifood: 30 } }, custo, canal, tributosPct: 0, embutidos });
  const b = raioXDaMarmita({ marmita: { nome_receita: "B", precos: { ifood: 20 } }, custo, canal, tributosPct: 0, embutidos });
  const r = resumoDasMarmitas([b, a, raioXDaMarmita({ marmita: { nome_receita: "C" }, custo, canal })]);
  assert.equal(r.itens[0].rotulo, "A");
  assert.match(r.texto, /mais deixa lucro é A/);
  assert.match(r.texto, /prejuízo: B/);
  assert.match(r.texto, /1 sem preço ou ficha/);
  assert.match(resumoDasMarmitas([]).texto, /^DADOS INSUFICIENTES/);
});
