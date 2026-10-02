// Registro simples de produção. Rode com: node --test app/lib/producao-simples.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { previaProducaoSimples, registroDeProducao } from "./producao-calculos.mjs";

const carne = { id: "carne", nome: "Carne de sol", unidade_medida: "kg", preco_normalizado: 39.9, peso_bruto_padrao: 1000, perda_g: 150, perda_pct: 15 };
const cebola = { id: "cebola", nome: "Cebola", unidade_medida: "kg", preco_normalizado: 6 };
const desfiada = { id: "f1", nome_receita: "Carne desfiada", eh_base: true, departamento: "cozinha", rendimento_porcoes: 2, rendimento_unidade: "kg",
  fichas_ingredientes: [{ insumos: carne, quantidade: 1.7, fator_correcao: 0 }, { insumos: cebola, quantidade: 0.3, fator_correcao: 0 }] };

test("prévia: consumo bruto (com a perda) e custo pela ficha, sem saldo de estoque", () => {
  const p = previaProducaoSimples(desfiada, 4, [desfiada]);  // 4 kg = 2 receitas
  assert.deepEqual(p.erros, []);
  assert.equal(p.receitas, 2);
  const c = p.itens.find((i) => i.nome === "Carne de sol");
  assert.equal(c.necessario, 4);                // 1,7 kg limpo × 2 ÷ 0,85 = 4 kg bruto
  assert.equal(p.itens.find((i) => i.nome === "Cebola").necessario, 0.6);
  assert.ok(Math.abs(p.custo_estimado - (4 * 39.9 + 0.6 * 6)) < 0.01);
  assert.ok(!("faltante" in c));
});

test("prévia recusa quantidade inválida e ficha sem ingrediente", () => {
  assert.match(previaProducaoSimples(desfiada, 0, []).erros[0], /maior que zero/);
  assert.ok(previaProducaoSimples({ ...desfiada, fichas_ingredientes: [] }, 1, []).erros.length > 0);
});

test("registro: o que, quanto, quem, custo e retrato da receita", () => {
  const p = previaProducaoSimples(desfiada, "4", [desfiada]);
  const r = registroDeProducao({ unidadeId: "u1", ficha: desfiada, quantidade: "4", colaboradorId: "c1", previa: p, departamento: "cozinha", localArmazenamento: "Freezer 1", chave: "k1" });
  assert.equal(r.quantidade_produzida, 4);
  assert.equal(r.unidade_medida, "kg");
  assert.equal(r.custo_total, 163.2);
  assert.equal(r.receita_snapshot.itens.length, 2);
  assert.equal(r.chave_operacao, "k1");
});
