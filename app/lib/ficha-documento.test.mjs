import test from "node:test";
import assert from "node:assert/strict";
import { montarDocumentoFichas, nomeDoArquivo } from "./ficha-documento.mjs";

const ins = (id, nome, unidade_medida, custo_unitario) => ({ id, nome, unidade_medida, custo_unitario });
const it = (insumo, quantidade) => ({ insumo_id: insumo.id, quantidade, fator_correcao: 0, insumos: insumo });

const tucupi = {
  id: "p1", departamento: "cozinha", eh_base: true, tipo_base: "pre", nome_receita: "Tucupi reduzido",
  categoria: "Molhos e caldos", codigo: "FT-0001", versao: "1.0", rendimento_porcoes: 1.5, rendimento_unidade: "kg",
  tempo_preparo: 40, tempo_coccao: 25, observacoes: "OBSERVACAO-ANTIGA", modo_preparo: "1. Colocar o tucupi na panela.\n2. Reduzir.",
  fichas_ingredientes: [it(ins("a", "Tucupi", "l", 12), 1), it(ins("b", "Sal", "g", 0.002), 15)],
};
const xarope = { ...tucupi, id: "p2", departamento: "bar", nome_receita: "Xarope simples", categoria: "Xaropes", codigo: "FT-0002" };
const picanha = {
  id: "q1", departamento: "cozinha", eh_base: false, nome_receita: "Picanha <b>na brasa</b>", categoria: "Pratos",
  codigo: "FT-0010", rendimento_porcoes: 0.7, rendimento_unidade: "kg", tempo_coccao: 12, observacoes: "OBSERVACAO-DO-PRATO",
  preco_venda: 99, modo_preparo: "Arroz à esquerda\nPicanha ao centro",
  fichas_ingredientes: [it(ins("c", "Picanha", "kg", 90), 0.4), { subficha_id: "p1", quantidade: 0.08, fator_correcao: 0 }],
};
const drink = { ...picanha, id: "q2", departamento: "bar", nome_receita: "Caipirinha", codigo: "FT-0011" };
const todas = [tucupi, xarope, picanha, drink];
const complementos = { p1: { armazenamento: { recipiente: "Cuba GN com tampa", forma: "Refrigerado", validade_refrigerado_dias: 3, observacoes: "OBS-ARMAZENAMENTO" }, equipamentos: [{ nome: "Panela 10 L" }], alergenicos: [] } };

const quantas = (html, trecho) => html.split(trecho).length - 1;

test("ficha de PRATO: título próprio, ingrediente + quantidade e montagem", () => {
  const html = montarDocumentoFichas([picanha], { todasFichas: todas, mostrarCustos: true });
  assert.match(html, /FICHA DE PRATO/);
  assert.doesNotMatch(html, /FICHA TÉCNICA/);
  assert.match(html, /Montagem do prato/);
  assert.match(html, /<th>Ingrediente<\/th><th class="q">Quantidade<\/th>/);
  assert.match(html, /400 g/);
  assert.match(html, /Tucupi reduzido<span class="tag">pré-preparo<\/span>/);
  // Nada do que foi tirado do prato aparece.
  for (const proibido of ["Rendimento", "Tempo de preparo", "cocção", "Peso final", "Armazenamento", "Equipamentos",
    "Alergênicos", "Custo", "Observa", "OBSERVACAO-DO-PRATO", "Informações adicionais", "embalagem", "R$"]) {
    assert.doesNotMatch(html, new RegExp(proibido, "i"), `prato não deveria ter "${proibido}"`);
  }
  // Nome escapado: HTML digitado no nome não vira tag.
  assert.match(html, /Picanha &lt;b&gt;na brasa&lt;\/b&gt;/);
});

test("ficha de PRÉ-PREPARO: produção completa, sem cocção, observações nem embalagem", () => {
  const html = montarDocumentoFichas([tucupi], { todasFichas: todas, complementos, mostrarCustos: true });
  assert.match(html, /FICHA DE PRÉ-PREPARO/);
  for (const esperado of ["Modo de preparo", "Armazenamento e validade", "Forma / recipiente", "Cuba GN com tampa",
    "Local e validade", "Refrigerado — validade 3 dias", "Equipamentos e utensílios", "Panela 10 L",
    "Não contém alergênicos cadastrados.", "Custo dos ingredientes", "Custo total", "Rendimento", "1,5 kg", "40 min", "Versão"]) {
    assert.ok(html.includes(esperado), `faltou "${esperado}"`);
  }
  for (const proibido of ["cocção", "OBSERVACAO-ANTIGA", "OBS-ARMAZENAMENTO", "Observa", "embalagem", "Informações adicionais"]) {
    assert.doesNotMatch(html, new RegExp(proibido, "i"), `pré-preparo não deveria ter "${proibido}"`);
  }
});

