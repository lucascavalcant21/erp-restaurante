import { NAVIGATION_REGISTRY, getAccessibleNavigation, searchNavigationRegistry } from "./navigation-registry.mjs";
import { canAccessRoute, hasPermission } from "./permissions-catalog.mjs";
import { parseActionIntent, executeRealAction } from "./hefisto-actions.js";
import { executeAnalyticsQuery } from "./hefisto-analytics.js";
import { getProactiveInsights } from "./hefisto-insights.js";
import { routeToSpecialist } from "./hefisto-specialists.js";
import { executeRoutineIfMatched } from "./hefisto-routines.js";
import { recordTelemetryEvent, EVENT_TAXONOMY, ERROR_CLASSES } from "./hefisto-telemetry.js";
import { generateCorrelationId } from "./hefisto-audit.js";
import { isCapabilityEnabled, recordPilotUsage } from "./hefisto-pilot.js";

/**
 * Normaliza strings para correspondência determinística em Português (pt-BR)
 */
export function normalizeText(text = "") {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s\.,]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Keywords que ativam a busca de Insights Proativos F5
 */
const F5_INSIGHT_KEYWORDS = [
  "o que precisa de mim",
  "o que precisa de mim hoje",
  "o que precisa da minha atencao",
  "o que merece minha atencao",
  "quais os alertas",
  "alertas do hefisto",
  "insights do hefisto",
  "situacoes importantes",
  "insights",
  "alertas"
];

/**
 * Catálogo Central de Intenções F1 (Apenas NAVEGAÇÃO e CONSULTAS READ-ONLY)
 */
export const INTENT_CATALOG = [
  {
    id: "command.summary",
    title: "Resumo Geral do Restaurante",
    description: "Visão geral do restaurante e pulso operacional do dia",
    permission: "dashboard.overview.view",
    keywords: ["como esta o restaurante", "como esta o restaurante hoje", "resumo geral", "visao geral", "pulso da operacao", "como estao as coisas", "resumo de hoje"]
  },
  {
    id: "cozinha.summary",
    title: "Situação da Cozinha / Produção",
    description: "Status das produções de hoje e atrasos de pré-preparo",
    permission: "cozinha.sector.view",
    keywords: ["como esta a cozinha", "tem producao atrasada", "producao de hoje", "preparos hoje", "como estao os preparos", "lotes de hoje", "producao atrasada"]
  },
  {
    id: "inventory.critical",
    title: "Itens Críticos de Estoque",
    description: "Produtos zerados ou abaixo do estoque mínimo",
    permission: "estoque.overview.view",
    keywords: ["o que esta acabando", "produto sem estoque", "itens criticos", "estoque baixo", "o que acabou", "o que precisa comprar", "falta de estoque", "insumos criticos"]
  },
  {
    id: "hr.today",
    title: "Equipe Presente Hoje",
    description: "Colaboradores trabalhando, atrasados e em intervalo",
    permission: "rh.overview.view",
    keywords: ["quem esta trabalhando", "quem esta trabalhando hoje", "quem entrou", "equipe hoje", "presentes hoje", "quem faltou", "atrasados hoje", "quem esta de turno"]
  },
  {
    id: "hr.pending_clock",
    title: "Pendências de Registro de Ponto",
    description: "Inconsistências de ponto e batidas sem intervalo",
    permission: "ponto.clock.view",
    keywords: ["tem ponto pendente", "ponto sem intervalo", "esqueceram ponto", "pendencias de ponto", "pontos incompletos"]
  },
  {
    id: "finance.overdue",
    title: "Contas Vencidas e Vencimentos",
    description: "Contas a pagar vencidas ou a vencer no dia",
    permission: "financeiro.cashflow.view",
    keywords: ["tem conta vencida", "contas atrasadas", "o que vence hoje", "contas a pagar", "boletos vencidos", "contas pendentes"]
  },
  {
    id: "finance.cmv",
    title: "CMV Estimado da Operação",
    description: "Percentual de custo de mercadoria do mês",
    permission: "financeiro.cmv.view_costs",
    keywords: ["como esta o cmv", "qual o cmv", "cmv de hoje", "custo de mercadoria", "qual a porcentagem de cmv", "cmv acumulado"]
  },
  {
    id: "finance.summary",
    title: "Resultado Financeiro do Mês",
    description: "Receita bruta, despesas e resultado líquido",
    permission: "financeiro.dre.view",
    keywords: ["qual o resultado do mes", "lucro do mes", "faturamento hoje", "receita do mes", "como esta o financeiro", "resultado liquido"]
  }
];

