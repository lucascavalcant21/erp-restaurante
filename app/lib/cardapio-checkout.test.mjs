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
