import assert from "assert";
import fs from "fs";
import path from "path";
import { NAVIGATION_REGISTRY, searchNavigationRegistry, getAccessibleNavigation } from "../app/lib/navigation-registry.mjs";

console.log("==========================================");
console.log("TESTING PHASE D2: HUB ESTOQUE & COMPRAS");
console.log("==========================================");

// Test 1: Navigation Registry Entries
console.log("\n[1] Testing Navigation Registry Phase D2 Entries...");
const hubCozinha = NAVIGATION_REGISTRY.find(item => item.id === "hub-cozinha");
assert.ok(hubCozinha, "hub-cozinha preset must exist in NAVIGATION_REGISTRY");
assert.strictEqual(hubCozinha.route, "/dashboard/cozinha", "hub-cozinha route must match /dashboard/cozinha");

const estVisaoGeral = NAVIGATION_REGISTRY.find(item => item.id === "est-visao-geral");
assert.ok(estVisaoGeral, "est-visao-geral preset must exist in NAVIGATION_REGISTRY");
assert.strictEqual(estVisaoGeral.route, "/dashboard/operacao/estoque", "est-visao-geral route must match /dashboard/operacao/estoque");

console.log("✓ Navigation Registry entries verified successfully!");

// Test 2: Search Navigation Registry for Estoque with admin session
console.log("\n[2] Testing universal search for 'estoque' with admin session...");
const mockAdminSession = { papel: "admin", gerenciado: false };
const searchResults = searchNavigationRegistry("estoque", mockAdminSession);
assert.ok(searchResults.length > 0, "Universal search for 'estoque' should return results for admin");

const estoqueResult = searchResults.find(i => i.id === "est-visao-geral");
assert.ok(estoqueResult, "est-visao-geral must be present in search results for 'estoque'");
console.log("✓ Universal search for Estoque verified successfully!");

// Test 3: EstoqueHub component file existence and static checks
console.log("\n[3] Testing EstoqueHub file existence and contents...");
const estoquHubPath = path.resolve("./app/components/navigation/EstoqueHub.js");
assert.ok(fs.existsSync(estoquHubPath), "EstoqueHub.js file must exist");

const content = fs.readFileSync(estoquHubPath, "utf-8");
assert.ok(content.includes("export default function EstoqueHub"), "EstoqueHub must export default function EstoqueHub");
assert.ok(content.includes("fetchEstoque"), "EstoqueHub must use fetchEstoque API");
assert.ok(content.includes("fetchMovimentosEstoque"), "EstoqueHub must use fetchMovimentosEstoque API");
assert.ok(content.includes("hasPermission"), "EstoqueHub must check permissions");

console.log("✓ EstoqueHub file structure and contents verified!");

console.log("\n==========================================");
console.log("ALL PHASE D2 TESTS PASSED PERFECTLY!");
console.log("==========================================");
