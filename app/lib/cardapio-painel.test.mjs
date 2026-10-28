// Painel → Cardápio: canais, esgotado hoje, seções e o reflexo no cardápio do cliente.
import test from "node:test";
import assert from "node:assert/strict";
import { cardapioDoCanal, canalDoPedido, esgotadoHoje, montarCardapioPublico, normalizarConfigCardapio } from "./cardapio-digital.mjs";
import { filtrarLinhas, itemComCanal, itemEsgotado, montarPainelCardapio, mover, reordenarCategorias, resumoDaSecao } from "./cardapio-painel.mjs";

// 28/10/2026 às 22h em São Paulo = 29/10 01h UTC (o dia vale no fuso da loja).
const AGORA = new Date("2026-10-29T01:00:00Z");
const fichas = [
  { id: "f1", nome_receita: "Picanha", nome_comercial: "Picanha na brasa", categoria: "Grelhados", departamento: "cozinha", ativo: true, status: "ativa", tempo_preparo: 25 },
  { id: "f2", nome_receita: "Caipirinha", categoria: "Drinks", departamento: "bar", ativo: true },
  { id: "f3", nome_receita: "Fraldinha", categoria: "Grelhados", departamento: "cozinha", ativo: false },
];
const produtos = [
  { id: "p1", nome_produto: "PICANHA", preco_venda: 89.9, categoria: "Grelhados", departamento: "cozinha", ficha_id: "f1", imagem_url: "https://x/p.jpg" },
  { id: "p2", nome_produto: "Caipirinha de limão", preco_venda: 19.9, categoria: "Drinks", departamento: "bar", ficha_id: "f2", tempo_preparo_base: 5 },
  { id: "p3", nome_produto: "Fraldinha", preco_venda: 0, categoria: "Grelhados", ficha_id: "f3" },
  { id: "p4", nome_produto: "Água", preco_venda: 6, categoria: "Bebidas" },
];

test("linhas: nome comercial, tempo e pendências reais (nada inventado)", () => {
  const { linhas, categorias } = montarPainelCardapio({ produtos, fichas, config: {}, agora: AGORA });
  const p = Object.fromEntries(linhas.map((l) => [l.id, l]));
  assert.equal(p.p1.nome, "Picanha na brasa");
  assert.deepEqual(p.p1.info, ["25 min"]);
  assert.deepEqual(p.p2.info, ["5 min", "sem foto"], "tempo do produto quando a ficha não tem");
  assert.deepEqual(p.p3.info, ["sem foto", "ficha inativa", "sem preço"]);
  assert.deepEqual(p.p4.info, ["sem foto", "sem ficha técnica"]);
  assert.equal(p.p1.noAr, true);
  assert.equal(p.p3.noAr, false);
  assert.equal(p.p2.estacao, "bar");
  assert.equal(p.p4.noAr, true, "sem ficha o prato ainda aparece (só avisa)");
  assert.deepEqual(categorias.map((c) => [c.nome, c.qtd]), [["Grelhados", 2], ["Drinks", 1], ["Bebidas", 1]]);
});

test("promoção que vale agora aparece abaixo do preço", () => {
  const config = { promocoes: [{ id: "pd", titulo: "Prato do dia", tipo: "preco", preco_promocional: 79.9, produto_ids: ["p1"], ativo: true }] };
  const { linhas } = montarPainelCardapio({ produtos, fichas, config, agora: AGORA });
  assert.equal(linhas.find((l) => l.id === "p1").promocao, "Prato do dia: R$ 79,90");
});

test("canal: desligar e religar; o oculto antigo vira desligado em todos", () => {
  assert.deepEqual(itemComCanal({}, "delivery", false), { canais_ocultos: ["delivery"] });
  assert.deepEqual(itemComCanal({ canais_ocultos: ["delivery"] }, "delivery", true), {});
  assert.deepEqual(itemComCanal({ oculto: true, ordem: 2 }, "qr", true), { ordem: 2, canais_ocultos: ["tablet", "delivery"] });
  const { linhas } = montarPainelCardapio({ produtos, fichas, config: { itens: { p1: { oculto: true } } }, agora: AGORA });
  assert.deepEqual(linhas.find((l) => l.id === "p1").canais, { tablet: false, qr: false, delivery: false });
});

test("esgotado hoje: vale no dia da loja e volta sozinho no dia seguinte", () => {
  const item = itemEsgotado({}, true, AGORA);
  assert.deepEqual(item, { esgotado_dia: "2026-10-28" }, "22h em SP ainda é dia 28");
  assert.equal(esgotadoHoje(item, AGORA), true);
  assert.equal(esgotadoHoje(item, new Date("2026-10-29T03:00:00Z")), false, "meia-noite em SP: voltou");
  assert.deepEqual(itemEsgotado(item, false, AGORA), {});
});

test("cardápio do cliente: esgotado some de todos os canais; desligado some só no canal", () => {
  const config = { itens: { p1: { esgotado_dia: "2026-10-28" }, p2: { canais_ocultos: ["delivery"] } } };
  const juntos = produtos.map((p) => ({ ...p, ficha: fichas.find((f) => f.id === p.ficha_id) || null }));
  const c = montarCardapioPublico({ produtos: juntos, config, agora: AGORA });
  assert.equal(c.produtos.some((p) => p.id === "p1"), false);
  assert.deepEqual(c.produtos.find((p) => p.id === "p2").fora_dos_canais, ["delivery"]);
  const delivery = cardapioDoCanal(c, canalDoPedido("delivery"));
  const qr = cardapioDoCanal(c, canalDoPedido("qrcode"));
  assert.equal(delivery.produtos.some((p) => p.id === "p2"), false);
  assert.equal(delivery.categorias.some((x) => x.produto_ids.includes("p2")), false);
  assert.equal(qr.produtos.some((p) => p.id === "p2"), true);
  assert.equal(normalizarConfigCardapio(config).itens.p1.esgotado_dia, "2026-10-28");
  assert.deepEqual(normalizarConfigCardapio({ itens: { p1: { canais_ocultos: ["x", "qr", "qr"], esgotado_dia: "ontem" } } }).itens.p1, { canais_ocultos: ["qr"] });
});

test("filtro por canal, busca por ingrediente e resumo da seção", () => {
  const { linhas } = montarPainelCardapio({ produtos, fichas, config: { itens: { p2: { canais_ocultos: ["delivery"] } } }, ingredientes: { f1: ["sal grosso"] }, agora: AGORA });
  assert.deepEqual(filtrarLinhas(linhas, { canal: "delivery" }).map((l) => l.id), ["p1", "p4"]);
  assert.deepEqual(filtrarLinhas(linhas, { busca: "sal gros" }).map((l) => l.id), ["p1"]);
  assert.deepEqual(filtrarLinhas(linhas, { categoria: "cat-grelhados" }).map((l) => l.id), ["p1", "p3"]);
  assert.equal(resumoDaSecao(linhas.filter((l) => l.categoria_id === "cat-grelhados")), "Estação: Cozinha · aparece em Tablet, QR, Delivery");
  assert.equal(resumoDaSecao([linhas.find((l) => l.id === "p3")]), "Estação: Cozinha · não aparece em nenhum canal");
});

test("arrastar seções", () => {
  const cats = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(mover(cats, 0, 2).map((c) => c.id), ["b", "c", "a"]);
  assert.deepEqual(reordenarCategorias(cats, ["c", "a"]).map((c) => c.id), ["c", "a", "b"]);
});
