// Menu principal: uma lista só para o topo, o "voltar" e os painéis antigos.
import test from "node:test";
import assert from "node:assert/strict";
import { MENU_PRINCIPAL, UNIVERSOS, cardsDaArea, menuPrincipal, menuVisivel, universoLiberado, areaDaRota, universoDaRota, inicioDaArea, destinoDoPainelAntigo } from "./menu-principal.mjs";
import { pagesForRoute } from "./permissions-catalog.mjs";

test("Inteligência só aparece para quem pode", () => {
  assert.ok(!menuPrincipal({ podeInteligencia: false }).some((m) => m.id === "inteligencia"));
  assert.ok(menuPrincipal({ podeInteligencia: true }).some((m) => m.id === "inteligencia"));
});

test("área da tela pelo link mais específico", () => {
  assert.equal(areaDaRota("/dashboard/cozinha/kds").id, "cozinha");
  assert.equal(areaDaRota("/dashboard/salao/mesas").id, "salao");
  assert.equal(areaDaRota("/dashboard/delivery").id, "salao");
  assert.equal(areaDaRota("/dashboard/operacao/ingredientes").id, "estoque", "o link do menu vence o card");
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

test("Cozinha, Bar e Salão abrem direto a tela de cards, sem submenu", () => {
  assert.deepEqual(UNIVERSOS.map((u) => u.id), ["cozinha", "bar", "salao"]);
  for (const u of UNIVERSOS) {
    assert.ok(!u.submodules, `${u.id} não tem submenu`);
    assert.ok(cardsDaArea(u).length >= 10, `${u.id} tem cards`);
  }
});

test("nenhum card leva a tela de outra área por redirecionamento", () => {
  // /dashboard/vendas virou Contas a Receber (F2.3): seria um card do Salão caindo no Financeiro.
  const hrefs = UNIVERSOS.flatMap(cardsDaArea).map((c) => c.href);
  assert.ok(!hrefs.includes("/dashboard/vendas"));
  assert.ok(!hrefs.some((h) => h.startsWith("/dashboard/operacao/estoque?dept=")), "?dept= cai no painel antigo do estoque; use ?area=");
});

test("todo card aponta para uma tela do catálogo de permissões", () => {
  for (const u of UNIVERSOS) {
    for (const c of cardsDaArea(u)) {
      const [rota, busca = ""] = c.href.split("?");
      assert.ok(pagesForRoute(rota, busca).length > 0, `${u.id}: ${c.href} fora do catálogo`);
      assert.ok(c.label && c.desc && c.icone, `${u.id}: card incompleto ${c.href}`);
    }
  }
});

test("voltar de um card retorna ao universo de onde ele foi aberto", () => {
  // Validades não tem setor: quem decide é o universo aberto antes.
  assert.equal(inicioDaArea("/dashboard/operacao/validade", { origem: "bar" }), "/dashboard/bar");
  assert.equal(inicioDaArea("/dashboard/operacao/validade", { origem: "cozinha" }), "/dashboard/cozinha");
  assert.equal(inicioDaArea("/dashboard/operacao/guias", { origem: "salao" }), "/dashboard/salao");
  // Com setor na URL, vale mesmo sem origem (link direto ou favorito).
  assert.equal(inicioDaArea("/dashboard/operacao/fichas", { search: "?dept=bar" }), "/dashboard/bar");
  assert.equal(inicioDaArea("/dashboard/operacao/estoque", { search: "?area=salao" }), "/dashboard/salao");
  assert.equal(inicioDaArea("/dashboard/cozinha/kds", { search: "?setor=bar", origem: "bar" }), "/dashboard/bar");
  // Na tela de cards, voltar leva ao início do app.
  assert.equal(inicioDaArea("/dashboard/bar", { origem: "bar" }), "/dashboard");
});

test("uma origem antiga não prende telas de fora do universo", () => {
  assert.equal(universoDaRota("/dashboard/financeiro", "", "bar"), null);
  assert.equal(universoDaRota("/dashboard/operacao/estoque", "", "bar"), null, "Estoque do menu não é o Estoque do bar");
  assert.equal(universoDaRota("/dashboard/operacao/fichas", "?dept=cozinha", "bar").id, "cozinha", "o setor da URL vence a origem");
  assert.equal(universoDaRota("/dashboard/bar/producao", "", "cozinha").id, "bar");
});

test("conta limitada só vê no menu as áreas que pode abrir", () => {
  const pode = (rota, busca) => rota === "/dashboard/bar" || (rota === "/dashboard/operacao/fichas" && busca === "dept=bar");
  assert.deepEqual(menuVisivel(MENU_PRINCIPAL, pode).map((m) => m.id), ["bar"]);
  assert.deepEqual(menuVisivel(MENU_PRINCIPAL, () => false), []);
  assert.equal(menuVisivel(MENU_PRINCIPAL, () => true).length, MENU_PRINCIPAL.length);
});

test("submenu mostra só as telas liberadas", () => {
  const pode = (rota) => rota === "/dashboard/rh/ponto";
  const [equipe] = menuVisivel(MENU_PRINCIPAL, pode);
  assert.equal(equipe.id, "rh");
  assert.deepEqual(equipe.submodules.map((s) => s.label), ["Ponto e espelho"]);
});

test("tela de cards abre para quem pode usar algum card dela", () => {
  const pode = (rota, busca) => rota === "/dashboard/operacao/fichas" && busca === "dept=bar";
  assert.equal(universoLiberado("/dashboard/bar", pode), true);
  assert.equal(universoLiberado("/dashboard/salao", pode), false);
  assert.equal(universoLiberado("/dashboard/financeiro", () => true), false);
});
