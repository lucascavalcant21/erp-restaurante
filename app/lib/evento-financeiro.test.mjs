// Eventos: funil, custo, preço e compras. Rode com: node --test app/lib/evento-financeiro.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { normalizarEtapa, FUNIL_ETAPAS, custoPorcaoDaFicha, resumoDoEvento, pendenciasDoEvento, listaDeComprasDoEvento } from "./evento-financeiro.mjs";

const carne = { id: "carne", nome: "Carne de sol", unidade_medida: "kg", preco_normalizado: 39.9, peso_bruto_padrao: 1000, perda_g: 150, perda_pct: 15 };
const farinha = { id: "farinha", nome: "Farinha", unidade_medida: "kg", preco_normalizado: 8 };
const manteiga = { id: "manteiga", nome: "Manteiga", unidade_medida: "kg", preco_normalizado: 50 };
const farofa = { id: "farofa", nome_receita: "Farofa", eh_base: true, rendimento_porcoes: 1, rendimento_unidade: "kg",
  fichas_ingredientes: [{ insumos: farinha, quantidade: 0.9, fator_correcao: 0 }, { insumos: manteiga, quantidade: 0.1, fator_correcao: 0 }] };
const prato = { id: "prato", nome_receita: "Carne com farofa", rendimento_porcoes: 0.3, rendimento_unidade: "kg",
  fichas_ingredientes: [{ insumos: carne, quantidade: 0.2, fator_correcao: 0 }, { subficha_id: "farofa", quantidade: 0.1, fator_correcao: 0 }] };
const FICHAS = [prato, farofa];
const EVENTO = { capacidade: 100, valor_contratado: 6000, total_custo_equipe: 900, custo_aluguel_espaco: 300, taxa_imposto_pct: 6, taxa_maquininha_pct: 0,
  cardapio_itens: [{ id: "i1", ficha_id: "prato", nome: "Carne com farofa", quantidade_servida: 100, departamento: "cozinha", custo_porcao: 1 }],
  historico_pagamentos: [{ valor: 3000 }], funil_status: "CONFIRMADO" };

test("funil: etapa com acento ou de outra versão cai na lista única", () => {
  assert.equal(normalizarEtapa("NEGOCIAÇÃO"), "NEGOCIACAO");
  assert.equal(normalizarEtapa("Informações recebidas"), "INFORMACOES RECEBIDAS");
  assert.equal(normalizarEtapa(null), "NOVO CONTATO");
  assert.equal(normalizarEtapa("qualquer coisa"), "NOVO CONTATO");
  assert.ok(FUNIL_ETAPAS.includes("CANCELADO"));
});

test("custo da porção vem da ficha (perda e subficha), não do valor gravado", () => {
  // 0,2 kg × 46,94 + 0,1 kg de farofa (0,9×8 + 0,1×50 = 12,20/kg) = 9,388 + 1,22
  const c = custoPorcaoDaFicha(prato, FICHAS);
  assert.ok(Math.abs(c - (0.2 * 39.9 / 0.85 + 0.1 * 12.2)) < 0.001);
  const r = resumoDoEvento(EVENTO, FICHAS, {});
  assert.ok(Math.abs(r.itens[0].custoPorcao - c) < 1e-9);
  assert.equal(r.itens[0].aoVivo, true);
});

test("resumo: CMV, equipe, extras, imposto, resultado e % sobre o valor do evento", () => {
  const r = resumoDoEvento(EVENTO, FICHAS, { margem_alvo_pct: 15 });
  const cmv = r.cmv;
  assert.equal(cmv, Math.round(custoPorcaoDaFicha(prato, FICHAS) * 100 * 100) / 100);
  const l = Object.fromEntries(r.linhas.map((x) => [x.id, x]));
  assert.equal(l.imposto.valor, 360);
  assert.equal(r.resultado.valor, Math.round((6000 - cmv - 900 - 300 - 360) * 100) / 100);
  assert.equal(l.equipe.pct, 15);
  assert.equal(r.custoPorConvidado, Math.round((cmv + 1200) / 100 * 100) / 100);
  assert.equal(r.receitaPorConvidado, 60);
  // preço sugerido: (CMV + equipe + extras) ÷ (1 − 6% − 15%)
  assert.equal(r.precoSugerido, Math.round(((cmv + 1200) / 0.79) * 100) / 100);
  assert.equal(r.pendente, 3000);
});

test("pendências saem dos dados", () => {
  const r = resumoDoEvento(EVENTO, FICHAS, {});
  assert.ok(pendenciasDoEvento(EVENTO, r, "2026-01-01").some((p) => /Falta receber/.test(p)));
  const vazio = resumoDoEvento({ funil_status: "NOVO CONTATO" }, FICHAS, {});
  const p = pendenciasDoEvento({}, vazio, "2026-01-01");
  assert.ok(p.includes("Cardápio não montado."));
  assert.ok(p.includes("Valor do evento não definido."));
  const passado = pendenciasDoEvento({ ...EVENTO, data_evento: "2025-12-01" }, r, "2026-01-01");
  assert.ok(passado.some((x) => /data já passou/.test(x)));
});

test("lista de compras: bruto com perda, abre o pré-preparo, soma e custeia", () => {
  const l = listaDeComprasDoEvento(EVENTO, FICHAS);
  const por = Object.fromEntries(l.itens.map((x) => [x.nome, x]));
  assert.ok(Math.abs(por["Carne de sol"].quantidade - 20 / 0.85) < 0.001); // 100 × 0,2 kg limpo ÷ 0,85
  assert.equal(por.Farinha.quantidade, 9);     // 100 × 0,1 kg de farofa × 0,9
  assert.equal(por.Manteiga.quantidade, 1);
  assert.ok(Math.abs(por["Carne de sol"].custo - (20 / 0.85) * 39.9) < 0.01);
  assert.ok(Math.abs(l.total - (por["Carne de sol"].custo + 72 + 50)) < 0.02);
  assert.deepEqual(l.avisos, []);
});
