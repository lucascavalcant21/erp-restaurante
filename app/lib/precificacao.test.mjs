// Rode: node --test app/lib/precificacao.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { metaEmReais, noBolso } from "./precificacao.mjs";
import { precoSugerido } from "./marmitaria/nucleo.mjs";

test("meta em porcentagem é fixa e os reais acompanham o preço", () => {
  assert.equal(metaEmReais({ preco: 30, metaPct: 10 }), 3);
  assert.equal(metaEmReais({ preco: 40, metaPct: "10" }), 4);
  assert.equal(metaEmReais({ preco: 27, metaPct: 10 }), 2.7);
});

test("meta em reais vale sobre a porcentagem e não muda com o preço", () => {
  assert.equal(metaEmReais({ preco: 50, metaPct: 10, metaReais: "10" }), 10);
  assert.equal(noBolso({ lucro: 12, preco: 60, metaReais: 10 }).rotuloMeta, "Meta de lucro");
});

test("o que passa da meta é margem de segurança", () => {
  const b = noBolso({ lucro: 7, preco: 40, metaPct: 10 });
  assert.deepEqual([b.lucro, b.meta, b.margem, b.falta, b.estado, b.rotuloMeta], [7, 4, 3, 0, "na_meta", "Meta de lucro"]);
});

test("na promoção aparece quanto falta para a meta", () => {
  const b = noBolso({ lucro: 1.8, preco: 27, metaPct: 10 });
  assert.deepEqual([b.meta, b.margem, b.falta, b.estado], [2.7, 0, 0.9, "abaixo"]);
});

test("prejuízo e meta ausente não viram número inventado", () => {
  assert.equal(noBolso({ lucro: -2, preco: 20, metaPct: 10 }).estado, "prejuizo");
  assert.equal(noBolso({ lucro: null, preco: 20, metaPct: 10 }), null);
  const s = noBolso({ lucro: 5, preco: 20 });
  assert.deepEqual([s.estado, s.meta, s.margem], ["sem_meta", null, null]);
});

test("preço pela meta em reais: R$ 10 limpos com 60% de despesas sobre R$ 9", () => {
  const canal = { id: "x", nome: "X", comissao_pct: 60, taxa_pagamento_pct: 0, pagamento_na_comissao: true };
  assert.equal(precoSugerido({ custoTecnico: 9, canal, tributosPct: 0, lucroAlvoReais: 10 }).preco, 47.5);
  assert.equal(precoSugerido({ custoTecnico: 9, canal, tributosPct: 0, margemAlvoPct: 10 }).preco, 30);
});

test("Restaurante: meta em reais no preço sugerido da pizza", async () => {
  const { precoSugerido: sugerido } = await import("./pizza-do-prato.mjs");
  const base = { custoIngredientes: 9, params: { taxa_cartao_pct: 0, imposto_pct: 0 } };
  const pct = sugerido({ ...base, margemAlvoPct: 10 });
  const reais = sugerido({ ...base, margemAlvoPct: 10, lucroAlvoReais: 10 });
  assert.equal(Math.round(pct * 100) / 100, 10);
  assert.equal(Math.round(reais * 100) / 100, 19);
});

test("Resultado do mês leva a meta em reais para a precificação", async () => {
  const { parametrosDoResultado, sobreporParametros } = await import("./resultado-mes.mjs");
  const p = sobreporParametros({}, parametrosDoResultado({ "2026-11": { meta_lucro_pct: "10", meta_lucro_reais: "8" } }));
  assert.deepEqual([p.margem_alvo_pct, p.lucro_alvo_reais], [10, 8]);
  assert.equal(parametrosDoResultado({ "2026-11": { meta_lucro_reais: "" } }).lucro_alvo_reais, null);
});
