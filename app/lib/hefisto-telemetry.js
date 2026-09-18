import { redactSensitiveData } from "./hefisto-policy.js";
import { generateCorrelationId } from "./hefisto-audit.js";

/**
 * HÉFISTO FASE F13 — OBSERVABILIDADE, SAÚDE E MONITORAMENTO
 * Buffer circular de telemetria e métricas em memória (Sem migrations de banco de dados)
 */
const TELEMETRY_BUFFER_MAX = 2000;
const INCIDENTS_BUFFER_MAX = 500;
const FEEDBACK_BUFFER_MAX = 500;

const telemetryBuffer = [];
const incidentsBuffer = [];
const feedbackBuffer = [];

/**
 * Taxonomia Central de Eventos da Observabilidade do Héfisto
 */
export const EVENT_TAXONOMY = {
  REQUEST_STARTED: "hefesto.request.started",
  REQUEST_COMPLETED: "hefesto.request.completed",
  REQUEST_FAILED: "hefesto.request.failed",
  INTENT_RESOLVED: "hefesto.intent.resolved",
  INTENT_AMBIGUOUS: "hefesto.intent.ambiguous",
  SPECIALIST_ROUTED: "hefesto.specialist.routed",
  TOOL_STARTED: "hefesto.tool.started",
  TOOL_COMPLETED: "hefesto.tool.completed",
  TOOL_FAILED: "hefesto.tool.failed",
  ACTION_PREVIEWED: "hefesto.action.previewed",
  ACTION_CONFIRMED: "hefesto.action.confirmed",
  ACTION_CANCELLED: "hefesto.action.cancelled",
  ACTION_FAILED: "hefesto.action.failed",
  WORKFLOW_STARTED: "hefesto.workflow.started",
  WORKFLOW_COMPLETED: "hefesto.workflow.completed",
  AUTOMATION_COMPLETED: "hefesto.automation.completed",
  APPROVAL_REQUESTED: "hefesto.approval.requested",
  APPROVAL_REJECTED: "hefesto.approval.rejected",
  CONTEXT_RESOLVED: "hefesto.context.resolved",
  CONTEXT_FAILED: "hefesto.context.failed"
};

/**
 * Classificação de Erros Padrão
 */
export const ERROR_CLASSES = {
  PERMISSION_DENIED: "PERMISSION_DENIED",
  AMBIGUOUS_INPUT: "AMBIGUOUS_INPUT",
  ENTITY_NOT_FOUND: "ENTITY_NOT_FOUND",
  TOOL_TIMEOUT: "TOOL_TIMEOUT",
  TOOL_ERROR: "TOOL_ERROR",
  MODEL_ERROR: "MODEL_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  POLICY_BLOCKED: "POLICY_BLOCKED",
  SAFE_MODE_BLOCKED: "SAFE_MODE_BLOCKED",
  USER_CANCELLED: "USER_CANCELLED"
};

/**
 * Registra um evento de telemetria no buffer com sanitização determinística F6
 */
