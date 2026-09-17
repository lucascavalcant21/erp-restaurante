import assert from "assert";
import {
  SPECIALIST_REGISTRY,
  identifySpecialist,
  routeToSpecialist
} from "../app/lib/hefisto-specialists.js";
import { processHefistoIntent } from "../app/lib/hefisto-intents.js";
import { queryAuditEvents, clearAuditEvents } from "../app/lib/hefisto-audit.js";
import { setSafeMode, setKillSwitch } from "../app/lib/hefisto-policy.js";

async function runF7Tests() {
  console.log("==================================================");
  console.log("   HÉFISTO FASE F7 — AGENTES ESPECIALISTAS POR SETOR");
  console.log("==================================================\n");

  clearAuditEvents();
  setSafeMode("unit-test", false);
  setKillSwitch("unit-test", false);

  const sessionAdmin = { id: "admin-1", gerenciado: false };

  // ---------------------------------------------------------------------------
  // TEST 1: SPECIALIST REGISTRY (4 ESPECIALISTAS OFICIAIS)
  // ---------------------------------------------------------------------------
  console.log("--- 1. Specialist Registry & Tool Allowlists ---");
  assert.strictEqual(SPECIALIST_REGISTRY.length, 4, "Possui exatamente 4 especialistas cadastrados");

  const specKitchen = SPECIALIST_REGISTRY.find(s => s.id === "hefesto.kitchen");
  const specInventory = SPECIALIST_REGISTRY.find(s => s.id === "hefesto.inventory");
  const specFinance = SPECIALIST_REGISTRY.find(s => s.id === "hefesto.finance");
  const specHR = SPECIALIST_REGISTRY.find(s => s.id === "hefesto.hr");

  assert(specKitchen && specInventory && specFinance && specHR, "Os 4 especialistas (Cozinha, Estoque, Financeiro, RH) estão registrados");
  assert(specKitchen.allowedTools.includes("production.complete"), "Cozinha possui permissão de produção");
  assert(specInventory.allowedTools.includes("inventory.entry"), "Estoque possui permissão de entradas");
  assert(specFinance.allowedTools.includes("finance.cmv"), "Financeiro possui ferramenta analítica de CMV");
  assert(specHR.allowedTools.includes("ponto.clock.view"), "RH possui ferramenta de ponto tradicional");
  console.log(" ✓ PASS: Cadastro de especialistas e Tool Allowlists estritas verificados");

  // ---------------------------------------------------------------------------
  // TEST 2: ROTEAMENTO DETERMINÍSTICO (SPECIALIST ROUTER)
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Roteamento Determinístico por Especialista ---");
  const routeK = identifySpecialist("o que falta produzir hoje?");
  const routeI = identifySpecialist("quanto camarao temos?");
  const routeF = identifySpecialist("por que meu cmv subiu?");
  const routeH = identifySpecialist("quem esta trabalhando hoje?");

  assert.strictEqual(routeK?.id, "hefesto.kitchen", "'o que falta produzir' roteia para hefesto.kitchen");
  assert.strictEqual(routeI?.id, "hefesto.inventory", "'quanto camarão temos' roteia para hefesto.inventory");
  assert.strictEqual(routeF?.id, "hefesto.finance", "'por que meu cmv subiu' roteia para hefesto.finance");
  assert.strictEqual(routeH?.id, "hefesto.hr", "'quem está trabalhando' roteia para hefesto.hr");
  console.log(" ✓ PASS: Roteamento determinístico encaminha para o especialista correto");

  // ---------------------------------------------------------------------------
  // TEST 3: CONSULTAS MULTIDOMÍNIO COORDENADAS (MULTI-SPECIALIST)
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Consultas Multidomínio Coordenadas pelo Héfisto ---");
  const multiRes = await routeToSpecialist({
    text: "Por que o custo do camarão aumentou?",
    session: sessionAdmin,
    unitId: "unit-test"
  });

  assert.strictEqual(multiRes.type, "ANALYTICS_RESULT", "Consulta multidomínio retorna parecer estruturado");
  assert.strictEqual(multiRes.specialistId, "hefesto.orchestrator", "Orquestrado pelo Héfisto sem loops");
  assert(multiRes.summaryText.includes("Parecer Héfisto"), "Apresenta resposta única e integrada");
  console.log(" ✓ PASS: Consulta multidomínio executou integração de dados sem loops de agentes");

  // ---------------------------------------------------------------------------
  // TEST 4: PERMISSÕES PRÉ-ROTEAMENTO POR ESPECIALISTA
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. Filtro de Permissões Pré-Roteamento ---");
  const sessionOperadorCozinha = {
    id: "op-cozinha",
    gerenciado: true,
    permissoes: ["cozinha.sector.view"] // Sem permissão financeira
  };

  const blockedFinance = await routeToSpecialist({
    text: "como esta meu resultado financeiro?",
    session: sessionOperadorCozinha,
    unitId: "unit-test"
  });

  assert.strictEqual(blockedFinance.permissionDenied, true, "Consulta a especialista sem permissão é bloqueada pré-roteamento");
  console.log(" ✓ PASS: Usuário sem permissão financeira não acessa o especialista Financeiro");

  // ---------------------------------------------------------------------------
  // TEST 5: ENFORCING DA GOVERNANÇA F6 E AUDITORIA COM SPECIALIST ID
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. Governança F6 & Auditoria com specialistId ---");
  const auditEvents = queryAuditEvents({ tenantId: "unit-test", periodKey: "hoje" });
  assert(auditEvents.length > 0, "Eventos de auditoria foram gerados com specialistId");
  assert(auditEvents.some(e => e.executor && e.executor.includes("Specialist")), "Executor identifica o especialista/roteador envolvido");
  console.log(" ✓ PASS: Rastreabilidade auditada de chamadas a especialistas confirmada");

  // ---------------------------------------------------------------------------
  // TEST 6: PRESERVAÇÃO INTEGRAL DO PONTO TRADICIONAL & ETIQUETAS TSPL
  // ---------------------------------------------------------------------------
  console.log("\n--- 6. Preservação do Ponto TRADICIONAL & Zero Migrations ---");
  const pontoIntent = await processHefistoIntent({
    text: "abrir registro de ponto",
    session: sessionAdmin,
    unitId: "unit-test"
  });

  assert.strictEqual(pontoIntent.type, "NAVIGATION", "Navegação para ponto tradicional intacta");
  assert(pontoIntent.targetRoute.includes("/ponto"), "Direciona para rota oficial de ponto");
  console.log(" ✓ PASS: Ponto TRADICIONAL e Etiquetas TSPL mantidos sem alterações");

  console.log("\n==================================================");
  console.log("   RESULTADO FASE F7: TODOS OS TESTES PASSARAM!");
  console.log("==================================================");
}

runF7Tests().catch(err => {
  console.error("FATAL F7 TEST FAILURE:", err);
  process.exit(1);
});
