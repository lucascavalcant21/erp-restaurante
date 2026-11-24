import test from "node:test";
import assert from "node:assert/strict";
import {
  sugestaoIndice, rendimentoDaProducao, producaoParaTotal, producaoDaFicha, producaoDoEvento,
  fichasDosEventos, normalizarProducao, usosDaProducao, naBase,
} from "./janta-producao.mjs";
import { cardapioDoDia, normalizarJanta } from "./janta-funcionarios.mjs";

const feijao = (extra = {}) => normalizarProducao({
  id: "fp-feijao", nome: "Feijão",
  ingredientes: [
    { nome: "Feijão carioca", quantidade: 1, unidade: "kg", principal: true },
    { nome: "Alho", quantidade: 20, unidade: "g" },
    { nome: "Água", quantidade: 3, unidade: "L" },
  ],
  indice: 3, preparo: "Cozinhe na pressão.", ...extra,
});

test("exemplo do dono: rende 3 kg, preciso de 2,5 kg → a receita encolhe", () => {
  const rend = rendimentoDaProducao(feijao());
  assert.equal(rend.valor, 3000);
  assert.equal(rend.natureza, "ESTIMATIVA"); // cru × índice
  const r = producaoParaTotal(feijao(), 2500, "g");
  assert.equal(r.status, "ok");
  assert.equal(r.fator, 0.8333);
  assert.equal(r.natureza, "ESTIMATIVA");
  assert.match(r.ingredientes[0].quantidade, /833/);
  assert.match(r.ingredientes[1].quantidade, /16,67 g/);
  assert.match(r.ingredientes[2].quantidade, /2,5 L/);
});

test("rendimento pesado vale mais que o índice e é REAL", () => {
  const p = feijao({ rendimento: 3.2, rendimento_unidade: "kg" });
  const rend = rendimentoDaProducao(p);
  assert.equal(rend.valor, 3200);
  assert.equal(rend.natureza, "REAL");
  assert.equal(producaoParaTotal(p, 1600, "g").fator, 0.5);
  assert.equal(producaoParaTotal(p, 1600, "g").natureza, "REAL");
});

test("sem rendimento nem índice: DADOS INSUFICIENTES com o motivo", () => {
  const p = feijao({ indice: "" });
  assert.equal(rendimentoDaProducao(p).valor, null);
  const r = producaoParaTotal(p, 2500, "g");
  assert.equal(r.status, "insuficiente");
  assert.match(r.motivo, /índice/);
  assert.equal(producaoParaTotal(feijao(), 0, "g").status, "insuficiente");
});

test("porção em unidades precisa de ficha que rende em unidades", () => {
  const almondega = normalizarProducao({ nome: "Almôndega", ingredientes: [{ nome: "Carne moída", quantidade: 1, unidade: "kg", principal: true }], rendimento: 40, rendimento_unidade: "un" });
  assert.equal(producaoParaTotal(almondega, 60, "un").fator, 1.5);
  assert.equal(producaoParaTotal(almondega, 600, "g").status, "insuficiente");
  assert.equal(producaoParaTotal(feijao(), 10, "un").status, "insuficiente");
});

test("feijão em ml e ficha em g: conta 1 ml ≈ 1 g e marca ESTIMATIVA", () => {
  const p = feijao({ rendimento: 3, rendimento_unidade: "kg" });
  const r = producaoParaTotal(p, 1500, "ml");
  assert.equal(r.fator, 0.5);
  assert.equal(r.natureza, "ESTIMATIVA");
});

test("sugestões de índice da literatura (UFV)", () => {
  assert.equal(sugestaoIndice("Arroz branco").indice, 2.86);
  assert.equal(sugestaoIndice("arroz integral").indice, 2.39);
  assert.equal(sugestaoIndice("Feijão preto").indice, 1.89);
  assert.equal(sugestaoIndice("Feijao carioca").indice, 1.81);
  assert.equal(sugestaoIndice("Macarrão parafuso").indice, 2.44);
  assert.equal(sugestaoIndice("Carne moída").indice, 0.74);
  assert.equal(sugestaoIndice("Frango desfiado").indice, 0.52);
  assert.equal(sugestaoIndice("Ovos").indice, 0.82);
  assert.equal(sugestaoIndice("Alface"), null);
});

test("trazer ficha técnica do sistema: cópia com rendimento e principal", () => {
  const ficha = {
    id: "f1", nome_receita: "Arroz", rendimento_porcoes: 6, rendimento_unidade: "kg", modo_preparo: "Refogue.",
    fichas_ingredientes: [
      { quantidade: 2, insumos: { nome: "Arroz agulhinha", unidade_medida: "kg" } },
      { quantidade: 50, insumos: { nome: "Óleo", unidade_medida: "ml" } },
    ],
  };
  const p = producaoDaFicha(ficha, { tipo: "marmita", rotulo: "Marmitas" });
  assert.equal(p.origem.tipo, "marmita");
  assert.equal(p.origem.ficha_id, "f1");
  assert.equal(p.rendimento, 6);
  assert.equal(p.rendimento_unidade, "kg");
  assert.equal(p.ingredientes[0].principal, true);
  assert.equal(p.ingredientes[1].unidade, "ml");
  assert.equal(p.indice, ""); // tem rendimento: não sugere índice
  // ficha em porções sem peso: sem rendimento, sugere o índice do arroz
  const semPeso = producaoDaFicha({ ...ficha, rendimento_unidade: "porcao" });
  assert.equal(semPeso.rendimento, "");
  assert.equal(semPeso.indice, 2.86);
  assert.equal(rendimentoDaProducao(semPeso).valor, 2000 * 2.86);
});

