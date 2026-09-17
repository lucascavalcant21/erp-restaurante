import { redactSensitiveData } from "./hefisto-policy.js";

/**
 * Buffer Circular de Auditoria em Memória (Sem migrations de banco de dados)
 * Capacidade: Últimos 1000 eventos de auditoria com rotação automática
 */
const AUDIT_BUFFER_MAX = 1000;
const auditEventsBuffer = [];

/**
 * Gerador de Correlation ID único para seguir a cadeia de solicitações:
 * Solicitação -> Intenção -> Risk Level -> Preview -> Aprovação -> Execução -> Resultado
 */
export function generateCorrelationId() {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).substring(2, 7);
  return `corr-${ts}-${rnd}`;
}

/**
 * Registra um evento oficial de auditoria no Audit Trail do Héfisto (AuditEvent Schema)
 */
export function logAuditEvent({
  correlationId = null,
  userId = "anonymous",
  userName = "Usuário",
  tenantId = "matriz",
  channel = "text", // 'text' | 'voice'
  textInput = "",
  intentId = null,
  actionId = null,
  riskLevel = "READ_ONLY", // 'READ_ONLY' | 'NAVIGATION' | 'LOW_RISK_ACTION' | 'SENSITIVE_ACTION' | 'HIGH_RISK_ACTION' | 'BLOCKED'
  entityIds = [],
  sanitizedParameters = {},
  permissionRequired = null,
  permissionResult = true,
  approvalRequired = false,
  approvalResult = "NOT_APPLICABLE", // 'PROPOSED' | 'APPROVED' | 'CANCELLED' | 'EXPIRED' | 'INVALIDATED' | 'NOT_APPLICABLE'
  executionStatus = "NOT_APPLICABLE", // 'NOT_APPLICABLE' | 'STARTED' | 'SUCCEEDED' | 'FAILED' | 'BLOCKED_SAFE_MODE' | 'BLOCKED_HIGH_RISK'
  executor = "HefistoAssistantEngine",
  errorCode = null,
  durationMs = 0
}) {
  const eventId = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const nowIso = new Date().toISOString();

  const auditEvent = {
    eventId,
    correlationId: correlationId || generateCorrelationId(),
    timestamp: nowIso,
    userId: String(userId || "anonymous"),
    userName: String(userName || "Usuário"),
    tenantId: String(tenantId || "matriz").trim(),
    channel: String(channel || "text").toLowerCase(),
    textInput: redactSensitiveData(String(textInput || "")),
    intentId,
    actionId,
    riskLevel,
    entityIds: Array.isArray(entityIds) ? entityIds : [],
    sanitizedParameters: redactSensitiveData(sanitizedParameters),
    permissionRequired,
    permissionResult: !!permissionResult,
    approvalRequired: !!approvalRequired,
    approvalResult,
    executionStatus,
    executor,
    errorCode,
    durationMs: Number(durationMs || 0)
  };

  // Mantém buffer circular dentro do limite máximo
  if (auditEventsBuffer.length >= AUDIT_BUFFER_MAX) {
    auditEventsBuffer.shift();
  }
  auditEventsBuffer.push(auditEvent);

  return auditEvent;
}

/**
 * Consulta e filtra eventos de auditoria para a tela de visualização administrativa
 */
export function queryAuditEvents({
  tenantId = "matriz",
  periodKey = "hoje", // 'hoje' | '7dias' | '30dias'
  userId = null,
  domain = null,
  riskLevel = null,
  executionStatus = null,
  limit = 100
} = {}) {
  const cleanTenant = String(tenantId || "matriz").trim();
  let events = auditEventsBuffer.filter(e => e.tenantId === cleanTenant);

  // Filtro de período
  const now = new Date();
  if (periodKey === "hoje") {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    events = events.filter(e => e.timestamp >= startOfDay);
  } else if (periodKey === "7dias") {
    const start7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    events = events.filter(e => e.timestamp >= start7Days);
  } else if (periodKey === "30dias") {
    const start30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    events = events.filter(e => e.timestamp >= start30Days);
  }

  if (userId) {
    events = events.filter(e => e.userId === String(userId));
  }

  if (riskLevel) {
    events = events.filter(e => e.riskLevel === riskLevel);
  }

  if (executionStatus) {
    events = events.filter(e => e.executionStatus === executionStatus);
  }

  // Ordena por mais recente primeiro
  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return events.slice(0, limit);
}

/**
 * Limpa o buffer de auditoria (útil para testes ou reset administrativo)
 */
export function clearAuditEvents() {
  auditEventsBuffer.length = 0;
}