test("custos do pré-preparo só com permissão", () => {
  const semPermissao = montarDocumentoFichas([tucupi], { todasFichas: todas, complementos, mostrarCustos: false });
  assert.doesNotMatch(semPermissao, /Custo/);
  assert.doesNotMatch(semPermissao, /R\$/);
});

test("seção sem informação não é impressa", () => {
  const vazio = { ...tucupi, modo_preparo: "", tempo_preparo: null };
  const html = montarDocumentoFichas([vazio], { todasFichas: todas, complementos: {}, mostrarCustos: false });
  assert.doesNotMatch(html, /Modo de preparo/);
  assert.doesNotMatch(html, /Armazenamento/);
  assert.doesNotMatch(html, /Equipamentos/);
  assert.doesNotMatch(html, /Tempo de preparo/);
  // Alergênico é declaração: continua dizendo que não há.
  assert.match(html, /Não contém alergênicos cadastrados\./);
});

test("Livro de Receitas mistura os dois tipos, cada ficha no seu template", () => {
  const html = montarDocumentoFichas([picanha, drink, tucupi, xarope], {
    todasFichas: todas, complementos, livro: true, nomeUnidade: "Unidade X", data: "setembro de 2026",
  });
  assert.equal(quantas(html, '<article class="ficha tipo-prato"'), 2);
  assert.equal(quantas(html, '<article class="ficha tipo-pre-preparo"'), 2);
  assert.equal(quantas(html, ">FICHA DE PRATO<"), 2);
  assert.equal(quantas(html, ">FICHA DE PRÉ-PREPARO<"), 2);
  assert.match(html, /class="capa"/);
  assert.match(html, /2 pratos/);
  assert.match(html, /2 pré-preparos/);
  assert.match(html, /class="indice"/);
  // A ordem pedida é a ordem impressa.
  const ordem = [...html.matchAll(/<h1 class="nome">([^<]+)</g)].map(m => m[1]);
  assert.deepEqual(ordem, ["Picanha &lt;b&gt;na brasa&lt;/b&gt;", "Caipirinha", "Tucupi reduzido", "Xarope simples"]);
  // Cada ficha começa numa página nova.
  assert.match(html, /\.ficha \+ \.ficha\{page-break-before:always;break-before:page\}/);
  // Nº no cabeçalho casa com o índice.
  assert.match(html, /<td class="r">Nº<\/td><td class="v">03<\/td>/);
  assert.match(html, /<span class="n">03<\/span><span class="nm">Tucupi reduzido<\/span>/);
});

test("setor aparece no cabeçalho de cada ficha", () => {
  const html = montarDocumentoFichas([drink, xarope], { todasFichas: todas });
  assert.equal(quantas(html, '<div class="sub">Bar</div>'), 2);
});

test("a foto só entra se for imagem base64 da própria ficha", () => {
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqPtfDwAFPwJ/0d1WawAAAABJRU5ErkJggg==";
  assert.match(montarDocumentoFichas([{ ...picanha, imagem: png }], { todasFichas: todas }), /<img src="data:image\/jpeg;base64,/);
  const maliciosa = montarDocumentoFichas([{ ...picanha, imagem: 'data:image/png;base64,x" onerror="alert(1)' }], { todasFichas: todas });
  assert.doesNotMatch(maliciosa, /onerror/);
  assert.doesNotMatch(montarDocumentoFichas([{ ...picanha, imagem: png }], { todasFichas: todas, incluirFoto: false }), /<img/);
});

test("nome do arquivo", () => {
  assert.equal(nomeDoArquivo([picanha]), "Prato Picanha <b>na brasa</b>");
  assert.equal(nomeDoArquivo([tucupi]), "Pré-preparo Tucupi reduzido");
  assert.equal(nomeDoArquivo([picanha, tucupi], { livro: true }), "livro-de-receitas");
});
