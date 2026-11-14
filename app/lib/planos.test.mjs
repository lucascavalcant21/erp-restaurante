// Planos do Héfisto (decisão do dono, 14/11/2026). Rode: node --test app/lib/planos.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { AREAS_GRATIS, PLANOS, PLANO_PAGO, areaLiberada, planoPorId, precoTexto } from "./planos.mjs";
import { MENU_PRINCIPAL } from "./menu-principal.mjs";

test("dois planos: Grátis e Completo por R$ 89,90", () => {
  assert.deepEqual(Object.keys(PLANOS), ["gratis", "completo"]);
  assert.equal(PLANO_PAGO.precoCentavos, 8990);
  assert.equal(precoTexto(PLANO_PAGO), "R$ 89,90");
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

test("link comercial só existe com número de WhatsApp válido", async () => {
  const { linkComercial, numeroWhatsApp } = await import("./planos.mjs");
  assert.equal(numeroWhatsApp("(91) 99999-0000"), "5591999990000");
  assert.equal(numeroWhatsApp("123"), null);
  assert.equal(linkComercial("", { plano: PLANO_PAGO }), null);
  const link = linkComercial("91999990000", { plano: PLANO_PAGO, empresa: "Casa X" });
  assert.ok(link.startsWith("https://wa.me/5591999990000?text="));
  assert.match(decodeURIComponent(link), /plano Completo do Héfisto \(R\$ 89,90 por mês\) para Casa X/);
  const anual = decodeURIComponent(linkComercial("91999990000", { plano: PLANO_PAGO, periodo: "anual" }));
  assert.match(anual, /anual, R\$ 647,28 com 40% de desconto/);
});

test("no Grátis, telas de área paga ficam trancadas; o resto abre", async () => {
  const { areaTrancadaDaRota } = await import("./planos.mjs");
  assert.equal(areaTrancadaDaRota("gratis", "/dashboard/financeiro/dre"), "financeiro");
  assert.equal(areaTrancadaDaRota("gratis", "/dashboard/rh/ponto"), "rh");
  assert.equal(areaTrancadaDaRota("gratis", "/dashboard/mesas"), null);
  assert.equal(areaTrancadaDaRota("gratis", "/dashboard/operacao/estoque"), null);
  assert.equal(areaTrancadaDaRota("gratis", "/dashboard/conta/plano"), null);
  assert.equal(areaTrancadaDaRota("gratis", "/dashboard"), null);
  assert.equal(areaTrancadaDaRota("completo", "/dashboard/financeiro/dre"), null);
  assert.equal(areaTrancadaDaRota(null, "/dashboard/financeiro/dre"), null);
});

test("semestral com 20% e anual com 40% de desconto, em centavos exatos", async () => {
  const { precoNoPeriodo, PERIODOS, FORMAS_PAGAMENTO } = await import("./planos.mjs");
  assert.deepEqual(PERIODOS.map((p) => [p.id, p.meses, p.descontoPct]), [["mensal", 1, 0], ["semestral", 6, 20], ["anual", 12, 40]]);
  assert.deepEqual(precoNoPeriodo(PLANO_PAGO, "mensal"), { periodo: PERIODOS[0], totalCentavos: 8990, cheioCentavos: 8990, economiaCentavos: 0, porMesCentavos: 8990 });
  // 6 × 89,90 = 539,40; −20% = 431,52 (71,92 por mês)
  const sem = precoNoPeriodo(PLANO_PAGO, "semestral");
  assert.deepEqual([sem.totalCentavos, sem.economiaCentavos, sem.porMesCentavos], [43152, 10788, 7192]);
  // 12 × 89,90 = 1.078,80; −40% = 647,28 (53,94 por mês)
  const anu = precoNoPeriodo(PLANO_PAGO, "anual");
  assert.deepEqual([anu.totalCentavos, anu.economiaCentavos, anu.porMesCentavos], [64728, 43152, 5394]);
  assert.equal(precoNoPeriodo(PLANO_PAGO, "trimestral"), null);
  assert.deepEqual(FORMAS_PAGAMENTO.map((f) => f.id), ["credito", "debito", "pix"]);
});