test("trazer ficha exclusiva de evento, sem repetir nomes", () => {
  const eventos = [
    { nome: "Casamento", operacao_detalhes: { orcamento: { cardapio: [
      { id: "x1", origem: "exclusiva", nome: "Escondidinho", peso_porcao_g: 300, ingredientes: [{ nome: "Mandioca", quantidade: 150, unidade_uso: "g" }, { nome: "Carne seca", quantidade: 80, unidade_uso: "g" }] },
      { id: "x2", origem: "sistema", ficha_id: "f1", nome: "Arroz" },
    ] } } },
    { nome: "Aniversário", operacao_detalhes: { orcamento: { cardapio: [{ id: "x3", origem: "exclusiva", nome: "escondidinho", ingredientes: [{ nome: "A", quantidade: 1 }] }] } } },
  ];
  const lista = fichasDosEventos(eventos);
  assert.equal(lista.length, 1);
  const p = producaoDoEvento(lista[0].item, lista[0].evento);
  assert.equal(p.origem.rotulo, "Eventos · Casamento");
  assert.equal(p.rendimento, 300);
  assert.equal(p.ingredientes.find((i) => i.principal).nome, "Mandioca");
});

test("a janta usa a ficha de produção: total do dia refaz a receita", () => {
  const janta = normalizarJanta({
    pessoas_padrao: 10,
    producao: [feijao()],
    fixos: [{ id: "i1", nome: "Feijão", modo: "g", porcao: 250, producao_id: "fp-feijao" }],
  });
  const c = cardapioDoDia(janta, "seg");
  const item = c.pratos[0].itens[0];
  assert.equal(item.total, 2500);
  assert.equal(item.receita.status, "ok");
  assert.equal(item.receita.fator, 0.8333);
  assert.equal(item.cru, null); // a receita já diz o cru
  // ficha apagada
  const sem = cardapioDoDia({ ...janta, producao: [] }, "seg");
  assert.equal(sem.pratos[0].itens[0].receita.status, "insuficiente");
  assert.deepEqual(usosDaProducao(janta, "fp-feijao"), ["Todo dia"]);
});

test("normalizar: um só principal e unidades válidas", () => {
  const p = normalizarProducao({ ingredientes: [{ principal: true, unidade: "KG" }, { principal: true, unidade: "xícara" }] });
  assert.equal(p.ingredientes.filter((i) => i.principal).length, 1);
  assert.equal(p.ingredientes[0].unidade, "kg");
  assert.equal(p.ingredientes[1].unidade, "g");
  assert.deepEqual(naBase(2, "L"), { q: 2000, base: "ml" });
});

test("custo da ficha de produção e da janta do dia pelos preços do cadastro", async () => {
  const { custoDaProducao } = await import("./janta-producao.mjs");
  const insumos = new Map([
    ["f1", { id: "f1", nome: "Feijão carioca", unidade_medida: "kg", preco_normalizado: 8 }],
    ["a1", { id: "a1", nome: "Alho", unidade_medida: "kg", preco_normalizado: 30 }],
  ]);
  const p = normalizarProducao({
    id: "fp", nome: "Feijão", indice: 3,
    ingredientes: [
      { nome: "Feijão carioca", quantidade: 1, unidade: "kg", principal: true, insumo_id: "f1" },
      { nome: "Alho", quantidade: 20, unidade: "g", insumo_id: "a1" },
      { nome: "Água", quantidade: 3, unidade: "L" },
    ],
  });
  const c = custoDaProducao(p, insumos);
  assert.equal(c.custo, 8.6); // 8 + 0,60; água fica fora sem acusar falta de preço
  assert.equal(c.natureza, "REAL");
  const janta = normalizarJanta({ pessoas_padrao: 10, producao: [p], fixos: [{ id: "i1", nome: "Feijão", modo: "g", porcao: 300, producao_id: "fp" }] });
  const d = cardapioDoDia(janta, "seg", { insumos });
  assert.equal(d.custo, 8.6); // 3 kg pronto = a ficha inteira
  assert.equal(d.custoPorPessoa, 0.86);
  assert.equal(d.natureza, "REAL");
  const semPreco = custoDaProducao(normalizarProducao({ ingredientes: [{ nome: "Sal", quantidade: 10, unidade: "g" }] }), insumos);
  assert.equal(semPreco.custo, null);
});

test("ingrediente de ficha de outra unidade acha o preço pelo nome", async () => {
  const { custoDaProducao, mapaDeInsumos } = await import("./janta-producao.mjs");
  const m = mapaDeInsumos([{ id: "local", nome: "Arroz Agulhinha", unidade_medida: "kg", preco_normalizado: 6 }]);
  const p = normalizarProducao({ ingredientes: [{ nome: "arroz agulhinha", quantidade: 2, unidade: "kg", insumo_id: "de-outra-unidade" }] });
  assert.equal(custoDaProducao(p, m).custo, 12);
});
