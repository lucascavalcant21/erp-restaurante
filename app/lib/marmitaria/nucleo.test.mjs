// Testes do núcleo da marmitaria. Cada número esperado foi feito à mão e a
// conta está no comentário ao lado. Rode: node --test app/lib/marmitaria/nucleo.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import {
  custoDaMarmita, resultadoPorCanal, precoSugerido, necessidadeDeProducao, baixasDaProducao,
  cmoMarmitaria, encargosDaConfig, cmvRealDosEstoques, contasDaMarmitaria, dreMarmitaria, simular,
  periodo, paraUnidadeDoCadastro, canalConfigurado, validarCanal, cmvPrevisto, resumoVendas, rankingMarmitas, fatorSaldo, dreConsolidado,
} from "./nucleo.mjs";

// ── cadastro de teste ──────────────────────────────────────────────────────
const ins = (id, nome, unidade_medida, custo_compra, tamanho_embalagem = 1, extra = {}) =>
  ({ id, nome, unidade_medida, custo_compra, tamanho_embalagem, ...extra });
const ARROZ = ins("arroz", "Arroz cru", "kg", 6);
const FRANGO = ins("frango", "Frango", "kg", 20);
const CARNE = ins("carne", "Carne", "kg", 35);
const SAL = ins("sal", "Sal", "g", 2, 1000);          // R$ 2 o pacote de 1 kg
const POTE = ins("pote", "Pote 750 ml", "un", 1.1);
const TAMPA = ins("tampa", "Tampa", "un", 0.3);
const ESPELHO_ARROZ = ins("esp-arroz", "Arroz cozido", "kg", 0);
const insumos = new Map([ARROZ, FRANGO, CARNE, SAL, POTE, TAMPA, ESPELHO_ARROZ].map((i) => [i.id, i]));

// pré-preparo: 1 kg de arroz cru + 10 g de sal rendem 2,5 kg de arroz cozido
const ARROZ_COZIDO = {
  id: "arroz-cozido", nome_receita: "Arroz cozido", eh_base: true, rendimento_porcoes: 2.5, rendimento_unidade: "kg",
  fichas_ingredientes: [{ insumo_id: "arroz", insumos: ARROZ, quantidade: 1 }, { insumo_id: "sal", insumos: SAL, quantidade: 10 }],
};
const fichas = [ARROZ_COZIDO];

const MARMITA_FRANGO = {
  itens: [{ subficha_id: "arroz-cozido", quantidade: 0.15 }, { insumo_id: "frango", quantidade: 0.12, fator_correcao: 25 }],
  embalagens: [{ insumo_id: "pote", quantidade: 1 }, { insumo_id: "tampa", quantidade: 1 }],
};
const MARMITA_CARNE = {
  itens: [{ subficha_id: "arroz-cozido", quantidade: 0.15 }, { insumo_id: "carne", quantidade: 0.1 }],
  embalagens: [{ insumo_id: "pote", quantidade: 1 }, { insumo_id: "tampa", quantidade: 1 }],
};

test("custo técnico: ingrediente com FC, pré-preparo pelo rendimento e embalagens", () => {
  const c = custoDaMarmita({ ...MARMITA_FRANGO, fichas, insumos });
  // frango 0,12 kg × R$ 20 × 1,25 = 3,00
  // arroz cozido: lote = 1 kg × 6 + 10 g × R$ 2/kg = 6,02 → ÷ 2,5 kg = 2,408/kg × 0,15 = 0,3612
  // embalagens 1,10 + 0,30 = 1,40
  assert.equal(c.alimentos, 3);
  assert.equal(c.prePreparos, 0.36);
  assert.equal(c.embalagens, 1.4);
  assert.equal(c.total, 4.76);
  assert.deepEqual(c.pendencias, []);
  assert.equal(c.completo, true);
});

test("custo técnico: avisa ingrediente sem custo e pré-preparo inexistente, sem inventar valor", () => {
  const semCusto = ins("x", "Tempero novo", "kg", 0);
  const c = custoDaMarmita({ itens: [{ insumo_id: "x", quantidade: 0.01 }, { subficha_id: "nao-existe", quantidade: 1 }], fichas, insumos: new Map([["x", semCusto]]) });
  assert.equal(c.completo, false);
  assert.ok(c.pendencias.some((p) => p.includes("Tempero novo")));
  assert.ok(c.pendencias.some((p) => p.includes("pré-preparo")));
});

