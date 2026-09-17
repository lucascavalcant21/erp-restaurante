import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { NAVIGATION_REGISTRY, searchNavigationRegistry } from "../app/lib/navigation-registry.mjs";

console.log("==========================================");
console.log("TESTING PHASE D5: INTEGRATION, CONSISTENCY & FINISHING OF HUBS");
console.log("==========================================\n");

// [1] Test HubPrimitives.js File & Components Export
console.log("[1] Testing HubPrimitives.js component library...");
const primitivesPath = path.join(process.cwd(), "app/components/navigation/HubPrimitives.js");
if (!fs.existsSync(primitivesPath)) {
  console.error("❌ ERROR: HubPrimitives.js does not exist!");
  process.exit(1);
}
const primitivesContent = fs.readFileSync(primitivesPath, "utf-8");
const expectedPrimitives = [
  "HubHeader",
  "HubAttentionCard",
  "HubSectionHeader",
  "HubCardContainer",
  "HubActionButton",
  "HubSkeleton",
  "HubErrorState",
  "HubListContainer",
  "HubListItem"
];

for (const prim of expectedPrimitives) {
  if (!primitivesContent.includes(prim)) {
    console.error(`❌ ERROR: Primitive '${prim}' missing from HubPrimitives.js`);
    process.exit(1);
  }
}
console.log("✓ HubPrimitives.js exported all required design system components!\n");

// [2] Test the 4 Operational Hub Files Existence & Primitives Usage
console.log("[2] Testing the 4 Operational Hub files for Primitives integration...");
const hubFiles = [
  { name: "CozinhaHub.js", path: "app/components/navigation/CozinhaHub.js" },
  { name: "EstoqueHub.js", path: "app/components/navigation/EstoqueHub.js" },
  { name: "RhHub.js", path: "app/components/navigation/RhHub.js" },
  { name: "FinanceiroHub.js", path: "app/components/navigation/FinanceiroHub.js" }
];

for (const hub of hubFiles) {
  const fullPath = path.join(process.cwd(), hub.path);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ ERROR: Hub file ${hub.name} does not exist!`);
    process.exit(1);
  }
  const content = fs.readFileSync(fullPath, "utf-8");
  if (!content.includes("HubHeader") || !content.includes("HubPrimitives")) {
    console.error(`❌ ERROR: ${hub.name} does not import or use HubPrimitives!`);
    process.exit(1);
  }
}
console.log("✓ All 4 Hubs successfully import and render using HubPrimitives!\n");

// [3] Test Integration Pages Rendering Hub Components
console.log("[3] Testing page routes for Hub integration...");
const pageIntegrations = [
  { route: "/dashboard/cozinha", path: "app/dashboard/cozinha/page.js", importName: "CozinhaHub" },
  { route: "/dashboard/operacao/estoque", path: "app/dashboard/operacao/estoque/page.js", importName: "EstoqueHub" },
  { route: "/dashboard/rh", path: "app/dashboard/rh/page.js", importName: "RhHub" },
  { route: "/dashboard/financeiro", path: "app/dashboard/financeiro/page.js", importName: "FinanceiroHub" }
];

for (const page of pageIntegrations) {
  const fullPath = path.join(process.cwd(), page.path);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ ERROR: Page ${page.path} does not exist!`);
    process.exit(1);
  }
  const content = fs.readFileSync(fullPath, "utf-8");
  if (!content.includes(page.importName)) {
    console.error(`❌ ERROR: Page ${page.path} does not import ${page.importName}!`);
    process.exit(1);
  }
}
console.log("✓ All dashboard page routes cleanly integrate their respective Hubs!\n");

// [4] Test Navigation Registry Entries for Hubs
console.log("[4] Testing Navigation Registry Phase D5 Hub Entries...");
const hubRegistryIds = ["hub-cozinha", "est-visao-geral", "rh-painel", "fin-fluxo-caixa"];

for (const id of hubRegistryIds) {
  const entry = NAVIGATION_REGISTRY.find(e => e.id === id);
  if (!entry) {
    console.error(`❌ ERROR: Navigation Registry entry for '${id}' is missing!`);
    process.exit(1);
  }
}
console.log("✓ Navigation Registry entries for all 4 Hubs verified!\n");

// [5] Test Universal Search Across Domain Terms
console.log("[5] Testing Universal Search across operational terms...");
const searchTerms = [
  "cozinha", "estoque", "rh", "financeiro",
  "etiquetas", "cmv", "ponto", "compras", "producao"
];

for (const term of searchTerms) {
  const results = searchNavigationRegistry(term, { papel: "admin" });
  if (results.length === 0) {
    console.error(`❌ ERROR: Search term '${term}' returned zero results!`);
    process.exit(1);
  }
  console.log(`  ✓ Search for '${term}' returned ${results.length} result(s)`);
}
console.log("✓ Universal Search across all operational Hub terms verified!\n");

// [6] Run Previous Phase Regression Tests
console.log("[6] Executing regression tests across Phases C, D1, D2, D3, D4...");
const phaseTestScripts = [
  "test-phase-c.mjs",
  "test-phase-d1.mjs",
  "test-phase-d2.mjs",
  "test-phase-d3.mjs",
  "test-phase-d4.mjs"
];

for (const script of phaseTestScripts) {
  console.log(`  Running scripts/${script}...`);
  try {
    execSync(`node scripts/${script}`, { stdio: "inherit" });
  } catch (err) {
    console.error(`❌ ERROR: Regression test scripts/${script} failed!`);
    process.exit(1);
  }
}

console.log("\n==========================================");
console.log("ALL PHASE D5 INTEGRATION & CONSISTENCY TESTS PASSED PERFECTLY!");
console.log("==========================================");
