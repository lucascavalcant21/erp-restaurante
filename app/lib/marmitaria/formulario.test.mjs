// Formulário da marmita: cadastro, edição e salvamento repetido.
// Rode: node --test app/lib/marmitaria/formulario.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { formDaMarmita, payloadDoForm, custoDoForm, quantidadeParaTela } from "./formulario.mjs";

const insumos = new Map([
  ["frango", { id: "frango", nome: "Frango", unidade_medida: "kg", custo_compra: 20, tamanho_embalagem: 1 }],
  ["pote", { id: "pote", nome: "Pote", unidade_medida: "un", custo_compra: 1.1, tamanho_embalagem: 1 }],
]);
const fichas = [{ id: "arroz", nome_receita: "Arroz cozido", eh_base: true, rendimento_porcoes: 2, rendimento_unidade: "kg",
  fichas_ingredientes: [{ insumo_id: "x", insumos: { id: "x", nome: "Arroz cru", unidade_medida: "kg", custo_compra: 6, tamanho_embalagem: 1 }, quantidade: 1 }] }];
const ctx = { insumos, fichas };

test("cadastro novo: id nasce na abertura e é o mesmo em todas as tentativas de salvar", () => {
  const f = formDaMarmita(null, ctx);
  assert.ok(f.id && f.novo);
  const preenchido = { ...f, nome: "Frango com arroz", preco: "25,90",
    itens: [{ key: "1", insumo_id: "frango", qtd: "120", un: "g", fator_correcao: 0 }, { key: "2", subficha_id: "arroz", qtd: "150", un: "g" }],
    embalagens: [{ key: "3", insumo_id: "pote", qtd: "1", tipo: "marmitex" }], precos: { ifood: "29,90", whatsapp: "" } };
  const a = payloadDoForm(preenchido, ctx, "seldeestrela");
  const b = payloadDoForm(preenchido, ctx, "seldeestrela");
  assert.deepEqual(a.erros, []);
  assert.equal(a.payload.id, f.id);
  assert.deepEqual(a.payload, b.payload); // segunda tentativa = mesmo envio
  // 120 g e 150 g viram 0,12 kg e 0,15 kg do cadastro; preço com vírgula vira número
  assert.deepEqual(a.payload.itens.map((i) => i.quantidade), [0.12, 0.15]);
  assert.equal(a.payload.preco_venda, 25.9);
  assert.deepEqual(a.payload.precos, [{ canal: "ifood", preco_venda: 29.9 }]);
  assert.equal(a.payload.custo_embalagens_total, 1.1);
});

test("custo ao vivo do formulário: 0,12 kg × 20 + 0,15 kg de arroz a R$ 3/kg + pote 1,10 = 3,95", () => {
  const f = { ...formDaMarmita(null, ctx), itens: [{ key: "1", insumo_id: "frango", qtd: "120", un: "g" }, { key: "2", subficha_id: "arroz", qtd: "150", un: "g" }],
    embalagens: [{ key: "3", insumo_id: "pote", qtd: "1" }] };
  assert.equal(custoDoForm(f, ctx).total, 3.95);
});

test("edição: abre com o id e as gramas como a cozinha fala, e grava de volta o mesmo valor", () => {
  const gravada = { id: "m1", codigo: "MARM-0002", nome_receita: "Frango", preco_venda: 25, ativo: true, tamanho_marmita: "G", peso_final_g: 600,
    itens: [{ insumo_id: "frango", quantidade: 0.12, fator_correcao: 25 }, { subficha_id: "arroz", quantidade: 1.5 }],
    embalagens: [{ insumo_id: "pote", quantidade: 1, tipo: "marmitex" }], precos: { ifood: 29.9 } };
  const f = formDaMarmita(gravada, ctx);
  assert.equal(f.id, "m1");
  assert.equal(f.novo, false);
  assert.deepEqual([f.itens[0].qtd, f.itens[0].un], ["120", "g"]);
  assert.deepEqual([f.itens[1].qtd, f.itens[1].un], ["1,5", "kg"]);
  assert.equal(f.precos.ifood, "29,9");
  const p = payloadDoForm(f, ctx, "seldeestrela").payload;
  assert.deepEqual(p.itens, [{ insumo_id: "frango", subficha_id: null, quantidade: 0.12, fator_correcao: 25 }, { insumo_id: null, subficha_id: "arroz", quantidade: 1.5, fator_correcao: 0 }]);
  assert.equal(p.tamanho, "G");
  assert.equal(p.peso_final_g, 600);
});

test("erros de preenchimento voltam todos de uma vez e não geram envio", () => {
  const f = { ...formDaMarmita(null, ctx), nome: "", itens: [{ key: "1", insumo_id: "frango", qtd: "", un: "g" }, { key: "2", insumo_id: "frango", qtd: "1", un: "ml" }],
    embalagens: [{ key: "3", insumo_id: "pote", qtd: "0" }] };
  const r = payloadDoForm(f, ctx, "u");
  assert.equal(r.payload, null);
  assert.equal(r.erros.length, 4);
  assert.ok(r.erros.some((e) => e.includes("não combina")));
});

test("quantidade para a tela", () => {
  assert.deepEqual(quantidadeParaTela(0.25, "l"), { qtd: "250", un: "ml" });
  assert.deepEqual(quantidadeParaTela(2, "kg"), { qtd: "2", un: "kg" });
  assert.deepEqual(quantidadeParaTela(3, "un"), { qtd: "3", un: "un" });
});
