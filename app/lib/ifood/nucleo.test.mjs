// Núcleo dos pedidos do iFood, sem rede e sem banco (dados sintéticos).
//   node --test app/lib/ifood/nucleo.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizarEvento, situacaoDoPedido, normalizarPedido, vendasDoPedido, consumoDoPedido, ajusteDeEstoque,
  duplicidadesDeFonte, pedidoEquivalente, conciliarRepasses, ratear, dataLocal, codigoCurto, pendenciasDaSincronizacao,
} from "./nucleo.mjs";
import { evento, detalhes, CANAL_TESTE, PEDIDO } from "./fixtures.mjs";

const evs = (...codes) => codes.map((c, i) => normalizarEvento(evento(c, i)));
const FICHA = "f-frango";
const MAP = new Map([["MARM-FRANGO", { ficha_id: FICHA, quantidade_por_item: 1 }], ["REFRI-350", { ignorar: true }]]);
const somaCampo = (vs, k) => Math.round(vs.reduce((t, v) => t + (v[k] || 0), 0) * 100) / 100;

test("evento: código curto a partir do nome longo e da variante ORDER_*", () => {
  assert.equal(codigoCurto({ code: "CFM" }), "CFM");
  assert.equal(codigoCurto({ fullCode: "CONFIRMED" }), "CFM");
  assert.equal(codigoCurto({ code: "CONFIRMED", fullCode: "ORDER_CONFIRMED" }), "CFM");
  assert.equal(codigoCurto({ code: "XYZ" }), "XYZ");
});

test("evento sem id é inválido (nada de id inventado)", () => {
  assert.equal(normalizarEvento({ code: "PLC", orderId: "x" }).valido, false);
  assert.equal(normalizarEvento(null).valido, false);
  assert.equal(normalizarEvento(evento("PLC", 0)).valido, true);
});

test("situação: fora de ordem não volta; cancelamento é final e guarda o motivo", () => {
  const fora = [normalizarEvento(evento("DSP", 9)), normalizarEvento(evento("CFM", 2)), normalizarEvento(evento("PLC", 0))];
  assert.equal(situacaoDoPedido(fora).status, "DESPACHADO");
  const can = [...evs("PLC", "CFM", "PRS"), normalizarEvento(evento("CAN", 30, { metadata: { CANCEL_CODE: "501", CANCEL_REASON: "Problemas de sistema", CANCEL_ORIGIN: "MERCHANT" } })), normalizarEvento(evento("CON", 40))];
  const s = situacaoDoPedido(can);
  assert.equal(s.status, "CANCELADO");
  assert.equal(s.confirmado, true);
  assert.equal(s.preparoIniciado, true);
  assert.deepEqual([s.cancelamento.codigo, s.cancelamento.origem], ["501", "MERCHANT"]);
  assert.equal(situacaoDoPedido(evs("PLC", "CAN")).confirmado, false);
});

test("pedido: guarda só o primeiro nome; sem telefone, documento, endereço ou autorização do cartão", () => {
  const { pedido } = normalizarPedido(detalhes(), { unidadeId: "marmitaria" });
  assert.equal(pedido.cliente_nome, "Maria");
  const texto = JSON.stringify(pedido);
  for (const proibido of ["39845612077", "0800", "12345678", "Rua X", "SECRETO", "Souza"]) assert.equal(texto.includes(proibido), false, proibido);
  assert.equal(pedido.pedido_externo_id, PEDIDO);
  assert.equal(pedido.data_operacao, "2026-10-14");
});

test("pedido: benefício da loja é desconto; do iFood não; taxa adicional é do iFood", () => {
  const { pedido } = normalizarPedido(detalhes(), { unidadeId: "m" });
  assert.equal(pedido.descontos_loja, 2.6);
  assert.equal(pedido.beneficios_canal, 3);
  assert.equal(pedido.taxas_adicionais, 1.5);
  assert.equal(pedido.valor_pedido, 56.9);
});

