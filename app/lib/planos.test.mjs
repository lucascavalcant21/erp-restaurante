// Planos do Héfisto (decisão do dono, 14/11/2026). Rode: node --test app/lib/planos.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { PLANOS, PLANO_PAGO, planoPorId, precoTexto } from "./planos.mjs";
import { MENU_PRINCIPAL } from "./menu-principal.mjs";

test("dois planos: Grátis e Completo por R$ 89,90", () => {
  assert.deepEqual(Object.keys(PLANOS), ["gratis", "completo"]);
  assert.equal(PLANO_PAGO.precoCentavos, 8990);
  assert.equal(precoTexto(PLANO_PAGO), "R$ 89,90");
  assert.equal(precoTexto(PLANOS.gratis), "R$ 0,00");
});

test("Grátis: ingredientes, fichas, estoque simples e checklists; o resto com cadeado", async () => {
  const { rotaLiberada, areaLiberada, podeCriarFicha, linkCheckout } = await import("./planos.mjs");
  for (const r of ["/dashboard", "/dashboard/operacao/ingredientes", "/dashboard/operacao/fichas/123", "/dashboard/operacao/estoque",
    "/dashboard/operacao/estoque/contagens", "/dashboard/operacao/rotina", "/dashboard/cozinha", "/dashboard/conta/plano", "/dashboard/assinar", "/dashboard/menu"]) {
    assert.equal(rotaLiberada("gratis", r), true, r);
  }
  // comandas bloqueadas (dono, 14/11/2026), Nico/Jhon, financeiro, equipe, etiquetas, KDS, custo do estoque, logins
  for (const r of ["/dashboard/mesas", "/dashboard/salao/mesas", "/dashboard/inteligencia/assistente", "/dashboard/financeiro/dre", "/dashboard/rh/ponto",
    "/dashboard/operacao/etiquetas", "/dashboard/cozinha/kds", "/dashboard/operacao/estoque/painel", "/dashboard/configuracoes/usuarios",
    "/dashboard/configuracoes/apps", "/dashboard/marmitaria", "/dashboard/reservas-eventos", "/dashboard/operacao/cardapio"]) {
    assert.equal(rotaLiberada("gratis", r), false, r);
  }
  const area = (id) => MENU_PRINCIPAL.find((m) => m.id === id);
  assert.equal(areaLiberada("gratis", area("cozinha")), true);
  assert.equal(areaLiberada("gratis", area("estoque")), true);
  for (const id of ["inteligencia", "financeiro", "rh", "eventos", "marmitaria", "cardapio", "operacao"]) assert.equal(areaLiberada("gratis", area(id)), false, id);
  assert.equal(podeCriarFicha("gratis", 4), true);
  assert.equal(podeCriarFicha("gratis", 5), false);
  assert.equal(podeCriarFicha("completo", 500), true);
  assert.equal(linkCheckout("/dashboard/mesas"), "/dashboard/assinar?de=%2Fdashboard%2Fmesas");
});

test("Completo e empresa sem assinatura não trancam nada", async () => {
  const { rotaLiberada } = await import("./planos.mjs");
  for (const r of ["/dashboard/mesas", "/dashboard/financeiro", "/dashboard/inteligencia"]) {
    assert.equal(rotaLiberada("completo", r), true);
    assert.equal(rotaLiberada(null, r), true);
    assert.equal(rotaLiberada("PRO", r), true);
  }
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
  // Por enquanto só Pix (Nubank); cartões quando houver cobrança online.
  assert.deepEqual(FORMAS_PAGAMENTO.filter((f) => f.disponivel).map((f) => f.id), ["pix"]);
});

test("comprovante do Pix vai ao WhatsApp com plano, período e valor", async () => {
  const { linkComprovante } = await import("./planos.mjs");
  const link = decodeURIComponent(linkComprovante("45998674041", { plano: PLANO_PAGO, periodo: "semestral", empresa: "Casa X" }));
  assert.ok(link.startsWith("https://wa.me/5545998674041?text="));
  assert.match(link, /plano Completo, semestral, R\$ 431,52, empresa Casa X/);
  assert.equal(linkComprovante("", { plano: PLANO_PAGO }), null);
  assert.equal(linkComprovante("45998674041", { plano: PLANOS.gratis }), null);
});
