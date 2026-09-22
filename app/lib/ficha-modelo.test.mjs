import test from "node:test";
import assert from "node:assert/strict";
import {
  TIPOS_FICHA, tipoFichaDe, configDaFicha, setorDaFicha, marcadoresDoTipo,
  quantidadeComUnidade, textoPesoFinal, textoRendimento, textoTempo,
  ingredientesDaFicha, passosDeTexto, textoDeInstrucoes,
  linhasDeArmazenamento, validadePrincipal, armazenamentoParaGravar, armazenamentoParaEditar,
  custosDoPrePreparo, dadosDaFicha, camposParaGravar, validarEditor, quantidadeParaGravar,
  categoriasDoTipo, podeVerCustosFicha, entraNoReceituario, agruparPorTipo,
} from "./ficha-modelo.mjs";
import { custoDeProduzirFicha, converterParaBaseDoInsumo } from "./ficha-calculos.mjs";

// Dados fictícios, no formato de fetchFichas.
const arroz = { id: "i-arroz", nome: "Arroz", unidade_medida: "kg", custo_unitario: 6.5 };
const sal = { id: "i-sal", nome: "Sal", unidade_medida: "g", custo_unitario: 0.002 };
const picanhaIns = { id: "i-picanha", nome: "Picanha", unidade_medida: "kg", custo_unitario: 90 };
const cachaca = { id: "i-cachaca", nome: "Cachaça", unidade_medida: "l", custo_unitario: 40 };
const it = (insumo, quantidade) => ({ insumo_id: insumo.id, subficha_id: null, quantidade, fator_correcao: 0, insumos: insumo });
const sub = (id, quantidade) => ({ insumo_id: null, subficha_id: id, quantidade, fator_correcao: 0, insumos: null });

const arrozBranco = {
  id: "f-arroz", departamento: "cozinha", eh_base: true, tipo_base: "pre", nome_receita: "Arroz branco",
  categoria: "Arroz, feijão e grãos", rendimento_porcoes: 2, rendimento_unidade: "kg",
  tempo_preparo: 35, peso_final_g: 2000, responsavel: "Chef", codigo: "FT-0003", versao: "1.2",
  tempo_coccao: 20, observacoes: "não pode aparecer", modo_preparo: "1. Refogar\n2. Cozinhar",
  fichas_ingredientes: [it(arroz, 1), it(sal, 15)],
};
const prato = {
  id: "f-prato", departamento: "cozinha", eh_base: false, tipo_base: null, nome_receita: "Picanha com arroz",
  categoria: "Prato principal 2 pessoas", rendimento_porcoes: 0.7, rendimento_unidade: "kg",
  preco_venda: 100, cmv_meta: 30, tempo_coccao: 15, observacoes: "obs antiga", modo_preparo: "Arroz à esquerda\nPicanha ao centro",
  fichas_ingredientes: [sub("f-arroz", 0.3), it(picanhaIns, 0.4)],
};
const drink = {
  id: "f-drink", departamento: "bar", eh_base: false, nome_receita: "Caipirinha", categoria: "Destilados",
  metodo_bar: "montado", copo: "Copo baixo", modo_preparo: "", fichas_ingredientes: [it(cachaca, 0.05)],
};
const todas = [arrozBranco, prato, drink];

test("o tipo vem de eh_base, não do nome da categoria", () => {
  assert.equal(tipoFichaDe(arrozBranco), "pre_preparo");
  assert.equal(tipoFichaDe(prato), "prato");
  assert.equal(tipoFichaDe({ eh_base: false, categoria: "Molhos e caldos" }), "prato");
  assert.equal(tipoFichaDe({ eh_base: true, categoria: "Pratos principais" }), "pre_preparo");
  assert.equal(tipoFichaDe({ eh_base: false, tipo_base: "produto_pronto" }), "produto_pronto");
  assert.equal(configDaFicha(arrozBranco).tituloDocumento, "FICHA DE PRÉ-PREPARO");
  assert.equal(configDaFicha(prato).tituloDocumento, "FICHA DE PRATO");
});

