import test from "node:test";
import assert from "node:assert/strict";
import {
  numeroBR, plataformaDoTexto, pesoDoTexto, componentesDaDescricao, cardapioDoOcr, resumoDoCardapio,
  compararComNossas, textoDaComparacao, linhasDaComparacao, linhasDosAdicionais, nossosAdicionaisDaConfig,
} from "./concorrentes.mjs";

test("números do jeito que o cardápio escreve", () => {
  assert.equal(numeroBR("R$ 24,90"), 24.9);
  assert.equal(numeroBR("1.234,50"), 1234.5);
  assert.equal(numeroBR("24.90"), 24.9);
  assert.equal(numeroBR(""), null);
  assert.equal(numeroBR("grátis"), null);
  assert.equal(numeroBR(-3), null);
});

test("plataforma pelo texto", () => {
  assert.equal(plataformaDoTexto("iFood"), "ifood");
  assert.equal(plataformaDoTexto("i food"), "ifood");
  assert.equal(plataformaDoTexto("99 Food"), "99food");
  assert.equal(plataformaDoTexto("WhatsApp"), "whatsapp");
  assert.equal(plataformaDoTexto("loja"), null);
});

test("peso só quando escrito (ml não é peso)", () => {
  assert.equal(pesoDoTexto("Marmita G 500g"), 500);
  assert.equal(pesoDoTexto("Marmitex", "serve 1 pessoa, 1,2 kg"), 1200);
  assert.equal(pesoDoTexto("Suco 500 ml"), null);
  assert.equal(pesoDoTexto("Marmita grande"), null);
});

test("o que vem no prato pela descrição", () => {
  assert.deepEqual(componentesDaDescricao("Acompanha: arroz, feijão, frango grelhado e salada."), ["arroz", "feijão", "frango grelhado", "salada"]);
  assert.deepEqual(componentesDaDescricao("Arroz + feijão tropeiro + bife acebolado"), ["Arroz", "feijão tropeiro", "bife acebolado"]);
  assert.deepEqual(componentesDaDescricao(""), []);
});

test("leitura dos prints vira cardápio limpo: sem preço não entra, repetido entra uma vez", () => {
  const c = cardapioDoOcr({
    estabelecimento: " Marmitaria  da Vila ", plataforma: "iFood", taxa_entrega: "R$ 6,99", pedido_minimo: "20,00", tempo_entrega: "40-50 min", avaliacao: "4,7",
    itens: [
      { tipo: "prato", categoria: "Marmitas", nome: "Marmita de frango grelhado 500g", descricao: "Arroz, feijão, frango grelhado e salada", componentes: [], preco: "24,90", preco_original: "29,90" },
      { tipo: "adicional", grupo: "Turbine", nome: "Ovo frito", preco: "3,00" },
      { tipo: "adicional", grupo: "Turbine", nome: "Ovo frito", preco: "3,00" },
      { tipo: "adicional", grupo: "Turbine", nome: "Bacon", preco: "" },
      { tipo: "PRATO", nome: "Feijoada", preco: "32", serve_pessoas: "2", peso_g: "1 kg" },
      { tipo: "xyz", nome: "Coca lata", preco: "6,50", preco_original: "5" },
    ],
  });
  assert.equal(c.concorrente, "Marmitaria da Vila");
  assert.equal(c.plataforma, "ifood");
  assert.deepEqual([c.taxa_entrega, c.pedido_minimo, c.avaliacao, c.tempo_entrega], [6.99, 20, 4.7, "40-50 min"]);
  assert.equal(c.itens.length, 4);
  assert.deepEqual(c.itens[0].componentes, ["Arroz", "feijão", "frango grelhado", "salada"]);
  assert.equal(c.itens[0].peso_g, 500);
  assert.equal(c.itens[0].preco_original, 29.9);
  assert.equal(c.itens[2].tipo, "prato");
  assert.equal(c.itens[2].serve_pessoas, 2);
  assert.equal(c.itens[2].peso_g, 1000, "\"1 kg\" escrito vira 1000 g");
  assert.equal(c.itens[3].tipo, "outro");
  assert.equal(c.itens[3].preco_original, undefined, "riscado menor que o preço não vale");
  assert.equal(cardapioDoOcr({ itens: [{ nome: "Bacon", preco: "" }] }), null);
  assert.equal(cardapioDoOcr(null), null);
});

test("resumo: quantos de cada e faixa dos pratos", () => {
  const r = resumoDoCardapio({ itens: [{ tipo: "prato", preco: 20 }, { tipo: "prato", preco: 30 }, { tipo: "prato", preco: 25 }, { tipo: "adicional", preco: 3 }] });
  assert.equal(r.prato, 3);
  assert.equal(r.adicional, 1);
  assert.deepEqual(r.faixaPratos, { min: 20, mediana: 25, max: 30, n: 3 });
  assert.equal(resumoDoCardapio({ itens: [] }).faixaPratos, null);
});

