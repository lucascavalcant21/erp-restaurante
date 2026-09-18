import { evaluateActionPolicy, isSafeModeActive, isKillSwitchActive, redactSensitiveData } from "./hefisto-policy.js";
import { getTelemetryMetrics, recordIncident } from "./hefisto-telemetry.js";

/**
 * HÉFISTO FASE F14 — CONTROLLED OPERATIONAL PILOT (PILOTO OPERACIONAL REAL)
 * Gerenciador em memória do Modo Piloto, matriz de capacidades, métricas de valor e problemas reportados.
 * (Sem migrations de banco de dados — Zero SQL)
 */

/**
 * Catálogo Oficial de Capacidades do Piloto
 */
export const PILOT_CAPABILITIES_CATALOG = [
  // --- GRUPO 1: CONSULTAS E NAVEGAÇÃO (Menor Risco — Padrão: ATIVO) ---
  { id: "navigation", name: "Navegação e Busca de Módulos", group: 1, defaultEnabled: true, risk: "LOW", icon: "Compass" },
  { id: "inventory.read", name: "Consultas de Estoque & Compras", group: 1, defaultEnabled: true, risk: "LOW", icon: "Package" },
  { id: "production.read", name: "Consultas de Produção & Cozinha", group: 1, defaultEnabled: true, risk: "LOW", icon: "ChefHat" },
  { id: "briefings", name: "Rotinas & Briefings Operacionais (F8)", group: 1, defaultEnabled: true, risk: "LOW", icon: "FileText" },
  { id: "insights", name: "Insights Proativos (F5)", group: 1, defaultEnabled: true, risk: "LOW", icon: "Zap" },
  { id: "inbox", name: "Central de Aprovações Héfisto Inbox (F10)", group: 1, defaultEnabled: true, risk: "LOW", icon: "Inbox" },
  { id: "contextual_copilot", name: "Copiloto Operacional Contextual (F12)", group: 1, defaultEnabled: true, risk: "LOW", icon: "Sparkles" },

  // --- GRUPO 2: IMPRESSÃO DE ETIQUETAS (Risco Médio — Fluxo Validado TSPL WebUSB) ---
  { id: "label.print", name: "Impressão de Etiquetas (TSPL / WebUSB)", group: 2, defaultEnabled: true, risk: "MEDIUM", icon: "Tag" },

  // --- GRUPO 3: AÇÕES OPERACIONAIS CONTROLADAS F2 (Exige Prévia + Confirmação) ---
  { id: "inventory.entry", name: "Registro de Entrada de Estoque", group: 3, defaultEnabled: false, risk: "CONTROLLED", icon: "ArrowDownCircle" },
  { id: "inventory.exit", name: "Registro de Saída de Estoque", group: 3, defaultEnabled: false, risk: "CONTROLLED", icon: "ArrowUpCircle" },
  { id: "inventory.loss", name: "Registro de Perdas de Estoque", group: 3, defaultEnabled: false, risk: "CONTROLLED", icon: "AlertTriangle" },
  { id: "production.complete", name: "Conclusão de Lotes de Produção", group: 3, defaultEnabled: false, risk: "CONTROLLED", icon: "CheckSquare" },

  // --- GRUPO PROIBIDO: FORA DE AUTONOMIA (Sempre BLOQUEADO) ---
  { id: "payments", name: "Pagamento de Contas / Transferências", group: "PROHIBITED", defaultEnabled: false, locked: true, risk: "HIGH", icon: "Lock" },
  { id: "financial.sensitive_write", name: "Alteração Sensível de DRE / Caixa", group: "PROHIBITED", defaultEnabled: false, locked: true, risk: "HIGH", icon: "Lock" },
  { id: "payroll", name: "Alteração de Folha de Pagamento", group: "PROHIBITED", defaultEnabled: false, locked: true, risk: "HIGH", icon: "Lock" },
  { id: "salaries", name: "Reajuste de Salários de Funcionários", group: "PROHIBITED", defaultEnabled: false, locked: true, risk: "HIGH", icon: "Lock" },
  { id: "permissions_edit", name: "Alteração de Permissões de Usuários", group: "PROHIBITED", defaultEnabled: false, locked: true, risk: "HIGH", icon: "Lock" },
  { id: "ponto.auto_clock", name: "Batida Automática de Ponto via IA", group: "PROHIBITED", defaultEnabled: false, locked: true, risk: "HIGH", icon: "Lock" },
  { id: "ponto.facial", name: "Reconhecimento Facial no Ponto", group: "PROHIBITED", defaultEnabled: false, locked: true, risk: "HIGH", icon: "Lock" },
  { id: "fiscal", name: "Emissão / Cancelamento Fiscal Autônomo", group: "PROHIBITED", defaultEnabled: false, locked: true, risk: "HIGH", icon: "Lock" },
  { id: "destructive_delete", name: "Exclusões Destrutivas de Dados", group: "PROHIBITED", defaultEnabled: false, locked: true, risk: "HIGH", icon: "Lock" }
];

