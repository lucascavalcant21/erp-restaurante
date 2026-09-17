import { ROUTINE_REGISTRY, executeRoutineIfMatched } from "./hefisto-routines.js";
import { getProactiveInsights } from "./hefisto-insights.js";
import { hasPermission } from "./permissions-catalog.mjs";
import { isKillSwitchActive, isSafeModeActive, evaluateActionPolicy } from "./hefisto-policy.js";
import { logAuditEvent as recordAuditLog } from "./hefisto-audit.js";

/**
 * Catálogo Inicial de Automações Programadas READ-ONLY (F9)
 */
export const AUTOMATION_CATALOG = [
  {
    id: "scheduled.openingBriefing",
    routineId: "restaurant.opening",
    name: "Briefing de Abertura Programado",
    description: "Prepara o briefing de abertura automaticamente antes do turno da manhã",
    defaultTime: "08:00",
    defaultDays: [1, 2, 3, 4, 5, 6, 7], // Seg-Dom
    requiredPermissions: ["cozinha.sector.view"],
    executionMode: "READ_ONLY_AUTOMATION"
  },
  {
    id: "scheduled.managementBriefing",
    routineId: "management.dailyBriefing",
    name: "Resumo Gerencial Diário",
    description: "Consolida os indicadores de operação, equipe e financeiro uma vez ao dia",
    defaultTime: "11:00",
    defaultDays: [2, 3, 4, 5, 6, 7], // Ter-Dom
    requiredPermissions: ["dashboard.overview.view"],
    executionMode: "READ_ONLY_AUTOMATION"
  },
  {
    id: "scheduled.closingBriefing",
    routineId: "restaurant.closing",
    name: "Check de Fechamento Programado",
    description: "Executa verificação READ-ONLY de pendências operacionais antes do encerramento",
    defaultTime: "23:30",
    defaultDays: [2, 3, 4, 5, 6], // Ter-Sáb
    requiredPermissions: ["cozinha.sector.view"],
    executionMode: "READ_ONLY_AUTOMATION"
  },
  {
    id: "scheduled.insightCheck",
    routineId: "f5_insight_check",
    name: "Verificação de Alertas Héfisto",
    description: "Verifica proativamente situações críticas de estoque e produções no meio do turno",
    defaultTime: "15:00",
    defaultDays: [1, 2, 3, 4, 5, 6, 7],
    requiredPermissions: [],
    executionMode: "READ_ONLY_AUTOMATION"
  }
];

// In-Memory Storage & Execution History Fallback para Multitenant
const tenantAutomationsStore = new Map();
const executionHistoryStore = new Set();
const historyLogsStore = [];

/**
 * Retorna o fuso horário configurado da empresa (Padrão: America/Sao_Paulo)
 */
export function getTenantTimezone(tenantId = "") {
  return "America/Sao_Paulo";
}

/**
 * Calcula a próxima execução considerando fuso horário e dias selecionados
 */
export function computeNextExecution(scheduleTime = "08:00", scheduleDays = [1, 2, 3, 4, 5, 6, 7], timezone = "America/Sao_Paulo", fromDate = new Date()) {
  const [hours, minutes] = scheduleTime.split(":").map(Number);
  const target = new Date(fromDate);
  target.setHours(hours, minutes, 0, 0);

  if (target <= fromDate) {
    target.setDate(target.getDate() + 1);
  }

  // Ajusta para o próximo dia válido na lista de dias
  let count = 0;
  while (count < 7) {
    const dayOfWeek = target.getDay() === 0 ? 7 : target.getDay(); // 1=Seg, 7=Dom
    if (scheduleDays.includes(dayOfWeek)) {
      break;
    }
    target.setDate(target.getDate() + 1);
    count++;
  }

  return target.toISOString();
}

/**
 * Retorna as automações configuradas para uma determinada empresa (tenant)
 */
