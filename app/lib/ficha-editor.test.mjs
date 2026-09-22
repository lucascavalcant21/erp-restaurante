import test from "node:test";
import assert from "node:assert/strict";
import {
  itemDeIngrediente, itemDeOpcao, opcoesDeIngrediente, buscarOpcoes, custoDosItens,
  rendimentoEhAutomatizavel, estadoInicialDoEditor, precoSuspeito,
} from "./ficha-editor.mjs";
import { quantidadeParaGravar, comCustoDeEmbalagens, custoPorPorcaoDaFicha } from "./ficha-modelo.mjs";
import { custoDeProduzirFicha } from "./ficha-calculos.mjs";

const arroz = { id: "i-arroz", nome: "Arroz", unidade_medida: "kg", custo_unitario: 6 };
const sal = { id: "i-sal", nome: "Sal", unidade_medida: "g", custo_unitario: 0.002 };
const limao = { id: "i-limao", nome: "Limão", unidade_medida: "un", custo_unitario: 0.5 };

const base = {
  id: "b1", departamento: "cozinha", eh_base: true, tipo_base: "pre", nome_receita: "Arroz branco",
  rendimento_porcoes: 2, rendimento_unidade: "kg",
  fichas_ingredientes: [{ insumo_id: arroz.id, quantidade: 1, insumos: arroz }, { insumo_id: sal.id, quantidade: 20, insumos: sal }],
};
const molho = {
  id: "b2", departamento: "cozinha", eh_base: true, nome_receita: "Molho que usa o arroz",
  rendimento_porcoes: 1, rendimento_unidade: "kg", fichas_ingredientes: [{ subficha_id: "b1", quantidade: 0.1 }],
};
const prato = {
  id: "p1", departamento: "cozinha", eh_base: false, nome_receita: "Prato", rendimento_porcoes: 0.3, rendimento_unidade: "kg",
  modo_preparo: "", padrao_montagem: "Arroz à esquerda",
  fichas_ingredientes: [{ subficha_id: "b1", quantidade: 0.3 }],
};
const todas = [base, molho, prato];

test("insumo em g: o editor trabalha em kg e grava de volta em g (não encolhe)", () => {
  const item = itemDeIngrediente(base.fichas_ingredientes[1], todas);
  assert.equal(item.unidade, "kg");
  assert.equal(item.unidade_insumo, "g");
  assert.equal(item.quantidade, 0.02);
  assert.equal(quantidadeParaGravar(item.quantidade, item.unidade_insumo), 20);
  // Ida e volta repetida não muda nada.
  let gravado = 20;
  for (let i = 0; i < 5; i++) gravado = quantidadeParaGravar(itemDeIngrediente({ quantidade: gravado, insumos: sal }, todas).quantidade, "g");
  assert.equal(gravado, 20);
});

test("pré-preparo como ingrediente: quantidade na unidade do rendimento e custo proporcional", () => {
  const item = itemDeIngrediente(prato.fichas_ingredientes[0], todas);
  assert.equal(item.tipo, "base");
  assert.equal(item.nome, "Arroz branco");
  assert.equal(item.unidade, "kg");
  assert.equal(item.modo, "sub");
  // Lote de 2 kg custa 6 + 0,04 = 6,04 → 3,02/kg
  assert.equal(item.custo_unitario.toFixed(2), "3.02");
  assert.equal(custoDosItens([item]).toFixed(3), (3.02 * 0.3).toFixed(3));
  assert.equal(custoDosItens([item]).toFixed(6), custoDeProduzirFicha(prato, todas).toFixed(6));
});

test("opções de ingrediente: insumos, pré-preparos e embalagens; sem ciclo", () => {
  const opcoes = opcoesDeIngrediente({ insumos: [arroz, sal], embalagens: [{ id: "e1", nome: "Marmita", unidade_medida: "un" }], fichas: todas, fichaId: "b1" });
  const valores = opcoes.map(o => o.valor);
  assert.ok(valores.includes("insumo:i-arroz"));
  assert.ok(valores.includes("insumo:e1"));
  // b1 não pode conter a si mesmo nem o molho que já usa b1.
  assert.ok(!valores.includes("base:b1"));
  assert.ok(!valores.includes("base:b2"));
  // Prato novo pode usar qualquer pré-preparo; prato nunca vira ingrediente.
  const doPrato = opcoesDeIngrediente({ fichas: todas }).map(o => o.valor);
  assert.deepEqual(doPrato, ["base:b1", "base:b2"]);
  assert.equal(buscarOpcoes(opcoesDeIngrediente({ insumos: [{ id: "x", nome: "Açúcar" }] }), "acucar").length, 1);
});

test("item escolhido na busca", () => {
  assert.equal(itemDeOpcao("insumo:i-limao", { insumos: [limao] }, 2).quantidade, 2);
  assert.equal(itemDeOpcao("insumo:i-limao", { insumos: [limao] }).modo, "base");
  assert.equal(itemDeOpcao("base:b1", { fichas: todas }).tipo, "base");
  assert.equal(itemDeOpcao("base:nao-existe", { fichas: todas }), null);
});

