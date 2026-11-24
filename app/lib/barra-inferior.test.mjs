// Barra inferior do celular (14/11/2026). Rode: node --test app/lib/barra-inferior.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { ABAS, abaAtiva, abasVisiveis, mostraBarraInferior } from "./barra-inferior.mjs";

const dono = { papel: "admin" };

test("aparece em todas as telas, menos as de trabalho em tela cheia (24/11/2026)", () => {
  for (const r of ["/dashboard", "/dashboard/", "/dashboard/menu", "/dashboard/tarefas", "/dashboard/cozinha", "/dashboard/bar", "/dashboard/salao"]) {
    assert.equal(mostraBarraInferior(r, dono), true, r);
  }
  // Telas de trabalho com rodapé próprio ficam sem a barra.
  for (const r of ["/dashboard/mesas", "/dashboard/salao/mesas", "/dashboard/cozinha/kds", "/dashboard/inteligencia/assistente", "/dashboard/rh/ponto", "/dashboard/rh/extra/123"]) {
    assert.equal(mostraBarraInferior(r, dono), false, r);
  }
  for (const r of ["/dashboard/operacao/fichas", "/dashboard/conta", "/dashboard/marmitaria", "/dashboard/configuracoes", "/dashboard/rh/rapido"]) {
    assert.equal(mostraBarraInferior(r, dono), true, r);
  }
});

test("app dedicado da loja e quem não entrou não têm barra", () => {
  assert.equal(mostraBarraInferior("/dashboard", { is_app: true }), false);
  assert.equal(mostraBarraInferior("/dashboard", null), false);
});

test("aba acesa", () => {
  assert.equal(abaAtiva("/dashboard"), "inicio");
  assert.equal(abaAtiva("/dashboard/conta"), "menu");
  assert.equal(abaAtiva("/dashboard/tarefas"), null);
  assert.equal(abaAtiva("/dashboard/marmitaria"), "delivery");
  assert.equal(abaAtiva("/dashboard/marmitaria/marmitas/organizador"), "delivery");
  assert.equal(abaAtiva("/dashboard/cozinha", "/dashboard/cozinha"), "inicio");
  assert.equal(abaAtiva("/dashboard/bar"), null);
});

test("cinco abas para o dono; sem Assistente e sem Delivery quando não pode", () => {
  assert.deepEqual(abasVisiveis({ podeInteligencia: true }).map((a) => a.id), ["inicio", "assistente", "pesquisar", "delivery", "menu"]);
  assert.deepEqual(
    abasVisiveis({ podeInteligencia: false, podeRota: (r) => r !== "/dashboard/marmitaria" }).map((a) => a.id),
    ["inicio", "pesquisar", "menu"],
  );
  assert.ok(ABAS.every((a) => a.href || a.acao));
});
