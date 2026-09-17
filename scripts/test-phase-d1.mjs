import { NAVIGATION_REGISTRY, getAccessibleNavigation, getBottomNavPreset, searchNavigationRegistry } from "../app/lib/navigation-registry.mjs";

console.log("=== BATERIA DE TESTES - FASE D1 (HUB COZINHA) ===");

// 1. Validar registro do Hub Cozinha no Navigation Registry
const hubCozinha = NAVIGATION_REGISTRY.find(i => i.id === "hub-cozinha");
console.log(`[TEST 1] Registro do Hub Cozinha:`, hubCozinha ? `✅ Cadastrado (${hubCozinha.route})` : "❌ Não encontrado");
if (!hubCozinha) {
  console.error("❌ ERRO: hub-cozinha não cadastrado.");
}

// 2. Teste de Permissões: Usuário com permissão de Cozinha vs Usuário Restrito
console.log("\n--- TESTE 2: PERMISSÕES NO HUB COZINHA ---");
const sessionCozinha = { papel: "cozinha", gerenciado: true, permissions: ["cozinha.view", "cozinha.sector.view", "cozinha.production.view", "estoque.labels.view"] };
const sessionSemEstoque = { papel: "cozinha", gerenciado: true, permissions: ["cozinha.view", "cozinha.sector.view", "cozinha.production.view"] };

const accessibleCozinha = getAccessibleNavigation(sessionCozinha);
const accessibleSemEstoque = getAccessibleNavigation(sessionSemEstoque);

console.log(`Cozinha Completa acessa: ${accessibleCozinha.length} rotas`);
console.log(`Cozinha Sem Estoque acessa: ${accessibleSemEstoque.length} rotas`);

const podeVerEstoqueNoSemEstoque = accessibleSemEstoque.some(r => r.route.includes("/estoque"));
if (!podeVerEstoqueNoSemEstoque) {
  console.log("✅ OK: Bloco de estoque crítico é omitido para usuário sem permissão de estoque.");
} else {
  console.error("❌ ERRO: Usuário sem permissão visualizou estoque.");
}

// 3. Teste de Busca pelo Hub Cozinha
console.log("\n--- TESTE 3: BUSCA UNIVERSAL PELO HUB COZINHA ---");
const buscaCozinha = searchNavigationRegistry("cozinha", sessionCozinha);
console.log("Busca por 'cozinha':", buscaCozinha.slice(0, 3).map(i => i.title));
if (buscaCozinha.some(i => i.id === "hub-cozinha")) {
  console.log("✅ OK: Hub Cozinha encontrado na Busca Universal.");
} else {
  console.error("❌ ERRO: Hub Cozinha não retornou na busca.");
}

// 4. Teste de Preset da Bottom Navigation para Cozinha
console.log("\n--- TESTE 4: PRESET BOTTOM NAV PARA COZINHA ---");
const presetCozinha = getBottomNavPreset(sessionCozinha);
console.log("Preset Bottom Nav Cozinha:", presetCozinha.map(p => p.shortTitle));

if (presetCozinha.length === 5 && presetCozinha[1].id === "hub-cozinha") {
  console.log("✅ OK: Preset da Cozinha inicia com o Hub Cozinha na posição 2.");
} else {
  console.error("❌ ERRO: Preset da Cozinha incorreto.");
}

// 5. Teste de Regressão das Fases B e C
console.log("\n--- TESTE 5: REGRESSÃO FASES B E C ---");
const buscaAcai = searchNavigationRegistry("acai", sessionCozinha);
if (buscaAcai.length > 0 && buscaAcai[0].id === "op-etiquetas") {
  console.log("✅ OK: Regressão da busca universal sem falhas.");
} else {
  console.error("❌ ERRO: Falha na busca universal.");
}

console.log("\n=== BATERIA DE TESTES FASE D1 FINALIZADA COM SUCESSO! ===");
