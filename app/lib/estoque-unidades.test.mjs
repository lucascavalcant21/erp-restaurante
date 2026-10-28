// Testes das unidades do estoque (HDEV-EST-001): garrafa ≠ ml, caixa → garrafas,
// kg/g, L/ml, saldo operacional, situação do item e saldo por local.
// node --test app/lib/estoque-unidades.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  quantidadeDoMovimento, saldoOperacional, perfilUnidades, situacaoDoItem, resumoSituacoes, saldosPorLocal, unidadeOperacional, itemInativo, minimoNoSaldo,
} from "./estoque-unidades.mjs";
import { saldoDepois } from "./estoque-movimento.mjs";

// Cadastros como estão no banco real (11/10/2026)
const corona = { nome: "Corona", unidade_medida: "ml", unidade_comercial: "garrafa", tamanho_embalagem: 330, conta_por_embalagem: true, permite_fracionado: true };
const coronaCx = { ...corona, unidade_compra: "caixa", fator_compra: 12 };
const heineken = { nome: "Heineken", unidade_medida: "ml", unidade_comercial: null, tamanho_embalagem: 600, conta_por_embalagem: true, permite_fracionado: true };
const arroz = { nome: "Arroz", unidade_medida: "kg", unidade_comercial: "pacote", tamanho_embalagem: 2 };
const sal = { nome: "Sal", unidade_medida: "kg", tamanho_embalagem: null };
const oleo = { nome: "Óleo", unidade_medida: "l", tamanho_embalagem: null };

test("24 garrafas de Corona 330 ml = 24 garrafas no saldo operacional (7.920 ml no banco)", () => {
  const q = quantidadeDoMovimento({ insumo: corona, embalagens: "24" });
  assert.equal(q.quantidadeSaldo, 7920);
  assert.equal(q.unidadeSaldo, "ml");
  assert.equal(q.detalhe.embalagens, 24);
  assert.equal(q.quantidade_informada, 24);
  assert.equal(q.unidade_informada, "garrafa");
  assert.equal(saldoOperacional(corona, q.quantidadeSaldo), "24 garrafas");
});

test("garrafa nunca vira ml digitado: 24 em ml são 24 ml, e aparecem como ml (não garrafas)", () => {
  const q = quantidadeDoMovimento({ insumo: corona, fracao: "24", unidadeFracao: "ml" });
  assert.equal(q.quantidadeSaldo, 24);
  assert.equal(saldoOperacional(corona, 24), "24 ml (aberta)");
});

test("2 caixas com 12 garrafas = 24 garrafas = 7.920 ml", () => {
  const q = quantidadeDoMovimento({ insumo: coronaCx, compras: "2" });
  assert.equal(q.quantidadeSaldo, 7920);
  assert.equal(q.detalhe.embalagens, 24);
  assert.equal(q.detalhe.compras, 2);
  assert.equal(q.unidade_informada, "caixa");
  assert.match(q.texto, /2 caixas × 12 = 24 garrafas = 7\.920 ml/);
});

test("caixa sem fator no cadastro é recusada (não chuta 1 caixa = 1 garrafa)", () => {
  assert.ok(quantidadeDoMovimento({ insumo: corona, compras: "2" }).erro);
  assert.ok(quantidadeDoMovimento({ insumo: coronaCx, compras: "1,5" }).erro);
});

test("retirada de 5 garrafas: 24 → 19 garrafas", () => {
  const ret = quantidadeDoMovimento({ insumo: corona, embalagens: "5" });
  const depois = saldoDepois(7920, "saida", ret.quantidadeSaldo);
  assert.equal(depois, 6270);
  assert.equal(saldoOperacional(corona, depois), "19 garrafas");
});

test("estorno de uma retirada devolve exatamente o saldo anterior", () => {
  const ret = quantidadeDoMovimento({ insumo: corona, embalagens: "5" }).quantidadeSaldo;
  assert.equal(saldoDepois(saldoDepois(7920, "saida", ret), "entrada", ret), 7920);
});

test("garrafa aberta: 12 garrafas + 100 ml", () => {
  assert.equal(saldoOperacional(corona, 12 * 330 + 100), "12 garrafas + 100 ml");
});

test("produto em ml sem nome de embalagem conta em 'unidades'", () => {
  assert.equal(unidadeOperacional(heineken).nome, "unidade");
  assert.equal(saldoOperacional(heineken, 1800), "3 unidades");
});

test("embalagem de 1 kg/1 L sem nome mostra kg/L, não 'embalagens' (Açaí e Absolut reais)", () => {
  const acai = { nome: "Açaí", unidade_medida: "kg", unidade_comercial: null, tamanho_embalagem: 1 };
  const absolut = { nome: "Absolut", unidade_medida: "l", unidade_comercial: null, tamanho_embalagem: 1 };
  assert.equal(saldoOperacional(acai, 3), "3 kg");
  assert.equal(saldoOperacional(absolut, 0.75), "0,75 L");
  assert.equal(unidadeOperacional(acai).embalagem, false);
  // com nome, continua contando pela embalagem
  assert.equal(saldoOperacional({ ...acai, unidade_comercial: "balde" }, 3), "3 baldes");
  // garrafa de 330 ml sem nome continua "unidades"
  assert.equal(saldoOperacional(heineken, 1800), "3 unidades");
});

