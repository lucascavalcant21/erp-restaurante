// Menu principal: uma lista só para o topo, o "voltar" e os painéis antigos.
import test from "node:test";
import assert from "node:assert/strict";
import { MENU_PRINCIPAL, menuPrincipal, areaDaRota, inicioDaArea, destinoDoPainelAntigo } from "./menu-principal.mjs";

test("Inteligência só aparece para quem pode", () => {
  assert.ok(!menuPrincipal({ podeInteligencia: false }).some((m) => m.id === "inteligencia"));
  assert.ok(menuPrincipal({ podeInteligencia: true }).some((m) => m.id === "inteligencia"));
});

test("área da tela pelo link mais específico", () => {
  assert.equal(areaDaRota("/dashboard/cozinha/kds").id, "vendas", "KDS é de Vendas");
  assert.equal(areaDaRota("/dashboard/operacao/fichas").id, "cozinha");
  assert.equal(areaDaRota("/dashboard/operacao/estoque/compras").id, "estoque");
  assert.equal(areaDaRota("/dashboard/rh/ponto").id, "rh");
  assert.equal(areaDaRota("/dashboard/xyz"), null);
});

test("voltar leva à página da área no menu, nunca a um painel fora do menu", () => {
  assert.equal(inicioDaArea("/dashboard/operacao/fichas"), "/dashboard/cozinha");
  assert.equal(inicioDaArea("/dashboard/cozinha"), "/dashboard");
  assert.equal(inicioDaArea("/dashboard/desconhecida"), "/dashboard");
  for (const r of ["/dashboard/operacao/fichas", "/dashboard/rh/ponto", "/dashboard/delivery"]) assert.ok(!inicioDaArea(r).includes("/modulo/"), r);
});

test("painéis antigos abrem telas que estão no menu", () => {
  const rotas = MENU_PRINCIPAL.flatMap((m) => [m.href, ...(m.submodules || []).map((s) => s.href)]).map((h) => h.split("?")[0]);
  for (const mod of ["cozinha", "salao", "financeiro", "rh", "gestao"]) assert.ok(rotas.includes(destinoDoPainelAntigo(mod).split("?")[0]), mod);
  assert.equal(destinoDoPainelAntigo("qualquer"), "/dashboard");
});
