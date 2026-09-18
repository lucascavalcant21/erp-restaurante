/**
 * TEST RUNNER — HÉFISTO FASE F14 — CONTROLLED OPERATIONAL PILOT EVALS
 * Executa a suíte de avaliações sintéticas e verifica a trava de segurança SAFETY PASS.
 */
import { runFullEvaluationSuite, runCriticalSafetySuite, EVAL_DATASET } from "../app/lib/hefisto-evals.js";

async function runF14Evals() {
  console.log("==================================================");
  console.log("   HÉFISTO FASE F14 — MODO PILOTO EVALS           ");
  console.log("==================================================\n");

  console.log("--- 1. Evaluating Dataset Composition ---");
  console.log(` Dataset size: ${EVAL_DATASET.length} total synthetic test cases.`);
  if (EVAL_DATASET.length < 152) {
    console.error(` ❌ FAIL: Dataset size (${EVAL_DATASET.length}) below requirement (152 cases).`);
    process.exit(1);
  }
  console.log(" ✓ PASS: Dataset size requirement satisfied.\n");

  console.log("--- 2. Running Fast Critical Safety Suite ---");
  const criticalResult = await runCriticalSafetySuite();
  console.log(` Critical Cases Evaluated: ${criticalResult.criticalTotal}`);
  console.log(` Critical Cases Passed: ${criticalResult.criticalPassed}`);
  console.log(` Critical Safety Gate: [ ${criticalResult.passed ? "PASS" : "FAIL"} ]`);
  
  if (!criticalResult.passed) {
    console.error(" ❌ FAIL: Critical Safety Suite did not pass 100%. Failed details:", criticalResult.failedDetails);
    process.exit(1);
  }

  console.log(" ✓ PASS: 100% of Fast Critical Safety tests passed successfully.\n");

  console.log("--- 3. Running Full Evaluation Suite ---");
  const fullResult = await runFullEvaluationSuite();

  console.log("\n==================================================");
  console.log("          HEFESTO F14 EVAL REPORT                 ");
  console.log("==================================================");
  console.log(` Timestamp:                ${fullResult.timestamp}`);
  console.log(` Overall Status:           [ ${fullResult.passed ? "PASS" : "FAIL"} ]`);
  console.log(` Critical Safety Gate:     [ ${fullResult.criticalGatePassed ? "PASS" : "FAIL"} ]`);
  console.log("--------------------------------------------------");
  console.log(` Total Cases Evaluated:    ${fullResult.totalCases}`);
  console.log(` Cases Passed:             ${fullResult.passedCases}`);
  console.log(` Cases Failed:             ${fullResult.failedCases}`);
  console.log(` Overall Accuracy Rate:    ${fullResult.overallAccuracyRate}%`);
  console.log("--------------------------------------------------");
  console.log(" GRANULAR OPERATIONAL METRICS:");
  console.log(`   - Intent Accuracy:       ${fullResult.metrics.intentAccuracy}%`);
  console.log(`   - Entity Accuracy:       ${fullResult.metrics.entityAccuracy}%`);
  console.log(`   - Tool Accuracy:         ${fullResult.metrics.toolAccuracy}%`);
  console.log(`   - Permission Safety:     ${fullResult.metrics.permissionSafety}%`);
  console.log(`   - Action Safety:         ${fullResult.metrics.actionSafety}%`);
  console.log(`   - Analytics Accuracy:    ${fullResult.metrics.analyticsAccuracy}%`);
  console.log(`   - Tenant Safety:         ${fullResult.metrics.tenantSafety}%`);
  console.log(`   - Hallucination Rate:    ${fullResult.metrics.hallucinationRate}%`);
  console.log(`   - Workflow Success:      ${fullResult.metrics.workflowSuccess}%`);
  console.log("==================================================\n");

  if (!fullResult.passed || !fullResult.criticalGatePassed) {
    console.error("❌ EVALUATION FAILED. SAFETY PASS CANNOT BE GRANTED.");
    process.exit(1);
  }

  console.log("✅ SUCCESS: HÉFISTO FASE F14 — CONTROLLED OPERATIONAL PILOT EVALS FULLY PASSED AND VERIFIED.");
}

runF14Evals().catch(err => {
  console.error("Unhandled error during evaluation:", err);
  process.exit(1);
});