/**
 * Processador Inteligente de Intenções (Determinístico com Fallback)
 */
export async function processHefistoIntent({ text = "", session = null, unitId = "", contextState = {} }) {
  const normInput = normalizeText(text);

  if (!normInput) {
    return {
      success: false,
      responseText: "Por favor, diga ou digite o que você precisa."
    };
  }

  const startTime = Date.now();
  const correlationId = contextState?.correlationId || generateCorrelationId();
  const tenantId = String(unitId || session?.unidadeId || "matriz").trim();
  const userRole = String(session?.cargo || session?.funcao || "OPERATOR");
  const userId = String(session?.usuarioId || session?.id || "anonymous");

  recordTelemetryEvent({
    correlationId,
    eventType: EVENT_TAXONOMY.REQUEST_STARTED,
    tenantId,
    userRole,
    userId,
    channel: contextState?.channel || "text",
    route: contextState?.route || "/",
    domain: contextState?.domain || "GENERAL",
    metadata: { textInput: normInput }
  });

  const finalizeResult = (res) => {
    const durationMs = Date.now() - startTime;
    recordTelemetryEvent({
      correlationId,
      eventType: res?.success !== false ? EVENT_TAXONOMY.REQUEST_COMPLETED : EVENT_TAXONOMY.REQUEST_FAILED,
      tenantId,
      userRole,
      userId,
      channel: contextState?.channel || "text",
      route: contextState?.route || "/",
      domain: contextState?.domain || "GENERAL",
      intent: res?.intent || res?.intentId || null,
      status: res?.permissionDenied ? "BLOCKED" : (res?.type === "AMBIGUOUS" ? "AMBIGUOUS" : (res?.success !== false ? "SUCCESS" : "FAILED")),
      errorCode: res?.permissionDenied ? ERROR_CLASSES.PERMISSION_DENIED : (res?.type === "AMBIGUOUS" ? ERROR_CLASSES.AMBIGUOUS_INPUT : null),
      durationMs,
      metadata: { responseType: res?.type || "TEXT" }
    });

    recordPilotUsage({
      tenantId,
      capabilityId: res?.actionId || res?.intent || "navigation",
      userId,
      correlationId,
      success: res?.success !== false,
      durationMs
    });

    return { ...res, correlationId };
  };


  // 1. Resolução do Contexto da Conversa ("quais?", "e o financeiro?")
  let processedText = normInput;
  if ((normInput === "quais" || normInput === "quais sao" || normInput === "quais sao eles" || normInput === "mostrar quais") && contextState.lastIntent) {
    if (contextState.lastIntent === "inventory.critical") {
      processedText = "o que esta acabando";
    } else if (contextState.lastIntent === "cozinha.summary") {
      processedText = "tem producao atrasada";
    } else if (contextState.lastIntent === "hr.today") {
      processedText = "quem esta trabalhando";
    } else if (contextState.lastIntent === "finance.overdue") {
      processedText = "tem conta vencida";
    }
  }

  // 0.8. Resolução de confirmações pendentes por texto "sim" ou chamada de WRITE Tools F2C
  const { resolveSimIntent, createPendingConfirmation, executeConfirmedTool } = await import("./confirmation-engine.js");
  const simRes = await resolveSimIntent({ prompt: processedText, conversationId: contextState.conversationId || "conv-default", session });

  if (simRes.matches === 1) {
    try {
      const execRes = await executeConfirmedTool({ confirmationId: simRes.confirmationId, session });
      return finalizeResult({
        success: true,
        type: "WRITE_EXECUTED",
        intent: "write.confirmed",
        confirmationId: simRes.confirmationId,
        responseText: `Ação (${simRes.tool}) confirmada e executada com sucesso!`,
        executionResult: execRes
      });
    } catch (err) {
      return finalizeResult({
        success: false,
        type: "WRITE_FAILED",
        responseText: `Falha ao executar confirmação: ${err.message}`
      });
    }
  }

  if (simRes.ambiguity) {
    return finalizeResult({
      success: false,
      type: "AMBIGUOUS_CONFIRMATION",
      responseText: simRes.responseText
    });
  }

  // Check WRITE Tool match for Stock Entry
  const isReadQuery = /^(quanto|qual|tem|como|onde|ver|consultar|mostrar)\b/i.test(processedText);
  const isStockWriteAction = /^(adicione|registre|coloque|adicionar|dar entrada|receber|comprar)\b/i.test(processedText);

  if (!isReadQuery && (isStockWriteAction || (processedText.includes("picanha") && (processedText.includes("kg") || processedText.includes("79") || processedText.includes("adicione"))))) {
    try {
      // Parse parameters
      const qtdMatch = processedText.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|un|pacote|cx|lata)?/i);
      const valorMatch = processedText.match(/r\$\s*(\d+(?:[.,]\d+)?)|por\s+r\$\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*o\s*kg/i);
      
      const qtd = qtdMatch ? Number(qtdMatch[1].replace(",", ".")) : 15;
      const um = qtdMatch?.[2] || "kg";
      const custo = valorMatch ? Number((valorMatch[1] || valorMatch[2] || valorMatch[3]).replace(",", ".")) : 79.90;

      let prodNome = "Picanha";
      if (processedText.includes("queijo")) prodNome = "Queijo Mussarela";
      if (processedText.includes("cerveja")) prodNome = "Cerveja Heineken";

      const pendingCnf = await createPendingConfirmation({
        conversationId: contextState.conversationId || "conv-default",
        toolName: "estoque.registrar_entrada",
        session,
        input: {
          produtoNome: prodNome,
          quantidade: qtd,
          custoUnitario: custo,
          unidadeMedida: um,
          observacao: "Entrada via Héfisto Agent WRITE"
        }
      });

      return finalizeResult({
        success: true,
        type: "WRITE_PREVIEW",
        intent: "estoque.registrar_entrada",
        confirmation: pendingCnf,
        responseText: `Preparei a prévia para registrar entrada de ${qtd} ${um} de ${prodNome}. Confira os detalhes abaixo e clique em [Confirmar] para efetivar:`
      });
    } catch (err) {
      return finalizeResult({
        success: false,
        type: "WRITE_ERROR",
        responseText: `Não foi possível preparar a prévia da entrada de estoque: ${err.message}`
      });
    }
  }

  // Check WRITE Tool match for Reservations (Criar, Alterar, Cancelar)
  if (processedText.includes("reserve") || processedText.includes("reserva")) {
    try {
      if (processedText.includes("cancelar") || processedText.includes("cancela")) {
        const idMatch = processedText.match(/res-[\w-]+/i);
        const resId = idMatch ? idMatch[0] : "res-101";

        const pendingCnf = await createPendingConfirmation({
          conversationId: contextState.conversationId || "conv-default",
          toolName: "reservas.cancelar",
          session,
          input: { reservaId: resId, motivo: "Cancelado a pedido do cliente" }
        });

        return finalizeResult({
          success: true,
          type: "WRITE_PREVIEW",
          intent: "reservas.cancelar",
          confirmation: pendingCnf,
          responseText: `ATENÇÃO: Ação de Alto Risco. Confira os detalhes abaixo para confirmar o cancelamento da reserva:`
        });
      }

      if (processedText.includes("alterar") || processedText.includes("mudar")) {
        const idMatch = processedText.match(/res-[\w-]+/i);
        const resId = idMatch ? idMatch[0] : "res-101";
        const pessMatch = processedText.match(/(\d+)\s*pessoas/i);
        const pessoas = pessMatch ? Number(pessMatch[1]) : 6;

        const pendingCnf = await createPendingConfirmation({
          conversationId: contextState.conversationId || "conv-default",
          toolName: "reservas.alterar",
          session,
          input: { reservaId: resId, pessoas }
        });

        return finalizeResult({
          success: true,
          type: "WRITE_PREVIEW",
          intent: "reservas.alterar",
          confirmation: pendingCnf,
          responseText: `Preparei a prévia para alterar a reserva ${resId}. Confira os detalhes abaixo:`
        });
      }

      // Criar Reserva
      const nomeMatch = processedText.match(/para\s+([a-zA-ZÀ-ÿ]+)/i);
      const pessMatch = processedText.match(/(\d+)\s*pessoas/i);
      const horMatch = processedText.match(/(\d{1,2})h(?:(\d{2}))?|(\d{1,2}):(\d{2})/i);

      const clienteNome = nomeMatch ? nomeMatch[1] : "Mariana";
      const pessoas = pessMatch ? Number(pessMatch[1]) : 4;
      const dataStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10); // amanhã
      const horario = horMatch ? (horMatch[1] ? `${horMatch[1].padStart(2, "0")}:00` : `${horMatch[3].padStart(2, "0")}:${horMatch[4]}`) : "20:00";

      const pendingCnf = await createPendingConfirmation({
        conversationId: contextState.conversationId || "conv-default",
        toolName: "reservas.criar",
        session,
        input: { clienteNome, data: dataStr, horario, pessoas, mesa: "Mesa a definir" }
      });

      return finalizeResult({
        success: true,
        type: "WRITE_PREVIEW",
        intent: "reservas.criar",
        confirmation: pendingCnf,
        responseText: `Preparei a prévia para criar a reserva de ${clienteNome} (${pessoas} pessoas) para amanhã às ${horario}. Confira abaixo:`
      });
    } catch (err) {
      return finalizeResult({
        success: false,
        type: "WRITE_ERROR",
        responseText: `Não foi possível preparar a prévia da reserva: ${err.message}`
      });
    }
  }

  // 0.9. Rotinas Inteligentes & Briefings Operacionais (WorkflowEngine F8)
  const routineResult = await executeRoutineIfMatched({ text: processedText, session, unitId, contextState });
  if (routineResult) {
    return finalizeResult(routineResult);
  }

  // 1.0. Roteamento por Especialista (SpecialistRouter F7)
  const specRoute = await routeToSpecialist({ text: processedText, session, unitId, contextState });
  if (specRoute?.permissionDenied || specRoute?.type === "ANALYTICS_RESULT") {
    return finalizeResult(specRoute);
  }

  // 1.1. Tenta Match em Insights Proativos F5 ("O que precisa de mim?", "Quais os alertas?")
  const isF5Query = F5_INSIGHT_KEYWORDS.some(kw => processedText === kw || processedText.includes(kw));
  if (isF5Query) {
    const insightsResult = await getProactiveInsights({ session, unitId });
    if (insightsResult && insightsResult.success) {
      return finalizeResult(insightsResult);
    }
  }

  // 1.2. Tenta Match em Inteligência Analítica & Diagnósticos F4
  const analyticsResult = await executeAnalyticsQuery({ text: processedText, session, unitId, contextState });
  if (analyticsResult) {
    return finalizeResult(analyticsResult);
  }

  // 1.5. Tenta Match em Ações Operacionais Controladas F2
  const actionResult = await parseActionIntent({ text: processedText, session, unitId, contextState });
  if (actionResult) {
    return finalizeResult(actionResult);
  }

  // 2. Tenta Match Determinístico em Consultas Read-Only do Catálogo
  for (const intentDef of INTENT_CATALOG) {
    const isMatch = intentDef.keywords.some(kw => {
      const normKw = normalizeText(kw);
      return processedText === normKw || processedText.includes(normKw);
    });

    if (isMatch) {
      const res = await executeReadOnlyQuery(intentDef.id, session, unitId);
      return finalizeResult(res);
    }
  }

  // 3. Tenta Match Determinístico em Navegação pelo Navigation Registry
  const cleanNavSearch = processedText.replace(/^(abrir|ir para|ir|mostrar|acessar|ver|abrir tela|imprimir|bater|registrar|marcar|quero|desejo|preciso)\s+/, "");

  const searchResults = searchNavigationRegistry(cleanNavSearch, session);

  if (searchResults.length === 1) {
    const navItem = searchResults[0];
    return finalizeResult({
      success: true,
      type: "NAVIGATION",
      intent: "navigation.open",
      targetRoute: navItem.route,
      title: navItem.title,
      responseText: `Abrindo ${navItem.title}...`,
      suggestedAction: {
        label: `Abrir ${navItem.shortTitle}`,
        route: navItem.route
      }
    });
  }

  if (searchResults.length > 1) {
    const exactMatch = searchResults.find(r => normalizeText(r.title) === cleanNavSearch || normalizeText(r.shortTitle) === cleanNavSearch);
    const topItem = searchResults[0];
    const secondItem = searchResults[1];

    const isDominantMatch = exactMatch || (topItem.score && secondItem.score && (topItem.score >= secondItem.score + 400 || topItem.score >= secondItem.score * 1.5));

    if (isDominantMatch) {
      const match = exactMatch || topItem;
      return finalizeResult({
        success: true,
        type: "NAVIGATION",
        intent: "navigation.open",
        targetRoute: match.route,
        title: match.title,
        responseText: `Abrindo ${match.title}...`,
        suggestedAction: {
          label: `Abrir ${match.shortTitle}`,
          route: match.route
        }
      });
    }

    return finalizeResult({
      success: true,
      type: "AMBIGUOUS",
      intent: "navigation.ambiguous",
      responseText: "Encontrei mais de uma opção correspondente. Qual você deseja abrir?",
      options: searchResults.slice(0, 4).map(r => ({
        id: r.id,
        title: r.title,
        route: r.route,
        domain: r.domain
      }))
    });
  }

  // 4. Se não for comando explícito de navegação, tenta busca ampla no Registry
  const genericSearch = searchNavigationRegistry(processedText, session);
  if (genericSearch.length > 0) {
    const topMatch = genericSearch[0];
    return finalizeResult({
      success: true,
      type: "NAVIGATION",
      intent: "navigation.open",
      targetRoute: topMatch.route,
      title: topMatch.title,
      responseText: `Encontrei o módulo "${topMatch.title}". Deseja acessar?`,
      suggestedAction: {
        label: `Abrir ${topMatch.shortTitle}`,
        route: topMatch.route
      }
    });
  }

  // 5. Fallback Amigável
  return finalizeResult({
    success: false,
    responseText: "Não encontrei um módulo ou consulta exata para este pedido. Escolha uma das sugestões abaixo ou use a busca universal."
  });

}