export function getAutomationsForTenant(tenantId = "unidade-padrao", ownerSession = null) {
  if (!tenantAutomationsStore.has(tenantId)) {
    const defaultList = AUTOMATION_CATALOG.map(item => ({
      id: item.id,
      routineId: item.routineId,
      name: item.name,
      description: item.description,
      enabled: true,
      triggerType: "SCHEDULED",
      scheduleTime: item.defaultTime,
      scheduleDays: item.defaultDays,
      timezone: getTenantTimezone(tenantId),
      requiredPermissions: item.requiredPermissions,
      executionMode: item.executionMode,
      ownerId: ownerSession?.id || "admin-system",
      ownerEmail: ownerSession?.email || "admin@restaurante.com",
      lastExecutedAt: null,
      nextExecutionAt: computeNextExecution(item.defaultTime, item.defaultDays, getTenantTimezone(tenantId)),
      status: "SCHEDULED"
    }));
    tenantAutomationsStore.set(tenantId, defaultList);
  }
  return tenantAutomationsStore.get(tenantId);
}

/**
 * Atualiza e salva a configuração de uma automação
 */
export function updateAutomation(tenantId, automationId, updates = {}, ownerSession = null) {
  const automations = getAutomationsForTenant(tenantId, ownerSession);
  const idx = automations.findIndex(a => a.id === automationId);
  if (idx === -1) return null;

  const current = automations[idx];
  const updated = {
    ...current,
    ...updates,
    timezone: getTenantTimezone(tenantId),
    nextExecutionAt: computeNextExecution(
      updates.scheduleTime || current.scheduleTime,
      updates.scheduleDays || current.scheduleDays,
      getTenantTimezone(tenantId)
    ),
    updatedAt: new Date().toISOString()
  };

  automations[idx] = updated;
  tenantAutomationsStore.set(tenantId, automations);
  return updated;
}

/**
 * Retorna o histórico recente de execuções de automações
 */
export function getAutomationHistory(tenantId = "unidade-padrao", limit = 20) {
  return historyLogsStore
    .filter(h => h.tenantId === tenantId)
    .slice(-limit)
    .reverse();
}

/**
 * Disparador e Executor de Automações Programadas (F9)
 */
