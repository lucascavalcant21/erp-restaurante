/**
 * Policy & Risk Engine (Héfisto F6 Governança & Segurança)
 * Camada determinística de políticas de acesso, classificação de risco, Modo Seguro e Kill Switch.
 */

// Estado global em memória do Modo Seguro e Kill Switch (por unidade/tenant)
const safeModeState = new Map(); // tenantId -> boolean
const killSwitchState = new Map(); // tenantId -> boolean

// Action Allowlist estrita (Ações que a IA está autorizada a interagir)
export const ACTION_ALLOWLIST = new Set([
  "label.print",
  "inventory.entry",
  "inventory.exit",
  "inventory.loss",
  "production.complete"
]);

// Ações de Alto Risco (Sempre bloqueadas para execução autônoma/IA)
export const HIGH_RISK_ACTIONS = new Set([
  "finance.payBill",
  "finance.deleteExpense",
  "finance.updateDRE",
  "ponto.clockIn",
  "ponto.clockOut",
  "ponto.adjustRecord",
  "rh.updateSalary",
  "rh.terminateEmployee",
  "system.updatePermissions",
  "system.execArbitrary"
]);

/**
 * Níveis de Risco Padronizados
 */
export const RISK_LEVELS = {
  READ_ONLY: "READ_ONLY",
  NAVIGATION: "NAVIGATION",
  LOW_RISK_ACTION: "LOW_RISK_ACTION",
  SENSITIVE_ACTION: "SENSITIVE_ACTION",
  HIGH_RISK_ACTION: "HIGH_RISK_ACTION",
  BLOCKED: "BLOCKED"
};

/**
 * Redige/Mascara automaticamente senhas, tokens, cartões e PII do texto ou objeto
 */
export function redactSensitiveData(input) {
  if (!input) return input;
  if (typeof input === "string") {
    return input
      .replace(/(senha|password|pass|secret|token|bearer|key|authorization)=([^\s&]+)/gi, "$1=***REDACTED***")
      .replace(/(\b\d{3}\.\d{3}\.\d{3}-\d{2}\b)/g, "***.***.***-**") // CPF
      .replace(/(\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b)/g, "****-****-****-****"); // Cartão
  }
  if (typeof input === "object") {
    try {
      const copy = JSON.parse(JSON.stringify(input));
      for (const key of Object.keys(copy)) {
        if (/senha|password|secret|token|auth|cookie|key/i.test(key)) {
          copy[key] = "***REDACTED***";
        } else if (typeof copy[key] === "object") {
          copy[key] = redactSensitiveData(copy[key]);
        }
      }
      return copy;
    } catch {
      return input;
    }
  }
  return input;
}

/**
 * Ativa ou Desativa o Modo Seguro para a unidade
 */
export function setSafeMode(unitId = "matriz", enabled = true) {
  safeModeState.set(String(unitId || "matriz").trim(), !!enabled);
}

/**
 * Consulta se o Modo Seguro está ativo para a unidade
 */
export function isSafeModeActive(unitId = "matriz") {
  return safeModeState.get(String(unitId || "matriz").trim()) === true;
}

/**
 * Ativa o Kill Switch de Ações do Héfisto para a unidade
 */
export function setKillSwitch(unitId = "matriz", enabled = true) {
  killSwitchState.set(String(unitId || "matriz").trim(), !!enabled);
}

/**
 * Consulta se o Kill Switch está ativo
 */
export function isKillSwitchActive(unitId = "matriz") {
  return killSwitchState.get(String(unitId || "matriz").trim()) === true;
}

/**
 * Classifica o nível de risco de uma intenção ou ação de forma determinística
 */
export function evaluateRiskLevel(actionIdOrIntent, params = {}) {
  const target = String(actionIdOrIntent || "").trim();

  if (HIGH_RISK_ACTIONS.has(target)) {
    return RISK_LEVELS.HIGH_RISK_ACTION;
  }

  if (target === "label.print") {
    return RISK_LEVELS.LOW_RISK_ACTION;
  }

  if (ACTION_ALLOWLIST.has(target)) {
    return RISK_LEVELS.SENSITIVE_ACTION;
  }

  if (target.startsWith("navigation.") || target.startsWith("route.")) {
    return RISK_LEVELS.NAVIGATION;
  }

  if (target.startsWith("inventory.") || target.startsWith("cozinha.") || target.startsWith("finance.") || target.startsWith("rh.")) {
    return RISK_LEVELS.READ_ONLY;
  }

  return RISK_LEVELS.READ_ONLY;
}

/**
 * Avalia se uma ação pode ser executada respeitando todas as políticas de segurança
 */
export function evaluateActionPolicy({ actionId, unitId = "matriz", session = null, riskLevel = RISK_LEVELS.SENSITIVE_ACTION }) {
  const cleanUnit = String(unitId || "matriz").trim();

  // 1. Verificação do Kill Switch
  if (isKillSwitchActive(cleanUnit)) {
    return {
      allowed: false,
      reason: "KILL_SWITCH_ACTIVE",
      message: "Ações transacionais do Héfisto estão temporariamente desativadas pelo administrador."
    };
  }

  // 2. Verificação do Modo Seguro (Safe Mode)
  if (isSafeModeActive(cleanUnit) && (riskLevel === RISK_LEVELS.SENSITIVE_ACTION || riskLevel === RISK_LEVELS.LOW_RISK_ACTION)) {
    return {
      allowed: false,
      reason: "SAFE_MODE_ACTIVE",
      message: "Modo Seguro ativo: alterações de dados via linguagem natural estão pausadas."
    };
  }

  // 3. Verificação de Ação de Alto Risco (High Risk Action Always Blocked for AI)
  if (riskLevel === RISK_LEVELS.HIGH_RISK_ACTION || HIGH_RISK_ACTIONS.has(actionId)) {
    return {
      allowed: false,
      reason: "HIGH_RISK_BLOCKED",
      message: "Esta operação de alto risco precisa ser realizada através do fluxo tradicional do ERP por medida de segurança."
    };
  }

  // 4. Verificação de Allowlist
  if (!ACTION_ALLOWLIST.has(actionId)) {
    return {
      allowed: false,
      reason: "NOT_IN_ALLOWLIST",
      message: "Esta ação não está cadastrada na lista de ações permitidas do Héfisto."
    };
  }

  return {
    allowed: true,
    reason: "POLICY_PASSED",
    message: "Ação autorizada pela política de segurança."
  };
}

/**
 * Valida se o payload da confirmação coincide exatamente com o preview gerado (Prevenção de alteração de payload)
 */
export function validatePayloadMatch(originalPreview, confirmationPayload) {
  if (!originalPreview || !confirmationPayload) return false;
  
  const origProduct = String(originalPreview.productId || originalPreview.productName || "").trim().toLowerCase();
  const confProduct = String(confirmationPayload.productId || confirmationPayload.productName || "").trim().toLowerCase();

  const origQty = Number(originalPreview.quantity || 0);
  const confQty = Number(confirmationPayload.quantity || 0);

  const origUnit = String(originalPreview.unit || "").trim().toLowerCase();
  const confUnit = String(confirmationPayload.unit || "").trim().toLowerCase();

  if (origProduct !== confProduct) return false;
  if (Math.abs(origQty - confQty) > 0.0001) return false;
  if (origUnit !== confUnit) return false;

  return true;
}