test("pedido agendado usa o dia da entrega; data no fuso de São Paulo", () => {
  const { pedido } = normalizarPedido(detalhes({ orderTiming: "SCHEDULED", createdAt: "2026-10-14T23:30:00Z", schedule: { deliveryDateTimeStart: "2026-10-16T15:00:00Z" } }), { unidadeId: "m" });
  assert.equal(pedido.agendado, true);
  assert.equal(pedido.data_operacao, "2026-10-16");
  assert.equal(dataLocal("2026-10-15T02:30:00Z"), "2026-10-14"); // 23h30 em SP
});

test("rateio não perde centavo", () => {
  const r = ratear(100, [1, 1, 1]);
  assert.equal(r.reduce((a, b) => a + b, 0), 100);
  assert.deepEqual(ratear(0, [1, 2]), [0, 0]);
});

test("vendas: uma linha por marmita + outros itens + entrega própria; receita fecha com o pedido", () => {
  const { pedido } = normalizarPedido(detalhes(), { unidadeId: "m" });
  const { vendas, semMapeamento } = vendasDoPedido({ pedido, situacao: situacaoDoPedido(evs("PLC", "CFM")), mapeamento: MAP, canal: CANAL_TESTE });
  assert.equal(semMapeamento.length, 0);
  assert.deepEqual(vendas.map((v) => v.referencia_externa), [`ifood:${PEDIDO}:${FICHA}`, `ifood:${PEDIDO}:outros`, `ifood:${PEDIDO}:entrega`]);
  assert.equal(vendas[0].quantidade, 2);
  assert.equal(vendas[1].quantidade, 0); // refrigerante não é marmita
  assert.equal(somaCampo(vendas, "valor_bruto"), 61); // 50 + 6 + 5 de entrega própria
  assert.equal(somaCampo(vendas, "descontos"), 2.6); // só o desconto da loja
  assert.ok(vendas.every((v) => v.taxas_estimadas === true));
  // comissão 12% sobre a receita de cada linha; taxa fixa R$ 1 rateada
  assert.equal(somaCampo(vendas, "outras_taxas"), 1);
  const receita = 61 - 2.6;
  assert.ok(Math.abs(somaCampo(vendas, "comissao") - receita * 0.12) <= 0.02);
});

test("vendas: entrega feita pelo iFood não é receita da loja", () => {
  const { pedido } = normalizarPedido(detalhes({ delivery: { deliveredBy: "IFOOD" } }), { unidadeId: "m" });
  const { vendas } = vendasDoPedido({ pedido, situacao: situacaoDoPedido(evs("PLC", "CFM")), mapeamento: MAP, canal: CANAL_TESTE });
  assert.equal(vendas.some((v) => v.referencia_externa.endsWith(":entrega")), false);
});

test("vendas: não confirmado, teste e cancelado antes de confirmar não geram venda", () => {
  const { pedido } = normalizarPedido(detalhes(), { unidadeId: "m" });
  assert.deepEqual(vendasDoPedido({ pedido, situacao: situacaoDoPedido(evs("PLC")), mapeamento: MAP }).vendas, []);
  assert.deepEqual(vendasDoPedido({ pedido, situacao: situacaoDoPedido(evs("PLC", "CAN")), mapeamento: MAP }).vendas, []);
  const teste = normalizarPedido(detalhes({ isTest: true }), { unidadeId: "m" }).pedido;
  assert.deepEqual(vendasDoPedido({ pedido: teste, situacao: situacaoDoPedido(evs("PLC", "CFM")), mapeamento: MAP }).vendas, []);
  assert.equal(vendasDoPedido({ pedido: { detalhes_carregados: false }, situacao: {} }).vendas, null);
});

test("vendas: cancelado depois de confirmar zera a receita, a quantidade e as taxas", () => {
  const { pedido } = normalizarPedido(detalhes(), { unidadeId: "m" });
  const { vendas } = vendasDoPedido({ pedido, situacao: situacaoDoPedido(evs("PLC", "CFM", "CAN")), mapeamento: MAP, canal: CANAL_TESTE });
  for (const v of vendas) {
    assert.equal(Math.round((v.valor_bruto - v.descontos - v.cancelamentos) * 100), 0);
    assert.equal(v.quantidade, 0);
    assert.equal(v.comissao, 0);
    assert.equal(v.repasse_liquido, null);
  }
});

