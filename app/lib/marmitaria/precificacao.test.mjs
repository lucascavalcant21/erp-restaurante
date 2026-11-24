import { test } from "node:test";
import assert from "node:assert/strict";
import { taxaDaFatura, resultadoPorCanal, normalizarCanal, precoSugerido } from "./nucleo.mjs";
import { alertasDoPreco, cascataDoPreco, contaDoPreco, descontoDaLoja, descontoDoPreco, faixaDePrecos, precoComCupom } from "./precificacao.mjs";

// Testes mínimos da especificação "Héfisto — Delivery Marmitas" (21/11/2026).

test("(1) fatura 99Food: 799,80 − 85,92 − 107,02 = 606,86 e os percentuais", () => {
  const f = taxaDaFatura({ ganhos: "799,80", ofertas: "85,92", taxas: "107,02" });
  assert.equal(f.liquido, 606.86);
  assert.equal(f.ofertasPct, 10.7427);
  assert.equal(f.taxasPct, 13.3808);
  assert.equal(f.totalPct, 24.1235);
  assert.equal(f.repassePct, 75.8765);
  assert.equal(taxaDaFatura({ ganhos: 100, ofertas: 60, taxas: 50 }), null);
});

test("(2) desconto 42 → 30 = R$ 12 (28,57%); (3) 50 com cupom de 25% = 37,50", () => {
  assert.deepEqual(descontoDoPreco({ precoLista: 42, clientePaga: 30 }), { desconto: 12, pct: 28.57 });
  assert.equal(precoComCupom(50, 25), 37.5);
  assert.equal(descontoDoPreco({ precoLista: 30, clientePaga: 42 }), null);
});

test("(5) rateio simples 22.120 / 2.600 ≈ 8,51 por marmita", () => {
  const fixos = [5000, 3000, 800, 5000, 120, 400, 300, 7500];
  const total = fixos.reduce((a, b) => a + b, 0);
  assert.equal(total, 22120); // (4)
  assert.equal(Math.round((total / 2600) * 100) / 100, 8.51);
});

test("(6) a taxa da fatura só vale quando o dono liga; nunca vira promoção obrigatória", () => {
  const canal = { id: "99food", nome: "99", comissao_pct: 8.9, taxa_pagamento_pct: 3.2, fatura_ganhos: 799.8, fatura_ofertas: 85.92, fatura_taxas: 107.02 };
  const contrato = resultadoPorCanal({ preco: 40, custoTecnico: 10, canal });
  assert.equal(contrato.modoTaxa, "contrato");
  assert.equal(contrato.promocao, 0);
  assert.equal(contrato.comissao, 3.56);
  const fatura = resultadoPorCanal({ preco: 40, custoTecnico: 10, canal: { ...canal, usar_fatura: true } });
  assert.equal(fatura.modoTaxa, "fatura");
  assert.equal(fatura.promocao, 4.3); // 10,74% de 40
  assert.equal(fatura.comissao, 5.35); // 13,38% de 40
  assert.equal(r2(fatura.receita - fatura.variaveis), 30.35); // ≈ 75,88% de 40
  // fatura incoerente não liga o modo
  assert.equal(normalizarCanal({ ...canal, usar_fatura: true, fatura_taxas: 900 }).usar_fatura, false);
});
const r2 = (n) => Math.round(n * 100) / 100;

test("(7) desconto pago pelo app não sai da loja; o da loja sai uma vez só", () => {
  const canal = { id: "balcao", nome: "Balcão", comissao_pct: 0, taxa_pagamento_pct: 0 };
  const loja = contaDoPreco({ precoLista: 42, clientePaga: 30, quemPaga: "loja", custo: 12, canal, tributosPct: 0 });
  const app = contaDoPreco({ precoLista: 42, clientePaga: 30, quemPaga: "app", custo: 12, canal, tributosPct: 0 });
  const meio = contaDoPreco({ precoLista: 42, clientePaga: 30, quemPaga: "dividido", parteLojaPct: 50, custo: 12, canal, tributosPct: 0 });
  assert.equal(loja.r.receita, 30);
  assert.equal(app.r.receita, 42);
  assert.equal(meio.r.receita, 36);
  assert.equal(app.descontoApp, 12);
  assert.equal(descontoDaLoja({ desconto: 12, quemPaga: "dividido", parteLojaPct: 25 }), 3);
});