const leitura = {
  concorrente: "Marmitaria da Vila", plataforma: "ifood", observado_em: "2026-11-17",
  itens: [
    { tipo: "prato", nome: "Marmita de frango grelhado", componentes: ["arroz", "feijão", "frango grelhado", "salada"], peso_g: 500, preco: 24.9 },
    { tipo: "prato", nome: "Marmita de carne de panela", componentes: ["arroz", "feijão", "carne de panela", "farofa"], preco: 28.9 },
    { tipo: "prato", nome: "Feijoada completa", componentes: ["arroz", "feijoada", "couve", "laranja"], preco: 35 },
    { tipo: "adicional", grupo: "Turbine", nome: "Ovo frito", preco: 3 },
    { tipo: "adicional", grupo: "Turbine", nome: "Porção de batata frita", preco: 9.9 },
    { tipo: "bebida", nome: "Coca lata", preco: 6.5 },
  ],
};
const nossas = [
  { id: "a", nome: "Frango grelhado", preco: 27.9, peso_g: 450, componentes: ["Arroz branco", "Feijão", "Peito de frango grelhado", "Salada"] },
  { id: "b", nome: "Carne de panela", preco: 26, componentes: ["Arroz branco", "Feijão", "Carne de panela"] },
  { id: "c", nome: "Escondidinho de mandioca", preco: null, componentes: ["Mandioca", "Carne seca"] },
];

test("compara nossas marmitas com os pratos parecidos deles", () => {
  const cmp = compararComNossas({ nossas, nossosAdicionais: [{ nome: "Ovo", preco: 2.5 }, { nome: "Linguiça", preco: 5 }], leitura });
  const [a, b, c] = cmp.pares;
  assert.equal(a.par.nome, "Marmita de frango grelhado");
  assert.equal(a.diferenca, 3);
  assert.equal(a.diferencaPct, 12);
  assert.equal(a.nosso100g, 6.2);
  assert.equal(a.deles100g, 4.98);
  assert.equal(b.par.nome, "Marmita de carne de panela");
  assert.equal(b.diferenca, -2.9);
  assert.deepEqual(b.soDeles, ["farofa"]);
  assert.equal(c.par, null);
  assert.equal(cmp.semPar.map((i) => i.nome).join(), "Feijoada completa");
  assert.equal(cmp.maisCaras, 1);
  assert.equal(cmp.maisBaratas, 1);
  // adicionais
  assert.equal(cmp.adicionais.lista[0].nosso.nome, "Ovo");
  assert.equal(cmp.adicionais.lista[0].diferenca, -0.5);
  assert.deepEqual(cmp.adicionais.soEles.map((x) => x.nome), ["Porção de batata frita"]);
  assert.deepEqual(cmp.adicionais.soNos.map((x) => x.nome), ["Linguiça"]);
  const t = textoDaComparacao(cmp);
  assert.match(t, /Marmitaria da Vila no iFood \(cardápio visto em 17\/11\): 3 pratos de R\$\s?24,90 a R\$\s?35,00, 2 adicionais/);
  assert.match(t, /1 das nossas está mais cara, 1 está mais barata/);
  assert.match(t, /Eles oferecem 1 adicional que nós não temos: Porção de batata frita/);
  const l = linhasDaComparacao(cmp);
  assert.match(l[0].valor, /\+R\$\s?3,00.*100 g/);
  assert.match(l[2].valor, /sem preço · sem prato parecido/);
  assert.equal(linhasDosAdicionais(cmp).length, 3);
});

test("sem nossos adicionais cadastrados: DADOS INSUFICIENTES do nosso lado, lista os deles", () => {
  const cmp = compararComNossas({ nossas, nossosAdicionais: null, leitura });
  assert.equal(cmp.adicionais, null);
  assert.match(textoDaComparacao(cmp), /DADOS INSUFICIENTES dos nossos adicionais/);
  assert.equal(linhasDosAdicionais(cmp).length, 2);
});

test("sem marmita nossa: diz que falta dado, não inventa", () => {
  const cmp = compararComNossas({ nossas: [], nossosAdicionais: null, leitura });
  assert.match(textoDaComparacao(cmp), /DADOS INSUFICIENTES do nosso lado/);
});

test("nossos adicionais vêm dos grupos do cardápio digital", () => {
  assert.equal(nossosAdicionaisDaConfig({}), null);
  assert.deepEqual(nossosAdicionaisDaConfig({ cardapio_digital: { grupos: [
    { nome: "Turbine", tipo: "adicional", opcoes: [{ nome: "Ovo", preco: 2.5 }, { nome: "Grátis", preco: 0 }] },
    { nome: "Retirar", tipo: "retirar", opcoes: [{ nome: "Cebola", preco: 0 }] },
  ] } }), [{ nome: "Ovo", preco: 2.5, grupo: "Turbine" }]);
});