test("vendas: canal sem taxa configurada avisa e não inventa comissão", () => {
  const { pedido } = normalizarPedido(detalhes(), { unidadeId: "m" });
  const r = vendasDoPedido({ pedido, situacao: situacaoDoPedido(evs("PLC", "CFM")), mapeamento: MAP, canal: { id: "ifood", nome: "iFood" } });
  assert.equal(somaCampo(r.vendas, "comissao"), 0);
  assert.ok(r.avisos.some((a) => /não configuradas/.test(a)));
});

test("vendas: item sem marmita associada entra na receita e é apontado", () => {
  const { pedido } = normalizarPedido(detalhes(), { unidadeId: "m" });
  const r = vendasDoPedido({ pedido, situacao: situacaoDoPedido(evs("PLC", "CFM")), mapeamento: new Map(), canal: CANAL_TESTE });
  assert.equal(r.semMapeamento.length, 2);
  const sem = r.vendas.find((v) => v.referencia_externa.endsWith(":sem_marmita"));
  assert.equal(sem.valor_bruto, 56);
  assert.equal(sem.ficha_id, null);
});

// ── estoque ──
const INS = new Map([["arroz", { id: "arroz", nome: "Arroz", unidade_medida: "kg" }], ["pote", { id: "pote", nome: "Pote", unidade_medida: "un" }]]);
const MARMITAS = new Map([[FICHA, { itens: [{ insumo_id: "arroz", quantidade: 0.15, fator_correcao: 0 }], embalagens: [{ insumo_id: "pote", quantidade: 1 }] }]]);
const SALDOS = new Map([["arroz", [{ estoque_id: "E-MARM", saldo: 10000, prioridade: 0 }]], ["pote", [{ estoque_id: "E-EMB", saldo: 100, prioridade: 0 }]]]);

test("estoque: consumo pela ficha (gramas e unidades) e reprocessar não move nada", () => {
  const { pedido } = normalizarPedido(detalhes(), { unidadeId: "m" });
  const sit = situacaoDoPedido(evs("PLC", "CFM"));
  const { consumo } = consumoDoPedido({ pedido, situacao: sit, mapeamento: MAP, marmitas: MARMITAS, insumos: INS });
  assert.equal(consumo.get("arroz").q, 300); // 2 × 0,15 kg = 300 g
  assert.equal(consumo.get("pote").q, 2);
  const a1 = ajusteDeEstoque({ aplicado: {}, consumo, saldos: SALDOS });
  assert.deepEqual(a1.movimentos.map((m) => [m.estoque_id, m.tipo, m.quantidade]), [["E-MARM", "saida", 300], ["E-EMB", "saida", 2]]);
  const a2 = ajusteDeEstoque({ aplicado: a1.aplicado, consumo, saldos: SALDOS });
  assert.equal(a2.movimentos.length, 0);
});

test("estoque: cancelado antes do preparo devolve ao mesmo local; depois do preparo mantém", () => {
  const { pedido } = normalizarPedido(detalhes(), { unidadeId: "m" });
  const aplicado = { "E-MARM:arroz": 300, "E-EMB:pote": 2 };
  const antes = consumoDoPedido({ pedido, situacao: situacaoDoPedido(evs("PLC", "CFM", "CAN")), mapeamento: MAP, marmitas: MARMITAS, insumos: INS });
  const dev = ajusteDeEstoque({ aplicado, consumo: antes.consumo, saldos: SALDOS });
  assert.deepEqual(dev.movimentos.map((m) => [m.estoque_id, m.tipo, m.quantidade]), [["E-MARM", "entrada", 300], ["E-EMB", "entrada", 2]]);
  assert.deepEqual(dev.aplicado, {});
  const depois = consumoDoPedido({ pedido, situacao: situacaoDoPedido(evs("PLC", "CFM", "PRS", "CAN")), mapeamento: MAP, marmitas: MARMITAS, insumos: INS });
  assert.equal(ajusteDeEstoque({ aplicado, consumo: depois.consumo, saldos: SALDOS }).movimentos.length, 0);
});