test("unidades: digitado em g vira kg do cadastro; grandezas diferentes recusam", () => {
  assert.equal(paraUnidadeDoCadastro(150, "g", "kg"), 0.15);
  assert.equal(paraUnidadeDoCadastro(0.5, "l", "ml"), 500);
  assert.equal(paraUnidadeDoCadastro(1, "kg", "ml"), null);
  assert.equal(fatorSaldo("kg"), 1000);
  assert.equal(fatorSaldo("un"), 1);
});

// ── preço por canal ─────────────────────────────────────────────────────────
const IFOOD = { id: "ifood", nome: "iFood", comissao_pct: 12, taxa_pagamento_pct: 3.2 };

test("margem de contribuição por canal: cada taxa uma vez, sobre a base certa", () => {
  const r = resultadoPorCanal({ preco: 30, custoTecnico: 10, canal: IFOOD, tributosPct: 6 });
  // tributos 30 × 6% = 1,80 · comissão 30 × 12% = 3,60 · pagamento 30 × 3,2% = 0,96
  // MC = 30 − 1,80 − 3,60 − 0,96 − 10 = 13,64 → 45,47% · CMV 33,33% · markup 3
  assert.equal(r.tributos, 1.8);
  assert.equal(r.comissao, 3.6);
  assert.equal(r.taxaPagamento, 0.96);
  assert.equal(r.margemContribuicao, 13.64);
  assert.equal(r.margemContribuicaoPct, 45.47);
  assert.equal(r.cmvTecnicoPct, 33.33);
  assert.equal(r.markup, 3);
  assert.deepEqual(r.avisos, []);
});

test("promoção custeada reduz a receita antes de tributo e comissão", () => {
  const r = resultadoPorCanal({ preco: 30, custoTecnico: 10, canal: { ...IFOOD, promocao_pct: 10 }, tributosPct: 6 });
  // receita 27 · tributo 1,62 · comissão 3,24 · pagamento 0,864 · MC = 27 − 1,62 − 3,24 − 0,864 − 10 = 11,276
  assert.equal(r.receita, 27);
  assert.equal(r.margemContribuicao, 11.28);
  assert.equal(r.margemContribuicaoPct, 41.76);
});

test("pagamento incluído na comissão não é cobrado de novo; taxas por pedido divididas pelas marmitas do pedido", () => {
  const r = resultadoPorCanal({ preco: 30, custoTecnico: 10, tributosPct: 0,
    canal: { ...IFOOD, pagamento_na_comissao: true, taxa_fixa_pedido: 1, entrega_subsidiada_pedido: 4, itens_por_pedido: 2 } });
  // 30 − 3,60 (comissão) − 0,50 (taxa fixa ÷ 2) − 2,00 (entrega ÷ 2) − 10 = 13,90
  assert.equal(r.taxaPagamento, 0);
  assert.equal(r.taxaFixa, 0.5);
  assert.equal(r.entrega, 2);
  assert.equal(r.margemContribuicao, 13.9);
});

test("canal e tributos sem configuração geram aviso, não número escondido", () => {
  const r = resultadoPorCanal({ preco: 30, custoTecnico: 10, canal: { id: "whatsapp", nome: "WhatsApp" } });
  assert.equal(r.avisos.length, 2);
  assert.equal(canalConfigurado({ id: "whatsapp" }), false);
  assert.equal(canalConfigurado({ id: "balcao", comissao_pct: 0, taxa_pagamento_pct: 0 }), true);
  assert.ok(validarCanal({ id: "x", nome: "X", comissao_pct: 120 }).length >= 1);
  assert.equal(resultadoPorCanal({ preco: 0, custoTecnico: 10 }).valido, false);
});

