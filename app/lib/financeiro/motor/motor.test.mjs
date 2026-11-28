import { test } from "node:test";
import assert from "node:assert/strict";
import {
  centavos, fracao, precoComercial, textoReais, precoRecomendado, taxasDoItem,
  resultadoDoItem, pontoDeEquilibrioPonderado, simularPromocao, custoDaFicha,
} from "./index.mjs";

test("centavos lê número e texto pt-BR; vazio é null, nunca zero", () => {
  assert.equal(centavos(23.41), 2341);
  assert.equal(centavos("1.234,56"), 123456);
  assert.equal(centavos("R$ 0,10"), 10);
  assert.equal(centavos(""), null);
  assert.equal(centavos(null), null);
  assert.equal(centavos("abc"), null);
  assert.equal(fracao("23%"), 0.23);
  assert.equal(textoReais(2341), "R$ 23,41");
});

test("exemplo do documento: custo 11, taxa 23%, margem 30%", () => {
  const r = precoRecomendado({ custoC: 1100, regras: [{ nome: "Plataforma", tipo: "percentual", valor: 23 }], margemPct: 30 });
  assert.equal(r.status, "OK");
  assert.ok(Math.abs(r.exatoC / 100 - 23.404255) < 1e-6);
  assert.equal(r.minimoC, 2341); // arredonda para cima: não reduz a margem
  assert.equal(r.comercialC, 2390);
});

test("caso geral (busca) dá o mesmo preço do caso simples", () => {
  const regras = [{ nome: "Plataforma", tipo: "percentual", valor: 23 }];
  const simples = precoRecomendado({ custoC: 1100, regras, margemPct: 30 });
  const geral = precoRecomendado({ custoC: 1100, regras: [...regras, { nome: "zero", tipo: "fixo_pedido", valor: 0 }], margemPct: 30 });
  assert.equal(geral.minimoC, simples.minimoC);
});

test("cenário inviável é bloqueado", () => {
  const r = precoRecomendado({ custoC: 1000, regras: [{ nome: "x", tipo: "percentual", valor: 75 }], margemPct: 30 });
  assert.equal(r.status, "INVIAVEL");
});

test("sem custo ou sem margem: DADOS INSUFICIENTES", () => {
  assert.equal(precoRecomendado({ custoC: null, margemPct: 30 }).status, "DADOS INSUFICIENTES");
  assert.equal(precoRecomendado({ custoC: 1000 }).status, "DADOS INSUFICIENTES");
});

test("taxas com bases diferentes, fixo por pedido e mensalidade", () => {
  const regras = [
    { nome: "Comissão", tipo: "percentual", base: "receita_loja", valor: 12 },
    { nome: "Pagamento online", tipo: "percentual", base: "preco_pago", valor: 3.2 },
    { nome: "Taxa por pedido", tipo: "fixo_pedido", valor: 1 },
    { nome: "Mensalidade", tipo: "mensal", valor: 100, vigencia: { de: "2026-01-01", ate: null } },
  ];
  const t = taxasDoItem({ regras, precoListaC: 4000, descontoLojaC: 400, descontoAppC: 400, itensPorPedido: 2, itensNoMes: 1000, data: "2026-11-27" });
  // comissão 12% de 36,00 = 4,32; pagamento 3,2% de 32,00 = 1,024 → 1,02; pedido 1,00/2 = 0,50; mensal 100/1000 = 0,10
  assert.deepEqual(t.linhas.map((l) => l.valorC), [432, 102, 50, 10]);
  assert.equal(t.totalC, 594);
  const fora = taxasDoItem({ regras, precoListaC: 4000, itensNoMes: null });
  assert.ok(fora.avisos.some((a) => /Mensalidade/.test(a)));
});

test("regra fora da vigência não entra", () => {
  const regras = [{ nome: "Antiga", tipo: "percentual", valor: 30, vigencia: { de: "2025-01-01", ate: "2025-12-31" } }];
  assert.equal(taxasDoItem({ regras, precoListaC: 1000, data: "2026-11-27" }).totalC, 0);
});

test("produto com prejuízo aparece com margem negativa", () => {
  const r = resultadoDoItem({ precoListaC: 1500, custoC: 1400, regras: [{ nome: "App", tipo: "percentual", valor: 27 }] });
  assert.ok(r.margemC < 0);
});

test("ponto de equilíbrio ponderado pelo mix", () => {
  const r = pontoDeEquilibrioPonderado({
    fixosC: 2000000, diasMes: 26,
    mix: [{ receitaC: 3000, margemC: 1200, quantidade: 100 }, { receitaC: 1000, margemC: 200, quantidade: 100 }],
  });
  // margem média = (120000 + 20000) / (300000 + 100000) = 35%
  assert.equal(Math.round(r.mcPct), 35);
  assert.equal(r.faturamentoMesC, Math.ceil(2000000 / 0.35));
  assert.equal(pontoDeEquilibrioPonderado({ fixosC: 1000, mix: [] }).status, "DADOS INSUFICIENTES");
  assert.equal(pontoDeEquilibrioPonderado({ fixosC: 1000, mix: [{ receitaC: 1000, margemC: -10, quantidade: 5 }] }).status, "INVIAVEL");
});

test("promoção compartilhada: subsídio, margem antes/depois e volume para empatar", () => {
  const r = simularPromocao({
    precoListaC: 4000, custoC: 1500, regras: [{ nome: "App", tipo: "percentual", base: "preco_lista", valor: 20 }],
    desconto: { tipo: "percentual", valor: 20, lojaPct: 50 }, volumeBase: 100,
  });
  assert.equal(r.descontoC, 800);
  assert.equal(r.pagoPelaLojaC, 400);
  assert.equal(r.pagoPeloAppC, 400);
  assert.equal(r.antes.margemC, 4000 - 800 - 1500);
  assert.equal(r.depois.margemC, 3600 - 800 - 1500);
  assert.equal(r.volumeNecessario, Math.ceil((1700 * 100) / 1300));
  const ruim = simularPromocao({ precoListaC: 2000, custoC: 1500, desconto: { tipo: "fixo", valor: 8 } });
  assert.ok(ruim.avisos[0].includes("negativa"));
});

test("custo da ficha usa a conta das fichas (sem fórmula paralela)", () => {
  const ficha = { id: "f", rendimento_porcoes: 2, fichas_ingredientes: [{ quantidade: 0.5, insumos: { nome: "Arroz", unidade_medida: "kg", custo_unitario: 8, custo_compra: 8 } }] };
  const r = custoDaFicha(ficha, [ficha]);
  assert.equal(r.totalC, 400);
  assert.equal(r.porPorcaoC, 200);
  assert.equal(custoDaFicha({ id: "v", fichas_ingredientes: [] }).status, "DADOS INSUFICIENTES");
});

test("preço comercial nunca fica abaixo do mínimo", () => {
  assert.equal(precoComercial(2341), 2390);
  assert.equal(precoComercial(2395), 2490);
  assert.equal(precoComercial(2390), 2390);
  assert.equal(precoComercial(2341, [90, 99]), 2390);
});
