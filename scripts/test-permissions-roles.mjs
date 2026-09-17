import { getAccessibleNavigation, searchNavigationRegistry } from "../app/lib/navigation-registry.mjs";

const ROLES_MOCK = {
  ADMINISTRADOR: { papel: "admin", super_admin: true },
  GESTOR: { papel: "gerente", gerenciado: true, permissions: ["cozinha.view", "rh.view", "estoque.view", "relatorios.view"] },
  COZINHA: { papel: "cozinha", gerenciado: true, permissions: ["cozinha.view", "cozinha.production.view", "estoque.labels.view"] },
  BAR: { papel: "bar", gerenciado: true, permissions: ["bar.view", "bar.production.view", "bar.recipes.view"] },
  RH: { papel: "rh", gerenciado: true, permissions: ["rh.overview.view", "rh.employees.view", "ponto.clock.view", "rh.extras.view"] },
  USUARIO_RESTRITO: { papel: "funcionario", gerenciado: true, permissions: ["dashboard.overview.view"] }
};

console.log("=== TESTE DE SEGURANÇA E NAVEGAÇÃO POR PERFIL (FASE B) ===");

for (const [roleName, session] of Object.entries(ROLES_MOCK)) {
  const accessible = getAccessibleNavigation(session);
  const dreInSearch = searchNavigationRegistry("dre", session);
  const fiscalInSearch = searchNavigationRegistry("fiscal", session);
  const usuariosInSearch = searchNavigationRegistry("usuarios", session);

  console.log(`\nPERFIL: [${roleName}]`);
  console.log(`  - Destinos permitidos no catálogo: ${accessible.length}`);
  console.log(`  - Visualiza DRE na busca? ${dreInSearch.length > 0 ? "SIM ❌" : "NÃO ✅"}`);
  console.log(`  - Visualiza Dados Fiscais? ${fiscalInSearch.length > 0 ? "SIM ❌" : "NÃO ✅"}`);
  console.log(`  - Visualiza Gestão de Usuários? ${usuariosInSearch.length > 0 ? "SIM ❌" : "NÃO ✅"}`);

  if (roleName !== "ADMINISTRADOR") {
    if (dreInSearch.length === 0 && fiscalInSearch.length === 0 && usuariosInSearch.length === 0) {
      console.log(`  ✅ OK: Perfil ${roleName} está totalmente protegido.`);
    } else {
      console.error(`  ❌ FALHA DE SEGURANÇA: Perfil ${roleName} acessou rotas administrativas!`);
    }
  }
}
console.log("\n=======================================================");