export async function triggerScheduledAutomations({
  tenantId = "unidade-padrao",
  ownerSession = null,
  forceOccurrenceKey = null,
  now = new Date()
}) {
  const automations = getAutomationsForTenant(tenantId, ownerSession);
  const results = [];
  const dateStr = now.toISOString().slice(0, 10);

  const sessionToUse = ownerSession || {
    id: "owner-automation",
    nome: "Sistema Héfisto",
    papel: "admin",
    permissions: "*"
  };

  for (const auto of automations) {
    if (!auto.enabled) continue;

    // Chave de Idempotência Obrigatória F9
    const deduplicationKey = forceOccurrenceKey || `${auto.id}:${tenantId}:${dateStr}:${auto.scheduleTime}`;

    // 1. Verificação de Idempotência: Se já rodou nesta ocorrência, SKIP
    if (executionHistoryStore.has(deduplicationKey)) {
      results.push({
        automationId: auto.id,
        name: auto.name,
        status: "SKIPPED",
        reason: "Ocorrência agendada já executada anteriormente (Idempotência confirmada).",
        deduplicationKey
      });
      continue;
    }

    // 2. Modelo de Owner e Verificação de Permissão Revogada / Usuário Inativo (Fail-Closed)
    if (sessionToUse.status === "inativo" || sessionToUse.disabled) {
      auto.enabled = false;
      auto.pausedReason = "Owner desativado. Automação pausada por segurança.";
      results.push({
        automationId: auto.id,
        name: auto.name,
        status: "FAILED",
        reason: "Owner desativado. Automação pausada por segurança.",
        deduplicationKey
      });
      continue;
    }

    if (auto.requiredPermissions && auto.requiredPermissions.length > 0) {
      const temPermissaoOwner = auto.requiredPermissions.every(perm =>
        sessionToUse.papel === "admin" || hasPermission(sessionToUse, perm)
      );

      if (!temPermissaoOwner) {
        auto.enabled = false;
        auto.pausedReason = "Permissão do owner revogada. Automação pausada por segurança.";

        recordAuditLog({
          correlationId: `auto-${Date.now()}`,
          userId: sessionToUse.id,
          userName: sessionToUse.nome,
          tenantId,
          channel: "automation",
          textInput: `[AUTOMAÇÃO PROGRAMADA] ${auto.name}`,
          intentId: auto.routineId,
          riskLevel: "READ_ONLY",
          permissionRequired: auto.requiredPermissions[0],
          permissionResult: false,
          executionStatus: "BLOCKED_HIGH_RISK",
          executor: "SchedulerEngine:F9"
        });

        results.push({
          automationId: auto.id,
          name: auto.name,
          status: "CANCELLED",
          reason: "Permissão do owner revogada. Automação pausada com segurança (Fail-closed).",
          deduplicationKey
        });
        continue;
      }
    }

    // 3. Validação pelo Policy Engine F6 (Kill Switch)
    if (isKillSwitchActive(tenantId)) {
      results.push({
        automationId: auto.id,
        name: auto.name,
        status: "CANCELLED",
        reason: "Bloqueado pelo Kill Switch (F6 Governança)",
        deduplicationKey
      });
      continue;
    }

    // 4. Execução da Rotina READ-ONLY (Sem Mutações)
    const startTime = Date.now();
    let outcome = null;
    let status = "SUCCEEDED";

    try {
      if (auto.routineId === "f5_insight_check") {
        outcome = await getProactiveInsights({ session: sessionToUse, unitId: tenantId });
      } else {
        const routineObj = ROUTINE_REGISTRY.find(r => r.id === auto.routineId);
        if (routineObj) {
          outcome = await executeRoutineIfMatched({
            text: routineObj.keywords[0],
            session: sessionToUse,
            unitId: tenantId
          });
        }
      }

      if (outcome && outcome.partialFailures && outcome.partialFailures.length > 0) {
        status = "PARTIAL";
      }
    } catch (err) {
      status = "FAILED";
      outcome = { success: false, error: err.message };
    }

    const durationMs = Date.now() - startTime;

    // Registra chave de idempotência para evitar duplicidade
    executionHistoryStore.add(deduplicationKey);

    // Atualiza metadados da automação
    auto.lastExecutedAt = now.toISOString();
    auto.nextExecutionAt = computeNextExecution(auto.scheduleTime, auto.scheduleDays, auto.timezone, now);

    // Registra auditoria oficial F6
    recordAuditLog({
      correlationId: `auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: sessionToUse.id,
      userName: sessionToUse.nome,
      tenantId,
      channel: "automation",
      textInput: `[AUTOMAÇÃO PROGRAMADA] ${auto.name}`,
      intentId: auto.routineId,
      riskLevel: "READ_ONLY",
      permissionRequired: auto.requiredPermissions[0] || null,
      permissionResult: true,
      approvalRequired: false,
      approvalResult: "NOT_APPLICABLE",
      executionStatus: status === "FAILED" ? "FAILED" : "SUCCEEDED",
      executor: "SchedulerEngine:F9",
      durationMs
    });

    const historyRecord = {
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      automationId: auto.id,
      name: auto.name,
      tenantId,
      deduplicationKey,
      status,
      durationMs,
      summaryText: outcome?.spokenSummary || outcome?.title || "Execução programada concluída",
      executedAt: now.toISOString()
    };

    historyLogsStore.push(historyRecord);

    results.push({
      automationId: auto.id,
      name: auto.name,
      status,
      durationMs,
      deduplicationKey,
      resultText: outcome?.responseText || outcome?.summary || "Concluído"
    });
  }

  return results;
}
