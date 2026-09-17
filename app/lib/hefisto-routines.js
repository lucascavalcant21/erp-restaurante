import { normalizeText } from "./hefisto-intents.js";
import { routeToSpecialist } from "./hefisto-specialists.js";
import { getProactiveInsights } from "./hefisto-insights.js";
import { canAccessRoute, hasPermission } from "./permissions-catalog.mjs";
import { logAuditEvent } from "./hefisto-audit.js";

/**
 * Catálogo Oficial de Rotinas Inteligentes (ROUTINE_REGISTRY - F8)
 */
export const ROUTINE_REGISTRY = [
  {
    id: "restaurant.opening",
    name: "Abertura do Restaurante",
    description: "Checklist e briefing operacional para preparação de abertura da casa",
    keywords: [
      "prepare meu restaurante para abrir",
      "como estamos para abrir hoje",
      "como estamos para abrir",
      "abertura do restaurante",
      "preparar abertura",
      "abertura"
    ],
    specialists: ["hefesto.hr", "hefesto.kitchen", "hefesto.inventory"],
    requiredPermissions: ["cozinha.sector.view", "estoque.overview.view", "rh.overview.view"],
    steps: [
      { id: "rh", specialist: "hefesto.hr", prompt: "quem esta trabalhando hoje", timeoutMs: 3000 },
      { id: "cozinha", specialist: "hefesto.kitchen", prompt: "como esta a cozinha", timeoutMs: 3000 },
      { id: "estoque", specialist: "hefesto.inventory", prompt: "o que esta acabando", timeoutMs: 3000 },
      { id: "insights", service: "f5_insights", timeoutMs: 2000 }
    ],
    timeoutMs: 8000
  },
  {
    id: "restaurant.currentStatus",
    name: "Status Atual da Operação",
    description: "Visão em tempo real do pulso operacional do restaurante",
    keywords: [
      "como esta o restaurante hoje",
      "status atual",
      "situacao da operacao",
      "resumo da operacao",
      "como esta o restaurante"
    ],
    specialists: ["hefesto.hr", "hefesto.kitchen", "hefesto.inventory"],
    requiredPermissions: [],
    steps: [
      { id: "rh", specialist: "hefesto.hr", prompt: "quem esta trabalhando hoje", timeoutMs: 3000 },
      { id: "cozinha", specialist: "hefesto.kitchen", prompt: "como esta a cozinha", timeoutMs: 3000 },
      { id: "estoque", specialist: "hefesto.inventory", prompt: "o que esta acabando", timeoutMs: 3000 },
      { id: "insights", service: "f5_insights", timeoutMs: 2000 }
    ],
    timeoutMs: 8000
  },
  {
    id: "restaurant.closing",
    name: "Check de Fechamento do Dia",
    description: "Validação de pendências de encerramento de turno e lote",
    keywords: [
      "faca o fechamento do dia",
      "fechamento do dia",
      "preparar fechamento",
      "fechamento"
    ],
    specialists: ["hefesto.kitchen", "hefesto.inventory", "hefesto.hr", "hefesto.finance"],
    requiredPermissions: [],
    steps: [
      { id: "cozinha", specialist: "hefesto.kitchen", prompt: "tem producao atrasada", timeoutMs: 3000 },
      { id: "estoque", specialist: "hefesto.inventory", prompt: "o que esta acabando", timeoutMs: 3000 },
      { id: "rh", specialist: "hefesto.hr", prompt: "tem ponto pendente", timeoutMs: 3000 },
      { id: "financeiro", specialist: "hefesto.finance", prompt: "tem conta vencida", timeoutMs: 3000 },
      { id: "insights", service: "f5_insights", timeoutMs: 2000 }
    ],
    timeoutMs: 8000
  },
  {
    id: "kitchen.briefing",
    name: "Briefing da Cozinha",
    description: "Alinhamento operacional direcionado para a equipe de preparo",
    keywords: [
      "faca o briefing da cozinha",
      "briefing da cozinha",
      "briefing cozinha",
      "resumo da cozinha"
    ],
    specialists: ["hefesto.kitchen", "hefesto.inventory"],
    requiredPermissions: ["cozinha.sector.view"],
    steps: [
      { id: "cozinha", specialist: "hefesto.kitchen", prompt: "como esta a cozinha", timeoutMs: 3000 },
      { id: "estoque", specialist: "hefesto.inventory", prompt: "o que esta acabando", timeoutMs: 3000 },
      { id: "insights", service: "f5_insights", timeoutMs: 2000 }
    ],
    timeoutMs: 6000
  },
  {
    id: "management.dailyBriefing",
    name: "Resumo Gerencial Diário",
    description: "Consolidado gerencial abrangendo operação, finanças e equipe",
    keywords: [
      "me de o resumo gerencial de hoje",
      "resumo gerencial",
      "briefing gerencial",
      "resumo gerencial de hoje",
      "resumo da gestao"
    ],
    specialists: ["hefesto.hr", "hefesto.kitchen", "hefesto.inventory", "hefesto.finance"],
    requiredPermissions: [],
    steps: [
      { id: "cozinha", specialist: "hefesto.kitchen", prompt: "como esta a cozinha", timeoutMs: 3000 },
      { id: "estoque", specialist: "hefesto.inventory", prompt: "o que esta acabando", timeoutMs: 3000 },
      { id: "rh", specialist: "hefesto.hr", prompt: "quem esta trabalhando hoje", timeoutMs: 3000 },
      { id: "financeiro", specialist: "hefesto.finance", prompt: "qual o resultado do mes", timeoutMs: 3000 },
      { id: "insights", service: "f5_insights", timeoutMs: 2000 }
    ],
    timeoutMs: 8000
  }
];