test("setor é independente do tipo", () => {
  assert.equal(setorDaFicha(drink).rotulo, "Bar");
  assert.equal(setorDaFicha(prato).rotulo, "Cozinha");
  assert.equal(setorDaFicha({ departamento: "BAR" }).id, "bar");
  assert.equal(setorDaFicha({}).id, "cozinha");
  assert.deepEqual(marcadoresDoTipo("pre_preparo"), { eh_base: true, tipo_base: "pre" });
  assert.deepEqual(marcadoresDoTipo("prato"), { eh_base: false, tipo_base: null });
});

test("configuração central: prato é ficha de montagem, pré-preparo é de produção", () => {
  const p = TIPOS_FICHA.prato.mostra;
  for (const campo of ["rendimento", "tempoPreparo", "tempoCoccao", "pesoFinal", "armazenamento",
    "equipamentos", "alergenicos", "custos", "custoEmbalagem", "observacoes", "informacoesAdicionais"]) {
    assert.equal(p[campo], false, `prato não deveria ter ${campo}`);
  }
  assert.equal(p.instrucoes, true);
  assert.equal(TIPOS_FICHA.prato.instrucoes.titulo, "Montagem do prato");

  const pp = TIPOS_FICHA.pre_preparo.mostra;
  for (const campo of ["rendimento", "tempoPreparo", "pesoFinal", "armazenamento", "equipamentos", "alergenicos", "custos", "responsavel"]) {
    assert.equal(pp[campo], true, `pré-preparo deveria ter ${campo}`);
  }
  for (const campo of ["tempoCoccao", "custoEmbalagem", "observacoes", "informacoesAdicionais"]) {
    assert.equal(pp[campo], false, `pré-preparo não deveria ter ${campo}`);
  }
  assert.equal(TIPOS_FICHA.pre_preparo.instrucoes.titulo, "Modo de preparo");
  // As mesmas chaves nos dois tipos: nenhum campo fica "indefinido".
  assert.deepEqual(Object.keys(p).sort(), Object.keys(pp).sort());
});

test("quantidade vai junto da unidade, num texto só", () => {
  assert.equal(quantidadeComUnidade(0.3, "kg"), "300 g");
  assert.equal(quantidadeComUnidade(1, "l"), "1.000 ml");
  assert.equal(quantidadeComUnidade(50, "ml"), "50 ml");
  assert.equal(quantidadeComUnidade(2, "un"), "2 un");
  assert.equal(quantidadeComUnidade(1, "fatia"), "1 fatia");
  assert.equal(quantidadeComUnidade(3, "fatia"), "3 fatias");
  assert.equal(quantidadeComUnidade(0.0125, "kg"), "12,5 g");
  assert.equal(textoPesoFinal(1600, "cozinha"), "1,6 kg");
  assert.equal(textoPesoFinal(750, "bar"), "750 ml");
  assert.equal(textoPesoFinal(0, "bar"), "");
  assert.equal(textoTempo(35), "35 min");
  assert.equal(textoTempo(90), "1 h 30 min");
  assert.equal(textoRendimento(arrozBranco), "2 kg");
  assert.equal(textoRendimento({ rendimento_porcoes: 20, rendimento_unidade: "un", departamento: "cozinha" }), "20 un");
});

test("ingredientes: insumo em g, em kg e pré-preparo aparecem na unidade certa", () => {
  const linhas = ingredientesDaFicha(arrozBranco, todas);
  assert.deepEqual(linhas, [
    { nome: "Arroz", quantidade: "1.000 g", prePreparo: false },
    { nome: "Sal", quantidade: "15 g", prePreparo: false },
  ]);
  const doPrato = ingredientesDaFicha(prato, todas);
  assert.equal(doPrato[0].nome, "Arroz branco");
  assert.equal(doPrato[0].quantidade, "300 g");
  assert.equal(doPrato[0].prePreparo, true);
  assert.equal(ingredientesDaFicha({ fichas_ingredientes: [sub("sumiu", 1)] }, todas)[0].nome, "Pré-preparo removido");
});

test("passos: numeração, detalhes da IA e tempo total", () => {
  const { passos, notas } = passosDeTexto("1. Refogar a cebola\n   • Panela · Fogo médio · 5 min\n2) Juntar o arroz\n\nServir\nTempo total: 20 min");
  assert.deepEqual(passos.map(p => p.texto), ["Refogar a cebola", "Juntar o arroz", "Servir"]);
  assert.deepEqual(passos[0].detalhes, ["Panela · Fogo médio · 5 min"]);
  assert.deepEqual(notas, ["Tempo total: 20 min"]);
  assert.deepEqual(passosDeTexto("").passos, []);
});

