// Testes do guard de rotas. Rode com: node app/lib/permissions-catalog.test.mjs
//
// Este arquivo decide quem vê o quê no sistema inteiro e vinha sem teste
// nenhum. O caso que deu origem a ele: `dashboard.overview.view` — a permissão
// básica que todo funcionário recebe para ver a tela inicial — abria folha de
// pagamento, DRE e a tela de usuários e acessos, porque /dashboard é prefixo
// de todas as rotas e o guard aceitava QUALQUER entrada que casasse.

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { canAccessRoute, hasPermission, pageForRoute, permissionMatches } from "./permissions-catalog.mjs";

let falhas = 0;
function conferir(nome, obtido, esperado) {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
}

// Sessões de verdade, como o sistema monta.
const garcom = { gerenciado: true, papel: "colaborador", permissions: ["dashboard.overview.view"] };
const semNada = { gerenciado: true, papel: "colaborador", permissions: [] };
const admin = { gerenciado: false, papel: "admin", permissions: [] };
const rhCompleto = { gerenciado: true, papel: "colaborador", permissions: ["rh.*"] };
const soFolha = { gerenciado: true, papel: "colaborador", permissions: ["rh.payroll.view"] };
const soCaixa = { gerenciado: true, papel: "colaborador", permissions: ["financeiro.cashflow.view"] };

// ── O vazamento: a permissão da tela inicial não abre o resto ──────────────
// Cada uma destas telas casa com /dashboard por prefixo. Antes do conserto,
// todas abriam para quem só podia ver a tela inicial.
const SENSIVEIS = [
  "/dashboard/rh/fechamento",
  "/dashboard/rh",
  "/dashboard/financeiro/dre",
  "/dashboard/financeiro/pizza",
  "/dashboard/configuracoes/usuarios",
  "/dashboard/configuracoes/perfis",
  "/dashboard/rh/gastos-admin",
];
for (const rota of SENSIVEIS) {
  conferir(`garcom NAO entra em ${rota}`, canAccessRoute(garcom, rota, ""), "false");
}

// ...e continua entrando onde ele pode.
conferir("garcom entra na tela inicial", canAccessRoute(garcom, "/dashboard", ""), "true");

// ── Quem tem a permissão certa continua entrando ──────────────────────────
conferir("rh.* entra na folha", canAccessRoute(rhCompleto, "/dashboard/rh/fechamento", ""), "true");
conferir("rh.* entra no painel de RH", canAccessRoute(rhCompleto, "/dashboard/rh", ""), "true");
conferir("rh.* NAO entra no financeiro", canAccessRoute(rhCompleto, "/dashboard/financeiro/dre", ""), "false");

// Permissão específica sem a do pai: a mais específica é que manda, então
// entra na folha mesmo sem poder ver o painel de RH.
conferir("so folha entra na folha", canAccessRoute(soFolha, "/dashboard/rh/fechamento", ""), "true");
conferir("so folha NAO entra no painel de RH", canAccessRoute(soFolha, "/dashboard/rh", ""), "false");

// ── Herança do pai real (não do /dashboard) ──────────────────────────────
// /dashboard/financeiro/custos-fixos não tem entrada própria; a mais
// específica que casa é /dashboard/financeiro. Herdar daí é o comportamento
// desejado — o que não pode é herdar da tela inicial.
conferir("sub-tela do financeiro herda do financeiro",
  canAccessRoute(soCaixa, "/dashboard/financeiro/custos-fixos", ""), "true");
conferir("garcom NAO entra na sub-tela do financeiro",
  canAccessRoute(garcom, "/dashboard/financeiro/custos-fixos", ""), "false");

// ── As 26 telas que caiam na entrada generica agora tem a sua ────────────
// Antes, Producao do Dia, Validade, Limpeza, Guias e companhia nao existiam
// no catalogo: casavam so com /dashboard e abriam para qualquer um que
// entrasse no sistema. Cada uma ganhou entrada propria (ou herda de um pai de
// verdade), entao agora exigem a permissao que lhes corresponde.
const soCozinha = { gerenciado: true, papel: "colaborador", permissions: ["cozinha.*"] };
conferir("validade exige permissao de cozinha, nao a da tela inicial",
  canAccessRoute(garcom, "/dashboard/operacao/validade", ""), "false");
conferir("cozinha.* abre a validade", canAccessRoute(soCozinha, "/dashboard/operacao/validade", ""), "true");
conferir("garcom NAO entra nas mesas do salao", canAccessRoute(garcom, "/dashboard/salao/mesas", ""), "false");

