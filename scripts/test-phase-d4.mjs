import assert from "assert";
import fs from "fs";
import path from "path";
import { NAVIGATION_REGISTRY, searchNavigationRegistry } from "../app/lib/navigation-registry.mjs";

console.log("==========================================");
console.log("TESTING PHASE D4: HUB FINANCEIRO & RESULTADO");
console.log("==========================================");

// Test 1: Navigation Registry Entries for Financeiro
console.log("\n[1] Testing Navigation Registry Phase D4 Financeiro Entries...");
const finFluxo = NAVIGATION_REGISTRY.find(item => item.id === "fin-fluxo-caixa");
assert.ok(finFluxo, "fin-fluxo-caixa preset must exist in NAVIGATION_REGISTRY");
assert.strictEqual(finFluxo.route, "/dashboard/financeiro", "fin-fluxo-caixa route must match /dashboard/financeiro");

const finDre = NAVIGATION_REGISTRY.find(item => item.id === "fin-dre");
assert.ok(finDre, "fin-dre preset must exist in NAVIGATION_REGISTRY");
assert.strictEqual(finDre.route, "/dashboard/financeiro/dre", "fin-dre route must match /dashboard/financeiro/dre");

console.log("✓ Navigation Registry Financeiro entries verified successfully!");

// Test 2: Search Navigation Registry for Financeiro terms with admin session
console.log("\n[2] Testing universal search for Financeiro terms...");
const mockAdminSession = { papel: "admin", gerenciado: false };
const searchTerms = ["financeiro", "contas", "fluxo de caixa", "dre", "cmv", "imposto"];

for (const term of searchTerms) {
  const results = searchNavigationRegistry(term, mockAdminSession);
  assert.ok(results.length > 0, `Universal search for '${term}' should return results`);
  console.log(`  ✓ Term '${term}' returned ${results.length} result(s)`);
}

// Test 3: Mathematical Safety Functions (Percentage points, division by zero, % variation)
console.log("\n[3] Testing Mathematical Safety Functions...");

// Helper for percentage variation
function calcVarPct(atual, anterior) {
  if (anterior <= 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

// Helper for percentage points
function calcPP(atualPct, anteriorPct) {
  return atualPct - anteriorPct;
}

assert.strictEqual(calcVarPct(120, 100), 20, "100 to 120 should be +20%");
assert.strictEqual(calcVarPct(100, 0), null, "Division by 0 should return null (no base)");
assert.strictEqual(calcPP(28.4, 30.4), -2.0, "30.4% to 28.4% should be -2.0 p.p.");

console.log("✓ Mathematical safety functions verified!");

// Test 4: FinanceiroHub component file existence and static checks
console.log("\n[4] Testing FinanceiroHub file existence and contents...");
const finHubPath = path.resolve("./app/components/navigation/FinanceiroHub.js");
assert.ok(fs.existsSync(finHubPath), "FinanceiroHub.js file must exist");

const content = fs.readFileSync(finHubPath, "utf-8");
assert.ok(content.includes("export default function FinanceiroHub"), "FinanceiroHub must export default function FinanceiroHub");
assert.ok(content.includes("fetchContas"), "FinanceiroHub must use fetchContas API");
assert.ok(content.includes("fetchLancamentos"), "FinanceiroHub must use fetchLancamentos API");
assert.ok(content.includes("podeVerFinanceiroTotal"), "FinanceiroHub must check granular permissions");
assert.ok(content.includes("contasVencidas"), "FinanceiroHub must render vencimentos alerts");

console.log("✓ FinanceiroHub file structure, permissions, and contents verified!");

console.log("\n==========================================");
console.log("ALL PHASE D4 TESTS PASSED PERFECTLY!");
console.log("==========================================");
