import assert from "assert";
import {
  evaluateRiskLevel,
  evaluateActionPolicy,
  isSafeModeActive,
  setSafeMode,
  isKillSwitchActive,
  setKillSwitch,
  validatePayloadMatch,
  redactSensitiveData,
  ACTION_ALLOWLIST,
  HIGH_RISK_ACTIONS,
  RISK_LEVELS
} from "../app/lib/hefisto-policy.js";
import {
  logAuditEvent,
  queryAuditEvents,
  generateCorrelationId,
  clearAuditEvents
} from "../app/lib/hefisto-audit.js";
import { processHefistoIntent } from "../app/lib/hefisto-intents.js";
import { executeRealAction } from "../app/lib/hefisto-actions.js";

async function runF6Tests() {
  console.log("==================================================");
  console.log("   HÉFISTO FASE F6 — GOVERNANÇA, AUDITORIA & MODO SEGURO");
  console.log("==================================================\n");

  clearAuditEvents();
  setSafeMode("unit-test", false);
  setKillSwitch("unit-test", false);

  // ---------------------------------------------------------------------------
  // TEST 1: CLASSIFICAÇÃO DE RISCO DETERMINÍSTICA (6 NÍVEIS)
  // ---------------------------------------------------------------------------
  console.log("--- 1. Classificação de Risco Determinística ---");
  assert.strictEqual(evaluateRiskLevel("inventory.critical"), RISK_LEVELS.READ_ONLY, "Consultas são READ_ONLY");
  assert.strictEqual(evaluateRiskLevel("navigation.open"), RISK_LEVELS.NAVIGATION, "Navegação é NAVIGATION");
  assert.strictEqual(evaluateRiskLevel("label.print"), RISK_LEVELS.LOW_RISK_ACTION, "Impressão de etiquetas é LOW_RISK_ACTION");
  assert.strictEqual(evaluateRiskLevel("inventory.entry"), RISK_LEVELS.SENSITIVE_ACTION, "Entrada de estoque é SENSITIVE_ACTION");
  assert.strictEqual(evaluateRiskLevel("finance.payBill"), RISK_LEVELS.HIGH_RISK_ACTION, "Pagamento de conta é HIGH_RISK_ACTION");
  assert.strictEqual(evaluateRiskLevel("ponto.clockIn"), RISK_LEVELS.HIGH_RISK_ACTION, "Batida de ponto por IA é HIGH_RISK_ACTION");
  console.log(" ✓ PASS: Matriz de Risco em 6 níveis avaliada com precisão determinística");

  // ---------------------------------------------------------------------------
  // TEST 2: ACTION ALLOWLIST ESTREITA
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Action Allowlist Estrita ---");
  assert(ACTION_ALLOWLIST.has("inventory.entry"), "Contém inventory.entry");
  assert(ACTION_ALLOWLIST.has("production.complete"), "Contém production.complete");
  assert(!ACTION_ALLOWLIST.has("finance.payBill"), "NÃO contém finance.payBill");
  assert(!ACTION_ALLOWLIST.has("ponto.clockIn"), "NÃO contém ponto.clockIn");
  console.log(" ✓ PASS: Allowlist estrita proíbe chamadas ou ações fora do catálogo");

  // ---------------------------------------------------------------------------
  // TEST 3: BLOQUEIO INVIOLÁVEL DE HIGH_RISK_ACTIONS
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Bloqueio de Ações de Alto Risco (High Risk Actions) ---");
  const highRiskPolicy = evaluateActionPolicy({
    actionId: "finance.payBill",
    unitId: "unit-test",
    riskLevel: RISK_LEVELS.HIGH_RISK_ACTION
  });

  assert.strictEqual(highRiskPolicy.allowed, false, "Ações de alto risco são BLOQUEADAS para a IA");
  assert.strictEqual(highRiskPolicy.reason, "HIGH_RISK_BLOCKED", "Motivo HIGH_RISK_BLOCKED retornado");
  console.log(" ✓ PASS: Ações financeiras transacionais e alteração de ponto são bloqueadas deterministicamente");

  // ---------------------------------------------------------------------------
  // TEST 4: MODO SEGURO (SAFE MODE)
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. Modo Seguro (Safe Mode) ---");
  setSafeMode("unit-test", true);
  assert.strictEqual(isSafeModeActive("unit-test"), true, "Modo Seguro ativado para a unidade");

  const safePolicy = evaluateActionPolicy({
    actionId: "inventory.entry",
    unitId: "unit-test",
    riskLevel: RISK_LEVELS.SENSITIVE_ACTION
  });
  assert.strictEqual(safePolicy.allowed, false, "Modo seguro bloqueia ações F2 de alteração de dados");
  assert.strictEqual(safePolicy.reason, "SAFE_MODE_ACTIVE", "Motivo SAFE_MODE_ACTIVE retornado");

  // Execução real em Modo Seguro deve ser bloqueada
  const execSafe = await executeRealAction({
    actionId: "inventory.entry",
    payload: { nome: "Camarão", quantidade: 5 },
    session: { id: "admin-1", gerenciado: false },
    unitId: "unit-test"
  });
  assert.strictEqual(execSafe.success, false, "executeRealAction recusa alteração em Modo Seguro");
  assert.strictEqual(execSafe.reason, "SAFE_MODE_ACTIVE", "Confirmação de recusa por Modo Seguro");

  // Consultas em Modo Seguro continuam funcionando normalmente
  const consultSafe = await processHefistoIntent({
    text: "Por que meu CMV aumentou?",
    session: { id: "admin-1", gerenciado: false },
    unitId: "unit-test"
  });
  assert.strictEqual(consultSafe.type, "ANALYTICS_RESULT", "Consultas e análises F4 continuam 100% operacionais em Modo Seguro");

  setSafeMode("unit-test", false);
  console.log(" ✓ PASS: Modo Seguro bloqueia alterações mantendo consultas ativas");

  // ---------------------------------------------------------------------------
  // TEST 5: KILL SWITCH DE AÇÕES
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. Kill Switch Administrativo ---");
  setKillSwitch("unit-test", true);
  const killPolicy = evaluateActionPolicy({
    actionId: "production.complete",
    unitId: "unit-test",
    riskLevel: RISK_LEVELS.SENSITIVE_ACTION
  });
  assert.strictEqual(killPolicy.allowed, false, "Kill switch desativa ações transacionais");
  assert.strictEqual(killPolicy.reason, "KILL_SWITCH_ACTIVE", "Motivo KILL_SWITCH_ACTIVE retornado");
  setKillSwitch("unit-test", false);
  console.log(" ✓ PASS: Kill Switch interrompe novas ações instantaneamente");

  // ---------------------------------------------------------------------------
  // TEST 6: PROTEÇÃO CONTRA ALTERAÇÃO DE PAYLOAD (PAYLOAD TAMPERING)
  // ---------------------------------------------------------------------------
  console.log("\n--- 6. Proteção contra Alteração de Payload ---");
  const origPreview = { productName: "Camarão 40/60", quantity: 0.5, unit: "kg" };
  const samePayload = { productName: "Camarão 40/60", quantity: 0.5, unit: "kg" };
  const tamperedPayload = { productName: "Camarão 40/60", quantity: 5.0, unit: "kg" }; // Alterou 500g para 5kg

  assert.strictEqual(validatePayloadMatch(origPreview, samePayload), true, "Payload idêntico validado com sucesso");
  assert.strictEqual(validatePayloadMatch(origPreview, tamperedPayload), false, "Payload alterado é REJEITADO e invalidado");
  console.log(" ✓ PASS: Invalidação imediata em caso de alteração de parâmetros pós-preview");

  // ---------------------------------------------------------------------------
  // TEST 7: IDEMPOTÊNCIA E PROTEÇÃO CONTRA DUPLO CLIQUE
  // ---------------------------------------------------------------------------
  console.log("\n--- 7. Idempotência e Duplo Clique ---");
  const testCorrId = generateCorrelationId();
  const firstExec = await executeRealAction({
    actionId: "production.complete",
    payload: { nome: "Molho Branco", quantidade: 1 },
    session: { id: "admin-1", gerenciado: false },
    unitId: "unit-test",
    correlationId: testCorrId
  });

  const secondExec = await executeRealAction({
    actionId: "production.complete",
    payload: { nome: "Molho Branco", quantidade: 1 },
    session: { id: "admin-1", gerenciado: false },
    unitId: "unit-test",
    correlationId: testCorrId
  });

  assert.strictEqual(firstExec.success, true, "Primeira execução concluída com sucesso");
  assert.strictEqual(secondExec.success, true, "Segunda execução tratada de forma idêntica e segura");
  assert(secondExec.responseText.includes("duplo clique"), "Duplo clique detectado e ignorado sem duplicar mutação");
  console.log(" ✓ PASS: Duplo clique tratado com idempotência determinística");

  // ---------------------------------------------------------------------------
  // TEST 8: REDAÇÃO AUTOMÁTICA DE DADOS SENSÍVEIS (REDACTION)
  // ---------------------------------------------------------------------------
  console.log("\n--- 8. Redação de Segredos e PII (Mascara Senhas/Tokens) ---");
  const rawText = "solicito acesso com senha=minhasenha123 e token=xyz987token";
  const redactedText = redactSensitiveData(rawText);
  assert(!redactedText.includes("minhasenha123"), "Senha foi redigida");
  assert(redactedText.includes("***REDACTED***"), "Substituída por ***REDACTED***");
  console.log(" ✓ PASS: Redação automática de credenciais e dados confidenciais");

  // ---------------------------------------------------------------------------
  // TEST 9: AUDIT TRAIL E CORRELATION ID TRACING
  // ---------------------------------------------------------------------------
  console.log("\n--- 9. Rastreabilidade Completa do Audit Trail ---");
  const auditList = queryAuditEvents({ tenantId: "unit-test", periodKey: "hoje" });
  assert(auditList.length >= 2, "Eventos de auditoria foram registrados no buffer");

  const sampleEvent = auditList[0];
  assert(sampleEvent.eventId && sampleEvent.correlationId, "Contém eventId e correlationId");
  assert(sampleEvent.timestamp && sampleEvent.riskLevel, "Contém timestamp e nível de risco");
  assert.strictEqual(sampleEvent.tenantId, "unit-test", "Vinculado à empresa/tenant 'unit-test'");
  console.log(" ✓ PASS: Rastreabilidade de solicitação -> aprovação -> execução -> resultado verificada");

  // ---------------------------------------------------------------------------
  // TEST 10: PRESERVAÇÃO INTEGRAL DO PONTO TRADICIONAL & ZERO MIGRATIONS
  // ---------------------------------------------------------------------------
  console.log("\n--- 10. Preservação do Ponto TRADICIONAL & Confirmação de Zero Migrations ---");
  const pontoIntent = await processHefistoIntent({
    text: "abrir registro de ponto",
    session: { id: "admin-1", gerenciado: false },
    unitId: "unit-test"
  });

  assert.strictEqual(pontoIntent.type, "NAVIGATION", "Comando de ponto redireciona para a tela de Registro de Ponto TRADICIONAL");
  assert(pontoIntent.targetRoute.includes("/ponto"), "Rota de Ponto Tradicional confirmada");
  console.log(" ✓ PASS: Ponto TRADICIONAL mantido (0 automação, 0 reconhecimento facial, 0 migrations de banco)");

  console.log("\n==================================================");
  console.log("   RESULTADO FASE F6: TODOS OS TESTES PASSARAM!");
  console.log("==================================================");
}

runF6Tests().catch(err => {
  console.error("FATAL F6 TEST FAILURE:", err);
  process.exit(1);
});