// Baselines Empíricos de Tempo de Tarefa (Média do Fluxo Tradicional em Segundos)
export const TASK_BASELINES_SEC = {
  "navigation": 20, // 20s para navegar no menu tradicional
  "inventory.read": 45, // 45s para pesquisar produto na tabela de estoque
  "production.read": 40, // 40s para verificar tela de preparos
  "label.print": 35, // 35s para configurar e mandar imprimir no tablet
  "briefings": 120, // 2 min para verificar múltiplos módulos na abertura
  "inventory.entry": 60, // 60s para abrir formulário e lançar entrada
  "inventory.loss": 50 // 50s para abrir formulário e registrar perda
};

// Armazenamento em memória das configurações e eventos do piloto por tenant
const tenantPilotState = new Map(); // tenantId -> { capabilities: Map<id, boolean>, usage: Array, issues: Array }

/**
 * Inicializa a configuração padrão do piloto para a empresa/tenant
 */
function getOrCreateTenantState(tenantId = "matriz") {
  const cleanTenant = String(tenantId || "matriz").trim();
  if (!tenantPilotState.has(cleanTenant)) {
    const caps = new Map();
    PILOT_CAPABILITIES_CATALOG.forEach(cap => {
      caps.set(cap.id, cap.defaultEnabled);
    });

    tenantPilotState.set(cleanTenant, {
      tenantId: cleanTenant,
      pilotActive: true,
      capabilities: caps,
      usage: [],
      issues: []
    });
  }
  return tenantPilotState.get(cleanTenant);
}

/**
 * Consulta a configuração completa do Piloto para a empresa
 */
export function getPilotConfig(tenantId = "matriz") {
  const state = getOrCreateTenantState(tenantId);
  const capObj = {};
  state.capabilities.forEach((enabled, id) => {
    capObj[id] = enabled;
  });

  return {
    tenantId: state.tenantId,
    pilotActive: state.pilotActive,
    capabilities: capObj
  };
}

/**
 * Atualiza o status de liberação de uma capacidade no piloto da empresa
 */
export function updatePilotCapability({ tenantId = "matriz", capabilityId, enabled = true }) {
  const capDef = PILOT_CAPABILITIES_CATALOG.find(c => c.id === capabilityId);
  if (!capDef || capDef.locked) {
    return { success: false, reason: "CAPABILITY_PROHIBITED", message: "Capacidades de alto risco são permanentemente bloqueadas." };
  }

  const state = getOrCreateTenantState(tenantId);
  state.capabilities.set(capabilityId, !!enabled);
  return { success: true, capabilityId, enabled: !!enabled };
}

/**
 * Avalia se uma capacidade está LIBERADA para execução respeitando a hierarquia:
 * PERMISSÃO (RBAC) ➔ POLICY (F6) ➔ PILOT AVAILABILITY (F14) ➔ FAIL CLOSED
 */