test("(8) cascata não duplica embalagem: ingredientes + embalagem = custo da ficha", () => {
  const canal = { id: "balcao", nome: "Balcão", comissao_pct: 0, taxa_pagamento_pct: 0 };
  const { r } = contaDoPreco({ precoLista: 35, custo: 13.3, canal, tributosPct: 0, embutidos: { cmoPorMarmita: 2.88, fixosPorMarmita: 5.63 } });
  const c = cascataDoPreco({ r, custo: { ingredientes: 11.5, embalagens: 1.8 } });
  const v = Object.fromEntries(c.map((l) => [l.id, l.valor]));
  assert.equal(v.ingredientes + v.embalagens, -13.3);
  assert.equal(v.contribuicao, 21.7);
  assert.equal(r2(v.equipe + v.fixos), -8.51);
  assert.equal(v.lucro, 13.19);
  assert.equal(c.at(-1).tipo, "final");
});

test("(9)(10) lucro é estimativa; sem custo completo o lucro fica pendente; meta e CMV acima de 30%", () => {
  const canal = { id: "balcao", nome: "Balcão", comissao_pct: 0, taxa_pagamento_pct: 0 };
  const { r } = contaDoPreco({ precoLista: 30, custo: 12, canal, tributosPct: 0, embutidos: { cmoPorMarmita: 4, fixosPorMarmita: 5 } });
  const tipos = alertasDoPreco({ r, metaReais: 10, completo: false }).map((a) => a.tipo);
  assert.deepEqual(tipos, ["pendente", "alerta", "alerta"]);
});

test("preço mínimo (lucro zero) e preços para as metas de R$ 10 e R$ 12", () => {
  const canal = { id: "99food", nome: "99", comissao_pct: 8.9, taxa_pagamento_pct: 3.2 };
  const f = faixaDePrecos({ custoComEmbutidos: 20, canal, tributosPct: 0, metas: [12, 10, 10] });
  assert.equal(f.minimo, precoSugerido({ custoTecnico: 20, canal, tributosPct: 0, margemAlvoPct: 0 }).preco);
  assert.deepEqual(f.metas.map((m) => m.lucro), [10, 12]);
  assert.ok(f.metas[0].preco > f.minimo && f.metas[1].preco > f.metas[0].preco);
  const r = resultadoPorCanal({ preco: f.metas[0].preco, custoTecnico: 20, canal });
  assert.ok(r.margemContribuicao >= 10 && r.margemContribuicao < 10.02);
  assert.equal(faixaDePrecos({ custoComEmbutidos: null, canal }).minimo, null);
});

test("pró-labore aparece separado na cascata, sem contar duas vezes", () => {
  const canal = { id: "balcao", nome: "Balcão", comissao_pct: 0, taxa_pagamento_pct: 0 };
  const { r } = contaDoPreco({ precoLista: 35, custo: 13.3, canal, tributosPct: 0, embutidos: { cmoPorMarmita: 2.88, fixosPorMarmita: 5.63, proLaborePorMarmita: 1.92 } });
  const c = cascataDoPreco({ r, custo: { ingredientes: 11.5, embalagens: 1.8 } });
  const v = Object.fromEntries(c.map((l) => [l.id, l.valor]));
  assert.equal(v.prolabore, -1.92);
  assert.equal(v.fixos, -3.71);
  assert.equal(v.equipe, -2.88);
  assert.equal(v.lucro, 13.19);
});