// ── TRAVA: nenhuma tela pode cair na entrada generica /dashboard ─────────
// Esta e a regressao que deixou o sistema inteiro aberto. Como /dashboard e
// prefixo de tudo, uma tela nova sem entrada no catalogo casa com ela e herda
// a permissao que todo funcionario tem. Se este caso falhar, a tela nova
// precisa de entrada em PERMISSION_MODULES — nao de um remendo no guard.
const rotasDoPainel = [];
(function varrer(dir) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      // Rotas com parametro ([id], [modulo]) sempre se abrem de dentro de
      // outra tela e herdam a permissao do pai; nao entram na conta.
      if (!nome.startsWith("[")) varrer(caminho);
    } else if (nome === "page.js") {
      rotasDoPainel.push(dir.replace(/^app/, ""));
    }
  }
})("app/dashboard");

const orfas = rotasDoPainel.filter(
  // pageForRoute devolve { module, page, parsed } — a rota esta em .page.route.
  // Ler .route direto aqui dava sempre undefined e a trava nunca acusava nada.
  (r) => r !== "/dashboard" && pageForRoute(r, "")?.page?.route === "/dashboard"
);
conferir(`nenhuma das ${rotasDoPainel.length} telas cai na entrada generica${orfas.length ? ` (${orfas.join(", ")})` : ""}`,
  orfas.length, 0);

// ── Operador x gerente: a mesma area, duas telas ─────────────────────────
// O estoque tem duas telas: a completa, com custo e valor, e a de operacao,
// com 10 campos e linguagem de cozinha ("Alimentos da cozinha", "Quem esta
// movimentando?"). Antes as duas dividiam a permissao `estoque.overview`, o
// que obrigava a dar a tela com dinheiro para quem so precisa dar baixa.
const cozinheiro = {
  gerenciado: true, papel: "colaborador",
  permissions: ["dashboard.overview.view", "estoque.operation.view", "estoque.operation.adjust_stock"],
};
conferir("cozinheiro entra na tela de operacao",
  canAccessRoute(cozinheiro, "/dashboard/operacao/estoque/tablet", ""), "true");
conferir("cozinheiro NAO entra na tela de estoque com custo",
  canAccessRoute(cozinheiro, "/dashboard/operacao/estoque", ""), "false");
// E o caminho contrario tambem vale: quem administra o estoque completo nao
// perde a tela de operacao, porque a entrada dela e filha da area.
const gerente = { gerenciado: true, papel: "colaborador", permissions: ["estoque.*"] };
conferir("gerente de estoque entra nas duas",
  canAccessRoute(gerente, "/dashboard/operacao/estoque", "") === true
  && canAccessRoute(gerente, "/dashboard/operacao/estoque/tablet", "") === true, "true");

// ── Portas que não podem se abrir ────────────────────────────────────────
conferir("sem permissao nenhuma NAO entra na folha", canAccessRoute(semNada, "/dashboard/rh/fechamento", ""), "false");
conferir("sem permissao nenhuma NAO entra nem na inicial", canAccessRoute(semNada, "/dashboard", ""), "false");
conferir("sem sessao NAO entra", canAccessRoute(null, "/dashboard", ""), "false");
conferir("admin entra em tudo", canAccessRoute(admin, "/dashboard/configuracoes/perfis", ""), "true");

// ── Variantes ?dept=: Cozinha e Bar dividem a mesma tela ─────────────────
const soBar = { gerenciado: true, papel: "colaborador", permissions: ["bar.recipes.view"] };
const rotaFichas = "/dashboard/operacao/fichas";
const entradaBar = pageForRoute(rotaFichas, "dept=bar");
const entradaCozinha = pageForRoute(rotaFichas, "dept=cozinha");
conferir("fichas?dept=bar resolve para a entrada do bar", entradaBar?.module?.id, "bar");
conferir("fichas?dept=cozinha resolve para a entrada da cozinha", entradaCozinha?.module?.id, "cozinha");
conferir("permissao do bar abre as fichas do bar", canAccessRoute(soBar, rotaFichas, "dept=bar"), "true");
conferir("permissao do bar NAO abre as fichas da cozinha", canAccessRoute(soBar, rotaFichas, "dept=cozinha"), "false");

// ── Curingas ─────────────────────────────────────────────────────────────
conferir("curinga total", permissionMatches("*", "rh.payroll.view"), "true");
conferir("curinga de modulo", permissionMatches("rh.*", "rh.payroll.view"), "true");
conferir("curinga de pagina", permissionMatches("rh.payroll.*", "rh.payroll.view"), "true");
conferir("curinga de outro modulo nao serve", permissionMatches("financeiro.*", "rh.payroll.view"), "false");
conferir("permissions '*' na sessao abre tudo", hasPermission({ permissions: "*" }, "rh.payroll.view"), "true");

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
