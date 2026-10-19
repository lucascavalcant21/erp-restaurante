// Fila do KDS: agrupamento por pedido, setor, estados e quando o pedido online fica pronto.
import test from "node:test";
import assert from "node:assert/strict";
import { montarFilaKDS, proximoStatusKDS, setorDoProduto, origemDoPedido, pedidoFicaPronto } from "./kds-fila.mjs";

const ped = (id, extra = {}) => ({ id, unidade_id: "u1", status: "aberto", tipo_pedido: "salao", cliente_nome: null, identificacao: null, created_at: "2026-10-19T12:00:00Z", ...extra });
const item = (id, pedido, departamento, status_kds = "pendente", extra = {}) => ({
  id, pedido_id: pedido.id, quantidade: 2, observacao: null, status_kds, created_at: pedido.created_at,
  produtos: { nome_produto: `Prato ${id}`, departamento }, pedidos: pedido, ...extra,
});

test("ciclo do item: pendente → preparando → pronto → pendente", () => {
  assert.equal(proximoStatusKDS("pendente"), "preparando");
  assert.equal(proximoStatusKDS(null), "preparando");
  assert.equal(proximoStatusKDS("preparando"), "pronto");
  assert.equal(proximoStatusKDS("pronto"), "pendente");
});

test("setor: bar pelo departamento; sem cadastro vai para a cozinha", () => {
  assert.equal(setorDoProduto("bar"), "bar");
  assert.equal(setorDoProduto("Bar"), "bar");
  assert.equal(setorDoProduto("cozinha"), "cozinha");
  assert.equal(setorDoProduto(null), "cozinha");
});

test("origem do ticket pelo tipo do pedido", () => {
  assert.equal(origemDoPedido({ tipo_pedido: "qrcode" }), "Mesa (QR)");
  assert.equal(origemDoPedido({ tipo_pedido: "delivery" }), "Delivery");
  assert.equal(origemDoPedido({ tipo_pedido: "ifood" }), "iFood");
  assert.equal(origemDoPedido({ tipo_pedido: "salao" }), "Salão");
});

test("agrupa por pedido, do mais antigo ao mais novo, e separa cozinha e bar", () => {
  const a = ped("A", { tipo_pedido: "qrcode", status: "preparando_delivery", cliente_nome: "[MESA 5] Ana", created_at: "2026-10-19T12:10:00Z" });
  const b = ped("B", { identificacao: "Mesa 2", created_at: "2026-10-19T12:00:00Z" });
  const linhas = [item("a1", a, "cozinha"), item("a2", a, "bar"), item("b1", b, "cozinha", "preparando")];
  const cozinha = montarFilaKDS(linhas, "cozinha");
  assert.deepEqual(cozinha.map((t) => t.id), ["B", "A"]);
  assert.deepEqual(cozinha[1].itens.map((i) => i.id), ["a1"]);
  assert.equal(cozinha[1].origem, "Mesa (QR)");
  assert.equal(cozinha[1].cliente, "[MESA 5] Ana");
  assert.equal(cozinha[0].identificacao, "Mesa 2");
  assert.equal(cozinha[0].itens[0].status, "preparando");
  assert.deepEqual(montarFilaKDS(linhas, "bar").map((t) => t.id), ["A"]);
  assert.equal(montarFilaKDS(linhas, "todos").find((t) => t.id === "A").itens.length, 2);
});

test("fora da fila: item aguardando aceite, entregue ou cancelado; pedido pago, servido, despachado ou cancelado", () => {
  const vivo = ped("V");
  const linhas = [
    item("x1", vivo, "cozinha", "aguardando_aceite"),
    item("x2", vivo, "cozinha", "entregue"),
    item("x3", vivo, "cozinha", "cancelado"),
    ...["pago", "entregue", "saiu", "cancelado", "recusado", "fechado"].map((st, k) => item(`p${k}`, ped(`P${k}`, { status: st }), "cozinha")),
  ];
  assert.deepEqual(montarFilaKDS(linhas, "todos"), []);
  assert.deepEqual(montarFilaKDS(null), []);
});

test("pedido online fica pronto só quando nada mais está na fila; comanda do salão nunca muda", () => {
  const online = { id: "A", tipo_pedido: "delivery", status: "preparando_delivery" };
  assert.equal(pedidoFicaPronto(online, [{ status_kds: "entregue" }, { status_kds: "pronto" }]), true);
  assert.equal(pedidoFicaPronto(online, [{ status_kds: "entregue" }, { status_kds: "pendente" }]), false, "o bar ainda não terminou");
  assert.equal(pedidoFicaPronto(online, []), false);
  assert.equal(pedidoFicaPronto({ ...online, status: "saiu" }, [{ status_kds: "entregue" }]), false, "não volta pedido que já saiu");
  assert.equal(pedidoFicaPronto({ id: "S", tipo_pedido: "salao", status: "aberto" }, [{ status_kds: "entregue" }]), false, "a comanda segue aberta até o garçom fechar");
});