test("preço sugerido atinge a margem-alvo e recusa o impossível", () => {
  const s = precoSugerido({ custoTecnico: 10, canal: IFOOD, tributosPct: 6, margemAlvoPct: 30 });
  // k = 0,06 + 0,12 + 0,032 = 0,212 · P = 10 ÷ (0,70 − 0,212) = 20,4918 → 20,50
  assert.equal(s.preco, 20.5);
  const conf = resultadoPorCanal({ preco: s.preco, custoTecnico: 10, canal: IFOOD, tributosPct: 6 });
  assert.ok(conf.margemContribuicaoPct >= 30);
  assert.equal(precoSugerido({ custoTecnico: 10, canal: IFOOD, tributosPct: 6, margemAlvoPct: 80 }).preco, null);
  assert.equal(precoSugerido({ custoTecnico: 0, canal: IFOOD, margemAlvoPct: 30 }).preco, null);
});

// ── produção e compras ─────────────────────────────────────────────────────
test("80 de frango e 40 de carne: usa o arroz já cozido, explode o resto e desconta o estoque", () => {
  const r = necessidadeDeProducao({
    plano: [{ ficha_id: "f", quantidade: 80 }, { ficha_id: "c", quantidade: 40 }],
    marmitas: new Map([["f", MARMITA_FRANGO], ["c", MARMITA_CARNE]]),
    fichas, insumos,
    saldo: new Map([["esp-arroz", 3], ["arroz", 5], ["frango", 4], ["pote", 100], ["tampa", 200]]),
    espelho: new Map([["arroz-cozido", "esp-arroz"]]),
  });
  // arroz cozido: 120 × 0,15 = 18 kg; há 3 → produzir 15 kg = 6 lotes
  const prep = r.prePreparos[0];
  assert.deepEqual([prep.necessario, prep.disponivel, prep.produzir, prep.lotes], [18, 3, 15, 6]);
  const item = (id) => r.itens.find((i) => i.insumo_id === id);
  // frango 80 × 0,12 × 1,25 = 12 kg − 4 = 8 · carne 40 × 0,1 = 4 · arroz cru 6 lotes × 1 kg = 6 − 5 = 1
  // sal 6 × 10 g = 60 g · pote 120 − 100 = 20 · tampa 120 − 200 = 0
  assert.deepEqual([item("frango").necessario, item("frango").comprar], [12, 8]);
  assert.equal(item("carne").comprar, 4);
  assert.equal(item("arroz").comprar, 1);
  assert.equal(item("sal").comprar, 60);
  assert.equal(item("pote").comprar, 20);
  assert.equal(item("tampa").comprar, 0);
  assert.equal(item("pote").tipo, "embalagem");
  // valor: 8 × 20 + 4 × 35 + 1 × 6 + 0,06 kg × 2 + 20 × 1,10 = 160 + 140 + 6 + 0,12 + 22 = 328,12
  assert.equal(r.valorEstimadoCompras, 328.12);
  assert.equal(r.listaDeCompras.length, 5);
});

test("pré-preparo dentro de pré-preparo: demanda completa antes de descontar o saldo", () => {
  const molho = { id: "molho", nome_receita: "Molho", eh_base: true, rendimento_porcoes: 1, rendimento_unidade: "kg",
    fichas_ingredientes: [{ subficha_id: "arroz-cozido", quantidade: 0.5 }] };
  const marmita = { itens: [{ subficha_id: "molho", quantidade: 0.1 }, { subficha_id: "arroz-cozido", quantidade: 0.1 }], embalagens: [] };
  const r = necessidadeDeProducao({ plano: [{ ficha_id: "m", quantidade: 10 }], marmitas: new Map([["m", marmita]]),
    fichas: [ARROZ_COZIDO, molho], insumos, saldo: new Map([["esp-arroz", 1]]), espelho: new Map([["arroz-cozido", "esp-arroz"]]) });
  // molho 1 kg → arroz cozido 0,5 + direto 1,0 = 1,5 kg; há 1 → produzir 0,5 kg = 0,2 lote → 0,2 kg de arroz cru
  const arroz = r.prePreparos.find((p) => p.ficha_id === "arroz-cozido");
  assert.deepEqual([arroz.necessario, arroz.produzir], [1.5, 0.5]);
  assert.equal(r.itens.find((i) => i.insumo_id === "arroz").necessario, 0.2);
});

