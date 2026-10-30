// Checkout do delivery: retirada, forma de pagamento e troco (regras do servidor).
import test from "node:test";
import assert from "node:assert/strict";
import { normalizarConfigCardapio } from "./cardapio-digital.mjs";
import { trocoEmReais, validarPedidoPublico } from "./server/negocio-publico.mjs";

const base = (cliente) => ({ unidade: "loja", cliente: { nome: "Ana", telefone: "45999990000", ...cliente }, itens: [{ id: "p1", quantidade: 1 }] });

test("retirada: sem endereço; entrega continua pedindo endereço", () => {
  const r = validarPedidoPublico(base({ tipo: "retirada", pagamento: "cartao" }));
  assert.equal(r.ok, true);
  assert.equal(r.pedido.tipo, "retirada");
  assert.equal(r.pedido.endereco, null);
  assert.equal(validarPedidoPublico(base({ tipo: "delivery", pagamento: "cartao" })).ok, false, "entrega sem endereço");
});

test("forma de pagamento: só as que existem; troco só no dinheiro", () => {
  assert.equal(validarPedidoPublico(base({ tipo: "retirada", pagamento: "bitcoin" })).codigo, "parametro_invalido");
  const cartao = validarPedidoPublico(base({ tipo: "delivery", endereco: "Rua A, 1", pagamento: "cartao", troco: "100" }));
  assert.equal(cartao.pedido.troco, "");
  const dinheiro = validarPedidoPublico(base({ tipo: "delivery", endereco: "Rua A, 1", pagamento: "dinheiro", troco: "R$ 150,00" }));
  assert.equal(dinheiro.pedido.troco, "R$ 150,00");
  assert.equal(dinheiro.pedido.pagamento, "dinheiro");
});

test("troco em reais", () => {
  assert.equal(trocoEmReais("R$ 150,00"), 150);
  assert.equal(trocoEmReais("1.000"), 1000);
  assert.equal(trocoEmReais("50,5"), 50.5);
  assert.equal(trocoEmReais(""), null);
  assert.equal(trocoEmReais("abc"), null);
});

test("retirada e formas vêm desligadas/padrão até o dono escolher", () => {
  assert.deepEqual(normalizarConfigCardapio({}).entrega.formas, ["dinheiro", "cartao"]);
  assert.equal(normalizarConfigCardapio({}).entrega.retirada, false);
  const e = normalizarConfigCardapio({ entrega: { retirada: true, formas: ["pix", "x", "vale"] } }).entrega;
  assert.deepEqual([e.retirada, e.formas], [true, ["pix", "vale"]]);
});

test("resumo do checkout: motivo explícito, retirada sem taxa e troco menor que o total", async () => {
  const { resumoDoCheckout } = await import("./cardapio-checkout.mjs");
  const cardapio = { unidade: { taxa_entrega: 6 }, entrega: { pedido_minimo: 30 }, produtos: [{ id: "a", preco: 20 }] };
  const form = { nome: "Ana", telefone: "(91) 98888-7777", endereco: "Rua 1", troco: "" };
  const base = { cardapio, carrinho: [{ id: "a", quantidade: 2 }], tipo: "delivery", pagamento: "cartao", form };
  const r = resumoDoCheckout(base);
  assert.equal(r.subtotal, 40);
  assert.equal(r.taxa, 6);
  assert.equal(r.total, 46);
  assert.ok(r.pode);
  assert.equal(resumoDoCheckout({ ...base, tipo: "retirada", form: { ...form, endereco: "" } }).taxa, 0, "retirada não paga entrega");
  assert.equal(resumoDoCheckout({ ...base, form: { ...form, endereco: " " } }).motivo, "falta_endereco");
  assert.equal(resumoDoCheckout({ ...base, carrinho: [{ id: "a", quantidade: 1 }] }).motivo, "falta_minimo");
  assert.equal(resumoDoCheckout({ ...base, pagamento: "" }).motivo, "falta_pagamento");
  assert.equal(resumoDoCheckout({ ...base, pagamento: "dinheiro", form: { ...form, troco: "R$ 20,00" } }).motivo, "troco_menor");
  assert.equal(resumoDoCheckout({ ...base, descontoCadastro: 4, cashback: 2 }).total, 40);
});

test("CPF: dígitos verificadores, máscara e pedido com CPF", async () => {
  const { cpfValido, mascaraCpf } = await import("./cpf.mjs");
  assert.equal(cpfValido("529.982.247-25"), "52998224725");
  assert.equal(cpfValido("529.982.247-24"), "");
  assert.equal(cpfValido("111.111.111-11"), "");
  assert.equal(mascaraCpf("5299822"), "529.982.2");
  assert.equal(mascaraCpf("52998224725"), "529.982.247-25");
  const ok = validarPedidoPublico({ unidade: "loja", cliente: { tipo: "qrcode", nome: "Ana", mesa: "12", cpf: "529.982.247-25" }, itens: [{ id: "p1", quantidade: 1 }] });
  assert.equal(ok.pedido.cpf, "52998224725");
  const ruim = validarPedidoPublico({ unidade: "loja", cliente: { tipo: "qrcode", nome: "Ana", mesa: "12", cpf: "123" }, itens: [{ id: "p1", quantidade: 1 }] });
  assert.equal(ruim.ok, false);
});
