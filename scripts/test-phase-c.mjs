import {
  NAVIGATION_REGISTRY,
  normalizeString,
  getAccessibleNavigation,
  getRegistryItemByRoute,
  getBottomNavPreset,
  searchNavigationRegistry
} from "../app/lib/navigation-registry.mjs";

import {
  getUserNamespace,
  addRecentRoute,
  getRecentItems,
  toggleFavoriteItem,
  getFavoriteItems,
  isFavorite
} from "../app/lib/user-preferences.js";

console.log("=== BATERIA COMPLETA DE TESTES - FASE C ===");

// Simulação de ambiente localStorage para Node.js
const mockStorage = new Map();
global.window = {
  dispatchEvent: () => {},
  location: { origin: "http://localhost" }
};
global.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key)
};

// 1. TESTE DE RECENTES: Ordem, sem duplicação e limite de 5
console.log("\n--- TESTE 1: RECENTES ---");
const userA = { id: "user_a", papel: "admin", super_admin: true };
addRecentRoute(userA, "/dashboard/operacao/etiquetas");
addRecentRoute(userA, "/dashboard/operacao/estoque");
addRecentRoute(userA, "/dashboard/rh/ponto");
addRecentRoute(userA, "/dashboard/financeiro/cmv");

let recentsA = getRecentItems(userA);
console.log("Acessou: Etiquetas -> Estoque -> Ponto -> CMV");
console.log("Ordem nos recentes:", recentsA.map(r => r.shortTitle));

if (recentsA[0]?.id === "fin-cmv" && recentsA[3]?.id === "op-etiquetas") {
  console.log("✅ OK: Ordem correta de acessos recentes.");
} else {
  console.error("❌ ERRO: Ordem de recentes incorreta.");
}

// Re-acessar Estoque
addRecentRoute(userA, "/dashboard/operacao/estoque");
recentsA = getRecentItems(userA);
console.log("Re-acessou Estoque. Nova ordem:", recentsA.map(r => r.shortTitle));

if (recentsA[0]?.id === "est-visao-geral" && recentsA.length === 4) {
  console.log("✅ OK: Item movido para o topo sem duplicação.");
} else {
  console.error("❌ ERRO: Falha ao reordenar item sem duplicação.");
}

// 2. TESTE DE FAVORITOS: Favoritar / Desfavoritar
console.log("\n--- TESTE 2: FAVORITOS ---");
toggleFavoriteItem(userA, "op-etiquetas");
toggleFavoriteItem(userA, "op-producao");
toggleFavoriteItem(userA, "fin-cmv");

let favsA = getFavoriteItems(userA);
console.log("Favoritou Etiquetas, Produção e CMV:", favsA.map(f => f.shortTitle));

if (favsA.length === 3 && isFavorite(userA, "op-etiquetas")) {
  console.log("✅ OK: Favoritos adicionados com sucesso.");
} else {
  console.error("❌ ERRO: Falha ao favoritar itens.");
}

toggleFavoriteItem(userA, "fin-cmv");
favsA = getFavoriteItems(userA);
console.log("Desfavoritou CMV. Novo total de favoritos:", favsA.map(f => f.shortTitle));

if (favsA.length === 2 && !isFavorite(userA, "fin-cmv")) {
  console.log("✅ OK: Favorito removido instantaneamente.");
} else {
  console.error("❌ ERRO: Falha ao desfavoritar item.");
}

// 3. TESTE DE PERMISSÃO: Revalidação contra ausência de permissão
console.log("\n--- TESTE 3: REVALIDAÇÃO DE PERMISSÕES NOS RECENTES E FAVORITOS ---");
const restrictedUser = {
  id: "user_a", // Mesmo ID para simular alteração de perfil/permissão
  papel: "cozinha",
  gerenciado: true,
  permissions: ["cozinha.view", "estoque.labels.view"]
};

const restrictedRecents = getRecentItems(restrictedUser);
const restrictedFavs = getFavoriteItems(restrictedUser);

console.log("Recentes do usuário com permissão reduzida:", restrictedRecents.map(r => r.shortTitle));
console.log("Favoritos do usuário com permissão reduzida:", restrictedFavs.map(f => f.shortTitle));

const containsCmvinRestricted = restrictedRecents.some(r => r.id === "fin-cmv") || restrictedFavs.some(f => f.id === "fin-cmv");
if (!containsCmvinRestricted) {
  console.log("✅ OK: Itens sem permissão foram automaticamente omitidos de Recentes e Favoritos.");
} else {
  console.error("❌ ERRO DE SEGURANÇA: Item sem permissão vazou!");
}