test("estoque: sem saldo aponta a falta e não baixa", () => {
  const { pedido } = normalizarPedido(detalhes(), { unidadeId: "m" });
  const { consumo } = consumoDoPedido({ pedido, situacao: situacaoDoPedido(evs("PLC", "CFM")), mapeamento: MAP, marmitas: MARMITAS, insumos: INS });
  const r = ajusteDeEstoque({ aplicado: {}, consumo, saldos: new Map() });
  assert.equal(r.movimentos.length, 0);
  assert.equal(r.faltas.length, 2);
});

// ── duplicidade e conciliação ──
test("duplicidade: iFood lançado à mão e automático no mesmo dia é apontado", () => {
  const d = duplicidadesDeFonte([
    { canal: "ifood", data: "2026-10-14", fonte: "manual", valor_bruto: 500 },
    { canal: "ifood", data: "2026-10-14", fonte: "ifood", valor_bruto: 61 },
    { canal: "ifood", data: "2026-10-15", fonte: "ifood", valor_bruto: 30 },
    { canal: "balcao", data: "2026-10-14", fonte: "manual", valor_bruto: 10 },
  ]);
  assert.deepEqual(d, [{ data: "2026-10-14", valorManual: 500, valorAutomatico: 61, lancamentosManuais: 1 }]);
});

test("pedido equivalente: por id; por número curto + dia + valor; ambíguo não casa", () => {
  const ps = [
    { canal: "ifood", pedido_externo_id: "A", display_id: "4821", data_operacao: "2026-10-14", valor_pedido: 56.9 },
    { canal: "ifood", pedido_externo_id: "B", display_id: "1111", data_operacao: "2026-10-14", valor_pedido: 20 },
    { canal: "ifood", pedido_externo_id: "C", display_id: "1111", data_operacao: "2026-10-14", valor_pedido: 20 },
  ];
  assert.equal(pedidoEquivalente(ps, { pedidoExternoId: "A" }).pedido.pedido_externo_id, "A");
  assert.equal(pedidoEquivalente(ps, { displayId: "4821", data: "2026-10-15", valor: 56.9 }).pedido.pedido_externo_id, "A");
  assert.equal(pedidoEquivalente(ps, { displayId: "4821", data: "2026-10-14", valor: 99 }).pedido, null);
  const amb = pedidoEquivalente(ps, { displayId: "1111", data: "2026-10-14" });
  assert.equal(amb.pedido, null);
  assert.equal(amb.criterio, "ambíguo");
});

test("conciliação: sem repasse real fica aguardando; com repasse mostra a diferença", () => {
  const vendas = [{ fonte: "ifood", referencia_externa: "ifood:A:f", valor_bruto: 100, descontos: 0, cancelamentos: 0, repasse_liquido: 80, taxas_estimadas: true }];
  const sem = conciliarRepasses({ vendas });
  assert.equal(sem.situacao, "aguardando_dados_ifood");
  assert.equal(sem.diferenca, null);
  assert.equal(sem.naturezaEsperado, "estimativa");
  const com = conciliarRepasses({ vendas, repasses: [{ tipo: "REPASSE", valor: 78.5 }] });
  assert.equal(com.diferenca, -1.5);
  assert.equal(com.situacao, "conciliavel");
});

test("pendências: falhas, pedidos sem detalhe, parados e itens sem marmita", () => {
  const p = pendenciasDaSincronizacao({
    agora: "2026-10-15T12:00:00Z",
    eventos: [{ status: "FALHA" }, { status: "PROCESSADO" }],
    pedidos: [
      { status: "CONFIRMADO", detalhes_carregados: true, criado_no_canal_em: "2026-10-14T10:00:00Z", itens: [{ codigo: "X", nome: "Marmita X" }] },
      { status: "RECEBIDO", detalhes_carregados: false, itens: [] },
    ],
    mapeamento: new Map(),
  });
  assert.deepEqual([p.falhas, p.semDetalhes, p.parados, p.itensSemMarmita.length, p.tudoCerto], [1, 1, 1, 1, false]);
});