test("baixa da produção: pré-preparo sai como pré-preparo (sem baixar o arroz cru de novo) e escolhe o estoque com saldo", () => {
  const r = baixasDaProducao({
    marmita: MARMITA_FRANGO, quantidade: 10, fichas, insumos, espelho: new Map([["arroz-cozido", "esp-arroz"]]),
    saldos: new Map([
      ["esp-arroz", [{ estoque_id: "pre", estoque_nome: "Pré-preparos", saldo: 2000, prioridade: 1 }]],
      ["frango", [{ estoque_id: "marm", saldo: 1000, prioridade: 0 }, { estoque_id: "coz", saldo: 5000, prioridade: 1 }]],
      ["tampa", [{ estoque_id: "emb", saldo: 50, prioridade: 0 }]],
    ]),
  });
  const b = (id) => r.baixas.find((x) => x.insumo_id === id);
  assert.deepEqual([b("esp-arroz").quantidade, b("esp-arroz").estoque_id], [1500, "pre"]); // 10 × 0,15 kg = 1.500 g
  assert.deepEqual([b("frango").quantidade, b("frango").estoque_id], [1500, "coz"]);      // 10 × 0,12 × 1,25 kg
  assert.equal(b("arroz"), undefined);
  assert.equal(b("tampa").quantidade, 10);
  assert.equal(r.faltas.length, 1); // pote sem saldo em lugar nenhum
  assert.ok(r.faltas[0].includes("Pote"));
});

// ── CMO ──────────────────────────────────────────────────────────────────────
test("CMO: exclusivo inteiro, compartilhado pela fração, extra pelo recibo pago; o resto fica no restaurante", () => {
  const colaboradores = [
    { id: "a", nome: "Ana", salario: 2000, vale_alimentacao: 300 },
    { id: "b", nome: "Bruno", salario: 3000 },
    { id: "c", nome: "Caio", tipo_contrato: "Freelancer" },
  ];
  const r = cmoMarmitaria({
    alocacoes: [{ colaborador_id: "a", tipo_alocacao: "exclusivo" }, { colaborador_id: "b", tipo_alocacao: "compartilhado", percentual_tempo: 40 },
      { colaborador_id: "c", tipo_alocacao: "compartilhado", percentual_tempo: 50 }],
    colaboradores, mes: "2026-10", marmitasVendidas: 300,
    recibos: [{ colaborador_id: "c", pagamento_realizado: true, data_pagamento: "2026-10-05", valor_total: 150 },
      { colaborador_id: "c", pagamento_realizado: false, data_trabalho: "2026-10-06", valor_total: 150 }],
    encargos: encargosDaConfig({}),
  });
  // Ana: 2000 + FGTS 160 + provisões 2000 × 19,44% × 1,08 = 419,90 + VA 300 = 2879,90
  // Bruno: (3000 + 240 + 629,86) × 40% = 1547,94 · Caio: 150 × 50% = 75
  assert.equal(r.linhas[0].marmitaria, 2879.9);
  assert.equal(r.linhas[1].marmitaria, 1547.94);
  assert.equal(r.linhas[1].restaurante, 2321.91);
  assert.equal(r.linhas[2].marmitaria, 75);
  assert.equal(r.total, 4502.84);
  assert.equal(r.porMarmita, 15.01);
  assert.equal(r.natureza, "estimativa");
});

test("CMO: INSS patronal vem do anexo IV do RH; Simples I–III não soma", () => {
  assert.equal(encargosDaConfig({}, { anexo_simples: "III" }).inss_patronal_pct, 0);
  assert.equal(encargosDaConfig({}, { anexo_simples: "IV", rat_pct: 2, fap: 1, terceiros_pct: 0 }).inss_patronal_pct, 22);
  assert.equal(encargosDaConfig({ inss_patronal_pct: 10 }, { anexo_simples: "IV" }).inss_patronal_pct, 10);
});