export function recordTelemetryEvent({
  correlationId = null,
  eventType = EVENT_TAXONOMY.REQUEST_STARTED,
  tenantId = "matriz",
  userRole = "OPERATOR",
  userId = "anonymous",
  channel = "text", // 'text' | 'voice' | 'contextual' | 'automation'
  route = "/",
  domain = "GENERAL",
  intent = null,
  specialistId = null,
  toolName = null,
  status = "SUCCESS", // 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'CANCELLED' | 'AMBIGUOUS'
  errorCode = null,
  durationMs = 0,
  metadata = {},
  contextType = null
}) {
  const eventId = `tel-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const timestamp = new Date().toISOString();

  // Exclusão estrita de Chain-of-Thought / scratchpad
  const sanitizedMetadata = redactSensitiveData({ ...metadata });
  delete sanitizedMetadata.chainOfThought;
  delete sanitizedMetadata.reasoning;
  delete sanitizedMetadata.scratchpad;
  delete sanitizedMetadata.promptRaw;

  const event = {
    eventId,
    correlationId: correlationId || generateCorrelationId(),
    timestamp,
    eventType,
    tenantId: String(tenantId || "matriz").trim(),
    userRole: String(userRole || "OPERATOR"),
    userId: String(userId || "anonymous"),
    channel: String(channel || "text").toLowerCase(),
    route: String(route || "/"),
    domain: String(domain || "GENERAL").toUpperCase(),
    intent,
    specialistId,
    toolName,
    status,
    errorCode,
    durationMs: Number(durationMs || 0),
    metadata: sanitizedMetadata,
    contextType
  };

  // Mantém buffer circular dentro do limite máximo
  if (telemetryBuffer.length >= TELEMETRY_BUFFER_MAX) {
    telemetryBuffer.shift();
  }
  telemetryBuffer.push(event);

  // Verificação determinística de incidentes de segurança
  detectIncidents(event);

  return event;
}

/**
 * Monitor Determinístico de Incidentes Críticos (Tenant Leaks, Action Sequence Violations, Point Violations)
 */
function detectIncidents(event) {
  // 1. Verificação de Tenant Leak
  if (event.metadata?.targetTenantId && event.metadata.targetTenantId !== event.tenantId) {
    recordIncident({
      severity: "CRITICAL",
      type: "TENANT_LEAK_DETECTED",
      title: "Possível Vazamento de Tenant Detectado",
      description: `Tentativa de acesso da empresa ${event.tenantId} aos recursos da empresa ${event.metadata.targetTenantId}.`,
      correlationId: event.correlationId,
      tenantId: event.tenantId
    });
  }

  // 2. Verificação de Sequência de Ação Sensível (Execução sem Preview/Confirmação Prévia)
  if (event.eventType === EVENT_TAXONOMY.ACTION_CONFIRMED || event.eventType === EVENT_TAXONOMY.TOOL_COMPLETED) {
    if (event.metadata?.isMutation) {
      const priorEvents = telemetryBuffer.filter(e => e.correlationId === event.correlationId);
      const hasPreview = priorEvents.some(e => e.eventType === EVENT_TAXONOMY.ACTION_PREVIEWED);
      if (!hasPreview) {
        recordIncident({
          severity: "CRITICAL",
          type: "ACTION_SEQUENCE_VIOLATION",
          title: "Violação de Sequência de Ação Mutation",
          description: `Ação transacional executada sem a exibição do preview obrigatório para confirmação.`,
          correlationId: event.correlationId,
          tenantId: event.tenantId
        });
      }
    }
  }

  // 3. Verificação de Ponto Tradicional (Proibição Total de Facial / Câmera / Auto Clock-in)
  const normIntent = String(event.intent || "").toLowerCase();
  const normTool = String(event.toolName || "").toLowerCase();
  if (
    normIntent.includes("facial") || normIntent.includes("camera") || normIntent.includes("autoclockin") ||
    normTool.includes("facial") || normTool.includes("camera") || normTool.includes("auto_clock")
  ) {
    recordIncident({
      severity: "CRITICAL",
      type: "POINT_SAFETY_VIOLATION",
      title: "Violação da Regra do Ponto Tradicional",
      description: "Tentativa de acionamento de reconhecimento facial ou batida automática via IA bloqueada.",
      correlationId: event.correlationId,
      tenantId: event.tenantId
    });
  }
}

/**
 * Registra um incidente no buffer de incidentes
 */
export function recordIncident({
  severity = "WARNING", // 'INFO' | 'WARNING' | 'CRITICAL'
  type = "SYSTEM_HEALTH",
  title = "Incidente de Sistema",
  description = "",
  correlationId = null,
  tenantId = "matriz"
}) {
  const incident = {
    incidentId: `inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    severity,
    type,
    title,
    description,
    correlationId,
    tenantId: String(tenantId || "matriz").trim()
  };

  if (incidentsBuffer.length >= INCIDENTS_BUFFER_MAX) {
    incidentsBuffer.shift();
  }
  incidentsBuffer.push(incident);

  return incident;
}

/**
 * Reconstrói o Trace completo de execução para um Correlation ID específico
 */
