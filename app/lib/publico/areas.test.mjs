import test from "node:test";
import assert from "node:assert/strict";
import { AREAS, areaPorId, conferirPedido, linkResposta, mascaraWhatsApp, mensagemDoPedido } from "./areas.mjs";
import { depoimentosPublicaveis } from "./depoimentos.mjs";

test("as áreas são as mesmas que o banco aceita", () => {
  assert.deepEqual(AREAS.map((a) => a.id), ["restaurante", "delivery", "eventos", "consultorio", "pessoal"]);
  assert.equal(areaPorId("CONSULTORIO").nome, "Consultório");
  assert.equal(areaPorId("banco"), null);
  assert.equal(areaPorId("pessoal").disponivel, false);
});

test("pedido: confere os campos como o banco", () => {
  const bom = { area: "eventos", nome: "Ana", whatsapp: "(81) 99999-0000", email: "a@b.com", aceite: true };
  assert.equal(conferirPedido(bom).ok, true);
  const r = conferirPedido({ ...bom, whatsapp: "123", email: "x", aceite: false, area: "" });
  assert.deepEqual(Object.keys(r.erros).sort(), ["aceite", "area", "email", "whatsapp"]);
});

test("mensagens e máscara", () => {
  assert.equal(mensagemDoPedido({ ok: true }), null);
  assert.match(mensagemDoPedido({ ok: false, erro: "ocupado" }), /muitos pedidos/);
  assert.match(mensagemDoPedido(null), /Não foi possível/);
  assert.equal(mascaraWhatsApp("81999990000"), "(81) 99999-0000");
  assert.equal(mascaraWhatsApp("8133330000"), "(81) 3333-0000");
});

test("resposta pelo WhatsApp com DDI do Brasil", () => {
  const l = linkResposta({ whatsapp: "81999990000", nome: "Ana Lima", area: "consultorio" });
  assert.match(l, /^https:\/\/wa\.me\/5581999990000\?text=/);
  assert.match(decodeURIComponent(l), /Olá, Ana! .*Consultório/);
  assert.equal(linkResposta({ whatsapp: "12" }), null);
});

test("depoimento só com nome, texto e autorização", () => {
  assert.deepEqual(depoimentosPublicaveis([{ nome: "A", texto: "B" }, { nome: "C", texto: "D", autorizadoEm: "2026-11-21" }]).map((d) => d.nome), ["C"]);
  assert.equal(depoimentosPublicaveis().length, 0);
});
