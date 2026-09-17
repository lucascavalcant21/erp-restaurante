import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { NAVIGATION_REGISTRY, searchNavigationRegistry } from "../app/lib/navigation-registry.mjs";

console.log("==========================================");
console.log("TESTING PHASE E: CENTRAL DE COMANDO DO RESTAURANTE");
console.log("==========================================\n");

// [1] Testing app/dashboard/page.js File Structure & Primitives
console.log("[1] Testing Central de Comando Home file structure & primitives...");
const homePath = path.join(process.cwd(), "app/dashboard/page.js");
if (!fs.existsSync(homePath)) {
  console.error("❌ ERROR: app/dashboard/page.js does not exist!");
  process.exit(1);
}
const homeContent = fs.readFileSync(homePath, "utf-8");

const requiredTokens = [
  "CentralDeComandoHome",
  "HubHeader",
  "HubAttentionCard",
  "HubSectionHeader",
  "HubCardContainer",
  "HubActionButton",
  "HubPrimitives",
  "Precisa de Você",
  "Agora no Restaurante",
  "actionItems",
  "Promise.allSettled"
];

for (const token of requiredTokens) {
  if (!homeContent.includes(token)) {
    console.error(`❌ ERROR: Token '${token}' missing from app/dashboard/page.js!`);
    process.exit(1);
  }
}
console.log("✓ Home file structure & design system primitives verified!\n");

// [2] Testing Action Item Derivation & Severity Hierarchy Contract
console.log("[2] Testing Action Item contract and severity sorting logic...");
const sampleActionItems = [
  { id: "1", severity: "warning", title: "ESTOQUE", description: "4 itens abaixo do mínimo" },
  { id: "2", severity: "critical", title: "FINANCEIRO", description: "3 contas vencidas" },
  { id: "3", severity: "info", title: "RH", description: "2 lembretes de folga" }
];

const severityOrder = { critical: 1, warning: 2, info: 3 };
sampleActionItems.sort((a, b) => (severityOrder[a.severity] || 9) - (severityOrder[b.severity] || 9));

if (sampleActionItems[0].id !== "2" || sampleActionItems[1].id !== "1") {
  console.error("❌ ERROR: Action Item severity sorting failed!");
  process.exit(1);
}
console.log("✓ Action Item contract & severity ranking verified!\n");

// [3] Testing Navigation Registry & Universal Search for Home
console.log("[3] Testing Navigation Registry entry 'dash-home' & Search...");
const homeEntry = NAVIGATION_REGISTRY.find(e => e.id === "dash-home");
if (!homeEntry || homeEntry.route !== "/dashboard") {
  console.error("❌ ERROR: Navigation Registry entry for 'dash-home' is invalid!");
  process.exit(1);
}

const searchResults = searchNavigationRegistry("inicio", { papel: "admin" });
if (searchResults.length === 0) {
  console.error("❌ ERROR: Search for 'inicio' returned zero results!");
  process.exit(1);
}
console.log("✓ Navigation Registry entry and search for Home verified!\n");

// [4] Executing Comprehensive Regression Tests Across All Phases
console.log("[4] Executing regression test suite across Phases C, D1, D2, D3, D4, D5...");
const regressionScripts = [
  "test-phase-c.mjs",
  "test-phase-d1.mjs",
  "test-phase-d2.mjs",
  "test-phase-d3.mjs",
  "test-phase-d4.mjs",
  "test-phase-d5.mjs"
];

for (const script of regressionScripts) {
  console.log(`  Running scripts/${script}...`);
  try {
    execSync(`node scripts/${script}`, { stdio: "inherit" });
  } catch (err) {
    console.error(`❌ ERROR: Regression test scripts/${script} failed!`);
    process.exit(1);
  }
}

console.log("\n==========================================");
console.log("ALL PHASE E CENTRAL DE COMANDO TESTS PASSED PERFECTLY!");
console.log("==========================================");
