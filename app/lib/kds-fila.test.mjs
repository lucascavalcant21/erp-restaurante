// Fila do KDS: agrupamento por pedido, setor, estados e quando o pedido online fica pronto.
import test from "node:test";
import assert from "node:assert/strict";
import { montarFilaKDS, proximoStatusKDS, setorDoProduto, origemDoPedido, pedidoFicaPronto, etapaDoTicket, cronometroKDS, localDoTicket, clienteDoTicket, partesDoItem, quadroKDS, tempoMedioKDS } from "./kds-fila.mjs";

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

test("quadro: coluna pelo estado dos itens", () => {
  const t = (...st) => ({ itens: st.map((status) => ({ status })) });
  assert.equal(etapaDoTicket(t("pendente", "pendente")), "fila");
  assert.equal(etapaDoTicket(t("pendente", "preparando")), "preparo");
  assert.equal(etapaDoTicket(t("pronto", "pendente")), "preparo");
  assert.equal(etapaDoTicket(t("pronto", "pronto")), "pronto");
});

test("cronômetro: verde até 10 min, amarelo até 15, depois atrasado com 4 níveis", () => {
  assert.deepEqual(cronometroKDS(192), { texto: "03:12", cor: "ok", atraso: 0, nivel: 0 });
  assert.equal(cronometroKDS(12 * 60 + 5).cor, "atencao");
  assert.deepEqual(cronometroKDS(21 * 60), { texto: "21:00", cor: "atrasado", atraso: 6, nivel: 2 });
  assert.equal(cronometroKDS(15 * 60).nivel, 1);
  assert.equal(cronometroKDS(60 * 60).nivel, 4);
});

test("local: mesa do QR vem do nome; salão pela identificação", () => {
  assert.equal(localDoTicket({ cliente: "[MESA 12] Ana", tipo_pedido: "qrcode" }), "Mesa 12");
  assert.equal(clienteDoTicket({ cliente: "[MESA 12] Ana" }), "Ana");
  assert.equal(localDoTicket({ identificacao: "05.01", tipo_pedido: "salao" }), "Mesa 05.01");
  assert.equal(localDoTicket({ identificacao: "Mesa 1.02" }), "Mesa 1.02");
  assert.equal(localDoTicket({ tipo_pedido: "delivery" }), "Delivery");
});

test("item: complementos, SEM, viagem, alergia e obs separados", () => {
  const r = partesDoItem("PARA VIAGEM · Ponto: Ao ponto · Sem: Cebola, Alho · Molho à parte · ALERGIA: crustáceos");
  assert.equal(r.viagem, true);
  assert.deepEqual(r.mods, ["Ao ponto", "SEM cebola", "SEM alho"]);
  assert.equal(r.obs, "Molho à parte");
  assert.deepEqual(r.alergia, ["ALERGIA: crustáceos"]);
  assert.deepEqual(partesDoItem(null), { viagem: false, alergia: [], mods: [], obs: "" });
});

test("prioridade: atrasados numerados do mais antigo, no topo da coluna; prontos fora", () => {
  const agora = Date.parse("2026-10-30T20:00:00Z");
  const tk = (id, min, st) => ({ id, created_at: new Date(agora - min * 60000).toISOString(), itens: [{ status: st, updated_at: new Date(agora - 60000).toISOString() }] });
  const q = quadroKDS([tk("a", 3, "pendente"), tk("b", 21, "pendente"), tk("c", 26, "preparando"), tk("d", 12, "preparando"), tk("e", 40, "pronto")], agora);
  assert.deepEqual(q.fila.map((t) => [t.id, t.prioridade]), [["b", 2], ["a", null]]);
  assert.deepEqual(q.preparo.map((t) => [t.id, t.prioridade]), [["c", 1], ["d", null]]);
  assert.equal(q.pronto[0].prioridade, null);
  assert.equal(q.prioridades, 2);
  assert.equal(tempoMedioKDS(q), 16);
});
