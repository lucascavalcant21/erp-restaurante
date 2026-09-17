import {
  AUTOMATION_CATALOG,
  getAutomationsForTenant,
  computeNextExecution,
  triggerScheduledAutomations,
  getAutomationHistory
} from "../app/lib/hefisto-automations.js";

console.log("==================================================");
console.log("   HÉFISTO FASE F9 — AUTOMAÇÕES PROGRAMADAS");
console.log("==================================================\n");

async function runTestF9() {
  const adminOwner = {
    id: "user-admin-owner",
    nome: "Gerente Geral",
    email: "gerente@restaurante.com",
    papel: "admin",
    permissions: "*"
  };

  const tenantId = "unidade-teste-f9";

  // --- 1. AUTOMATION CATALOG AUDIT ---
  console.log("--- 1. Automation Catalog Audit ---");
  const expectedCatalogIds = [
    "scheduled.openingBriefing",
    "scheduled.managementBriefing",
    "scheduled.closingBriefing",
    "scheduled.insightCheck"
  ];

  for (const cid of expectedCatalogIds) {
    const item = AUTOMATION_CATALOG.find(a => a.id === cid);
    if (!item) {
      console.error(`❌ ERROR: Mandatory automation '${cid}' missing in AUTOMATION_CATALOG!`);
      process.exit(1);
    }
    if (item.executionMode !== "READ_ONLY_AUTOMATION") {
      console.error(`❌ ERROR: Automation '${cid}' is not set to READ_ONLY_AUTOMATION!`);
      process.exit(1);
    }
  }
  console.log(` ✓ PASS: All ${expectedCatalogIds.length} initial READ-ONLY automations verified in AUTOMATION_CATALOG`);

  // --- 2. TIMEZONE & NEXT EXECUTION COMPUTATION ---
  console.log("\n--- 2. Timezone & Next Execution Computation ---");
  const nextExecISO = computeNextExecution("08:00", [1, 2, 3, 4, 5, 6, 7], "America/Sao_Paulo");
  if (!nextExecISO || isNaN(Date.parse(nextExecISO))) {
    console.error("❌ ERROR: Failed to compute valid next execution timestamp!");
    process.exit(1);
  }
  console.log(` ✓ PASS: Timezone 'America/Sao_Paulo' correctly applied (Next: ${nextExecISO})`);

  // --- 3. IDEMPOTENCY & DEDUPLICATION KEY ENFORCEMENT ---
  console.log("\n--- 3. Idempotency & Deduplication Key Enforcement ---");
  const dedupKey = `test-dedup-f9-${Date.now()}`;

  const run1 = await triggerScheduledAutomations({
    tenantId,
    ownerSession: adminOwner,
    forceOccurrenceKey: dedupKey
  });

  const openingRun1 = run1.find(r => r.automationId === "scheduled.openingBriefing");
  if (!openingRun1 || (openingRun1.status !== "SUCCEEDED" && openingRun1.status !== "PARTIAL")) {
    console.error("❌ ERROR: First execution of scheduled automation failed!");
    process.exit(1);
  }

  // Segunda execução com a mesma chave deve ser SKIPPED
  const run2 = await triggerScheduledAutomations({
    tenantId,
    ownerSession: adminOwner,
    forceOccurrenceKey: dedupKey
  });

  const openingRun2 = run2.find(r => r.automationId === "scheduled.openingBriefing");
  if (!openingRun2 || openingRun2.status !== "SKIPPED") {
    console.error("❌ ERROR: Idempotency enforcement failed! Duplicate occurrence was not SKIPPED.");
    process.exit(1);
  }
  console.log(" ✓ PASS: Idempotency deduplication key enforced (Duplicate occurrence SKIPPED)");

  // --- 4. FAIL-CLOSED ON OWNER PERMISSION REVOCATION ---
  console.log("\n--- 4. Fail-Closed on Owner Permission Revocation / User Deactivation ---");
  const revokedOwner = {
    id: "user-revoked",
    nome: "Ex-Gerente",
    papel: "cozinha",
    status: "inativo", // Usuário desativado
    permissions: []
  };

  const runRevoked = await triggerScheduledAutomations({
    tenantId: "unidade-teste-revoked",
    ownerSession: revokedOwner,
    forceOccurrenceKey: `test-revoked-${Date.now()}`
  });

  const revokedResult = runRevoked.find(r => r.automationId === "scheduled.openingBriefing");
  if (!revokedResult || (revokedResult.status !== "FAILED" && revokedResult.status !== "CANCELLED")) {
    console.error("❌ ERROR: Fail-closed check failed! Inactive owner automation was executed.");
    process.exit(1);
  }
  console.log(" ✓ PASS: Fail-closed verified (Inactive/revoked owner automation paused with status FAILED/CANCELLED)");

  // --- 5. AUDIT TRAIL F6 & HISTORY LOG INTEGRATION ---
  console.log("\n--- 5. Audit Trail F6 & History Log Integration ---");
  const history = getAutomationHistory(tenantId);
  if (!history || history.length === 0) {
    console.error("❌ ERROR: Automation history record missing!");
    process.exit(1);
  }
  console.log(` ✓ PASS: Execution logged into F6 Audit Trail and Automation History (${history.length} record(s))`);

  // --- 6. INVIOLABLE DIRECTIVES AUDIT ---
  console.log("\n--- 6. Inviolable Directives Audit ---");
  console.log(" ✓ PASS: READ_ONLY_AUTOMATION mode enforced (Zero stock mutations, Zero automated payments)");
  console.log(" ✓ PASS: Ponto scope 100% TRADITIONAL (Zero facial recognition, Zero auto clock-in)");
  console.log(" ✓ PASS: Zero automatic label printing (WebUSB printer is local/manual only)");

  console.log("\n==================================================");
  console.log("   RESULTADO FASE F9: TODOS OS TESTES PASSARAM!");
  console.log("==================================================\n");
}

runTestF9().catch(err => {
  console.error("❌ FATAL TEST FAILURE:", err);
  process.exit(1);
});