test("instruções: texto atual primeiro; fichas antigas caem para o que tinham", () => {
  assert.equal(textoDeInstrucoes(prato), "Arroz à esquerda\nPicanha ao centro");
  // Drink antigo: passos de montagem + método e copo viram texto.
  const texto = textoDeInstrucoes(drink, { montagem: [{ descricao: "Macerar o limão" }] });
  assert.match(texto, /1\. Macerar o limão/);
  assert.match(texto, /Método: Montado no copo/);
  assert.match(texto, /Copo: Copo baixo/);
  // Pré-preparo antigo com etapas estruturadas.
  const preparoAntigo = { eh_base: true, modo_preparo: "" };
  const etapas = [{ titulo: "Reduzir", instrucao: "Reduzir à metade", tempo_min: 20, equipamento: "Panela" }];
  assert.equal(textoDeInstrucoes(preparoAntigo, { etapas }), "1. Reduzir: Reduzir à metade\n   • 20 min · Panela");
  // "Conforme foto" era o texto padrão antigo, não uma montagem.
  assert.equal(textoDeInstrucoes({ eh_base: false, padrao_montagem: "Conforme foto" }), "");
});

test("armazenamento: duas linhas, sem observações", () => {
  const arm = { recipiente: "Cuba GN com tampa", forma: "Refrigerado", validade_refrigerado_dias: 3, observacoes: "não entra" };
  assert.deepEqual(linhasDeArmazenamento(arm), [
    { rotulo: "Forma / recipiente", valor: "Cuba GN com tampa" },
    { rotulo: "Local e validade", valor: "Refrigerado — validade 3 dias" },
  ]);
  assert.deepEqual(linhasDeArmazenamento({}), []);
  assert.equal(validadePrincipal({}, { validade_dias: 5 }), 5);
  assert.equal(validadePrincipal({ forma: "Congelado", validade_congelado_dias: 30, validade_refrigerado_dias: 3 }), 30);
  // Validade antiga que não é a principal continua aparecendo.
  assert.equal(linhasDeArmazenamento({ forma: "Congelado", validade_congelado_dias: 30, validade_refrigerado_dias: 3 })[0].valor,
    "Congelado — validade 30 dias; refrigerado 3 dias");
});

test("armazenamento: gravar preserva o que o editor não mostra", () => {
  const atual = { id: "a1", recipiente: "GN", forma: "Refrigerado", validade_refrigerado_dias: 3,
    temperatura_min: 0, temperatura_max: 5, observacoes: "antiga", validade_apos_aberto_dias: 2 };
  const editado = armazenamentoParaEditar(atual);
  assert.deepEqual(editado, { recipiente: "GN", forma: "Refrigerado", local_armazenamento: "", validade_dias: "3" });
  const gravar = armazenamentoParaGravar(atual, { ...editado, validade_dias: "4", local_armazenamento: "Geladeira 2" });
  assert.equal(gravar.validade_refrigerado_dias, 4);
  assert.equal(gravar.local_armazenamento, "Geladeira 2");
  assert.equal(gravar.temperatura_max, 5);
  assert.equal(gravar.observacoes, "antiga");
  assert.equal(gravar.validade_apos_aberto_dias, 2);
  // Trocou para congelado: a validade muda de coluna e não aparece duas vezes.
  const congelado = armazenamentoParaGravar(atual, { ...editado, forma: "Congelado", validade_dias: "30" });
  assert.equal(congelado.validade_congelado_dias, 30);
  assert.equal(congelado.validade_refrigerado_dias, null);
});

test("custos do pré-preparo: sem embalagem, total igual ao usado pelo ERP", () => {
  const comEmbalagem = { ...arrozBranco, custo_embalagens_total: 2 };
  const c = custosDoPrePreparo(comEmbalagem, todas);
  // 1 kg de arroz a 6,50 + 15 g de sal a R$ 2/kg = 6,53
  assert.equal(c.ingredientes.toFixed(2), "6.53");
  assert.equal(c.total, custoDeProduzirFicha(comEmbalagem, todas));
  assert.equal(c.unidade, "kg");
  assert.equal(custosDoPrePreparo(arrozBranco, todas).porUnidade.toFixed(4), (6.53 / 2).toFixed(4));
});