// ── CMV real ─────────────────────────────────────────────────────────────────
const baseCmv = {
  de: "2026-10-01", ateExclusivo: "2026-11-01", estoqueIds: ["E1"],
  contagens: [
    { id: "C1", estoque_id: "E1", tipo: "inicial", status: "fechada", data_referencia: "2026-10-01", fechada_em: "2026-10-01T10:00:00Z" },
    { id: "C2", estoque_id: "E1", tipo: "final", status: "fechada", data_referencia: "2026-10-31", fechada_em: "2026-10-31T22:00:00Z" },
    { id: "CX", estoque_id: "OUTRO", tipo: "inicial", status: "fechada", data_referencia: "2026-10-01" },
  ],
  itensPorContagem: new Map([["C1", [{ valor_total: 500 }]], ["C2", [{ valor_total: 300 }]], ["CX", [{ valor_total: 9999 }]]]),
  compras: [{ id: "K1", status: "confirmada", data_compra: "2026-10-10", valor_total: 1999, valor_itens: 1999 }],
  comprasItens: [{ compra_id: "K1", estoque_id: "E1", valor_total: 1000, quantidade_base: 1 }, { compra_id: "K1", estoque_id: "OUTRO", valor_total: 999, quantidade_base: 1 }],
  movimentos: [
    { id: "m1", estoque_id: "E1", tipo: "entrada", motivo: "transferencia_recebida", valor_total: 200, data_movimento: "2026-10-12T10:00:00Z" },
    { id: "m2", estoque_id: "E1", tipo: "saida", motivo: "transferencia_enviada", valor_total: 50, data_movimento: "2026-10-13T10:00:00Z" },
    { id: "m3", estoque_id: "E1", tipo: "entrada", motivo: "producao", valor_total: 80, data_movimento: "2026-10-13T10:00:00Z" },
    { id: "m4", estoque_id: "E1", tipo: "saida", motivo: "consumo", valor_total: 70, data_movimento: "2026-10-14T10:00:00Z" },
  ],
};

test("CMV real = inicial + compras + transferências recebidas − enviadas − final, só dos estoques da marmitaria", () => {
  const r = cmvRealDosEstoques(baseCmv);
  // 500 + 1000 + 200 − 50 − 300 = 1350 (a compra do outro estoque, a produção e o consumo não entram)
  assert.equal(r.status, "apurado");
  assert.equal(r.valor, 1350);
  assert.equal(r.natureza, "real");
});

test("CMV real sem contagem final: não apurado, com o motivo; transferência sem valor usa custo do cadastro como estimativa", () => {
  const sem = cmvRealDosEstoques({ ...baseCmv, contagens: baseCmv.contagens.filter((c) => c.id !== "C2") });
  assert.equal(sem.valor, null);
  assert.ok(sem.motivos[0].includes("fim do período"));
  const est = cmvRealDosEstoques({ ...baseCmv, custoPorBase: () => 0.02,
    movimentos: [{ id: "t", estoque_id: "E1", tipo: "entrada", motivo: "transferencia_recebida", quantidade: 5000, valor_total: null, data_movimento: "2026-10-05" }] });
  // 500 + 1000 + 5000 × 0,02 − 300 = 1300
  assert.equal(est.valor, 1300);
  assert.equal(est.natureza, "estimativa");
});

// ── DRE ──────────────────────────────────────────────────────────────────────
const vendas = [
  { data: "2026-10-10", canal: "ifood", ficha_id: "f", quantidade: 100, valor_bruto: 3000, descontos: 0, cancelamentos: 0, tributos: null, comissao: 360, taxa_pagamento: 96 },
  { data: "2026-10-11", canal: "balcao", ficha_id: "c", quantidade: 50, valor_bruto: 1250, descontos: 0, cancelamentos: 0, tributos: null, comissao: 0, taxa_pagamento: 0 },
];
const contas = [
  { valor_original: 400, competencia_efetiva: "2026-10-01", centro_custo_codigo: "marmitaria", natureza: "despesa_fixa", categoria_codigo: "utilidades_energia" },
  { valor_original: 3000, competencia_efetiva: "2026-10-05", centro_custo_codigo: "geral", natureza: "despesa_fixa", categoria_codigo: "ocupacao_aluguel" },
  { valor_original: 360, competencia_efetiva: "2026-10-20", centro_custo_codigo: "marmitaria", natureza: "custo_variavel", categoria_codigo: "com_comissao_marketplace" },
  { valor_original: 2000, competencia_efetiva: "2026-10-05", centro_custo_codigo: "marmitaria", natureza: "pessoal", categoria_codigo: "pessoal_salarios" },
  { valor_original: 1000, competencia_efetiva: "2026-10-05", centro_custo_codigo: "marmitaria", natureza: "mercadoria", categoria_codigo: "mercadoria_insumos" },
  { valor_original: 800, competencia_efetiva: "2026-10-05", centro_custo_codigo: "cozinha", natureza: "despesa_fixa", categoria_codigo: "manutencao" },
  { valor_original: 999, competencia_efetiva: "2026-09-05", centro_custo_codigo: "marmitaria", natureza: "despesa_fixa", categoria_codigo: "marketing" },
];