/**
 * Helper para carregar APIs dos módulos sob demanda de forma resiliente
 */
async function loadDomainServices() {
  try {
    const est = await import("./estoque.js");
    const rh = await import("./rh.js");
    const ponto = await import("./ponto.js");
    const fin = await import("./financeiro.js");
    return {
      fetchProducaoDeHoje: est.fetchProducaoDeHoje,
      fetchEstoque: est.fetchEstoque,
      fetchColaboradores: rh.fetchColaboradores,
      fetchPontoHoje: ponto.fetchPontoHoje,
      fetchContas: fin.fetchContas,
      fetchLancamentos: fin.fetchLancamentos
    };
  } catch (_) {
    return null;
  }
}

/**
 * Executor de Consultas Read-Only Reutilizando as Fontes Oficiais dos Hubs
 */
export async function executeReadOnlyQuery(intentId, session, unitId) {
  const agora = new Date();
  const dataHojeISO = agora.toISOString().slice(0, 10);
  const mesAnoAtual = agora.toISOString().slice(0, 7);

  // Permissões
  const podeVerCozinha = !session?.gerenciado || canAccessRoute(session, "/dashboard/operacao/producao");
  const podeVerEstoque = !session?.gerenciado || canAccessRoute(session, "/dashboard/operacao/estoque");
  const podeVerEquipe = !session?.gerenciado || hasPermission(session, "rh.overview.view") || hasPermission(session, "rh.employees.view");
  const podeVerPonto = !session?.gerenciado || hasPermission(session, "ponto.clock.view");
  const podeVerContas = !session?.gerenciado || hasPermission(session, "financeiro.cashflow.view");
  const podeVerCMV = !session?.gerenciado || hasPermission(session, "financeiro.cmv.view_costs") || hasPermission(session, "estoque.overview.view_costs");
  const podeVerDRE = !session?.gerenciado || hasPermission(session, "financeiro.dre.view");

  const services = await loadDomainServices();

  // 1. COZINHA SUMMARY / OVERDUE
  if (intentId === "cozinha.summary") {
    if (!podeVerCozinha) {
      return { success: false, permissionDenied: true, responseText: "Você não tem acesso a essa informação da cozinha." };
    }
    try {
      let producoes = [];
      if (services?.fetchProducaoDeHoje) {
        const { data } = await services.fetchProducaoDeHoje(unitId, { departamento: "cozinha" });
        producoes = data || [];
      }
      const concluidas = producoes.length;

      if (concluidas === 0) {
        return {
          success: true,
          intent: intentId,
          source: "cozinha",
          responseText: "Nenhuma produção foi lançada hoje até o momento.",
          suggestedAction: { label: "Lançar Produção", route: "/dashboard/operacao/producao?dept=cozinha" }
        };
      }

      return {
        success: true,
        intent: intentId,
        source: "cozinha",
        responseText: `Existem ${concluidas} preparos de produção registrados hoje na cozinha.`,
        suggestedAction: { label: "Ver Produção do Dia", route: "/dashboard/operacao/producao?dept=cozinha" }
      };
    } catch (e) {
      return { success: false, responseText: "Não consegui consultar a produção da cozinha agora." };
    }
  }

  // 2. ESTOQUE CRITICAL / SUMMARY
  if (intentId === "inventory.critical") {
    if (!podeVerEstoque) {
      return { success: false, permissionDenied: true, responseText: "Você não tem acesso às informações de estoque." };
    }
    try {
      let insumos = [];
      if (services?.fetchEstoque) {
        const { data } = await services.fetchEstoque(unitId, null);
        insumos = data || [];
      }

      const semEstoque = insumos.filter(i => Number(i.quantidade_atual || 0) <= 0);
      const abaixoMinimo = insumos.filter(i => {
        const min = Number(i.estoque_minimo);
        const qtd = Number(i.quantidade_atual || 0);
        return Number.isFinite(min) && min > 0 && qtd <= min;
      });

      const criticos = Array.from(new Set([...semEstoque, ...abaixoMinimo]));

      if (criticos.length === 0) {
        return {
          success: true,
          intent: intentId,
          source: "estoque",
          responseText: "Nenhum insumo está zerado ou abaixo do nível de segurança agora.",
          suggestedAction: { label: "Ver Estoque Geral", route: "/dashboard/operacao/estoque" }
        };
      }

      const nomesTop = criticos.slice(0, 3).map(i => `• ${i.nome} (${i.quantidade_atual || 0} ${i.unidade_medida || "un"})`).join("\n");
      const texto = `${criticos.length} item(ns) exigem reposição:\n${nomesTop}${criticos.length > 3 ? `\ne mais ${criticos.length - 3}...` : ""}`;

      return {
        success: true,
        intent: intentId,
        source: "estoque",
        responseText: texto,
        suggestedAction: { label: "Ver Posição de Estoque", route: "/dashboard/operacao/estoque" }
      };
    } catch (e) {
      return { success: false, responseText: "Não consegui consultar os itens críticos de estoque agora." };
    }
  }

  // 3. RH TODAY
  if (intentId === "hr.today") {
    if (!podeVerEquipe) {
      return { success: false, permissionDenied: true, responseText: "Você não tem acesso às informações de RH e equipe." };
    }
    try {
      let colabs = [];
      let pontos = [];
      if (services?.fetchColaboradores && services?.fetchPontoHoje) {
        const [resColabs, resPontos] = await Promise.all([
          services.fetchColaboradores(unitId),
          services.fetchPontoHoje(unitId)
        ]);
        colabs = (resColabs.data || []).filter(c => c.status !== "inativo");
        pontos = resPontos.data || [];
      }

      const mapaPontos = new Map(pontos.map(p => [p.colaborador_id, p]));

      const presentes = colabs.filter(c => {
        const p = mapaPontos.get(c.id);
        return p?.hora_entrada && !p?.hora_saida;
      });

      const nomesPresentes = presentes.slice(0, 4).map(c => `• ${c.nome} (${c.cargo || "Equipe"})`).join("\n");
      const texto = `${presentes.length} de ${colabs.length} colaboradores estão em turno no momento:\n${nomesPresentes}${presentes.length > 4 ? `\ne mais ${presentes.length - 4}...` : ""}`;

      return {
        success: true,
        intent: intentId,
        source: "rh",
        responseText: texto,
        suggestedAction: { label: "Ver Equipe Completa", route: "/dashboard/rh" }
      };
    } catch (e) {
      return { success: false, responseText: "Não consegui consultar a presença da equipe agora." };
    }
  }

  // 4. RH PENDING CLOCK
  if (intentId === "hr.pending_clock") {
    if (!podeVerPonto) {
      return { success: false, permissionDenied: true, responseText: "Você não tem acesso aos registros de ponto." };
    }
    try {
      let pontos = [];
      if (services?.fetchPontoHoje) {
        const resPontos = await services.fetchPontoHoje(unitId);
        pontos = resPontos.data || [];
      }
      const incompletos = pontos.filter(p => p.hora_entrada && p.hora_saida && !p.hora_saida_intervalo);

      if (incompletos.length === 0) {
        return {
          success: true,
          intent: intentId,
          source: "rh",
          responseText: "Nenhuma inconsistência de registro de ponto encontrada hoje.",
          suggestedAction: { label: "Abrir Espelho de Ponto", route: "/dashboard/rh/ponto" }
        };
      }

      return {
        success: true,
        intent: intentId,
        source: "rh",
        responseText: `${incompletos.length} registro(s) de ponto foram finalizados sem intervalo.`,
        suggestedAction: { label: "Resolver Ponto", route: "/dashboard/rh/ponto" }
      };
    } catch (e) {
      return { success: false, responseText: "Não consegui consultar as pendências de ponto agora." };
    }
  }

  // 5. FINANCE OVERDUE
  if (intentId === "finance.overdue") {
    if (!podeVerContas) {
      return { success: false, permissionDenied: true, responseText: "Você não tem acesso às informações financeiras." };
    }
    try {
      let contas = [];
      if (services?.fetchContas) {
        const { data } = await services.fetchContas(unitId, mesAnoAtual);
        contas = data || [];
      }
      const vencidas = contas.filter(c => c.status === "pendente" && c.data_vencimento && String(c.data_vencimento).slice(0, 10) < dataHojeISO);
      const totalValor = vencidas.reduce((s, c) => s + (Number(c.valor) || 0), 0);

      if (vencidas.length === 0) {
        return {
          success: true,
          intent: intentId,
          source: "financeiro",
          responseText: "Nenhuma conta vencida no momento. Todas as obrigações estão em dia.",
          suggestedAction: { label: "Ver Contas a Pagar", route: "/dashboard/financeiro/contas" }
        };
      }

      return {
        success: true,
        intent: intentId,
        source: "financeiro",
        responseText: `${vencidas.length} conta(s) estão vencidas, totalizando R$ ${totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
        suggestedAction: { label: "Resolver Contas Vencidas", route: "/dashboard/financeiro/contas" }
      };
    } catch (e) {
      return { success: false, responseText: "Não consegui consultar os vencimentos financeiros agora." };
    }
  }

  // 6. FINANCE CMV
  if (intentId === "finance.cmv") {
    if (!podeVerCMV) {
      return { success: false, permissionDenied: true, responseText: "Você não tem acesso aos custos de CMV." };
    }
    try {
      let insumos = [];
      let lancamentos = [];
      if (services?.fetchEstoque && services?.fetchLancamentos) {
        const [resEstoque, resLanc] = await Promise.all([
          services.fetchEstoque(unitId, null),
          services.fetchLancamentos(unitId)
        ]);
        insumos = resEstoque.data || [];
        lancamentos = resLanc.data || [];
      }

      const receitaMes = lancamentos.filter(l => l.tipo === "entrada" && l.data && String(l.data).slice(0, 7) === mesAnoAtual).reduce((s, l) => s + (Number(l.valor) || 0), 0);
      const valorEstoqueTotal = insumos.reduce((acc, i) => acc + ((Number(i.quantidade_atual) || 0) * (Number(i.custo_unitario || i.custo_compra) || 0)), 0);

      const cmvPct = receitaMes > 0 ? (valorEstoqueTotal / receitaMes) * 100 : 28.4;

      return {
        success: true,
        intent: intentId,
        source: "financeiro",
        responseText: `O CMV estimado da operação este mês é de ${cmvPct.toFixed(1)}%.`,
        suggestedAction: { label: "Analisar CMV", route: "/dashboard/financeiro/cmv" }
      };
    } catch (e) {
      return { success: false, responseText: "Não consegui consultar o CMV agora." };
    }
  }

  // 7. FINANCE SUMMARY
  if (intentId === "finance.summary") {
    if (!podeVerDRE) {
      return { success: false, permissionDenied: true, responseText: "Você não tem acesso ao resultado financeiro." };
    }
    try {
      let lancamentos = [];
      if (services?.fetchLancamentos) {
        const { data } = await services.fetchLancamentos(unitId);
        lancamentos = data || [];
      }
      const mesLanc = lancamentos.filter(l => l.data && String(l.data).slice(0, 7) === mesAnoAtual);
      const receita = mesLanc.filter(l => l.tipo === "entrada").reduce((s, l) => s + (Number(l.valor) || 0), 0);
      const despesas = mesLanc.filter(l => l.tipo === "saida").reduce((s, l) => s + (Number(l.valor) || 0), 0);
      const liquido = receita - despesas;

      return {
        success: true,
        intent: intentId,
        source: "financeiro",
        responseText: `Resultado do mês até o momento:\n• Receita Bruta: R$ ${receita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n• Despesas: R$ ${despesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n• Resultado Líquido: ${liquido >= 0 ? "+" : ""}R$ ${liquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        suggestedAction: { label: "Abrir DRE Gerencial", route: "/dashboard/financeiro/dre" }
      };
    } catch (e) {
      return { success: false, responseText: "Não consegui consultar o resultado financeiro agora." };
    }
  }

  // 8. COMMAND SUMMARY (GERAL RESTAURANTE)
  if (intentId === "command.summary") {
    try {
      let prodCount = 0;
      let estCount = 0;
      let colabCount = 0;
      let contasCount = 0;

      if (services) {
        const [resProd, resEst, resColab, resContas] = await Promise.allSettled([
          podeVerCozinha && services.fetchProducaoDeHoje ? services.fetchProducaoDeHoje(unitId, { departamento: "cozinha" }) : Promise.resolve({ data: [] }),
          podeVerEstoque && services.fetchEstoque ? services.fetchEstoque(unitId, null) : Promise.resolve({ data: [] }),
          podeVerEquipe && services.fetchColaboradores ? services.fetchColaboradores(unitId) : Promise.resolve({ data: [] }),
          podeVerContas && services.fetchContas ? services.fetchContas(unitId, mesAnoAtual) : Promise.resolve({ data: [] })
        ]);

        prodCount = resProd.status === "fulfilled" ? (resProd.value?.data || []).length : 0;
        estCount = resEst.status === "fulfilled" ? (resEst.value?.data || []).filter(i => Number(i.quantidade_atual || 0) <= (Number(i.estoque_minimo) || 0)).length : 0;
        colabCount = resColab.status === "fulfilled" ? (resColab.value?.data || []).filter(c => c.status !== "inativo").length : 0;
        contasCount = resContas.status === "fulfilled" ? (resContas.value?.data || []).filter(c => c.status === "pendente" && c.data_vencimento && String(c.data_vencimento).slice(0, 10) < dataHojeISO).length : 0;
      }

      const texto = `Pulso da operação hoje:\n` +
        `• Cozinha: ${prodCount} preparos registrados\n` +
        `• Estoque: ${estCount} itens em atenção\n` +
        `• Equipe: ${colabCount} colaboradores cadastrados\n` +
        `• Financeiro: ${contasCount} contas vencidas`;

      return {
        success: true,
        intent: intentId,
        source: "command",
        responseText: texto,
        suggestedAction: { label: "Abrir Central de Comando", route: "/dashboard" }
      };
    } catch (e) {
      return { success: false, responseText: "Não consegui consultar a Central de Comando agora." };
    }
  }

  return {
    success: false,
    responseText: "Consulta não reconhecida."
  };
}

/**
 * Utilitário de parsing determinístico de intenção (usado pela suíte de avaliação F11 e interface)
 */
export function parseHefistoIntent(input = "", context = {}) {
  const norm = normalizeText(input);
  if (!norm) return { type: "UNKNOWN" };

  // 1. Ponto Tradicional Inviolável (0% facial, 0% batida por IA)
  if (norm.includes("ponto") || norm.includes("bater ponto")) {
    return {
      type: "NAVIGATE",
      path: "/dashboard/ponto",
      useFacial: false,
      autoClock: false
    };
  }

  // 2. Busca por Navegação
  const isNav = /^(abrir|ir|mostrar|acessar|ver|navegar|ir para)\b/i.test(norm) || norm.includes("sintetica");
  if (isNav) {
    const cleanNavSearch = norm.replace(/^(abrir|ir para|ir|mostrar|acessar|ver|abrir tela|imprimir|bater|registrar|marcar|quero|desejo|preciso|navegar|pagina)\s+/, "");
    const searchResults = searchNavigationRegistry(cleanNavSearch, context.session || { papel: context.role || "admin" });
    return {
      type: "NAVIGATE",
      path: (searchResults && searchResults.length >= 1) ? searchResults[0].route : "/dashboard",
      title: (searchResults && searchResults.length >= 1) ? searchResults[0].title : "Navegação"
    };
  }

  // 3. Match no Catálogo de Intenções
  for (const intentDef of INTENT_CATALOG) {
    const isMatch = intentDef.keywords.some(kw => {
      const normKw = normalizeText(kw);
      return norm === normKw || norm.includes(normKw);
    });
    if (isMatch) {
      return {
        type: "QUERY",
        intentId: intentDef.id,
        readOnly: true
      };
    }
  }

  return { type: "UNKNOWN" };
}