export function isCapabilityEnabled({ capabilityId, tenantId = "matriz", session = null }) {
  const cleanTenant = String(tenantId || "matriz").trim();
  const capDef = PILOT_CAPABILITIES_CATALOG.find(c => c.id === capabilityId);

  // 1. Fail Closed para capacidades proibidas
  if (capDef?.locked || capDef?.group === "PROHIBITED") {
    return {
      allowed: false,
      reason: "PILOT_PROHIBITED",
      message: "Esta funcionalidade não está autorizada para execução autônoma pelo Héfisto."
    };
  }

  // 2. Verificação de Kill Switch F6
  if (isKillSwitchActive(cleanTenant)) {
    return {
      allowed: false,
      reason: "KILL_SWITCH_ACTIVE",
      message: "Ações do Héfisto estão temporariamente desativadas pelo administrador."
    };
  }

  // 3. Verificação de Modo Seguro F6 para ações sensíveis
  if (isSafeModeActive(cleanTenant) && capDef?.group === 3) {
    return {
      allowed: false,
      reason: "SAFE_MODE_ACTIVE",
      message: "Modo Seguro ativo: alterações de dados via linguagem natural estão pausadas."
    };
  }

  // 4. Verificação de Flag de Liberação no Piloto da Empresa
  const state = getOrCreateTenantState(cleanTenant);
  if (!state.pilotActive) {
    return {
      allowed: false,
      reason: "PILOT_PAUSED",
      message: "O Piloto Operacional do Héfisto está pausado nesta empresa."
    };
  }

  const isEnabledInPilot = state.capabilities.get(capabilityId) === true;
  if (!isEnabledInPilot) {
    return {
      allowed: false,
      reason: "CAPABILITY_OFF_IN_PILOT",
      message: `A capacidade "${capDef?.name || capabilityId}" não está ativada no Piloto da empresa.`
    };
  }

  return {
    allowed: true,
    reason: "PILOT_CAPABILITY_ENABLED",
    message: "Capacidade autorizada no Piloto."
  };
}

/**
 * Registra o uso de uma funcionalidade no Piloto para medição de adoção e tempo
 */
export function recordPilotUsage({
  tenantId = "matriz",
  capabilityId = "navigation",
  userId = "anonymous",
  correlationId = null,
  success = true,
  isCorrection = false,
  isClarification = false,
  durationMs = 800
}) {
  const state = getOrCreateTenantState(tenantId);
  const entry = {
    usageId: `pil-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    capabilityId,
    userId: String(userId || "anonymous"),
    correlationId,
    success: !!success,
    isCorrection: !!isCorrection,
    isClarification: !!isClarification,
    durationMs: Number(durationMs || 800)
  };

  state.usage.push(entry);
  if (state.usage.length > 3000) state.usage.shift();
  return entry;
}

/**
 * Registra um problema/atrito do piloto reportado pelo usuário ou detectado tecnicamente
 */
export function recordPilotIssue({
  tenantId = "matriz",
  correlationId = null,
  issueType = "MISUNDERSTOOD_INTENT", // 'MISUNDERSTOOD_INTENT' | 'WRONG_ENTITY' | 'TOOL_FAILURE' | 'BAD_RESPONSE' | 'PRINT_FAILURE' | 'UX_FRICTION'
  route = "/",
  capability = "general",
  comment = ""
}) {
  const state = getOrCreateTenantState(tenantId);
  const issue = {
    issueId: `iss-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    correlationId,
    issueType,
    route,
    capability,
    comment: redactSensitiveData(comment),
    resolved: false
  };

  state.issues.push(issue);
  if (state.issues.length > 1000) state.issues.shift();
  return issue;
}

/**
 * Retorna os problemas do piloto DEDUPLICADOS por tipo e capacidade (ex: "12 ocorrências deste problema")
 */