test("rateio: direta 100%, compartilhada pelo % da categoria, de outra operação 0%; sem % configurado avisa", () => {
  const c = contasDaMarmitaria(contas, "2026-10", { rateio: { por_categoria: { ocupacao_aluguel: 20 } } });
  assert.equal(c.length, 6); // a de setembro fica fora
  assert.equal(c.find((x) => x.categoria_codigo === "ocupacao_aluguel").valorMarmitaria, 600);
  assert.equal(c.find((x) => x.categoria_codigo === "manutencao").valorMarmitaria, 0);
  const semCfg = contasDaMarmitaria(contas, "2026-10", {});
  assert.equal(semCfg.find((x) => x.categoria_codigo === "ocupacao_aluguel").criterio, "rateio_nao_configurado");
});

test("DRE da marmitaria: sem dupla contagem de taxa e salário, CMV real, lucro e ponto de equilíbrio", () => {
  const cmo = { total: 4502.84, linhas: [{}] };
  const d = dreMarmitaria({
    vendas, contas: contasDaMarmitaria(contas, "2026-10", { rateio: { por_categoria: { ocupacao_aluguel: 20 } } }),
    cmvReal: { valor: 1300, natureza: "real" }, cmo, tributosPct: 6,
  });
  const v = (id) => d.linhas.find((l) => l.id === id);
  // receita 4250 · tributos 6% = 255 (estimado) · RL 3995 · CMV 1300 · LB 2695
  // variáveis 360 + 96 = 456 (a conta de comissão de 360 NÃO soma de novo) · MC 2239
  // operacionais: CMO 4502,84 + energia 400 + aluguel rateado 600 = 5502,84 (salário de 2000 não soma: vem do RH)
  // resultado = 2239 − 5502,84 = −3263,84
  assert.equal(v("receita_vendas").valor, 4250);
  assert.equal(v("tributos").valor, 255);
  assert.equal(v("tributos").natureza, "estimado");
  assert.equal(v("lucro_bruto").valor, 2695);
  assert.equal(v("variaveis").valor, 456);
  assert.ok(v("variaveis").nota.includes("não somada"));
  assert.equal(v("contribuicao").valor, 2239);
  assert.equal(v("operacionais").valor, 5502.84);
  assert.ok(v("operacionais").nota.includes("CMO vem do RH"));
  assert.equal(v("lucro_liquido").valor, -3263.84);
  assert.equal(d.indicadores.margemContribuicaoPct, 52.68);
  // PE = 5502,84 ÷ (2239 ÷ 4250) = 10.445,32 · ticket 28,33 → 369 marmitas
  assert.equal(d.indicadores.pontoEquilibrio, 10445.32);
  assert.equal(d.indicadores.pontoEquilibrioMarmitas, 369);
});

test("DRE sem vendas e sem CMV: sem dado com o motivo, nunca zero", () => {
  const d = dreMarmitaria({ vendas: [], contas: [], cmvReal: { valor: null, motivos: ["Falta a contagem."] } });
  assert.equal(d.linhas.find((l) => l.id === "receita_vendas").valor, null);
  assert.equal(d.linhas.find((l) => l.id === "lucro_liquido").valor, null);
  assert.equal(d.natureza, "sem_dado");
  assert.ok(d.alertas.some((a) => a.includes("Nenhuma venda")));
});

test("DRE usa o CMV previsto pela ficha só quando o real falta, marcado como estimativa", () => {
  const prev = cmvPrevisto(vendas, new Map([["f", 10], ["c", 12]]));
  assert.equal(prev.valor, 1600); // 100 × 10 + 50 × 12
  const d = dreMarmitaria({ vendas, contas: [], cmvReal: { valor: null, motivos: ["Falta a contagem."] }, cmvPrev: prev, tributosPct: 6 });
  const cmv = d.linhas.find((l) => l.id === "cmv");
  assert.equal(cmv.valor, 1600);
  assert.equal(cmv.natureza, "estimado");
  assert.equal(d.natureza, "estimado");
  assert.equal(cmvPrevisto([{ ficha_id: "z", quantidade: 2 }], new Map()).valor, null);
});