test("kg/g: 2 pacotes de 2 kg + 350 g = 4,35 kg; 500 g num produto em kg = 0,5 kg", () => {
  assert.equal(quantidadeDoMovimento({ insumo: arroz, embalagens: "2", fracao: "350", unidadeFracao: "g" }).quantidadeSaldo, 4.35);
  assert.equal(quantidadeDoMovimento({ insumo: sal, fracao: "500", unidadeFracao: "g" }).quantidadeSaldo, 0.5);
  assert.equal(saldoOperacional(sal, 1.5), "1,5 kg");
});

test("L/ml: 750 ml num produto em L = 0,75 L; ml não combina com kg", () => {
  assert.equal(quantidadeDoMovimento({ insumo: oleo, fracao: "750", unidadeFracao: "ml" }).quantidadeSaldo, 0.75);
  assert.ok(quantidadeDoMovimento({ insumo: sal, fracao: "750", unidadeFracao: "ml" }).erro);
});

test("perfil mostra os fatores explícitos", () => {
  assert.deepEqual(perfilUnidades(coronaCx).fatores, ["1 caixa = 12 garrafas", "1 garrafa = 330 ml"]);
  assert.deepEqual(perfilUnidades(sal).fatores, []);
});

test("situação: inativo > não conferido > zerado > abaixo > normal", () => {
  assert.equal(situacaoDoItem({ saldo: 10, ativo: false, conferido: true }), "inativo");
  assert.equal(situacaoDoItem({ saldo: 10, conferido: false }), "nao_conferido");
  assert.equal(situacaoDoItem({ saldo: 0, conferido: true }), "zerado");
  assert.equal(situacaoDoItem({ saldo: 2, minimo: 5, conferido: true }), "abaixo");
  assert.equal(situacaoDoItem({ saldo: 8, minimo: 5, conferido: true }), "normal");
});

test("produto sem saldo inicial conferido impede 'estoque seguro'", () => {
  const r = resumoSituacoes([{ saldo: 10, minimo: 2, conferido: true }, { saldo: 50, conferido: false }]);
  assert.equal(r.nao_conferido, 1);
  assert.equal(r.seguro, false);
  assert.equal(resumoSituacoes([{ saldo: 10, minimo: 2, conferido: true }]).seguro, true);
  assert.equal(resumoSituacoes([]).seguro, false);
});

test("mínimo do local está em garrafas: Amstel mínimo 15 com 14.400 ml (24 garrafas) é normal; com 6.000 ml (10) é abaixo", () => {
  const amstel = { unidade_medida: "ml", unidade_comercial: "garrafa", tamanho_embalagem: 600, conta_por_embalagem: true };
  assert.equal(minimoNoSaldo(amstel, 15), 9000);
  assert.equal(situacaoDoItem({ saldo: 14400, minimo: minimoNoSaldo(amstel, 15), conferido: true }), "normal");
  assert.equal(situacaoDoItem({ saldo: 6000, minimo: minimoNoSaldo(amstel, 15), conferido: true }), "abaixo");
  assert.equal(minimoNoSaldo(sal, 2), 2);
  assert.equal(minimoNoSaldo(sal, null), null);
});

test("inativo: sem saldo e sem movimento há 90 dias", () => {
  const agora = new Date("2026-10-11T12:00:00Z");
  assert.equal(itemInativo({ saldo: 0, ultimaMovimentacao: "2026-06-01" }, agora), true);
  assert.equal(itemInativo({ saldo: 0, ultimaMovimentacao: "2026-10-01" }, agora), false);
  assert.equal(itemInativo({ saldo: 0, ultimaMovimentacao: null }, agora), true);
  assert.equal(itemInativo({ saldo: 3, ultimaMovimentacao: "2020-01-01" }, agora), false);
});

test("mesmo produto em vários locais: um cadastro, saldos independentes", () => {
  const itens = [
    { insumo_id: "c", estoque_id: "bar", quantidade_atual: 3960 },
    { insumo_id: "c", estoque_id: "coz", quantidade_atual: 660 },
    { insumo_id: "x", estoque_id: "bar", quantidade_atual: 1 },
  ];
  assert.deepEqual(saldosPorLocal(itens, "c", [{ id: "bar", nome: "Bar" }, { id: "coz", nome: "Cozinha" }]),
    [{ estoqueId: "bar", local: "Bar", saldo: 3960 }, { estoqueId: "coz", local: "Cozinha", saldo: 660 }]);
});

test("bar: ml/L conta em garrafas ou latas (pedido do dono, 28/10/2026)", async () => {
  const { unidadeOperacional, saldoOperacional, quantidadeDoMovimento } = await import("./estoque-unidades.mjs");
  const coca = { departamento: "bar", unidade_medida: "ml", tamanho_embalagem: 350 };
  assert.equal(unidadeOperacional(coca).nome, "garrafa");
  assert.equal(saldoOperacional(coca, 10500), "30 garrafas");
  const lata = { ...coca, unidade_comercial: "lata" };
  assert.equal(saldoOperacional(lata, 700), "2 latas");
  assert.equal(quantidadeDoMovimento({ insumo: lata, embalagens: "3" }).quantidadeSaldo, 1050);
  // Absolut de 1 L: no bar é garrafa (fora do bar, embalagem de 1 L sem nome seguia em L).
  const absolut = { departamento: "bar", unidade_medida: "l", tamanho_embalagem: 1 };
  assert.equal(saldoOperacional(absolut, 3), "3 garrafas");
  assert.equal(unidadeOperacional({ ...absolut, departamento: "cozinha" }).embalagem, false);
});