test("rendimento automático só na unidade do setor", () => {
  assert.equal(rendimentoEhAutomatizavel({ id: null, departamento: "cozinha" }), true);
  assert.equal(rendimentoEhAutomatizavel({ id: "x", departamento: "cozinha", rendimento_unidade: "kg" }), true);
  assert.equal(rendimentoEhAutomatizavel({ id: "x", departamento: "bar", rendimento_unidade: "l" }), true);
  // Ficha antiga em g, porções ou unidades mantém a unidade: os pratos que a
  // usam têm quantidades nessa unidade.
  assert.equal(rendimentoEhAutomatizavel({ id: "x", departamento: "cozinha", rendimento_unidade: "g" }), false);
  assert.equal(rendimentoEhAutomatizavel({ id: "x", departamento: "cozinha", rendimento_unidade: "porcao" }), false);
});

test("ficha antiga abre no editor com o que tinha", () => {
  const e = estadoInicialDoEditor({ departamento: "cozinha", ficha: prato, todasFichas: todas, complementos: {} });
  // O padrão de montagem antigo vira o texto de montagem.
  assert.equal(e.form.modo_preparo, "Arroz à esquerda");
  assert.equal(e.itens.length, 1);
  assert.equal(e.autoRendimento, true);
  // Prato com peso de porção não tem o rendimento mexido sozinho.
  assert.equal(estadoInicialDoEditor({ departamento: "cozinha", ficha: { ...prato, peso_porcao_g: 250 }, todasFichas: todas }).autoRendimento, false);
  // Pré-preparo existente só soma se a pessoa pedir.
  assert.equal(estadoInicialDoEditor({ departamento: "cozinha", ficha: base, todasFichas: todas }).autoRendimento, false);
  const comArmazenamento = estadoInicialDoEditor({
    departamento: "cozinha", ficha: base, todasFichas: todas,
    complementos: { armazenamento: { recipiente: "GN", forma: "Refrigerado", validade_refrigerado_dias: 3 }, equipamentos: [{ nome: "Panela" }], alergenicos: [{ alergenico: "Leite" }] },
  });
  assert.deepEqual(comArmazenamento.armazenamento, { recipiente: "GN", forma: "Refrigerado", local_armazenamento: "", validade_dias: "3" });
  assert.deepEqual(comArmazenamento.equipamentos, ["Panela"]);
  assert.deepEqual(comArmazenamento.alergenicos, ["Leite"]);
});

test("ficha nova e rascunho da IA", () => {
  const nova = estadoInicialDoEditor({ departamento: "bar" });
  assert.equal(nova.form.id, null);
  assert.equal(nova.form.departamento, "bar");
  assert.equal(nova.form.rendimento_unidade, "l");
  assert.equal(nova.autoRendimento, true);
  const ia = estadoInicialDoEditor({ departamento: "cozinha", rascunho: { nome_receita: "Tucupi", tempo_preparo: 30, armazenamento: { recipiente: "GN", forma: "Refrigerado", validade_dias: "" }, equipamentos: ["Panela"], itens: [{ unidade: "kg", quantidade: 0.5 }, { unidade: "l", quantidade: 1 }] } });
  // O rascunho já vem com ingredientes: o rendimento é a soma deles (1,5 kg).
  assert.equal(ia.form.rendimento_porcoes, "1.5");
  assert.equal(ia.form.rendimento_unidade, "kg");
  assert.equal(ia.form.nome_receita, "Tucupi");
  assert.equal(ia.form.tempo_preparo, "30");
  assert.equal(ia.armazenamento.recipiente, "GN");
  assert.deepEqual(ia.equipamentos, ["Panela"]);
});

test("preço por grama suspeito", () => {
  assert.equal(precoSuspeito({ unidade: "g", custo_unitario: 2 }), true);
  assert.equal(precoSuspeito({ unidade: "kg", custo_unitario: 2 }), false);
});

test("CMV: embalagem do cardápio e custo por porção como na listagem", () => {
  const produtos = [{ ficha_id: "p1", embalagens: [{ embalagem_id: "e1", qtd: 2 }] }];
  const [comEmb] = comCustoDeEmbalagens([prato], produtos, [{ id: "e1", preco_unitario: 0.5 }]);
  assert.equal(comEmb.custo_embalagens_total, 1); // 2 × 0,50 × max(1, 0,3)
  const semPeso = custoPorPorcaoDaFicha(comEmb, todas);
  assert.equal(semPeso.custoPorcao, semPeso.custoTotal); // o prato inteiro é a porção
  const porPeso = custoPorPorcaoDaFicha({ ...comEmb, rendimento_porcoes: 1, peso_porcao_g: 250 }, todas);
  assert.equal(porPeso.custoPorcao.toFixed(6), (porPeso.custoTotal / 4).toFixed(6));
  const porContagem = custoPorPorcaoDaFicha({ ...comEmb, rendimento_porcoes: 4, rendimento_unidade: "porcao" }, todas);
  assert.equal(porContagem.custoPorcao.toFixed(6), (porContagem.custoTotal / 4).toFixed(6));
});