test("consolidado: unidade inteira + só o que ela não vê da marmitaria (vendas, tributos e taxas delas)", () => {
  const marm = dreMarmitaria({ vendas, contas: [], cmvReal: { valor: 1300 }, tributosPct: 6 });
  // marmitaria acrescenta: receita 4250 − tributos 255 − taxas das vendas 456 = 3539
  const unidade = { linhas: [
    { id: "faturamento", valor: 100000 }, { id: "impostos", valor: 6000 }, { id: "cmv", valor: 30000 },
    { id: "variaveis", valor: 4000 }, { id: "contribuicao", valor: 60000 }, { id: "pessoal", valor: 25000 },
    { id: "fixas", valor: 20000 }, { id: "resultado", valor: 15000 },
  ] };
  const c = dreConsolidado({ unidade, marmitaria: marm });
  const l = (id) => c.linhas.find((x) => x.id === id);
  assert.equal(l("receita").consolidado, 104250);
  assert.equal(l("cmv").consolidado, 30000);          // o inventário geral já conta o estoque da marmitaria
  assert.equal(l("pessoal").consolidado, 25000);      // a folha do RH não entra duas vezes
  assert.equal(l("variaveis").consolidado, 4456);
  assert.equal(l("resultado").marmitaria, 3539);
  assert.equal(l("resultado").consolidado, 18539);
  // sem DRE da unidade apurado → consolidado sem dado
  assert.equal(dreConsolidado({ unidade: { linhas: [{ id: "faturamento", valor: null }] }, marmitaria: marm }).receita, null);
});

test("resumo e ranking das vendas", () => {
  const r = resumoVendas(vendas);
  assert.deepEqual([r.quantidade, r.receita, r.porCanal.length], [150, 4250, 2]);
  const rk = rankingMarmitas(vendas, new Map([["f", { nome: "Frango" }], ["c", { nome: "Carne" }]]));
  assert.deepEqual(rk.map((x) => x.nome), ["Frango", "Carne"]);
});

// ── Simulador ────────────────────────────────────────────────────────────────
test("simulador: cenários, ponto de equilíbrio e volume para a margem desejada", () => {
  const s = simular({ cenarios: [100], diasMes: 26, mix: [{ nome: "Frango", participacao: 100, preco: 30, custo: 10, canal: "ifood" }],
    canais: new Map([["ifood", IFOOD]]), tributosPct: 6, cmoMes: 4000, despesasMes: 2000, margemDesejadaPct: 20 });
  // MC unitária 13,64 · 100/dia × 26 = 2600 · faturamento 78.000 · lucro 2600 × 13,64 − 6000 = 29.464 → 37,77%
  const c = s.cenarios[0];
  assert.deepEqual([c.total, c.faturamento, c.lucro, c.margemLiquidaPct], [2600, 78000, 29464, 37.77]);
  // PE 6000 ÷ 13,64 = 439,9 → 440/mês, 17/dia · meta 20%: 6000 ÷ (13,64 − 6) = 785,3 → 786/mês, 31/dia
  assert.deepEqual(s.pontoEquilibrio.marmitasMes, 440);
  assert.deepEqual(s.pontoEquilibrio.marmitasDia, 17);
  assert.deepEqual([s.meta.marmitasMes, s.meta.marmitasDia], [786, 31]);
  assert.equal(s.natureza, "simulacao");
  assert.equal(simular({ mix: [{ nome: "x", participacao: 60, preco: 30, custo: 10 }] }).valido, false);
});

test("período dos filtros: semana começa na segunda", () => {
  assert.deepEqual(periodo("semana", "2026-10-14"), { de: "2026-10-12", ate: "2026-10-14" });
  assert.deepEqual(periodo("mes", "2026-10-14"), { de: "2026-10-01", ate: "2026-10-14" });
  assert.deepEqual(periodo("personalizado", "2026-10-14", { de: "2026-10-20", ate: "2026-10-01" }), { de: "2026-10-01", ate: "2026-10-20" });
});
