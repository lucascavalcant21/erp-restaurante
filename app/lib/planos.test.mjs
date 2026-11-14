// Planos do Héfisto (decisão do dono, 14/11/2026). Rode: node --test app/lib/planos.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { AREAS_GRATIS, PLANOS, PLANO_PAGO, areaLiberada, planoPorId, precoTexto } from "./planos.mjs";
import { MENU_PRINCIPAL } from "./menu-principal.mjs";

test("dois planos: Grátis e Completo por R$ 59,90", () => {
  assert.deepEqual(Object.keys(PLANOS), ["gratis", "completo"]);
  assert.equal(PLANO_PAGO.precoCentavos, 5990);
  assert.equal(precoTexto(PLANO_PAGO), "R$ 59,90");
  assert.equal(precoTexto(PLANOS.gratis), "R$ 0,00");
});

test("as áreas do Grátis existem no menu", () => {
  const ids = MENU_PRINCIPAL.map((m) => m.id);
  for (const a of AREAS_GRATIS) assert.ok(ids.includes(a), a);
});

test("Completo abre tudo; Grátis tranca o que é do pago", () => {
  for (const m of MENU_PRINCIPAL) assert.equal(areaLiberada("completo", m.id), true, m.id);
  assert.equal(areaLiberada("gratis", "cozinha"), true);
  for (const id of ["inteligencia", "financeiro", "rh", "eventos", "marmitaria"]) assert.equal(areaLiberada("gratis", id), false, id);
});

test("sem plano registrado não tranca nada (cliente de hoje não perde tela)", () => {
  assert.equal(areaLiberada(null, "financeiro"), true);
  assert.equal(areaLiberada("PRO", "financeiro"), true);
  assert.equal(planoPorId("COMPLETO")?.id, "completo");
});
