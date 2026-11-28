import { test } from "node:test";
import assert from "node:assert/strict";
import {
  unidadesDaPesquisa, tamanhoNaUnidadeDoCadastro, montarCotacao, precoNormalizadoDoCadastro,
  compararLocais, camposDaEscolha, seriesPorLocal, ingredientesDaLista,
} from "./cotacoes.mjs";

const arroz = { id: "arroz", nome: "Arroz", unidade_medida: "kg", tamanho_embalagem: 5, custo_compra: 30, preco_normalizado: 6 };
const cot = (local, preco, quando, extra = {}) => ({
  insumo_id: "arroz", fornecedor_id: local, local_nome: `Mercado ${local}`, preco, tamanho_embalagem: 5,
  unidade_embalagem: "kg", preco_normalizado: preco / 5, registrada_em: quando, escolhida: false, ...extra,
});

test("unidades da pesquisa ficam na família do cadastro", () => {
  assert.deepEqual(unidadesDaPesquisa("kg"), ["kg", "g"]);
  assert.deepEqual(unidadesDaPesquisa("ml"), ["l", "ml"]);
  assert.deepEqual(unidadesDaPesquisa("L"), ["l", "ml"]);
  assert.deepEqual(unidadesDaPesquisa("garrafa"), ["garrafa"]);
  assert.equal(tamanhoNaUnidadeDoCadastro(500, "g", "kg"), 0.5);
  assert.equal(tamanhoNaUnidadeDoCadastro(2, "l", "ml"), 2000);
  assert.equal(tamanhoNaUnidadeDoCadastro(2, "kg", "ml"), null);
});

test("montar a pesquisa: valida e calcula o preço por kg", () => {
  const ok = montarCotacao({ insumo: arroz, preco: "28", tamanho: 5, unidade: "kg", marca: " Tio João ", fornecedorId: "y", localNome: "Mercado Y" });
  assert.equal(ok.linha.preco_normalizado, 5.6);
  assert.equal(ok.linha.marca, "Tio João");
  assert.equal(montarCotacao({ insumo: arroz, preco: 0, tamanho: 5, unidade: "kg", fornecedorId: "y", localNome: "Y" }).erro, "Digite o preço.");
  assert.match(montarCotacao({ insumo: arroz, preco: 10, tamanho: 1, unidade: "l", fornecedorId: "y", localNome: "Y" }).erro, /kg ou g/);
  assert.match(montarCotacao({ insumo: arroz, preco: 10, tamanho: 1, unidade: "kg" }).erro, /lugar/);
});

test("preço do cadastro sem normalizado salvo sai da embalagem", () => {
  assert.equal(precoNormalizadoDoCadastro({ unidade_medida: "kg", tamanho_embalagem: 5, custo_compra: 30 }), 6);
  assert.equal(precoNormalizadoDoCadastro({ unidade_medida: "kg" }), null);
});

test("compara os locais: mais barato, mais perto do cadastro e subiu/desceu", () => {
  const r = compararLocais(arroz, [
    cot("x", 32, "2026-11-01T10:00:00Z"),
    cot("x", 30, "2026-11-28T10:00:00Z"),
    cot("y", 28, "2026-11-28T10:10:00Z"),
    cot("z", 35, "2026-11-28T10:20:00Z"),
  ]);
  assert.equal(r.cadastro.precoEquivalente, 30);
  assert.deepEqual(r.locais.map((l) => l.fornecedorId), ["y", "x", "z"]);
  assert.equal(r.melhor.fornecedorId, "y");
  assert.equal(r.maisPerto.fornecedorId, "x"); // igual ao cadastro
  const x = r.locais.find((l) => l.fornecedorId === "x");
  assert.equal(x.precoEquivalente, 30);
  assert.equal(Number(x.vsAnteriorPct.toFixed(2)), -6.25);
  assert.equal(x.anterior.precoEquivalente, 32);
  assert.equal(Number(r.locais[0].vsCadastroPct.toFixed(2)), -6.67);
  assert.equal(Number(r.economiaPct.toFixed(1)), 25);
});

test("mais perto não repete o mais barato", () => {
  const r = compararLocais(arroz, [cot("y", 29, "2026-11-28T10:00:00Z"), cot("z", 40, "2026-11-28T10:00:00Z")]);
  assert.equal(r.melhor.fornecedorId, "y");
  assert.equal(r.maisPerto, null);
});

test("pacote de 1 kg compara com o de 5 kg pelo preço por kg", () => {
  const r = compararLocais(arroz, [
    { ...cot("w", 7, "2026-11-28T09:00:00Z"), tamanho_embalagem: 1, preco_normalizado: 7 },
    cot("y", 28, "2026-11-28T10:00:00Z"),
  ]);
  assert.equal(r.melhor.fornecedorId, "y");
  assert.equal(r.locais[1].precoEquivalente, 35); // R$ 7/kg × 5 kg
});

test("escolha grava na unidade do cadastro e diz se mudou o preço", () => {
  const e = camposDaEscolha(arroz, cot("y", 28, "2026-11-28T10:00:00Z", { marca: "Tio João" }));
  assert.equal(e.mudou, true);
  assert.deepEqual(e.campos, { tamanho_embalagem: 5, custo_compra: 28, custo_unitario: 5.6, preco_normalizado: 5.6, fornecedor_atual_id: "y", fornecedor: "Mercado y", marca: "Tio João" });
  assert.equal(Number(e.variacaoPct.toFixed(2)), -6.67);
  const g = camposDaEscolha({ ...arroz, unidade_medida: "g", tamanho_embalagem: 1000, custo_compra: 6, preco_normalizado: 6 }, { ...cot("y", 28, "x"), unidade_embalagem: "kg" });
  assert.equal(g.campos.tamanho_embalagem, 5000);
  assert.equal(g.campos.custo_compra, 28);
  const igual = camposDaEscolha(arroz, cot("x", 30, "2026-11-28T10:00:00Z"));
  assert.equal(igual.mudou, false);
  assert.equal(camposDaEscolha(arroz, { ...cot("x", 30, "x"), unidade_embalagem: "l" }), null);
});

test("gráfico: uma série por local, em ordem de data", () => {
  const s = seriesPorLocal(arroz, [cot("x", 30, "2026-11-28T10:00:00Z", { escolhida: true }), cot("x", 32, "2026-11-01T10:00:00Z"), cot("y", 28, "2026-11-28T10:10:00Z")]);
  assert.equal(s.length, 2);
  assert.deepEqual(s[0].pontos.map((p) => [p.valor, p.escolhida]), [[32, false], [30, true]]);
});

test("lista do setor: cozinha e bar, sem arquivados", () => {
  const lista = ingredientesDaLista([
    { id: 1, departamento: "cozinha" }, { id: 2, departamento: "bar" },
    { id: 3, departamento: "cozinha", departamentos: ["cozinha", "bar"] },
    { id: 4, departamento: "cozinha", arquivado_em: "2026-01-01" }, { id: 5, departamento: "cozinha", unido_a: "x" },
  ], "bar");
  assert.deepEqual(lista.map((i) => i.id), [2, 3]);
});
