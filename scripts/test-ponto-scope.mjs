import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { processHefistoIntent, normalizeText } from "../app/lib/hefisto-intents.js";
import { searchNavigationRegistry, getBottomNavPreset } from "../app/lib/navigation-registry.mjs";

console.log("==========================================");
console.log("TESTING PONTO SCOPE CORRECTION & REGRESSION");
console.log("==========================================\n");

// [1] Test Route Verification for Ponto Traditional and Kiosk
console.log("[1] Auditing Ponto Routes & Navigation Registry Priority...");

const mainPontoQueries = ["bater ponto", "ponto", "registrar ponto"];
const secondaryPontoQueries = ["entrada", "saida", "bater entrada", "bater saida"];
const adminSession = { papel: "admin" };

for (const q of mainPontoQueries) {
  const results = searchNavigationRegistry(q, adminSession);
  if (!results.length) {
    console.error(`❌ ERROR: Search term '${q}' returned 0 results!`);
    process.exit(1);
  }
  const topResult = results[0];
  if (topResult.route !== "/dashboard/ponto" && topResult.route !== "/dashboard/rh/ponto") {
    console.error(`❌ ERROR: Search term '${q}' top result is '${topResult.title}' (${topResult.route}), expected traditional ponto route!`);
    process.exit(1);
  }
  console.log(`  ✓ Search '${q}' -> '${topResult.title}' (${topResult.route})`);
}

for (const q of [...mainPontoQueries, ...secondaryPontoQueries]) {
  const results = searchNavigationRegistry(q, adminSession);
  const topResult = results[0];
  if (topResult && topResult.route === "/dashboard/rh/facial") {
    console.error(`❌ ERROR: Ponto Facial appeared as top result for query '${q}'!`);
    process.exit(1);
  }
}
console.log("✓ Navigation Registry correctly prioritizes traditional Ponto routes!\n");

// [2] Test Héfisto F1 Natural Language Resolution for Ponto
console.log("[2] Testing Héfisto F1 Intent Engine for Ponto Commands...");

const f1PontoQueries = [
  "quero bater ponto",
  "abrir ponto",
  "registrar ponto",
  "bater meu ponto"
];

async function runF1PontoTests() {
  for (const text of f1PontoQueries) {
    const res = await processHefistoIntent({
      text,
      session: adminSession,
      unitId: "unidade-teste"
    });

    if (res.type !== "NAVIGATION") {
      console.error(`❌ ERROR: Intent '${text}' expected type NAVIGATION, got ${res.type}`);
      process.exit(1);
    }
    if (res.targetRoute !== "/dashboard/ponto") {
      console.error(`❌ ERROR: Intent '${text}' expected targetRoute '/dashboard/ponto', got ${res.targetRoute}`);
      process.exit(1);
    }
    console.log(`  ✓ Héfisto intent '${text}' -> NAVIGATION to '${res.targetRoute}'`);
  }
  console.log("✓ Héfisto F1 intent resolution for Ponto verified!\n");
}

// [3] Test Bottom Navigation Presets for Ponto
console.log("[3] Testing Bottom Navigation Presets for Ponto...");

const salaoSession = { papel: "salao", gerenciado: true, permissions: ["salao.tables.view", "ponto.kiosk.view"] };
const rhSession = { papel: "rh", gerenciado: true, permissions: ["rh.overview.view", "ponto.clock.view"] };

const salaoNav = getBottomNavPreset(salaoSession);
const rhNav = getBottomNavPreset(rhSession);

const hasKioskInSalao = salaoNav.some(item => item.route === "/dashboard/ponto");
const hasRhPontoInRh = rhNav.some(item => item.route === "/dashboard/rh/ponto" || item.route === "/dashboard/ponto");

if (!hasKioskInSalao) {
  console.error("❌ ERROR: Salão preset missing Quiosque de Ponto (/dashboard/ponto)!");
  process.exit(1);
}
if (!hasRhPontoInRh) {
  console.error("❌ ERROR: RH preset missing Ponto (/dashboard/rh/ponto)!");
  process.exit(1);
}
console.log("✓ Bottom Navigation presets use traditional Ponto routes!\n");

// [4] Test Isolation of Facial Code & Clean Traditional Kiosk
console.log("[4] Checking facial isolation and traditional kiosk UI...");

const kioskPageCode = fs.readFileSync(path.resolve("app/dashboard/ponto/page.js"), "utf8");
if (kioskPageCode.includes("Bater ponto pelo rosto")) {
  console.error("❌ ERROR: 'Bater ponto pelo rosto' button is still present in traditional kiosk UI!");
  process.exit(1);
}
console.log("✓ Traditional Quiosque UI is clean and free of facial prompts!");

const facialComponentExists = fs.existsSync(path.resolve("app/components/PontoFacial.js"));
const facialLibExists = fs.existsSync(path.resolve("app/lib/facial.js"));
const facialPageExists = fs.existsSync(path.resolve("app/dashboard/rh/facial/page.js"));

if (!facialComponentExists || !facialLibExists || !facialPageExists) {
  console.error("❌ ERROR: Legacy facial code files were accidentally deleted!");
  process.exit(1);
}
console.log("✓ Legacy facial code files preserved untouched for safety!\n");

// [5] Run Full Regression Test Suite
console.log("[5] Executing full regression test suite (Phase F1 + all previous phases)...");

async function main() {
  await runF1PontoTests();
  try {
    execSync("node scripts/test-phase-f1.mjs", { stdio: "inherit" });
    console.log("\n==========================================");
    console.log("ALL PONTO SCOPE CORRECTION & REGRESSION TESTS PASSED PERFECTLY!");
    console.log("==========================================");
  } catch (err) {
    console.error("❌ ERROR in regression suite execution!");
    process.exit(1);
  }
}

main();
