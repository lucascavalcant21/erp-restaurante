import test from "node:test";
import assert from "node:assert/strict";
import {
  itemDeIngrediente, itemDeOpcao, opcoesDeIngrediente, buscarOpcoes, custoDosItens,
  rendimentoEhAutomatizavel, estadoInicialDoEditor, precoSuspeito,
} from "./ficha-editor.mjs";
import { quantidadeParaGravar, comCustoDeEmbalagens, custoPorPorcaoDaFicha, camposParaGravar } from "./ficha-modelo.mjs";
import {
  custoDeProduzirFicha, parseNumero, calculateFichaFinanceiro,
  entradasFinanceirasDaFicha, entradasFinanceirasParaEditor,
} from "./ficha-calculos.mjs";

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

test("rendimento do prato: gramas servidas, sugeridas e mantidas", () => {
  // Prato novo: a sugestão é a soma dos ingredientes em gramas, para ajustar.
  const novo = estadoInicialDoEditor({ departamento: "cozinha", tipo: "prato", rascunho: { itens: [{ unidade: "kg", quantidade: 0.3 }, { unidade: "g", quantidade: 120 }] } });
  assert.equal(novo.form.peso_final_g, "420");
  // Estimativa da IA manda sobre a soma.
  const daIA = estadoInicialDoEditor({ departamento: "cozinha", tipo: "prato", rascunho: { peso_final_g: 350, itens: [{ unidade: "kg", quantidade: 0.5 }] } });
  assert.equal(daIA.form.peso_final_g, "350");
  // Sem ingredientes ainda, fica vazio (nada de número inventado).
  assert.equal(estadoInicialDoEditor({ departamento: "cozinha", tipo: "prato" }).form.peso_final_g, "");
  // Pré-preparo novo não ganha peso final nenhum.
  assert.equal(estadoInicialDoEditor({ departamento: "cozinha", tipo: "pre_preparo", rascunho: { itens: [{ unidade: "kg", quantidade: 2 }] } }).form.peso_final_g, "");
  // Prato existente reabre com o que está gravado, sem recalcular.
  const existente = estadoInicialDoEditor({ departamento: "cozinha", ficha: { ...prato, peso_final_g: 420 }, todasFichas: todas, complementos: {} });
  assert.equal(existente.form.peso_final_g, "420");
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

// ── Bug: card mostrava os valores e o "Editar prato" abria vazio ────────────
//
// A causa era esta função: ela montava o formulário sem a parte comercial, que
// só o card sabia montar. Os testes abaixo trancam a hidratação completa.

const pratoVendido = {
  id: "p9", departamento: "cozinha", eh_base: false, nome_receita: "Açaí 1L - farinha amarela",
  codigo: "FT-0052", categoria: "Açaí", rendimento_porcoes: 1, rendimento_unidade: "porcao",
  modo_preparo: "1. Montar no copo", imagem: "base64aqui", peso_final_g: 1000,
  custo_embalagem: 0, taxa_maquininha: 2.5, imposto_pct: 4, cmv_meta: 35, preco_venda: 50,
  fichas_ingredientes: [{ insumo_id: arroz.id, quantidade: 0.18, insumos: arroz }],
};

test("editar prato existente hidrata TODOS os campos gravados", () => {
  const produto = { ficha_id: "p9", preco_venda: 55, taxa_cartao: 3, aliquota_imposto: 5 };
  const { form, itens } = estadoInicialDoEditor({
    departamento: "cozinha", tipo: "prato", ficha: pratoVendido, todasFichas: todas, complementos: {}, produto,
  });

  assert.equal(form.id, "p9");
  assert.equal(form.codigo, "FT-0052");
  assert.equal(form.nome_receita, "Açaí 1L - farinha amarela");
  assert.equal(form.categoria, "Açaí");
  assert.equal(form.departamento, "cozinha");
  assert.equal(form.imagem, "base64aqui");
  assert.equal(form.modo_preparo, "1. Montar no copo");
  assert.equal(form.rendimento_porcoes, "1");
  assert.equal(form.rendimento_unidade, "porcao");
  assert.equal(form.peso_final_g, "1000");
  // O preço vem do Cardápio (é o que o card mostra), não da coluna da ficha.
  assert.equal(form.preco_venda, "55");
  assert.equal(form.custo_embalagem, "0");
  assert.equal(form.taxa_maquininha, "2.5");
  assert.equal(form.imposto_pct, "4");
  assert.equal(form.cmv_meta, "35");
  assert.equal(form.eh_base, false);
  // Ingredientes com nome, quantidade, unidade e id.
  assert.equal(itens.length, 1);
  assert.equal(itens[0].nome, "Arroz");
  assert.equal(itens[0].insumo_id, "i-arroz");
  assert.equal(itens[0].quantidade, 0.18);
  assert.equal(itens[0].unidade, "kg");
});

test("campo vazio no editor é herança, não zero", () => {
  // Ficha sem taxa/imposto próprios: os campos abrem vazios (o painel mostra o
  // herdado no placeholder) — gravar não congela o padrão na ficha.
  const semNada = { ...pratoVendido, taxa_maquininha: null, imposto_pct: null, custo_embalagem: null, cmv_meta: null, preco_venda: null };
  const { form } = estadoInicialDoEditor({ departamento: "cozinha", tipo: "prato", ficha: semNada, todasFichas: todas, complementos: {} });
  assert.equal(form.taxa_maquininha, "");
  assert.equal(form.imposto_pct, "");
  assert.equal(form.custo_embalagem, "");
  assert.equal(form.preco_venda, "");
  assert.equal(form.cmv_meta, "30");
  // Sem produto no Cardápio o preço cai para a coluna da ficha.
  const soFicha = estadoInicialDoEditor({ departamento: "cozinha", tipo: "prato", ficha: pratoVendido, todasFichas: todas, complementos: {} });
  assert.equal(soFicha.form.preco_venda, "50");
  // Imposto 0% é escolha, não ausência: continua 0 e não vira o padrão.
  const isento = estadoInicialDoEditor({ departamento: "cozinha", tipo: "prato", ficha: { ...pratoVendido, imposto_pct: 0 }, todasFichas: todas, complementos: {} });
  assert.equal(isento.form.imposto_pct, "0");
});

test("ficha nova nasce com os campos comerciais vazios e meta 30", () => {
  const { form } = estadoInicialDoEditor({ departamento: "cozinha", tipo: "prato" });
  assert.equal(form.preco_venda, "");
  assert.equal(form.custo_embalagem, "");
  assert.equal(form.taxa_maquininha, "");
  assert.equal(form.imposto_pct, "");
  assert.equal(form.cmv_meta, "30");
  assert.equal(form.eh_base, false);
  assert.equal(estadoInicialDoEditor({ departamento: "cozinha", tipo: "pre_preparo" }).form.eh_base, true);
});

// ── Entradas financeiras: card e editor têm de ler a mesma coisa ────────────

test("entradasFinanceirasDaFicha: ordem de precedência ficha → produto → parâmetro", () => {
  const ficha = { id: "f1", custo_embalagem: 1.2, taxa_maquininha: 2.5, imposto_pct: 4, cmv_meta: 35, preco_venda: 50 };
  const produto = { preco_venda: 55, taxa_cartao: 3, aliquota_imposto: 6 };
  const params = { taxa_maquininha: 9, imposto_pct: 9 };

  const comTudo = entradasFinanceirasDaFicha(ficha, { produto, params });
  assert.equal(comTudo.precoVenda, 55);          // o Cardápio manda no preço
  assert.equal(comTudo.taxaMaquininhaPct, 2.5);  // a ficha manda na taxa
  assert.equal(comTudo.impostoPct, 4);
  assert.equal(comTudo.custoEmbalagemPorPorcao, 1.2);
  assert.equal(comTudo.cmvMeta, 35);

  // Sem valor próprio, herda do produto; sem produto, do parâmetro; sem nada, padrão.
  const semProprio = { id: "f1" };
  assert.equal(entradasFinanceirasDaFicha(semProprio, { produto, params }).taxaMaquininhaPct, 3);
  assert.equal(entradasFinanceirasDaFicha(semProprio, { params }).taxaMaquininhaPct, 9);
  assert.equal(entradasFinanceirasDaFicha(semProprio).taxaMaquininhaPct, 2.5);
  assert.equal(entradasFinanceirasDaFicha(semProprio).impostoPct, 4);

  // 0% é escolha válida e não pode cair no padrão.
  assert.equal(entradasFinanceirasDaFicha({ imposto_pct: 0 }, { produto, params }).impostoPct, 0);
  // Pré-preparo não é vendido: não paga maquininha nem imposto.
  const ehBase = entradasFinanceirasDaFicha({ eh_base: true, taxa_maquininha: 2.5, imposto_pct: 4 });
  assert.equal(ehBase.taxaMaquininhaPct, 0);
  assert.equal(ehBase.impostoPct, 0);
  // Sem preço em lugar nenhum: zero, não NaN.
  assert.equal(entradasFinanceirasDaFicha({}).precoVenda, 0);
});

test("card e editor chegam ao mesmo resultado a partir da mesma ficha", () => {
  // Números da ficha "Açaí 1L - farinha amarela" (FT-0052) relatada pelo usuário.
  const ficha = { id: "a1", rendimento_porcoes: 1, custo_embalagem: 0, taxa_maquininha: 2.5, imposto_pct: 4 };
  const produto = { preco_venda: 55 };
  const e = entradasFinanceirasDaFicha(ficha, { produto });

  const doCard = calculateFichaFinanceiro({
    custoTotalIngredientes: 27.7, rendimentoPorcoes: ficha.rendimento_porcoes,
    custoEmbalagemPorPorcao: e.custoEmbalagemPorPorcao, precoVenda: e.precoVenda,
    taxaMaquininhaPct: e.taxaMaquininhaPct, impostoPct: e.impostoPct,
  });
  // O editor parte do formulário hidratado — os mesmos valores, em texto.
  const form = entradasFinanceirasParaEditor(ficha, produto);
  const doEditor = calculateFichaFinanceiro({
    custoTotalIngredientes: 27.7, rendimentoPorcoes: 1,
    custoEmbalagemPorPorcao: parseNumero(form.custo_embalagem),
    precoVenda: parseNumero(form.preco_venda),
    taxaMaquininhaPct: parseNumero(form.taxa_maquininha),
    impostoPct: parseNumero(form.imposto_pct),
  });

  assert.deepEqual(doEditor, doCard);
  assert.equal(doCard.custoIngredientesPorPorcao, 27.7);
  assert.equal(doCard.valorMaquininha, 1.38);
  assert.equal(doCard.valorImposto, 2.2);
  assert.equal(doCard.custoTotal, 31.28);
  assert.equal(doCard.precoVenda, 55);
  assert.equal(doCard.lucroPorPorcao, 23.72);
});

test("números do Postgres viram número, não milhar nem NaN", () => {
  const form = entradasFinanceirasParaEditor({ preco_venda: "55.00", custo_embalagem: "3.50" }, null);
  assert.equal(form.preco_venda, "55");
  assert.equal(parseNumero(form.preco_venda), 55);
  assert.equal(parseNumero(form.custo_embalagem), 3.5);
  // Digitado à brasileira no campo.
  assert.equal(parseNumero("55,00"), 55);
  assert.equal(parseNumero("1.234,56"), 1234.56);
  assert.equal(parseNumero(""), 0);
  assert.equal(parseNumero(null), 0);
});

test("editar não apaga o que já estava gravado na ficha", () => {
  // Reabrir e salvar sem mexer em nada devolve os mesmos valores ao banco:
  // era isto que quebrava quando o formulário abria vazio.
  const { form } = estadoInicialDoEditor({
    departamento: "cozinha", tipo: "prato", ficha: pratoVendido, todasFichas: todas, complementos: {},
    produto: { preco_venda: 55 },
  });
  const campos = camposParaGravar("prato", form, { novo: false });
  assert.equal(campos.preco_venda, 55);
  assert.equal(campos.taxa_maquininha, 2.5);
  assert.equal(campos.imposto_pct, 4);
  assert.equal(campos.cmv_meta, 35);
  assert.equal(campos.peso_final_g, 1000);
  assert.equal(campos.nome_receita, "Açaí 1L - farinha amarela");
  // Meta alterada no editor agora persiste (antes só era gravada na criação).
  assert.equal(camposParaGravar("prato", { ...form, cmv_meta: "25" }, { novo: false }).cmv_meta, 25);
  // Ficha nova sem meta escolhida continua nascendo em 30%.
  assert.equal(camposParaGravar("prato", { nome_receita: "X", departamento: "cozinha" }, { novo: true }).cmv_meta, 30);
});
