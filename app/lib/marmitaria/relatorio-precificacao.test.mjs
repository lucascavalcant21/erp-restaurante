import test from "node:test";
import assert from "node:assert/strict";
import { cardapioDeVendas } from "./promocoes.mjs";
import { canaisDoRelatorio, htmlDoRelatorio, montarRelatorio, qtdTxt } from "./relatorio-precificacao.mjs";

const IFOOD = { id: "ifood", nome: "iFood", comissao_pct: 12, taxa_pagamento_pct: 3.2, ativo: true };
const BALCAO = { id: "balcao", nome: "Balcão", comissao_pct: 0, taxa_pagamento_pct: 0, ativo: true };
const K99 = { id: "99food", nome: "99", comissao_pct: 8.9, taxa_pagamento_pct: 3.2, ativo: true };
const CANAIS = [IFOOD, K99, BALCAO];

// O mesmo que useCardapio monta: as linhas do cardápio em cada app.
function porCanalDe(precos) {
  return new Map(CANAIS.map((c) => {
    const catalogo = { marmita: [{ id: "m1", nome: "Frango grelhado", preco: precos[c.id], custo: 15, categoria: "Marmitas" }], bebida: [], sobremesa: [] };
    const linhas = cardapioDeVendas({ catalogo, canal: c, tributosPct: 6, metaPct: 15, marmitas: [{ id: "m1", nome_receita: "Frango grelhado", categoria: "Marmitas" }] })
      .map((l) => ({ ...l, ficha: { id: "f1", codigo: "M01", imagem: "" } }));
    return [c.id, { linhas }];
  }));
}
const CUSTOS = new Map([["f1", {
  linhas: [{ tipo: "ingrediente", nome: "Peito de frango", quantidade: 0.18, unidade: "kg", custo: 6.3 }, { tipo: "pre_preparo", nome: "Arroz branco", quantidade: 0.2, unidade: "kg", custo: 1.2 }],
  linhasEmbalagens: [{ nome: "Marmita 750 ml", quantidade: 1, custo: 1.5 }],
  alimentos: 6.3, prePreparos: 1.2, embalagens: 1.5, total: 9, completo: true, pendencias: [],
}]]);

test("escolher apps: todos, alguns ou um (inclusive balcão)", () => {
  assert.deepEqual(canaisDoRelatorio(CANAIS, "todos").map((c) => c.id), ["ifood", "99food", "balcao"]);
  assert.deepEqual(canaisDoRelatorio(CANAIS, ["balcao", "ifood"]).map((c) => c.id), ["ifood", "balcao"]);
  assert.deepEqual(canaisDoRelatorio(CANAIS, ["balcao"]).map((c) => c.id), ["balcao"]);
});

test("os números do relatório são os mesmos da tela, app por app", () => {
  const porCanal = porCanalDe({ ifood: 40, "99food": 38, balcao: 32 });
  const rel = montarRelatorio({ canais: CANAIS, escolhidos: ["ifood", "balcao"], porCanal, custos: CUSTOS });
  assert.equal(rel.itens.length, 1);
  const [it] = rel.itens;
  assert.deepEqual(it.porApp.map((a) => a.canal), ["iFood", "Balcão"]);
  for (const a of it.porApp) {
    const tela = porCanal.get(a.canalId).linhas[0];
    assert.equal(a.preco, tela.precoPago);
    assert.equal(a.lucro, tela.lucro);
    assert.equal(a.cascata.at(-1).id, "lucro");
    assert.equal(a.cascata.at(-1).valor, tela.lucro);
  }
  // iFood tem comissão e maquininha; balcão não tem taxa
  assert.deepEqual(it.porApp[0].taxas.map((t) => t.rotulo), ["Comissão do app", "Maquininha e pagamento"]);
  assert.equal(it.porApp[1].taxas.length, 0);
  // ficha: ingredientes e embalagem separados
  assert.equal(it.ficha.alimentos, 7.5);
  assert.equal(it.ficha.embalagensTotal, 1.5);
});

test("sem preço num app: diz que falta, não inventa", () => {
  const rel = montarRelatorio({ canais: CANAIS, escolhidos: "todos", porCanal: porCanalDe({ ifood: 40, "99food": 0, balcao: 32 }), custos: CUSTOS });
  const a99 = rel.itens[0].porApp.find((a) => a.canalId === "99food");
  assert.equal(a99.semPreco, true);
  assert.equal(a99.lucro, null);
  const html = htmlDoRelatorio(rel, { empresa: "Sel de Estrela", data: "22/11/2026" });
  assert.match(html, /sem preço/);
  assert.match(html, /Precificação do delivery/);
  assert.match(html, /Peito de frango/);
  assert.match(html, /180 g/);
  assert.match(html, /<span class="pct">\(100,00%\)<\/span>/);
  assert.match(html, /Do preço ao lucro/);
  assert.match(html, /<th colspan="3" class="app">iFood<\/th>/);
  assert.match(html, /<th>Preço<\/th><th>Lucro<\/th><th>%<\/th>/);
  assert.doesNotMatch(html, /NaN|undefined/);
});

test("escapa texto vindo do cadastro", () => {
  const porCanal = porCanalDe({ ifood: 40, "99food": 38, balcao: 32 });
  porCanal.forEach((v) => { v.linhas[0].nome = "<script>x</script>"; });
  const html = htmlDoRelatorio(montarRelatorio({ canais: CANAIS, porCanal, custos: CUSTOS }));
  assert.doesNotMatch(html, /<script>x/);
});

test("quantidades em gramas (e ml)", () => {
  assert.equal(qtdTxt(0.18, "kg"), "180 g");
  assert.equal(qtdTxt(0.0255, "kg"), "25,5 g");
  assert.equal(qtdTxt(120, "g"), "120 g");
  assert.equal(qtdTxt(0.02, "l"), "20 ml");
  assert.equal(qtdTxt(2, "un"), "2 un");
  assert.equal(qtdTxt(null, "kg"), "—");
});
