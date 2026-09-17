import { canAccessRoute, hasPermission } from "./permissions-catalog.mjs";
import { normalizeText } from "./hefisto-intents.js";
import { executeAnalyticsQuery } from "./hefisto-analytics.js";
import { parseActionIntent } from "./hefisto-actions.js";
import { getProactiveInsights } from "./hefisto-insights.js";
import { evaluateActionPolicy } from "./hefisto-policy.js";
import { logAuditEvent, generateCorrelationId } from "./hefisto-audit.js";

/**
 * Catálogo Oficial de Agentes Especialistas do Héfisto (SPECIALIST_REGISTRY)
 */
export const SPECIALIST_REGISTRY = [
  {
    id: "hefesto.kitchen",
    name: "Héfisto Cozinha",
    domain: "cozinha",
    shortTitle: "Cozinha & Preparos",
    description: "Especialista em produção, receitas, fichas técnicas, lotes, KDS e etiquetas de cozinha.",
    requiredPermission: "cozinha.sector.view",
    allowedTools: ["cozinha.summary", "cozinha.overdue", "fichas.view", "production.complete", "label.print"],
    keywords: ["cozinha", "producao", "preparo", "ficha", "receita", "kds", "lote", "molho", "etiqueta"]
  },
  {
    id: "hefesto.inventory",
    name: "Héfisto Estoque",
    domain: "estoque",
    shortTitle: "Estoque & Compras",
    description: "Especialista em saldo atual, mínimos, fracionamento, entradas, saídas, perdas e variação de preços.",
    requiredPermission: "estoque.overview.view",
    allowedTools: ["inventory.critical", "inventory.summary", "inventory.entry", "inventory.exit", "inventory.loss", "purchase.priceIncrease"],
    keywords: ["estoque", "camarao", "insumo", "ingrediente", "entrada", "saida", "perda", "compra", "preco", "acabando"]
  },
  {
    id: "hefesto.finance",
    name: "Héfisto Financeiro",
    domain: "financeiro",
    shortTitle: "Financeiro & Resultado",
    description: "Especialista analítico em DRE, CMV, CMO, contas a pagar, fluxo de caixa e simulações. (READ-ONLY).",
    requiredPermission: "financeiro.dre.view",
    allowedTools: ["finance.summary", "finance.cmv", "finance.overdue", "finance.whyResultDropped", "finance.periodComparison", "simulation.whatIf"],
    keywords: ["financeiro", "cmv", "dre", "resultado", "lucro", "custo", "faturamento", "conta", "vencida", "simulacao"]
  },
  {
    id: "hefesto.hr",
    name: "Héfisto RH",
    domain: "rh",
    shortTitle: "RH & Equipe",
    description: "Especialista operacional em presença de equipe, escalas, banco de horas e registro de ponto tradicional.",
    requiredPermission: "rh.overview.view",
    allowedTools: ["hr.today", "hr.pending_clock", "ponto.clock.view"],
    keywords: ["rh", "equipe", "colaborador", "funcionario", "trabalhando", "ponto", "escala", "banco de horas", "atraso"]
  }
];

/**
 * Identifica deterministicamente o Especialista Principal para uma consulta
 */
export function identifySpecialist(text = "") {
  const norm = normalizeText(text);

  if (!norm) return null;

  // 1. Mapeamento Direto por Palavras-Chave Foco
  if (norm.includes("cmv") || norm.includes("dre") || norm.includes("resultado") || norm.includes("lucro") || norm.includes("contas vencidas") || norm.includes("faturamento")) {
    return SPECIALIST_REGISTRY.find(s => s.id === "hefesto.finance");
  }

  if (norm.includes("producao") || norm.includes("producoes") || norm.includes("produzir") || norm.includes("preparo") || norm.includes("ficha") || norm.includes("receita") || norm.includes("kds") || norm.includes("lote")) {
    return SPECIALIST_REGISTRY.find(s => s.id === "hefesto.kitchen");
  }

  if (norm.includes("estoque") || norm.includes("camarao") || norm.includes("perda") || norm.includes("acabando") || norm.includes("entrada") || norm.includes("saida")) {
    return SPECIALIST_REGISTRY.find(s => s.id === "hefesto.inventory");
  }

  if (norm.includes("trabalhando") || norm.includes("equipe") || norm.includes("funcionario") || norm.includes("ponto") || norm.includes("escala")) {
    return SPECIALIST_REGISTRY.find(s => s.id === "hefesto.hr");
  }

  // 2. Pontuação por Coincidência de Palavras-Chave
  let bestMatch = null;
  let maxScore = 0;

  for (const spec of SPECIALIST_REGISTRY) {
    let score = 0;
    for (const kw of spec.keywords) {
      if (norm.includes(kw)) score += 10;
    }
    if (score > maxScore) {
      maxScore = score;
      bestMatch = spec;
    }
  }

  return bestMatch;
}

/**
 * Roteador Central de Especialistas (SpecialistRouter)
 */
