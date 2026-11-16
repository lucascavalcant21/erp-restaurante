// Raio-x do preço e guia de montagem da marmita pela conversa (16/11/2026).
// TESTADO EM MOCK: banco em memória (sem filtro: o agente separa por ficha).
import test from "node:test";
import assert from "node:assert/strict";
import { HANDLERS_MARMITARIA } from "../agents/marmitaria-agente.mjs";
import { interpretarPorRegras } from "../commands/interpretador-regras.mjs";

const FICHAS = [
  { id: "m1", nome_receita: "Frango empanado com fritas", departamento: "marmitaria", ativo: true, status: "ativa", preco_venda: 30, peso_final_g: 450 },
  { id: "m2", nome_receita: "Carne de panela", departamento: "marmitaria", ativo: true, status: "ativa", preco_venda: 0 },
  { id: "b1", nome_receita: "Arroz branco", departamento: "cozinha", eh_base: true, ativo: true, status: "ativa", rendimento_porcoes: 5, rendimento_unidade: "kg" },
];
const INGS = [
  { ficha_id: "m1", subficha_id: "b1", quantidade: 0.2, fator_correcao: 0 },
  { ficha_id: "m1", insumo_id: "i1", quantidade: 0.15, fator_correcao: 0 },
  { ficha_id: "m1", insumo_id: "i2", quantidade: 0.12, fator_correcao: 0 },
  { ficha_id: "b1", insumo_id: "i3", quantidade: 2, fator_correcao: 0 },
];
const INSUMOS = [
  { id: "i1", nome: "Filé de frango", unidade_medida: "kg", custo_unitario: 24, tamanho_embalagem: 1, custo_compra: 24 },
  { id: "i2", nome: "Batata frita", unidade_medida: "kg", custo_unitario: 12, tamanho_embalagem: 1, custo_compra: 12 },
  { id: "i3", nome: "Arroz agulhinha", unidade_medida: "kg", custo_unitario: 6, tamanho_embalagem: 1, custo_compra: 6 },
  { id: "e1", nome: "Pote 750 ml", unidade_medida: "un", custo_unitario: 0.9, tamanho_embalagem: 1, custo_compra: 0.9, departamento: "embalagens" },
];
const CONFIG = [{ canais: [{ id: "ifood", nome: "iFood", ativo: true, comissao_pct: 12, taxa_pagamento_pct: 3.2 }], tributos_pct: null,
  rateio: { regime: "mei", marmitas_mes: 1000, cmo_mes: 9000, custos_fixos: [{ nome: "Pró-labore", valor: 3000 }, { nome: "Aluguel", valor: 2000 }], custos_variaveis: [{ nome: "Óleo", valor: 0.3 }] } }];

function motorFalso({ pode = true, tabelas = {} } = {}) {
  const base = {
    fichas_tecnicas: FICHAS, fichas_ingredientes: INGS, insumos: INSUMOS, marmitaria_configuracoes: CONFIG,
    marmitaria_fichas_embalagens: [{ ficha_id: "m1", embalagem_insumo_id: "e1", quantidade: 1 }],
    marmitaria_precificacao_canais: [{ ficha_id: "m1", canal: "ifood", preco_venda: 30 }],
    marmitaria_rh_alocacoes: [{ colaborador_id: "c1", ativo: true }, { colaborador_id: "c2", ativo: true }, { colaborador_id: "c3", ativo: true }],
    marmitaria_vendas: [],
    config_sistema: [{ params: { marmitaria_processos: { m1: { etapas: [{ id: "x", grupo: "montagem", titulo: "Arroz no fundo", texto: "Espalhe bem" }] } } } }],
    ...tabelas,
  };
  const q = (t) => { const r = { data: base[t] || [], error: null }; const o = { select: () => o, eq: () => o, gte: () => o, lte: () => o, limit: () => o, in: () => o, order: () => o, then: (f, g) => Promise.resolve(r).then(f, g) }; return o; };
  return { ambiente: { dbe: { from: q, consultas: [] }, hoje: "2026-11-16", verificador: { pode: async () => pode } } };
}

test("as frases do dono caem no raio-x e na montagem", () => {
  const id = (f) => interpretarPorRegras(f).valor.intencao;
  assert.equal(id("Como são nossas marmitas?"), "marmitaria.raio_x");
  assert.equal(id("Qual é o componente mais caro da marmita de frango?"), "marmitaria.raio_x");
  assert.equal(id("Quem está ganhando quanto por essa marmita?"), "marmitaria.raio_x");
  assert.equal(id("Nico, como monta a marmita de frango?"), "marmitaria.montagem");
});

test("raio-x da marmita citada: equipe, pró-labore, aluguel, lucro e o mais caro", async () => {
  const out = await HANDLERS_MARMITARIA["marmitaria.raio_x"]({ motor: motorFalso(), params: { texto: "quem está ganhando quanto na marmita de frango empanado?" } });
  assert.match(out.texto, /^Frango empanado com fritas a R\$\s30,00 no iFood/);
  assert.match(out.texto, /equipe \(3 pessoas\) leva R\$\s9,00 \(30%\)/);
  assert.match(out.texto, /pró-labore R\$\s3,00/);
  assert.match(out.texto, /mais caro é Filé de frango/);
  assert.equal(out.natureza, "ESTIMATIVA");
  assert.equal(out.blocos[0].itens.at(-1).rotulo, "Lucro");
});

test("sem marmita citada: resumo de todas; sem preço fica de fora", async () => {
  const out = await HANDLERS_MARMITARIA["marmitaria.raio_x"]({ motor: motorFalso(), params: { texto: "como são nossas marmitas?" } });
  assert.match(out.texto, /1 marmita com preço e ficha/);
  assert.match(out.texto, /1 sem preço ou ficha ficaram de fora/);
});

test("sem permissão de margem, não mostra número", async () => {
  const out = await HANDLERS_MARMITARIA["marmitaria.raio_x"]({ motor: motorFalso({ pode: false }), params: { texto: "como são nossas marmitas?" } });
  assert.doesNotMatch(out.texto, /R\$/);
});

test("guia de montagem pelo Nico: gramas, embalagem e passo a passo, sem custo", async () => {
  const out = await HANDLERS_MARMITARIA["marmitaria.montagem"]({ motor: motorFalso(), params: { texto: "Nico, como monta a marmita de frango empanado?" } });
  assert.match(out.texto, /Arroz branco: 200 g/);
  assert.match(out.texto, /Filé de frango: 150 g/);
  assert.match(out.texto, /1 Pote 750 ml/);
  assert.doesNotMatch(out.texto, /R\$/);
  assert.ok(out.blocos.some((b) => b.titulo === "Montagem" && b.itens[0].rotulo === "1. Arroz no fundo"));
});

test("marmita pela frase: empate não escolhe sozinho", async () => {
  const { marmitaDaFrase } = await import("../agents/marmitaria-agente.mjs");
  const ms = [{ id: "a", nome_receita: "Frango grelhado" }, { id: "b", nome_receita: "Frango empanado" }, { id: "c", nome_receita: "Carne de panela" }];
  assert.equal(marmitaDaFrase(ms, "marmita de frango empanado")?.id, "b");
  assert.equal(marmitaDaFrase(ms, "marmita de frango"), null);
  assert.equal(marmitaDaFrase(ms, "a de carne")?.id, "c");
});