/**
 * Identifica se a entrada do usuário corresponde a uma rotina do catálogo
 */
export function identifyRoutine(text = "") {
  const norm = normalizeText(text);
  if (!norm) return null;

  for (const routine of ROUTINE_REGISTRY) {
    for (const kw of routine.keywords) {
      const normKw = normalizeText(kw);
      if (norm === normKw || norm.includes(normKw)) {
        return routine;
      }
    }
  }
  return null;
}

/**
 * Utilitário para executar uma promessa com timeout seguro
 */
function withTimeout(promise, ms, stepName) {
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timeout na etapa ${stepName} (${ms}ms)`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Deduplica alertas e evidências usando fingerprints normalizadas
 */
function deduplicateAlerts(alerts = []) {
  const seen = new Set();
  const result = [];

  for (const item of alerts) {
    const norm = normalizeText(typeof item === "string" ? item : item.label || item.title || "");
    if (!norm) continue;
    if (!seen.has(norm)) {
      seen.add(norm);
      result.push(item);
    }
  }

  return result;
}

/**
 * Motor de Workflows Determinístico (WORKFLOW_ENGINE - F8)
 */
export async function executeRoutineIfMatched({ text = "", session = null, unitId = "", contextState = {}, signal = null }) {
  const routine = identifyRoutine(text);
  if (!routine) return null;

  const correlationId = `routine-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const startTime = Date.now();

  // Permissões gerais da rotina se houver restrição mandatória no root
  if (routine.requiredPermissions && routine.requiredPermissions.length > 0) {
    const temPermissaoGeral = routine.requiredPermissions.some(perm =>
      !session?.gerenciado || hasPermission(session, perm)
    );

    if (!temPermissaoGeral) {
      logAuditEvent({
        correlationId,
        userId: session?.id || "anonymous",
        userName: session?.nome || "Usuário",
        tenantId: unitId,
        channel: "text",
        textInput: text,
        intentId: routine.id,
        riskLevel: "READ_ONLY",
        permissionRequired: routine.requiredPermissions[0],
        permissionResult: false,
        approvalRequired: false,
        approvalResult: "NOT_APPLICABLE",
        executionStatus: "BLOCKED_HIGH_RISK",
        executor: "WorkflowEngine",
        durationMs: Date.now() - startTime
      });

      return {
        success: false,
        permissionDenied: true,
        responseText: `Você não possui permissão para executar a rotina ${routine.name}.`
      };
    }
  }

  // Execução Paralela de Passos com Timeout e Isolamento de Erros
  const stepPromises = routine.steps.map(step => {
    if (signal?.aborted) {
      return Promise.reject(new Error("CANCELLED"));
    }

    if (step.service === "f5_insights") {
      return withTimeout(getProactiveInsights({ session, unitId }), step.timeoutMs, step.id);
    }

    if (step.specialist) {
      return withTimeout(
        routeToSpecialist({ text: step.prompt, session, unitId, contextState }),
        step.timeoutMs,
        step.id
      );
    }

    return Promise.resolve(null);
  });

  const stepResults = await Promise.allSettled(stepPromises);

  // Verificação de Cancelamento / Troca de Empresa
  if (signal?.aborted) {
    return {
      success: false,
      cancelled: true,
      responseText: "Rotina cancelada pelo usuário."
    };
  }

  // Mapeamento e Consolidação dos Resultados das Etapas
  const outputs = {};
  let partialFailures = [];

  routine.steps.forEach((step, idx) => {
    const res = stepResults[idx];
    if (res.status === "fulfilled" && res.value) {
      if (res.value.permissionDenied) {
        // Omite silenciosamente se for sem permissão
        outputs[step.id] = null;
      } else {
        outputs[step.id] = res.value;
      }
    } else {
      outputs[step.id] = null;
      if (step.id !== "insights") {
        const sectorName = step.id === "rh" ? "RH/Equipe" : step.id === "cozinha" ? "Cozinha" : step.id === "estoque" ? "Estoque" : "Financeiro";
        partialFailures.push(sectorName);
      }
    }
  });

  // Sintetizador de Conteúdo e Formatação por Rotina
  let titleHeader = "";
  let attentionItems = [];
  let rhSection = null;
  let cozinhaSection = null;
  let estoqueSection = null;
  let financeiroSection = null;
  let suggestedActions = [];
  let spokenText = "";

  const dataHoraStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  // 1. ROTINA: ABERTURA DO RESTAURANTE
  if (routine.id === "restaurant.opening" || routine.id === "restaurant.currentStatus") {
    titleHeader = routine.id === "restaurant.opening" ? "ABERTURA · BRIEFING DA OPERAÇÃO" : "STATUS ATUAL DA OPERAÇÃO";

    if (outputs.rh?.success) {
      rhSection = outputs.rh.responseText || "Equipe pronta para o turno.";
    }
    if (outputs.cozinha?.success) {
      cozinhaSection = outputs.cozinha.responseText || "Produção em andamento.";
      if (outputs.cozinha.suggestedAction) suggestedActions.push(outputs.cozinha.suggestedAction);
    }
    if (outputs.estoque?.success) {
      estoqueSection = outputs.estoque.responseText || "Insumos verificados.";
      if (outputs.estoque.suggestedAction) suggestedActions.push(outputs.estoque.suggestedAction);
    }

    if (outputs.cozinha?.responseText?.includes("atrasada")) {
      attentionItems.push("Produções pendentes ou com atraso na cozinha");
    }
    if (outputs.estoque?.responseText?.includes("acabando") || outputs.estoque?.responseText?.includes("baixo")) {
      attentionItems.push("Itens de estoque críticos abaixo do nível mínimo");
    }
    if (outputs.rh?.responseText?.includes("pendente")) {
      attentionItems.push("Registros de ponto pendentes de validação");
    }

    spokenText = `Briefing de abertura pronto. ${attentionItems.length > 0 ? `Atenção para ${attentionItems.length} situação(ões) na operação.` : "Operação sem alertas impeditivos."}`;

  // 2. ROTINA: FECHAMENTO DO DIA
  } else if (routine.id === "restaurant.closing") {
    titleHeader = "CHECK DE FECHAMENTO DO DIA";

    if (outputs.cozinha?.success) {
      cozinhaSection = outputs.cozinha.responseText;
    }
    if (outputs.estoque?.success) {
      estoqueSection = outputs.estoque.responseText;
    }
    if (outputs.rh?.success) {
      rhSection = outputs.rh.responseText;
    }
    if (outputs.financeiro?.success) {
      financeiroSection = outputs.financeiro.responseText;
    }

    attentionItems.push("Verifique se há preparos pendentes antes de encerrar o turno");
    attentionItems.push("Confira os lançamentos de perdas de insumos do dia");

    spokenText = "Check de fechamento concluído. Verifique os alertas e pendências operacionais antes de encerrar.";

  // 3. ROTINA: KITCHEN BRIEFING
  } else if (routine.id === "kitchen.briefing") {
    titleHeader = "BRIEFING TÁTICO DA COZINHA";

    if (outputs.cozinha?.success) {
      cozinhaSection = outputs.cozinha.responseText;
      if (outputs.cozinha.suggestedAction) suggestedActions.push(outputs.cozinha.suggestedAction);
    }
    if (outputs.estoque?.success) {
      estoqueSection = outputs.estoque.responseText;
    }

    spokenText = "Briefing da cozinha pronto com status de produções e insumos de preparo.";

  // 4. ROTINA: RESUMO GERENCIAL
  } else if (routine.id === "management.dailyBriefing") {
    titleHeader = "RESUMO GERENCIAL DA OPERAÇÃO";

    if (outputs.cozinha?.success) cozinhaSection = outputs.cozinha.responseText;
    if (outputs.estoque?.success) estoqueSection = outputs.estoque.responseText;
    if (outputs.rh?.success) rhSection = outputs.rh.responseText;
    if (outputs.financeiro?.success) financeiroSection = outputs.financeiro.responseText;

    spokenText = "Resumo gerencial consolidado com dados de operação, equipe e financeiro.";
  }

  // Deduplicação dos itens de atenção e alertas F5
  const cleanAttention = deduplicateAlerts(attentionItems);

  let responseBody = `### 📋 ${titleHeader}\n*Atualizado às ${dataHoraStr}*\n\n`;

  if (partialFailures.length > 0) {
    responseBody += `> [!WARNING]\n> Não foi possível carregar os dados de **${partialFailures.join(", ")}** neste briefing.\n\n`;
  }

  if (cleanAttention.length > 0) {
    responseBody += `#### 🚨 SITUAÇÕES QUE REQUEREM ATENÇÃO\n`;
    cleanAttention.forEach(att => {
      responseBody += `• ${att}\n`;
    });
    responseBody += `\n`;
  }

  if (cozinhaSection) {
    responseBody += `#### 👨‍🍳 COZINHA & PRODUÇÃO\n${cozinhaSection}\n\n`;
  }
  if (estoqueSection) {
    responseBody += `#### 📦 ESTOQUE & INSUMOS\n${estoqueSection}\n\n`;
  }
  if (rhSection) {
    responseBody += `#### 👥 EQUIPE & TURNO\n${rhSection}\n\n`;
  }
  if (financeiroSection) {
    responseBody += `#### 💰 FINANCEIRO & DESEMPENHO\n${financeiroSection}\n\n`;
  }

  // Garantia de Ações Únicas e Válidas F2
  if (suggestedActions.length === 0) {
    if (routine.id === "kitchen.briefing" || routine.id === "restaurant.opening") {
      suggestedActions.push({ label: "Ver Produção da Cozinha", route: "/dashboard/operacao/producao?dept=cozinha" });
      suggestedActions.push({ label: "Ver Estoque Crítico", route: "/dashboard/operacao/estoque" });
    } else if (routine.id === "restaurant.closing") {
      suggestedActions.push({ label: "Resolver Pendências de Ponto", route: "/dashboard/rh/ponto" });
      suggestedActions.push({ label: "Ver Registros de Perda", route: "/dashboard/operacao/estoque" });
    } else {
      suggestedActions.push({ label: "Ver Central Operacional", route: "/dashboard" });
    }
  }

  logAuditEvent({
    correlationId,
    userId: session?.id || "anonymous",
    userName: session?.nome || "Usuário",
    tenantId: unitId,
    channel: "text",
    textInput: text,
    intentId: routine.id,
    riskLevel: "READ_ONLY",
    permissionRequired: routine.requiredPermissions[0] || null,
    permissionResult: true,
    approvalRequired: false,
    approvalResult: "NOT_APPLICABLE",
    executionStatus: "SUCCEEDED",
    executor: "WorkflowEngine:F8",
    durationMs: Date.now() - startTime
  });

  return {
    success: true,
    type: "ROUTINE_BRIEFING",
    routineId: routine.id,
    intent: routine.id === "restaurant.currentStatus" ? "command.summary" : routine.id,
    title: titleHeader,
    responseText: responseBody.trim(),
    spokenSummary: spokenText,
    suggestedActions: suggestedActions.slice(0, 3),
    updatedAt: dataHoraStr
  };
}
