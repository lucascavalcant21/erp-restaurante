import {
  NAVIGATION_REGISTRY,
  normalizeString,
  getAccessibleNavigation,
  searchNavigationRegistry
} from "../app/lib/navigation-registry.mjs";

console.log("=== TESTES NAVEGAÇÃO HÉFISTO (FASE B) ===");

// 1. Validar contagem de rotas registradas
console.log(`[TEST 1] Total de destinos registrados: ${NAVIGATION_REGISTRY.length}`);
if (NAVIGATION_REGISTRY.length >= 35) {
  console.log("✅ OK: Destinos essenciais registrados.");
} else {
  console.error("❌ ERRO: Poucos destinos registrados.");
}

// 2. Normalização de texto (Acentos / Caixa)
const norm1 = normalizeString("Açaí / Cúrcuma");
const norm2 = normalizeString("  IMPRESSÃO DE ETIQUETAS  ");
console.log(`[TEST 2] Normalização: "Açaí / Cúrcuma" -> "${norm1}"`);
console.log(`[TEST 2] Normalização: "  IMPRESSÃO DE ETIQUETAS  " -> "${norm2}"`);
if (norm1 === "acai / curcuma" && norm2 === "impressao de etiquetas") {
  console.log("✅ OK: Normalização funcional.");
} else {
  console.error("❌ ERRO: Falha na normalização.");
}

// 3. Testes de Busca Universal e Ranking
const testQueries = [
  "acai",
  "etiqueta",
  "imprimir",
  "cmv",
  "ponto",
  "bater ponto",
  "funcionario",
  "compras",
  "boleto"
];

const mockAdminSession = { papel: "admin", super_admin: true };
const mockRestrictedSession = {
  papel: "cozinha",
  gerenciado: true,
  permissions: ["cozinha.view", "estoque.labels.view", "ponto.clock.view"]
};

console.log("\n--- RESULTADOS DA BUSCA (ADMIN) ---");
for (const q of testQueries) {
  const res = searchNavigationRegistry(q, mockAdminSession, { limit: 3 });
  console.log(`\nBusca: "${q}" -> ${res.length} resultados`);
  res.forEach((item, idx) => {
    console.log(`  ${idx + 1}. [Score ${item.score}] ${item.title} (${item.route})`);
  });
}

// 4. Teste de Permissões
console.log("\n--- TESTE DE SEGURANÇA E FILTRAGEM DE PERMISSÕES ---");
const adminNav = getAccessibleNavigation(mockAdminSession);
const restrictedNav = getAccessibleNavigation(mockRestrictedSession);

console.log(`Admin acessa: ${adminNav.length} rotas`);
console.log(`Cozinha acessa: ${restrictedNav.length} rotas`);

const hasDreInRestricted = restrictedNav.some(r => r.route.includes("dre"));
if (!hasDreInRestricted) {
  console.log("✅ OK: Usuário restrito NÃO visualiza DRE na busca/navegação.");
} else {
  console.error("❌ ERRO DE SEGURANÇA: Usuário restrito conseguiu visualizar DRE!");
}

console.log("\n=== FIM DOS TESTES DE NAVEGAÇÃO ===");
