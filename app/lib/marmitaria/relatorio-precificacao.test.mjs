import test from "node:test";
import assert from "node:assert/strict";
import { cardapioDeVendas } from "./promocoes.mjs";
import { canaisDoRelatorio, htmlDoRelatorio, montarRelatorio, qtdTxt, secaoDoItem, secoesComItens } from "./relatorio-precificacao.mjs";

const IFOOD = { id: "ifood", nome: "iFood", comissao_pct: 12, taxa_pagamento_pct: 3.2, ativo: true };
const BALCAO = { id: "balcao", nome: "Balcão", comissao_pct: 0, taxa_pagamento_pct: 0, ativo: true };
const K99 = { id: "99food", nome: "99", comissao_pct: 8.9, taxa_pagamento_pct: 3.2, ativo: true };
const CANAIS = [IFOOD, K99, BALCAO];

// O mesmo que useCardapio monta: as linhas do cardápio em cada app.
function porCanalDe(precos, embutidos = null) {
  return new Map(CANAIS.map((c) => {
    const catalogo = { marmita: [{ id: "m1", nome: "Frango grelhado", preco: precos[c.id], custo: 15, categoria: "Marmitas" }], bebida: [], sobremesa: [] };
    const linhas = cardapioDeVendas({ catalogo, canal: c, tributosPct: 6, metaPct: 15, embutidos, marmitas: [{ id: "m1", nome_receita: "Frango grelhado", categoria: "Marmitas" }] })
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
  assert.match(html, /<th colspan="3" class="app">iFood<\/th>/);
  assert.match(html, /<th>Preço de venda<\/th><th>Lucro<\/th><th>%<\/th>/);
  assert.match(html, /Do custo ao lucro \(1 unidade\)/);
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

test("equipe, custos fixos e variáveis abertos item a item", () => {
  const embutidos = { completo: true, faltando: [], cmoPorMarmita: 4, fixosPorMarmita: 3, proLaborePorMarmita: 1, marmitasMes: 1000,
    cmoPartes: [{ nome: "Equipe fixa", valor: 3000 }, { nome: "Extras e diárias", valor: 1000 }],
    fixosLinhas: [{ nome: "Aluguel", valor: 1500 }, { nome: "Energia", valor: 500 }, { nome: "Pró-labore", valor: 1000 }],
    variaveisLinhas: [] };
  const porCanal = porCanalDe({ ifood: 40, "99food": 38, balcao: 32 }, embutidos);
  const rel = montarRelatorio({ canais: CANAIS, porCanal, custos: CUSTOS, embutidos });
  assert.deepEqual(rel.rateio.partes.fixos.map((x) => x.nome), ["Aluguel", "Energia"]);
  const html = htmlDoRelatorio(rel);
  assert.match(html, /<tr class="sub"><td>Equipe fixa<\/td>/);
  assert.match(html, /<tr class="sub"><td>Extras e diárias<\/td>/);
  assert.match(html, /<tr class="sub"><td>Aluguel<\/td>/);
});

test("pratos, bebidas e sobremesas separados pela categoria; só o que existe", () => {
  assert.equal(secaoDoItem({ secao: "marmitas", categoria: "Marmitas" }), "pratos");
  assert.equal(secaoDoItem({ secao: "marmitas", categoria: "Sucos" }), "bebidas");
  assert.equal(secaoDoItem({ secao: "marmitas", categoria: "Sobremesas" }), "sobremesas");
  assert.equal(secaoDoItem({ secao: "combos" }), "combos");
  assert.deepEqual(secoesComItens([{ secao: "marmitas", categoria: "Marmitas" }, { secao: "marmitas", categoria: "Bebidas" }]).map((x) => x.id), ["pratos", "bebidas"]);
  const porCanal = porCanalDe({ ifood: 40, "99food": 38, balcao: 32 });
  porCanal.forEach((v) => { v.linhas.push({ ...v.linhas[0], id: "m-b1", nome: "Suco de cajá", categoria: "Bebidas" }); });
  const rel = montarRelatorio({ canais: CANAIS, porCanal, custos: CUSTOS, secoes: ["bebidas"] });
  assert.deepEqual(rel.itens.map((i) => [i.nome, i.tipo]), [["Suco de cajá", "Bebida"]]);
});
