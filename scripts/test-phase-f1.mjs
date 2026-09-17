import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { processHefistoIntent, INTENT_CATALOG, normalizeText } from "../app/lib/hefisto-intents.js";

console.log("==========================================");
console.log("TESTING PHASE F1: ASSISTENTE HÉFISTO — INTENÇÕES, CONSULTAS & NAVEGAÇÃO");
console.log("==========================================\n");

// [1] Test Text Normalization
console.log("[1] Testing text normalization...");
if (normalizeText("  FUNCIONÁRIO! ") !== "funcionario") {
  console.error("❌ ERROR: Text normalization failed!");
  process.exit(1);
}
console.log("✓ Text normalization (accents, casing, spaces) verified!\n");

// [2] Test Intent Engine & Navigation Resolutions
console.log("[2] Testing deterministic intent matching & Navigation Registry resolution...");

const testQueries = [
  { text: "abrir etiquetas", expectedType: "NAVIGATION", expectedRoute: "/dashboard/operacao/etiquetas" },
  { text: "ir para producao", expectedType: "NAVIGATION", expectedRoute: "/dashboard/operacao/producao?dept=cozinha" },
  { text: "mostrar CMV", expectedType: "NAVIGATION", expectedRoute: "/dashboard/financeiro/cmv" },
  { text: "abrir contas vencidas", expectedType: "NAVIGATION", expectedRoute: "/dashboard/financeiro/contas" },
  { text: "o que esta acabando?", expectedIntent: "inventory.critical" },
  { text: "tem producao atrasada?", expectedIntent: "cozinha.summary" },
  { text: "quem esta trabalhando hoje?", expectedIntent: "hr.today" },
  { text: "como esta o restaurante hoje?", expectedIntent: "command.summary" }
];

async function runIntentTests() {
  const adminSession = { papel: "admin" };

  for (const t of testQueries) {
    const res = await processHefistoIntent({
      text: t.text,
      session: adminSession,
      unitId: "unidade-teste"
    });

    if (t.expectedType && res.type !== t.expectedType) {
      console.error(`❌ ERROR: Query '${t.text}' expected type ${t.expectedType}, got ${res.type}`);
      process.exit(1);
    }
    if (t.expectedRoute && res.targetRoute !== t.expectedRoute) {
      console.error(`❌ ERROR: Query '${t.text}' expected route ${t.expectedRoute}, got ${res.targetRoute}`);
      process.exit(1);
    }
    if (t.expectedIntent && res.intent !== t.expectedIntent) {
      console.error(`❌ ERROR: Query '${t.text}' expected intent ${t.expectedIntent}, got ${res.intent}`);
      process.exit(1);
    }
    console.log(`  ✓ Query '${t.text}' correctly resolved`);
  }
}

// [3] Test Strict Permission Enforcement for Financial Queries
console.log("\n[3] Testing strict permission enforcement for non-authorized users...");
async function runPermissionTests() {
  const restrictedSession = {
    gerenciado: true,
    papel: "cozinha",
    permissions: ["cozinha.sector.view"]
  };

  const res = await processHefistoIntent({
    text: "qual o resultado do mes?",
    session: restrictedSession,
    unitId: "unidade-teste"
  });

  if (!res.permissionDenied || !res.responseText.includes("não tem acesso")) {
    console.error("❌ ERROR: Permission check failed! Sensitive financial data was returned to non-authorized user!");
    process.exit(1);
  }
  console.log("✓ Strict permission enforcement verified! Non-authorized user received permission denial response.");
}

// [4] Test Ambiguity Handling
console.log("\n[4] Testing ambiguity resolution for multi-match queries...");
async function runAmbiguityTests() {
  const adminSession = { papel: "admin" };
  const res = await processHefistoIntent({
    text: "fichas",
    session: adminSession,
    unitId: "unidade-teste"
  });

  if (res.type !== "AMBIGUOUS" || !res.options || res.options.length < 2) {
    console.error("❌ ERROR: Ambiguity handling failed for query 'fichas'!");
    process.exit(1);
  }
  console.log(`  ✓ Ambiguous query 'fichas' returned ${res.options.length} valid route options`);
}

async function main() {
  await runIntentTests();
  await runPermissionTests();
  await runAmbiguityTests();

  // [5] Execute Comprehensive Regression Tests Across All Phases
  console.log("\n[5] Executing regression test suite across Phases C, D1, D2, D3, D4, D5, E...");
  const regressionScripts = [
    "test-phase-c.mjs",
    "test-phase-d1.mjs",
    "test-phase-d2.mjs",
    "test-phase-d3.mjs",
    "test-phase-d4.mjs",
    "test-phase-d5.mjs",
    "test-phase-e.mjs"
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
  console.log("ALL PHASE F1 ASSISTENTE HÉFISTO TESTS PASSED PERFECTLY!");
  console.log("==========================================");
}

main();
