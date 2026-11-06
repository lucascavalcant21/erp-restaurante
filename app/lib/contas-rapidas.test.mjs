// Contas rápidas: o que cada função pode fazer é regra de segurança, não só texto de tela.
import test from "node:test";
import assert from "node:assert/strict";
import { CONTAS_RAPIDAS, contaRapidaPorId, gerarSenhaTemporaria, sugerirLogin } from "./contas-rapidas.mjs";
import { allPermissionKeys, canAccessRoute, hasPermission } from "./permissions-catalog.mjs";
import { podeEditarFicha, podeImprimirFicha, podeVerCustosFicha } from "./ficha-modelo.mjs";
import { MENU_PRINCIPAL, menuVisivel, universoLiberado } from "./menu-principal.mjs";
import { homeDoUsuarioDe } from "./contas-rapidas-sessao.test-helper.mjs";

const sessaoDe = (id) => ({ gerenciado: true, papel: "funcionario", permissions: contaRapidaPorId(id).permissoes });
const ve = (s, rota, busca = "") => canAccessRoute(s, rota, busca);

test("toda permissão de modelo existe no catálogo", () => {
  const validas = new Set(allPermissionKeys());
  for (const c of CONTAS_RAPIDAS) for (const p of c.permissoes) assert.ok(validas.has(p), `${c.id}: ${p}`);
});

test("nenhum modelo tem curinga nem dá edição, exclusão ou custo", () => {
  for (const c of CONTAS_RAPIDAS) {
    for (const p of c.permissoes) {
      assert.ok(!p.includes("*"), `${c.id}: ${p}`);
      if (c.id === "chefe-bar" && p === "treinamento.team.approve") continue; // líder aprova a prática da equipe
      assert.ok(!/\.(edit|delete|view_costs|view_margin|view_values|settings|approve|adjust_stock)$/.test(p), `${c.id}: ${p}`);
    }
  }
});

test("chefe de bar vê a ficha de drinks, não edita, não imprime e não vê custo", () => {
  const s = sessaoDe("chefe-bar");
  assert.ok(ve(s, "/dashboard/operacao/fichas", "dept=bar"));
  assert.ok(ve(s, "/dashboard/operacao/fichas/abc", "dept=bar"));
  assert.ok(!ve(s, "/dashboard/operacao/fichas", "dept=cozinha"), "ficha da cozinha é de outro setor");
  assert.equal(podeEditarFicha(s, "bar"), false);
  assert.equal(podeImprimirFicha(s, "bar"), false);
  assert.equal(podeVerCustosFicha(s, "bar"), false);
});

test("chefe de bar adiciona e retira do estoque, mas não abre financeiro nem RH", () => {
  const s = sessaoDe("chefe-bar");
  assert.ok(ve(s, "/dashboard/operacao/estoque", "area=bar"));
  assert.ok(hasPermission(s, "estoque.movements.create"), "chave conferida por estoque_movimentar");
  assert.ok(!hasPermission(s, "estoque.overview.view"), "painel do estoque mostra custo");
  for (const r of ["/dashboard/financeiro", "/dashboard/rh", "/dashboard/operacao/estoque/compras", "/dashboard/configuracoes/usuarios"]) assert.ok(!ve(s, r), r);
});

test("chefe de bar não entra nos universos da Cozinha e do Salão pelo card de estoque", () => {
  const s = sessaoDe("chefe-bar");
  const pode = (rota, busca) => canAccessRoute(s, rota, busca);
  assert.equal(universoLiberado("/dashboard/bar", pode), true);
  assert.equal(universoLiberado("/dashboard/cozinha", pode), false);
  assert.equal(universoLiberado("/dashboard/salao", pode), false);
  const ids = menuVisivel(MENU_PRINCIPAL, pode).map((m) => m.id);
  assert.ok(ids.includes("bar"));
  assert.ok(!ids.includes("cozinha") && !ids.includes("salao"), ids.join());
});

test("equipe da cozinha vê fichas, usa o estoque e imprime", () => {
  const s = sessaoDe("equipe-cozinha");
  assert.ok(ve(s, "/dashboard/operacao/fichas", "dept=cozinha"));
  assert.ok(ve(s, "/dashboard/operacao/etiquetas", "dept=cozinha"));
  assert.equal(podeImprimirFicha(s, "cozinha"), true);
  assert.equal(podeEditarFicha(s, "cozinha"), false);
  assert.ok(!ve(s, "/dashboard/operacao/fichas", "dept=bar"));
});

test("conta de ponto abre só o relógio", () => {
  const s = sessaoDe("somente-ponto");
  assert.ok(ve(s, "/dashboard/rh/ponto"));
  for (const r of ["/dashboard/rh", "/dashboard/bar", "/dashboard/operacao/fichas", "/dashboard/financeiro"]) assert.ok(!ve(s, r), r);
});

test("a página inicial de cada modelo abre para a própria conta", () => {
  for (const c of CONTAS_RAPIDAS) assert.equal(homeDoUsuarioDe(c), c.paginaInicial, c.id);
});

test("login sugerido é curto e sem acento", () => {
  assert.equal(sugerirLogin("Ana Paula de Souza"), "ana.souza");
  assert.equal(sugerirLogin("João"), "joao");
  assert.equal(sugerirLogin("  "), "");
});

test("senha temporária tem 10 caracteres sem letras parecidas", () => {
  const senha = gerarSenhaTemporaria();
  assert.equal(senha.length, 10);
  assert.ok(!/[il1o0]/.test(senha));
});

test("conta da área: busca, anota e só retira do estoque", async () => {
  const { CONTAS_RAPIDAS } = await import("./contas-rapidas.mjs");
  const { canAccessRoute } = await import("./permissions-catalog.mjs");
  for (const [id, area, outra] of [["equipe-cozinha", "cozinha", "bar"], ["equipe-bar", "bar", "cozinha"]]) {
    const conta = CONTAS_RAPIDAS.find((c) => c.id === id);
    const sessao = { gerenciado: true, papel: "colaborador", permissions: conta.permissoes };
    assert.equal(conta.permissoes.includes("estoque.movements.create"), false);
    assert.equal(conta.permissoes.includes("estoque.outputs.create"), true);
    assert.equal(canAccessRoute(sessao, "/dashboard/operacao/consulta", `?dept=${area}`), true);
    assert.equal(canAccessRoute(sessao, "/dashboard/operacao/anotacoes", `?dept=${area}`), true);
    assert.equal(canAccessRoute(sessao, "/dashboard/operacao/consulta", `?dept=${outra}`), false);
    assert.equal(canAccessRoute(sessao, "/dashboard/operacao/anotacoes", ""), false);
    assert.equal(canAccessRoute(sessao, "/dashboard/operacao/montagem", `?dept=${area}`), false); // a tela de montagem edita e exclui
  }
});