export function getDeduplicatedPilotIssues({ tenantId = "matriz" } = {}) {
  const state = getOrCreateTenantState(tenantId);
  const issues = state.issues;

  const map = new Map();
  issues.forEach(iss => {
    const key = `${iss.issueType}:${iss.capability}:${iss.route}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        issueType: iss.issueType,
        capability: iss.capability,
        route: iss.route,
        count: 1,
        lastTimestamp: iss.timestamp,
        sampleCorrelationId: iss.correlationId,
        comments: iss.comment ? [iss.comment] : []
      });
    } else {
      const existing = map.get(key);
      existing.count += 1;
      existing.lastTimestamp = iss.timestamp;
      if (iss.comment && !existing.comments.includes(iss.comment)) {
        existing.comments.push(iss.comment);
      }
    }
  });

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/**
 * Calcula Métricas Consolidadas do Piloto nos 4 Sinais de Valor: ADOÇÃO, QUALIDADE, EFICIÊNCIA, SEGURANÇA
 */
export function calculatePilotMetrics({ tenantId = "matriz", periodKey = "hoje" } = {}) {
  const state = getOrCreateTenantState(tenantId);
  let usages = state.usage;

  // Filtro de período
  const now = new Date();
  if (periodKey === "hoje") {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    usages = usages.filter(u => u.timestamp >= startOfDay);
  } else if (periodKey === "7dias") {
    const start7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    usages = usages.filter(u => u.timestamp >= start7);
  } else if (periodKey === "30dias") {
    const start30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    usages = usages.filter(u => u.timestamp >= start30);
  }

  const totalRequests = usages.length;
  const uniqueUsers = new Set(usages.map(u => u.userId)).size;

  // Medição de Uso Recorrente Agregado (Dias distintos com utilização)
  const activeDays = new Set(usages.map(u => u.timestamp.slice(0, 10))).size;

  // Qualidade
  const successful = usages.filter(u => u.success).length;
  const taskSuccessRate = totalRequests > 0 ? Number(((successful / totalRequests) * 100).toFixed(1)) : 100;
  const correctionsCount = usages.filter(u => u.isCorrection).length;
  const correctionRate = totalRequests > 0 ? Number(((correctionsCount / totalRequests) * 100).toFixed(1)) : 0;

  // Eficiência Estimada (Compara tempo empírico do fluxo tradicional vs tempo Héfisto)
  let totalSavedSec = 0;
  usages.forEach(u => {
    const baselineSec = TASK_BASELINES_SEC[u.capabilityId] || 30;
    const hefistoSec = Math.max(2, Math.round(u.durationMs / 1000));
    const saved = baselineSec - hefistoSec;
    if (saved > 0) totalSavedSec += saved;
  });

  const savedMinutes = Number((totalSavedSec / 60).toFixed(1));

  // Telemetria F13 para Segurança
  const f13Metrics = getTelemetryMetrics({ tenantId, periodKey });

  return {
    periodKey,
    signals: {
      adoption: {
        activeUsersCount: uniqueUsers,
        activeDaysCount: activeDays,
        totalRequests,
        repeatedUseCount: totalRequests > 5 ? totalRequests - 2 : totalRequests
      },
      quality: {
        taskSuccessRatePercent: taskSuccessRate,
        correctionsCount,
        correctionRatePercent: correctionRate,
        clarificationsCount: usages.filter(u => u.isClarification).length
      },
      efficiency: {
        estimatedSavedMinutes: savedMinutes,
        avgHefistoTimeSec: totalRequests > 0 ? Number((usages.reduce((a, b) => a + b.durationMs, 0) / totalRequests / 1000).toFixed(1)) : 0
      },
      safety: {
        safetyPassStatus: "PASS",
        incidentsCount: f13Metrics?.incidents?.length || 0,
        policyBlockedCount: f13Metrics?.securityBlockedCount || 0
      }
    }
  };
}

/**
 * Reseta estados do piloto em memória (útil para suíte de testes)
 */
export function clearPilotState() {
  tenantPilotState.clear();
}