export function getTraceByCorrelationId(correlationId) {
  if (!correlationId) return null;
  const events = telemetryBuffer
    .filter(e => e.correlationId === correlationId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (events.length === 0) return null;

  const totalDurationMs = events.reduce((sum, e) => sum + e.durationMs, 0);
  const firstEvent = events[0];
  const lastEvent = events[events.length - 1];

  const steps = events.map(e => ({
    eventId: e.eventId,
    eventType: e.eventType,
    timestamp: e.timestamp,
    specialistId: e.specialistId,
    toolName: e.toolName,
    status: e.status,
    errorCode: e.errorCode,
    durationMs: e.durationMs,
    domain: e.domain
  }));

  return {
    correlationId,
    tenantId: firstEvent.tenantId,
    userRole: firstEvent.userRole,
    channel: firstEvent.channel,
    route: firstEvent.route,
    domain: firstEvent.domain,
    startTime: firstEvent.timestamp,
    endTime: lastEvent.timestamp,
    totalDurationMs,
    status: lastEvent.status,
    stepsCount: steps.length,
    steps
  };
}

/**
 * Calcula Métricas Agregadas de Saúde e Telemetria para o Dashboard Gerencial F13
 */
export function getTelemetryMetrics({ tenantId = "matriz", periodKey = "hoje" } = {}) {
  const cleanTenant = String(tenantId || "matriz").trim();
  let events = telemetryBuffer.filter(e => e.tenantId === cleanTenant);

  // Filtro de período
  const now = new Date();
  if (periodKey === "hoje") {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    events = events.filter(e => e.timestamp >= startOfDay);
  } else if (periodKey === "7dias") {
    const start7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    events = events.filter(e => e.timestamp >= start7);
  } else if (periodKey === "30dias") {
    const start30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    events = events.filter(e => e.timestamp >= start30);
  }

  const totalRequests = events.filter(e => e.eventType === EVENT_TAXONOMY.REQUEST_STARTED).length;

  if (totalRequests === 0 && events.length === 0) {
    return {
      hasSufficientData: false,
      totalRequests: 0,
      successRate: 100,
      securityBlockedCount: 0,
      technicalFailuresCount: 0,
      p95LatencyMs: 0,
      areas: [],
      topErrors: [],
      incidents: []
    };
  }

  const completedRequests = events.filter(e => e.eventType === EVENT_TAXONOMY.REQUEST_COMPLETED);
  const failedRequests = events.filter(e => e.eventType === EVENT_TAXONOMY.REQUEST_FAILED || e.status === "FAILED");
  const blockedRequests = events.filter(e => e.status === "BLOCKED" || e.errorCode === ERROR_CLASSES.POLICY_BLOCKED || e.errorCode === ERROR_CLASSES.SAFE_MODE_BLOCKED);

  const successRate = totalRequests > 0
    ? Number((((totalRequests - failedRequests.length) / totalRequests) * 100).toFixed(1))
    : 100;

  // Latências
  const durations = events.map(e => e.durationMs).filter(d => d > 0).sort((a, b) => a - b);
  const p50 = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0;
  const p95 = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;

  // Saúde por Área (Cozinha, Estoque, Financeiro, RH, Analytics, Workflows, Automações)
  const areasList = [
    { name: "Cozinha", domain: "COZINHA" },
    { name: "Estoque & Compras", domain: "ESTOQUE_COMPRAS" },
    { name: "Financeiro", domain: "FINANCEIRO" },
    { name: "RH & Equipe", domain: "RH" },
    { name: "Inteligência Analítica", domain: "ANALYTICS" },
    { name: "Rotinas & Workflows", domain: "WORKFLOWS" },
    { name: "Automações Programadas", domain: "AUTOMATIONS" }
  ];

  const areaMetrics = areasList.map(area => {
    const areaEvents = events.filter(e => e.domain === area.domain || String(e.domain).includes(area.domain));
    const reqs = areaEvents.length;
    const fails = areaEvents.filter(e => e.status === "FAILED").length;
    const failRate = reqs > 0 ? Number(((fails / reqs) * 100).toFixed(1)) : 0;
    const latencies = areaEvents.map(e => e.durationMs).filter(d => d > 0);
    const avgLat = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

    return {
      areaName: area.name,
      domain: area.domain,
      requestsCount: reqs,
      failureRatePercent: failRate,
      avgLatencyMs: avgLat,
      status: failRate > 15 ? "WARNING" : "HEALTHY"
    };
  });

  // Agrupa Principais Erros
  const errorCounts = {};
  events.filter(e => e.errorCode).forEach(e => {
    errorCounts[e.errorCode] = (errorCounts[e.errorCode] || 0) + 1;
  });

  const topErrors = Object.keys(errorCounts)
    .map(errCode => ({ errorCode: errCode, count: errorCounts[errCode] }))
    .sort((a, b) => b.count - a.count);

  const tenantIncidents = incidentsBuffer.filter(inc => inc.tenantId === cleanTenant);

  return {
    hasSufficientData: true,
    totalRequests,
    successRate,
    securityBlockedCount: blockedRequests.length,
    technicalFailuresCount: failedRequests.length,
    p50LatencyMs: p50,
    p95LatencyMs: p95,
    areas: areaMetrics,
    topErrors,
    incidents: tenantIncidents
  };
}

/**
 * Registra o feedback do usuário (👍 / 👎) sobre uma resposta do Héfisto
 */
export function recordUserFeedback({
  correlationId = null,
  rating = "POSITIVE", // 'POSITIVE' | 'NEGATIVE'
  reason = null, // 'Resposta incorreta' | 'Não entendeu' | 'Informação desatualizada' | 'Ação errada' | 'Outro'
  comment = "",
  tenantId = "matriz",
  userRole = "OPERATOR"
}) {
  const fb = {
    feedbackId: `fb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    correlationId,
    rating,
    reason,
    comment: redactSensitiveData(comment),
    tenantId: String(tenantId || "matriz").trim(),
    userRole,
    candidateForEval: rating === "NEGATIVE"
  };

  if (feedbackBuffer.length >= FEEDBACK_BUFFER_MAX) {
    feedbackBuffer.shift();
  }
  feedbackBuffer.push(fb);

  return fb;
}

/**
 * Retorna casos marcados como candidatos a novos fixtures Evals (para revisão do ADMIN)
 */
export function getEvalCandidates({ tenantId = "matriz" } = {}) {
  const cleanTenant = String(tenantId || "matriz").trim();
  return feedbackBuffer
    .filter(fb => fb.tenantId === cleanTenant && fb.candidateForEval)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Limpa todos os buffers de telemetria (útil para testes ou resets administrativos)
 */
export function clearTelemetryBuffers() {
  telemetryBuffer.length = 0;
  incidentsBuffer.length = 0;
  feedbackBuffer.length = 0;
}
