import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularCustoSolicitado,
  calcularPrecoNormalizado,
  ehInsumoPrePreparo,
  normalizarBusca,
  ordenarIngredientes,
  parseNumeroBR,
  precoNormalizadoDoInsumo,
  textoPesquisavel,
  unidadesIngredientePorDepartamento,
} from "./ingredientes-utils.mjs";

test("normaliza acentos, maiúsculas, espaços e hífens para pesquisa", () => {
  assert.equal(normalizarBusca(" Açafrão-da-Terra "), "acafraodaterra");
  assert.ok(textoPesquisavel({
    nome: "Açafrão-da-terra",
    nome_interno: "Açafrão",
    marca: "Kitano",
    codigo_interno: "IND-0001",
    categoria: "Temperos",
    fornecedores_vinculados: [{ nome: "Distribuidora Bom Sabor" }, { nome: "Horta & Cia" }],
  }).includes(normalizarBusca("Horta & Cia")));
});

test("ordena alfabeticamente ignorando acentos, caixa e hífens", () => {
  const lista = ordenarIngredientes([
    { nome: "banana" },
    { nome: "Água mineral" },
    { nome: "açafrão-da-terra" },
  ]);
  assert.deepEqual(lista.map(item => item.nome), ["açafrão-da-terra", "Água mineral", "banana"]);
});

test("calcula preço normalizado por kg e por litro", () => {
  assert.equal(calcularPrecoNormalizado(5, "kg", 75), 15);
  assert.equal(calcularPrecoNormalizado(500, "g", 10), 20);
  assert.equal(calcularPrecoNormalizado(250, "ml", 4.5), 18);
});

test("recalcula preço normalizado legado quando a migração deixou zero", () => {
  assert.equal(precoNormalizadoDoInsumo({
    tamanho_embalagem: 5,
    unidade_medida: "kg",
    custo_compra: 75,
    preco_normalizado: 0,
  }), 15);
});

test("calculadora aceita vírgula e converte g para kg", () => {
  const resultado = calcularCustoSolicitado({
    tamanho_embalagem: 5,
    unidade_medida: "kg",
    custo_compra: 75,
  }, "300,0", "g");
  assert.equal(resultado.erro, "");
  assert.equal(resultado.valor, 4.5);
  assert.equal(parseNumeroBR("1.234,50"), 1234.5);
});

test("calculadora converte ml para L e não aceita valor negativo", () => {
  const ingrediente = { tamanho_embalagem: 1, unidade_medida: "l", custo_compra: 12 };
  assert.equal(calcularCustoSolicitado(ingrediente, "250", "ml").valor, 3);
  assert.match(calcularCustoSolicitado(ingrediente, "-1", "ml").erro, /negativa/);
});

test("conversão entre peso e volume exige densidade", () => {
  const ingrediente = { tamanho_embalagem: 1, unidade_medida: "kg", custo_compra: 20 };
  assert.equal(
    calcularCustoSolicitado(ingrediente, "250", "ml").erro,
    "Não é possível converter peso em volume para este ingrediente.",
  );
  assert.equal(
    calcularCustoSolicitado({ ...ingrediente, densidade_g_ml: 0.8 }, "250", "ml").valor,
    4,
  );
});

test("cozinha oferece somente as sete unidades solicitadas", () => {
  assert.deepEqual(
    unidadesIngredientePorDepartamento("cozinha").map(item => item.value),
    ["kg", "g", "l", "ml", "pct", "maco", "caixa"],
  );
});

test("bar preserva garrafa e lata", () => {
  const bar = unidadesIngredientePorDepartamento("bar").map(item => item.value);
  assert.equal(bar.includes("garrafa"), true);
  assert.equal(bar.includes("lata"), true);
});

test("identifica itens de pré-preparo pela categoria", () => {
  assert.equal(ehInsumoPrePreparo({ categoria: "Pré-preparos" }), true);
  assert.equal(ehInsumoPrePreparo({ categoria: "Xaropes e pre-preparos" }), true);
  assert.equal(ehInsumoPrePreparo({ categoria: "Hortifrúti" }), false);
});

test("normaliza custo de pacote, maço e caixa por unidade", () => {
  assert.equal(calcularPrecoNormalizado(2, "pct", 18), 9);
  assert.equal(calcularPrecoNormalizado(4, "maco", 12), 3);
  assert.equal(calcularPrecoNormalizado(3, "caixa", 45), 15);
});
