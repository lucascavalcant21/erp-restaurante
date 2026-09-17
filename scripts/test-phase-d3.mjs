import assert from "assert";
import fs from "fs";
import path from "path";
import { NAVIGATION_REGISTRY, searchNavigationRegistry } from "../app/lib/navigation-registry.mjs";

console.log("==========================================");
console.log("TESTING PHASE D3: HUB RH & EQUIPE");
console.log("==========================================");

// Test 1: Navigation Registry Entries for RH
console.log("\n[1] Testing Navigation Registry Phase D3 RH Entries...");
const rhPainel = NAVIGATION_REGISTRY.find(item => item.id === "rh-painel");
assert.ok(rhPainel, "rh-painel preset must exist in NAVIGATION_REGISTRY");
assert.strictEqual(rhPainel.route, "/dashboard/rh", "rh-painel route must match /dashboard/rh");

const rhGestao = NAVIGATION_REGISTRY.find(item => item.id === "rh-gestao");
assert.ok(rhGestao, "rh-gestao preset must exist in NAVIGATION_REGISTRY");
assert.strictEqual(rhGestao.route, "/dashboard/rh/gestao", "rh-gestao route must match /dashboard/rh/gestao");

console.log("✓ Navigation Registry RH entries verified successfully!");

// Test 2: Search Navigation Registry for RH terms with admin session
console.log("\n[2] Testing universal search for RH terms...");
const mockAdminSession = { papel: "admin", gerenciado: false };
const searchTerms = ["rh", "funcionário", "ponto", "banco de horas"];

for (const term of searchTerms) {
  const results = searchNavigationRegistry(term, mockAdminSession);
  assert.ok(results.length > 0, `Universal search for '${term}' should return results`);
  console.log(`  ✓ Term '${term}' returned ${results.length} result(s)`);
}

// Test 3: RhHub component file existence and static checks
console.log("\n[3] Testing RhHub file existence and contents...");
const rhHubPath = path.resolve("./app/components/navigation/RhHub.js");
assert.ok(fs.existsSync(rhHubPath), "RhHub.js file must exist");

const content = fs.readFileSync(rhHubPath, "utf-8");
assert.ok(content.includes("export default function RhHub"), "RhHub must export default function RhHub");
assert.ok(content.includes("fetchColaboradores"), "RhHub must use fetchColaboradores API");
assert.ok(content.includes("fetchPontoHoje"), "RhHub must use fetchPontoHoje API");
assert.ok(content.includes("situacaoDoPonto"), "RhHub must use situacaoDoPonto helper");
assert.ok(content.includes("podeVerGestaoRH"), "RhHub must enforce block permissions");

console.log("✓ RhHub file structure, permissions, and contents verified!");

console.log("\n==========================================");
console.log("ALL PHASE D3 TESTS PASSED PERFECTLY!");
console.log("==========================================");