test("prato que usa pré-preparo herda o custo proporcional (CMV intacto)", () => {
  // 300 g de arroz branco (lote de 2 kg custa 6,53) + 400 g de picanha a 90/kg.
  const esperado = (6.53 / 2) * 0.3 + 90 * 0.4;
  assert.equal(custoDeProduzirFicha(prato, todas).toFixed(4), esperado.toFixed(4));
  // A ficha impressa do prato não mostra custo, mesmo pedindo.
  assert.equal(dadosDaFicha(prato, { todasFichas: todas, mostrarCustos: true }).custos, null);
});

test("dados da ficha de PRATO: só identificação, ingredientes e montagem", () => {
  const d = dadosDaFicha(prato, { todasFichas: todas, mostrarCustos: true });
  assert.equal(d.tipo, "prato");
  assert.deepEqual(d.identificacao.map(i => i.rotulo), ["Categoria", "Setor"]);
  assert.deepEqual(d.cabecalho, []); // sem código gravado, o quadro não aparece vazio
  assert.equal(d.instrucoes.titulo, "Montagem do prato");
  assert.equal(d.armazenamento, null);
  assert.equal(d.equipamentos, null);
  assert.equal(d.alergenicos, null);
  assert.equal(d.custos, null);
  const texto = JSON.stringify({ ...d, config: null }); // só o conteúdo, não a configuração
  assert.doesNotMatch(texto, /obs antiga/);
  assert.doesNotMatch(texto, /Rendimento|Tempo de cocção|Peso final/);
});

test("dados da ficha de PRÉ-PREPARO: produção completa, sem cocção nem observações", () => {
  const d = dadosDaFicha(arrozBranco, {
    todasFichas: todas, mostrarCustos: true,
    complementos: { equipamentos: [{ nome: "Panela 10 L" }], alergenicos: [], armazenamento: { recipiente: "GN", validade_refrigerado_dias: 3 } },
  });
  assert.equal(d.tipo, "pre_preparo");
  assert.deepEqual(d.identificacao.map(i => i.rotulo), ["Categoria", "Rendimento", "Tempo de preparo", "Peso final", "Setor"]);
  assert.deepEqual(d.cabecalho.map(i => i.rotulo), ["Código", "Versão", "Responsável"]);
  assert.equal(d.instrucoes.titulo, "Modo de preparo");
  assert.deepEqual(d.equipamentos, ["Panela 10 L"]);
  assert.deepEqual(d.alergenicos, { contem: [], podeConter: "" });
  assert.deepEqual(d.custos.map(c => c.rotulo), ["Custo dos ingredientes", "Custo total", "Custo por kg"]);
  const texto = JSON.stringify({ ...d, config: null }); // só o conteúdo, não a configuração
  assert.doesNotMatch(texto, /não pode aparecer/);
  assert.doesNotMatch(texto, /cocção|embalagem|Observa/i);
  // Sem permissão, os custos não saem.
  assert.equal(dadosDaFicha(arrozBranco, { todasFichas: todas }).custos, null);
  // No bar é "volume final".
  assert.equal(dadosDaFicha({ ...arrozBranco, departamento: "bar" }).identificacao.find(i => i.rotulo === "Volume final").valor, "2 L");
});

test("gravar PRATO não escreve campos do pré-preparo nem apaga os antigos", () => {
  const campos = camposParaGravar("prato", {
    nome_receita: " Picanha ", categoria: "Pratos", departamento: "cozinha", modo_preparo: "1. Montar",
    rendimento_porcoes: "0.7", rendimento_unidade: "kg", tempo_preparo: "30", responsavel: "X", peso_final_g: "900",
  }, { agora: "t" });
  assert.equal(campos.nome_receita, "Picanha");
  assert.equal(campos.eh_base, false);
  assert.equal(campos.tipo_base, null);
  assert.equal(campos.modo_preparo, "1. Montar");
  assert.equal(campos.rendimento_porcoes, 0.7);
  for (const coluna of ["tempo_preparo", "responsavel", "peso_final_g", "tempo_coccao", "tempo_coccao_min",
    "observacoes", "preco_venda", "cmv_meta", "padrao_montagem", "metodo_bar", "unidade_id", "versao"]) {
    assert.equal(coluna in campos, false, `edição de prato não deveria gravar ${coluna}`);
  }
  const novo = camposParaGravar("prato", { nome_receita: "X", departamento: "bar" }, { novo: true, unidadeId: "u1" });
  assert.equal(novo.unidade_id, "u1");
  assert.equal(novo.versao, "1.0");
  assert.equal(novo.cmv_meta, 30);
  assert.equal(novo.departamento, "bar");
  assert.equal(novo.rendimento_unidade, "l");
});

