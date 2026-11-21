// Rode com: node --test app/lib/marmitaria/gestao-lucro.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { conferenciaDoLucro } from "./gestao-lucro.mjs";

const dre = (ind, cmvNatureza = "real") => ({ indicadores: ind, linhas: [{ id: "cmv", natureza: cmvNatureza }] });

test("perda: CMV real acima da ficha vira alerta com o valor por marmita", () => {
  const c = conferenciaDoLucro({
    dre: dre({ marmitas: 1000, lucroLiquido: 8000, margemContribuicao: 18000 }),
    cmvReal: { valor: 13000 }, cmvPrev: { valor: 12000 }, metaPorMarmita: "10",
  });
  assert.equal(c.natureza, "REAL");
  assert.equal(c.perda.diferenca, 1000);
  assert.equal(c.perda.pct, 8.33);
  assert.equal(c.perda.situacao, "alerta");
  assert.equal(c.perda.porMarmita, 1);
  // meta 10 × 1000 = 10.000; falta 2.000; cada marmita deixa 18 → 112 marmitas
  assert.equal(c.meta.falta, 2000);
  assert.equal(c.meta.marmitasFaltam, 112);
  assert.equal(c.meta.atingida, false);
});

test("meta batida e cozinha dentro da tolerância", () => {
  const c = conferenciaDoLucro({
    dre: dre({ marmitas: 500, lucroLiquido: 6000, margemContribuicao: 10000 }),
    cmvReal: { valor: 5100 }, cmvPrev: { valor: 5000 }, metaPorMarmita: 10,
  });
  assert.equal(c.perda.situacao, "ok");
  assert.equal(c.meta.atingida, true);
  assert.equal(c.meta.sobra, 1000);
  assert.equal(c.veredito.situacao, "ok");
});

test("sem contagem de estoque: lucro é ESTIMATIVA e perda é DADOS INSUFICIENTES", () => {
  const c = conferenciaDoLucro({
    dre: dre({ marmitas: 100, lucroLiquido: 500, margemContribuicao: 1500 }, "estimado"),
    cmvReal: { valor: null, motivos: ["Sem contagem no fim do mês."] }, cmvPrev: { valor: 1200 }, metaPorMarmita: "",
  });
  assert.equal(c.natureza, "ESTIMATIVA");
  assert.equal(c.perda, null);
  assert.match(c.itens[0].titulo, /DADOS INSUFICIENTES/);
  assert.match(c.itens[1].texto, /Defina a meta/);
  assert.ok(c.veredito.aviso);
});

test("prejuízo e margem que não cobre", () => {
  const c = conferenciaDoLucro({ dre: dre({ marmitas: 100, lucroLiquido: -300, margemContribuicao: -50 }), cmvReal: { valor: 900 }, cmvPrev: { valor: 900 }, metaPorMarmita: 10 });
  assert.equal(c.veredito.situacao, "alerta");
  assert.equal(c.meta.marmitasFaltam, null);
  assert.match(c.itens[1].texto, /suba o preço/);
});