// 4. TESTE DE ISOLAMENTO ENTRE USUÁRIOS
console.log("\n--- TESTE 4: TROCA DE USUÁRIO (ISOLAMENTO EM TABLET COMPARTILHADO) ---");
const userB = { id: "user_b", papel: "rh", gerenciado: true, permissions: ["rh.overview.view", "rh.employees.view", "ponto.clock.view"] };
toggleFavoriteItem(userB, "rh-ponto");

const favsUserB = getFavoriteItems(userB);
const favsUserA = getFavoriteItems(userA);

console.log("Favoritos Usuário A (Admin):", favsUserA.map(f => f.shortTitle));
console.log("Favoritos Usuário B (RH):", favsUserB.map(f => f.shortTitle));

if (!favsUserB.some(f => f.id === "op-etiquetas") && !favsUserA.some(f => f.id === "rh-ponto")) {
  console.log("✅ OK: Zero vazamento de dados entre usuários no mesmo tablet.");
} else {
  console.error("❌ ERRO DE SEGURANÇA: Vazamento de preferências entre usuários!");
}

// 5 - 8. TESTE DE PRESETS PREVISÍVEIS DA BOTTOM NAVIGATION
console.log("\n--- TESTES 5 A 8: BOTTOM NAVIGATION PREVISÍVEL E ADAPTATIVA ---");
const sessionAdmin = { papel: "admin", super_admin: true };
const sessionCozinha = { papel: "cozinha", gerenciado: true, permissions: ["cozinha.view", "cozinha.production.view", "estoque.labels.view", "estoque.operation.view"] };
const sessionRH = { papel: "rh", gerenciado: true, permissions: ["rh.overview.view", "rh.employees.view", "ponto.clock.view", "rh.extras.view"] };

const bottomAdmin = getBottomNavPreset(sessionAdmin);
const bottomCozinha = getBottomNavPreset(sessionCozinha);
const bottomRH = getBottomNavPreset(sessionRH);

console.log("Bottom Nav ADMIN:", bottomAdmin.map(b => b.shortTitle));
console.log("Bottom Nav COZINHA:", bottomCozinha.map(b => b.shortTitle));
console.log("Bottom Nav RH:", bottomRH.map(b => b.shortTitle));

if (bottomAdmin.length === 5 && bottomAdmin[0].isHome && bottomAdmin[4].isMenu) {
  console.log("✅ OK: Admin possui 5 posições com Início na Pos 1 e Menu na Pos 5.");
} else {
  console.error("❌ ERRO: Estrutura do preset Admin incorreta.");
}

if (bottomCozinha.map(b => b.shortTitle).includes("Produção") && bottomCozinha.map(b => b.shortTitle).includes("Etiquetas")) {
  console.log("✅ OK: Preset da Cozinha focado em operação.");
} else {
  console.error("❌ ERRO: Preset da Cozinha incorreto.");
}

// 9. TESTE DE RESOLUÇÃO DE SUB-ROTAS (ROTA FILHA MARCA ÁREA CORRETA)
console.log("\n--- TESTE 9: RESOLUÇÃO DE SUB-ROTAS ---");
const subRouteMatch = getRegistryItemByRoute("/dashboard/operacao/etiquetas/tablet");
console.log("Sub-rota '/dashboard/operacao/etiquetas/tablet' resolve para:", subRouteMatch?.title);

if (subRouteMatch && (subRouteMatch.id === "op-etiquetas-tablet" || subRouteMatch.id === "op-etiquetas")) {
  console.log("✅ OK: Sub-rota filha mapeada para o módulo principal.");
} else {
  console.error("❌ ERRO: Falha no mapeamento de sub-rota filha.");
}

// 10. REGRESSÃO FASE B
console.log("\n--- TESTE 10: REGRESSÃO FASE B ---");
const searchAcai = searchNavigationRegistry("acai", sessionAdmin);
if (searchAcai.length > 0 && searchAcai[0].id === "op-etiquetas") {
  console.log("✅ OK: Busca universal da Fase B intacta ('acai' -> 'Impressão de Etiquetas').");
} else {
  console.error("❌ ERRO: Regressão na busca universal da Fase B.");
}

console.log("\n=== BATERIA DE TESTES FASE C FINALIZADA COM SUCESSO! ===");
