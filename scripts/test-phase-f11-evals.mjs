import { runHefistoEvals, EVAL_DATASET } from "../app/lib/hefisto-evals.js";

console.log("==================================================");
console.log("   HÉFISTO FASE F11 — EVALS & RELIABILITY LAYER");
console.log("==================================================\n");

async function runTestF11Evals() {
  console.log("--- 1. Evaluating Dataset Composition ---");
  console.log(` Dataset size: ${EVAL_DATASET.length} total synthetic test cases.`);
  if (EVAL_DATASET.length < 100) {
    console.error(`❌ ERROR: Dataset contains ${EVAL_DATASET.length} cases (must be >= 100).`);
    process.exit(1);
  }
  console.log(" ✓ PASS: Dataset size requirement (>= 100 cases) satisfied.\n");

  console.log("--- 2. Running Fast Critical Safety Suite ---");
  const fastReport = await runHefistoEvals({ suite: "fast" });
  console.log(` Critical Cases Evaluated: ${fastReport.summary.totalCases}`);
  console.log(` Critical Cases Passed: ${fastReport.summary.passedCases}`);
  console.log(` Critical Safety Gate: [ ${fastReport.criticalSafetyPass} ]`);

  if (fastReport.criticalSafetyPass !== "PASS") {
    console.error("❌ CRITICAL ERROR: Fast Critical Safety Suite FAILED!");
    console.error(fastReport.failedDetails);
    process.exit(1);
  }
  console.log(" ✓ PASS: 100% of Fast Critical Safety tests passed successfully.\n");

  console.log("--- 3. Running Full Evaluation Suite ---");
  const fullReport = await runHefistoEvals({ suite: "full" });

  console.log("\n==================================================");
  console.log("               HEFESTO EVAL REPORT                ");
  console.log("==================================================");
  console.log(` Timestamp:                ${fullReport.timestamp}`);
  console.log(` Overall Status:           [ ${fullReport.overallStatus} ]`);
  console.log(` Critical Safety Gate:     [ ${fullReport.criticalSafetyPass} ]`);
  console.log("--------------------------------------------------");
  console.log(` Total Cases Evaluated:    ${fullReport.summary.totalCases}`);
  console.log(` Cases Passed:             ${fullReport.summary.passedCases}`);
  console.log(` Cases Failed:             ${fullReport.summary.failedCases}`);
  console.log(` Overall Accuracy Rate:    ${fullReport.summary.overallAccuracyRate}%`);
  console.log("--------------------------------------------------");
  console.log(" GRANULAR OPERATIONAL METRICS:");
  console.log(`   - Intent Accuracy:       ${fullReport.metrics.intentAccuracy}%`);
  console.log(`   - Entity Accuracy:       ${fullReport.metrics.entityAccuracy}%`);
  console.log(`   - Tool Accuracy:         ${fullReport.metrics.toolAccuracy}%`);
  console.log(`   - Permission Safety:     ${fullReport.metrics.permissionSafety}%`);
  console.log(`   - Action Safety:         ${fullReport.metrics.actionSafety}%`);
  console.log(`   - Analytics Accuracy:    ${fullReport.metrics.analyticsAccuracy}%`);
  console.log(`   - Tenant Safety:         ${fullReport.metrics.tenantSafety}%`);
  console.log(`   - Hallucination Rate:    ${fullReport.metrics.hallucinationRate}%`);
  console.log(`   - Workflow Success:      ${fullReport.metrics.workflowSuccess}%`);
  console.log("==================================================\n");

  if (fullReport.overallStatus !== "PASS" || fullReport.criticalSafetyPass !== "PASS") {
    console.error("❌ ERROR: HEFESTO EVAL REPORT FAILED OVERALL STATUS OR CRITICAL SAFETY GATE!");
    process.exit(1);
  }

  console.log("✅ SUCCESS: HÉFISTO FASE F11 — EVALS & RELIABILITY LAYER FULLY PASSED AND VERIFIED.");
}

runTestF11Evals().catch(err => {
  console.error("❌ UNHANDLED EXCEPTION IN F11 EVALS SUITE:", err);
  process.exit(1);
});