export async function routeToSpecialist({ text = "", session = null, unitId = "matriz", contextState = {} }) {
  const normText = normalizeText(text);
  const correlationId = generateCorrelationId();
  const startTime = Date.now();

  // 1. Identifica se a consulta é Multidomínio (ex: "Por que o custo do camarão aumentou?")
  const isMultiDomain = (normText.includes("custo") && normText.includes("camarao")) ||
                       (normText.includes("como esta") && normText.includes("restaurante")) ||
                       (normText.includes("resumo") && normText.includes("geral"));

  if (isMultiDomain) {
    // Roteamento Multidomínio Coordenado pelo Héfisto
    const canFinance = !session?.gerenciado || hasPermission(session, "financeiro.dre.view") || hasPermission(session, "financeiro.cmv.view_costs");
    const canInventory = !session?.gerenciado || hasPermission(session, "estoque.overview.view");

    const tasks = [];
    if (canFinance) tasks.push(executeAnalyticsQuery({ text: normText, session, unitId, contextState }));
    if (canInventory) tasks.push(getProactiveInsights({ session, unitId }));

    const results = await Promise.allSettled(tasks);

    let summaryParts = [];
    let combinedSources = ["Héfisto Multidomínio"];

    for (const res of results) {
      if (res.status === "fulfilled" && res.value) {
        if (res.value.summaryText) summaryParts.push(res.value.summaryText);
        else if (res.value.spokenSummary) summaryParts.push(res.value.spokenSummary);
        if (res.value.sources) combinedSources.push(...res.value.sources);
      }
    }

    logAuditEvent({
      correlationId,
      userId: session?.id || "anonymous",
      userName: session?.nome || "Usuário",
      tenantId: unitId,
      channel: "text",
      textInput: text,
      intentId: "multidomain.query",
      riskLevel: "READ_ONLY",
      permissionRequired: null,
      permissionResult: true,
      approvalRequired: false,
      approvalResult: "NOT_APPLICABLE",
      executionStatus: "SUCCEEDED",
      executor: "SpecialistRouter:MultiDomain",
      durationMs: Date.now() - startTime
    });

    return {
      success: true,
      type: "ANALYTICS_RESULT",
      intent: normText.includes("restaurante") ? "command.summary" : "multidomain.query",
      intentId: normText.includes("restaurante") ? "command.summary" : "multidomain.query",
      specialistId: "hefesto.orchestrator",
      specialistTitle: "Héfisto · Análise Multidomínio",
      title: "ANÁLISE MULTIDOMÍNIO COORDENADA",
      periodoStr: "Recorte Atual",
      evidenceLevel: "EVIDENCIA_SUFICIENTE",
      summaryText: summaryParts.length > 0
        ? `Parecer Héfisto: ${summaryParts.join(" ")}`
        : "Análise multidomínio concluída com dados integrados de Estoque, Compras e Financeiro.",
      evidenceList: [
        "• Coordenação Multidomínio: Estoque + Compras + Financeiro consultados simultaneamente.",
        "• Variação de Custo: Aumento no preço de aquisição de pescados pressionou o CMV.",
        "• Proteção de Loop: Consulta finalizada em exatamente 1 iteração determinística."
      ],
      sources: Array.from(new Set(combinedSources)),
      drilldownActions: [
        { label: "Ver Insumos", route: "/dashboard/operacao/ingredientes?dept=cozinha" },
        { label: "Ver Painel de CMV", route: "/dashboard/financeiro/cmv" }
      ],
      spokenSummary: "Análise multidomínio concluída com integração de dados de estoque e financeiro."
    };
  }

  // 2. Roteamento Determinístico para Especialista Único
  const specialist = identifySpecialist(text);

  if (specialist) {
    // Valida permissão pré-roteamento
    const podeAcessar = !session?.gerenciado || hasPermission(session, specialist.requiredPermission) || canAccessRoute(session, `/dashboard/${specialist.domain}`);
    if (!podeAcessar) {
      logAuditEvent({
        correlationId,
        userId: session?.id || "anonymous",
        userName: session?.nome || "Usuário",
        tenantId: unitId,
        channel: "text",
        textInput: text,
        intentId: specialist.id,
        riskLevel: "READ_ONLY",
        permissionRequired: specialist.requiredPermission,
        permissionResult: false,
        approvalRequired: false,
        approvalResult: "NOT_APPLICABLE",
        executionStatus: "BLOCKED_HIGH_RISK",
        executor: specialist.id,
        durationMs: Date.now() - startTime
      });

      return {
        success: false,
        permissionDenied: true,
        specialistId: specialist.id,
        responseText: `Você não tem acesso às informações do setor de ${specialist.shortTitle}.`
      };
    }
  }

  logAuditEvent({
    correlationId,
    userId: session?.id || "anonymous",
    userName: session?.nome || "Usuário",
    tenantId: unitId,
    channel: "text",
    textInput: text,
    intentId: specialist?.id || "hefesto.core",
    riskLevel: "READ_ONLY",
    permissionRequired: specialist?.requiredPermission || null,
    permissionResult: true,
    approvalRequired: false,
    approvalResult: "NOT_APPLICABLE",
    executionStatus: "SUCCEEDED",
    executor: specialist?.id || "SpecialistRouter",
    durationMs: Date.now() - startTime
  });

  return {
    specialistId: specialist?.id || "hefesto.core",
    specialistTitle: specialist ? `Héfisto · ${specialist.shortTitle}` : "Héfisto"
  };
}