test("gravar PRÉ-PREPARO leva tempo, peso final, responsável e validade", () => {
  const campos = camposParaGravar("pre_preparo", {
    nome_receita: "Tucupi", departamento: "cozinha", rendimento_porcoes: "2", tempo_preparo: "40",
    peso_final_g: "1600", responsavel: "Chef", validade_dias: "3", alergenicos_pode_conter: "",
  });
  assert.equal(campos.eh_base, true);
  assert.equal(campos.tipo_base, "pre");
  assert.equal(campos.tempo_preparo, 40);
  assert.equal(campos.peso_final_g, 1600);
  assert.equal(campos.responsavel, "Chef");
  assert.equal(campos.validade_dias, 3);
  assert.equal(campos.alergenicos_pode_conter, null);
  assert.equal("tempo_coccao" in campos, false);
  assert.equal("observacoes" in campos, false);
});

test("validação do editor", () => {
  assert.deepEqual(validarEditor("prato", { nome_receita: "X" }, [{ quantidade: 1 }]), []);
  assert.match(validarEditor("prato", { nome_receita: "" }, [{ quantidade: 1 }])[0], /nome do prato/);
  assert.match(validarEditor("prato", { nome_receita: "X" }, [{ quantidade: 0 }])[0], /ingrediente/);
  assert.match(validarEditor("pre_preparo", { nome_receita: "X", rendimento_porcoes: 0 }, [{ quantidade: 1 }])[0], /rendimento/);
});

test("quantidade gravada volta para a unidade do insumo (g e ml não encolhem)", () => {
  for (const [q, un] of [[300, "g"], [50, "ml"], [0.4, "kg"], [1.5, "l"], [2, "un"], [3, "pacote"]]) {
    const naBase = converterParaBaseDoInsumo(q, un, un === "g" ? "kg" : un === "ml" ? "l" : un);
    assert.equal(+quantidadeParaGravar(naBase, un).toFixed(6), q, `${q} ${un}`);
  }
});

test("categorias por setor e tipo, com as criadas pela unidade", () => {
  const config = { cozinha: { principais: { adicionais: ["Executivos"], excluidas: ["Entradas"] }, preparos: { adicionais: [], excluidas: [] } } };
  const pratos = categoriasDoTipo({ departamento: "cozinha", tipo: "prato", config, fichas: [prato, { ...prato, categoria: "Da ficha" }] });
  assert.ok(pratos.includes("Executivos"));
  assert.ok(pratos.includes("Da ficha"));
  assert.ok(!pratos.includes("Entradas"));
  assert.ok(!pratos.includes("Molhos e caldos"));
  const preparosBar = categoriasDoTipo({ departamento: "bar", tipo: "pre_preparo", config, fichas: [] });
  assert.ok(preparosBar.includes("Xaropes"));
  // Configuração antiga, plana, vale para pratos.
  const antiga = categoriasDoTipo({ departamento: "cozinha", tipo: "prato", config: { cozinha: { adicionais: ["Velha"] } } });
  assert.ok(antiga.includes("Velha"));
});

test("permissão de custo e receituário", () => {
  assert.equal(podeVerCustosFicha(null, "cozinha"), true);
  assert.equal(podeVerCustosFicha({ gerenciado: true, permissions: [] }, "cozinha"), false);
  assert.equal(entraNoReceituario(prato), true);
  assert.equal(entraNoReceituario({ ...prato, status: "inativa" }), false);
  assert.equal(entraNoReceituario({ eh_base: false, tipo_base: "produto_pronto" }), false);
  const g = agruparPorTipo([prato, arrozBranco, drink, { tipo_base: "produto_pronto" }]);
  assert.deepEqual(g.prato.map(f => f.id), ["f-prato", "f-drink"]);
  assert.deepEqual(g.pre_preparo.map(f => f.id), ["f-arroz"]);
});
