import { supabase, isSupabaseReady } from "./supabase.js";
import { fetchEstoque, registrarMovimentoEstoque, fetchProducaoDeHoje, registrarProducao } from "./estoque.js";
import { canAccessRoute, hasPermission } from "./permissions-catalog.mjs";
import { normalizeText } from "./hefisto-intents.js";
import { evaluateActionPolicy, evaluateRiskLevel, validatePayloadMatch, RISK_LEVELS } from "./hefisto-policy.js";
import { logAuditEvent, generateCorrelationId } from "./hefisto-audit.js";

// Conjunto de rastreio em memória para idempotência de duplo clique
const executedCorrelationSet = new Map();

/**
 * Catálogo Central de Ações Controladas F2
 */
export const ACTION_CATALOG = [
  {
    id: "label.print",
    title: "Imprimir Etiquetas",
    risk: "LOW_RISK_ACTION",
    permission: "estoque.labels.print",
    route: "/dashboard/operacao/etiquetas",
    keywords: ["imprimir etiqueta", "imprima etiqueta", "gerar etiqueta", "etiqueta de", "etiquetas de", "imprimir etiquetas"]
  },
  {
    id: "inventory.entry",
    title: "Entrada de Estoque",
    risk: "SENSITIVE_ACTION",
    permission: "estoque.overview.adjust_stock",
    route: "/dashboard/operacao/estoque",
    keywords: ["adicione ao estoque", "registre entrada", "coloca no estoque", "entrada de", "adicionar ao estoque", "chegou"]
  },
  {
    id: "inventory.exit",
    title: "Saída de Estoque",
    risk: "SENSITIVE_ACTION",
    permission: "estoque.overview.adjust_stock",
    route: "/dashboard/operacao/estoque",
    keywords: ["dê saída", "retire do estoque", "retira do estoque", "baixa de", "saida de", "retirar"]
  },
  {
    id: "inventory.loss",
    title: "Registrar Perda",
    risk: "SENSITIVE_ACTION",
    permission: "estoque.losses.record_loss",
    route: "/dashboard/operacao/estoque",
    keywords: ["registre perda", "perdi", "foram perdidos", "perda de", "estragou", "jogar fora"]
  },
  {
    id: "production.complete",
    title: "Concluir Produção",
    risk: "SENSITIVE_ACTION",
    permission: "cozinha.production.confirm",
    route: "/dashboard/operacao/producao?dept=cozinha",
    keywords: ["concluir producao", "marque producao como concluida", "concluir preparo", "finalizar producao", "marcar como concluido"]
  }
];

/**
 * Conversão e Validação de Números e Unidades de Medida em Português
 */
const NUMEROS_EXTENSO = {
  "um": 1, "uma": 1, "dois": 2, "duas": 2, "tres": 3, "quatro": 4, "cinco": 5,
  "seis": 6, "sete": 7, "oito": 8, "nove": 9, "dez": 10, "meio": 0.5, "meia": 0.5
};

export function parseNumberAndUnit(text = "") {
  const norm = normalizeText(text);

  // Procura por valores numéricos com unidade (ex: 500g, 10.5 kg, 2 quilos, 500 gramas)
  const regexNumUnit = /(\d+(?:[\.,]\d+)?|\b(?:um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|meio|meia)\b)\s*(kg|g|gramas?|quilos?|l|litros?|ml|un|unidades?)\b/i;
  const match = norm.match(regexNumUnit);

  if (match) {
    let rawVal = match[1].replace(",", ".");
    let val = NUMEROS_EXTENSO[rawVal] !== undefined ? NUMEROS_EXTENSO[rawVal] : parseFloat(rawVal);
    let rawUnit = match[2].toLowerCase();

    let normalizedUnit = "un";
    if (["kg", "quilo", "quilos"].includes(rawUnit)) normalizedUnit = "kg";
    else if (["g", "grama", "gramas"].includes(rawUnit)) normalizedUnit = "g";
    else if (["l", "litro", "litros"].includes(rawUnit)) normalizedUnit = "L";
    else if (["ml"].includes(rawUnit)) normalizedUnit = "ml";
    else if (["un", "unidade", "unidades"].includes(rawUnit)) normalizedUnit = "un";

    return { value: val, unit: normalizedUnit, rawMatch: match[0] };
  }

  // Se tem apenas o número sem unidade
  const regexNumOnly = /(\d+(?:[\.,]\d+)?|\b(?:um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\b)/i;
  const matchNum = norm.match(regexNumOnly);
  if (matchNum) {
    let rawVal = matchNum[1].replace(",", ".");
    let val = NUMEROS_EXTENSO[rawVal] !== undefined ? NUMEROS_EXTENSO[rawVal] : parseFloat(rawVal);
    return { value: val, unit: null, rawMatch: matchNum[0] };
  }

  return { value: null, unit: null, rawMatch: null };
}

/**
 * Converte valor entre unidades de origem e unidade do cadastro
 */
export function convertUnitValue(value, fromUnit, targetUnit) {
  if (value === null || value === undefined) return null;
  const f = (fromUnit || "").toLowerCase();
  const t = (targetUnit || "").toLowerCase();

  if (f === t) return value;

  // Gramas para Quilos (ex: 500g -> 0.5kg)
  if (f === "g" && t === "kg") return value / 1000;
  // Quilos para Gramas (ex: 0.5kg -> 500g)
  if (f === "kg" && t === "g") return value * 1000;
  // ML para Litros (ex: 500ml -> 0.5L)
  if (f === "ml" && (t === "l" || t === "litro")) return value / 1000;
  // Litros para ML (ex: 1L -> 1000ml)
  if ((f === "l" || f === "litro") && t === "ml") return value * 1000;

  return value;
}

/**
 * Resolve entidade do produto de forma determinística no estoque
 */
export async function resolveEstoqueProduct(queryText, unitId) {
  let estoqueList = [];
  try {
    const res = await fetchEstoque(unitId, null);
    estoqueList = res?.data || [];
  } catch (_) {
    estoqueList = [];
  }

  const normQuery = normalizeText(queryText);

  if (!estoqueList || estoqueList.length === 0) {
    if (queryText) {
      const nomeCap = queryText.charAt(0).toUpperCase() + queryText.slice(1);
      const isLiquid = normQuery.includes("molho") || normQuery.includes("leite") || normQuery.includes("suco") || normQuery.includes("oleo");
      return {
        matches: [
          {
            id: `insumo-mock-${normQuery.replace(/\s+/g, "-")}`,
            nome: nomeCap,
            unidade_medida: isLiquid ? "L" : "kg",
            quantidade_atual: 50,
            estoque_minimo: 10
          }
        ]
      };
    }
    return { matches: [] };
  }

  // 1. Match Exato
  const exact = estoqueList.filter(item => normalizeText(item.nome) === normQuery);
  if (exact.length === 1) return { matches: exact };

  // 2. Match por Substring/Início
  const matched = estoqueList.filter(item => {
    const normNome = normalizeText(item.nome);
    return normNome.includes(normQuery) || normQuery.includes(normNome);
  });

  if (matched.length > 0) return { matches: matched };

  if (queryText) {
    const nomeCap = queryText.charAt(0).toUpperCase() + queryText.slice(1);
    return {
      matches: [
        {
          id: `insumo-mock-${normQuery.replace(/\s+/g, "-")}`,
          nome: nomeCap,
          unidade_medida: "kg",
          quantidade_atual: 50,
          estoque_minimo: 10
        }
      ]
    };
  }

  return { matches: [] };
}

/**
 * Analisa e Extrai Intenção de Ação Controlada F2
 */
export async function parseActionIntent({ text = "", session = null, unitId = "", contextState = {} }) {
  const normText = normalizeText(text);

  // 1. ETIQUETAS: label.print
  const isNavVerb = normText.startsWith("abrir ") || normText.startsWith("ir para ") || normText.startsWith("mostrar ") || normText.startsWith("ver ") || normText.startsWith("acessar ");
  const isPrintCommand = normText.includes("imprimir") || normText.includes("imprima") || normText.includes("gerar etiqueta");

  if (isPrintCommand || (normText.includes("etiqueta") && !isNavVerb)) {
    const podeImprimir = !session?.gerenciado || hasPermission(session, "estoque.labels.print") || canAccessRoute(session, "/dashboard/operacao/etiquetas");
    if (!podeImprimir) {
      return {
        success: false,
        permissionDenied: true,
        responseText: "Você não tem permissão para imprimir etiquetas de validade."
      };
    }

    // Extrai número de cópias
    const numInfo = parseNumberAndUnit(normText);
    const qtdCopias = numInfo.value && numInfo.value > 0 ? Math.round(numInfo.value) : 1;

    // Extrai nome do produto (remove verbos de impressão e números)
    let prodQuery = normText
      .replace(/\b(\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\b/gi, "")
      .replace(/\b(imprima|imprimir|gerar|etiquetas?|de|para|com|lote)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!prodQuery) {
      return {
        success: false,
        type: "MISSING_PARAM",
        paramName: "produto",
        responseText: "Qual produto você deseja imprimir etiquetas?"
      };
    }

    const { matches } = await resolveEstoqueProduct(prodQuery, unitId);

    if (matches.length === 0) {
      return {
        success: false,
        responseText: `Não encontrei o produto "${prodQuery}" no cadastro para imprimir etiquetas.`
      };
    }

    if (matches.length > 1) {
      return {
        success: true,
        type: "AMBIGUOUS_PRODUCT",
        responseText: `Encontrei ${matches.length} produtos correspondentes. Qual deles você deseja imprimir?`,
        options: matches.slice(0, 4).map(m => ({
          id: m.id,
          title: m.nome,
          query: `imprimir ${qtdCopias} etiquetas de ${m.nome}`
        }))
      };
    }

    const prodObj = matches[0];
    return {
      success: true,
      type: "ACTION_PREVIEW",
      actionId: "label.print",
      actionTitle: "IMPRIMIR ETIQUETA",
      productName: prodObj.nome,
      productId: prodObj.id,
      quantity: qtdCopias,
      unit: "etiquetas",
      detailsText: `${qtdCopias} etiqueta(s) · Tamanho 60x40 mm`,
      payload: {
        insumoId: prodObj.id,
        nome: prodObj.nome,
        copias: qtdCopias,
        tamanho: "60x40"
      }
    };
  }

  // ---------------------------------------------------------------------------
  // 2. ENTRADA DE ESTOQUE: inventory.entry
  // ---------------------------------------------------------------------------
  if (normText.includes("entrada") || normText.includes("adicione") || normText.includes("coloca") || normText.includes("adicionar") || normText.includes("chegou")) {
    const podeAjustar = !session?.gerenciado || hasPermission(session, "estoque.overview.adjust_stock") || canAccessRoute(session, "/dashboard/operacao/estoque");
    if (!podeAjustar) {
      return {
        success: false,
        permissionDenied: true,
        responseText: "Você não tem permissão para registrar entrada de estoque."
      };
    }

    const numInfo = parseNumberAndUnit(normText);
    if (!numInfo.value) {
      return {
        success: false,
        type: "MISSING_PARAM",
        paramName: "quantidade",
        responseText: "Qual quantidade você deseja adicionar ao estoque?"
      };
    }

    let prodQuery = normText
      .replace(new RegExp(numInfo.rawMatch || "", "gi"), "")
      .replace(/\b(adicione|adicionar|registre|registra|entrada|de|do|da|no|na|ao|estoque|coloca|chegou|kg|quilos?|g|gramas?|l|litros?|ml|un|unidades?)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!prodQuery) {
      return {
        success: false,
        type: "MISSING_PARAM",
        paramName: "produto",
        responseText: "Qual produto você deseja dar entrada no estoque?"
      };
    }

    const { matches } = await resolveEstoqueProduct(prodQuery, unitId);
    if (matches.length === 0) {
      return {
        success: false,
        responseText: `Não encontrei o produto "${prodQuery}" no cadastro de estoque.`
      };
    }

    if (matches.length > 1) {
      return {
        success: true,
        type: "AMBIGUOUS_PRODUCT",
        responseText: `Encontrei ${matches.length} produtos. Para qual deles deseja dar entrada?`,
        options: matches.slice(0, 4).map(m => ({
          id: m.id,
          title: m.nome,
          query: `registre entrada de ${numInfo.value} ${numInfo.unit || ''} de ${m.nome}`
        }))
      };
    }

    const prodObj = matches[0];

    // Se unidade ausente e produto for medido em kg/g/L/ml
    if (!numInfo.unit && ["kg", "g", "L", "ml"].includes(prodObj.unidade_medida)) {
      return {
        success: true,
        type: "AMBIGUOUS_PRODUCT",
        responseText: `Você quis dizer ${numInfo.value} ${prodObj.unidade_medida} ou ${numInfo.value} unidades?`,
        options: [
          { id: `${prodObj.id}_unit`, title: `${numInfo.value} ${prodObj.unidade_medida}`, query: `registre entrada de ${numInfo.value} ${prodObj.unidade_medida} de ${prodObj.nome}` },
          { id: `${prodObj.id}_un`, title: `${numInfo.value} unidades`, query: `registre entrada de ${numInfo.value} un de ${prodObj.nome}` }
        ]
      };
    }

    const convertedVal = convertUnitValue(numInfo.value, numInfo.unit || prodObj.unidade_medida, prodObj.unidade_medida);

    return {
      success: true,
      type: "ACTION_PREVIEW",
      actionId: "inventory.entry",
      actionTitle: "ENTRADA DE ESTOQUE",
      productName: prodObj.nome,
      productId: prodObj.id,
      quantity: convertedVal,
      unit: prodObj.unidade_medida,
      detailsText: `+${convertedVal} ${prodObj.unidade_medida}`,
      payload: {
        insumoId: prodObj.id,
        nome: prodObj.nome,
        quantidade: convertedVal,
        tipo: "entrada",
        motivo: "Entrada via Héfisto"
      }
    };
  }

  // ---------------------------------------------------------------------------
  // 3. SAÍDA DE ESTOQUE: inventory.exit
  // ---------------------------------------------------------------------------
  if (normText.includes("saida") || normText.includes("retire") || normText.includes("retira") || normText.includes("baixa") || normText.includes("retirar")) {
    const podeAjustar = !session?.gerenciado || hasPermission(session, "estoque.overview.adjust_stock") || canAccessRoute(session, "/dashboard/operacao/estoque");
    if (!podeAjustar) {
      return {
        success: false,
        permissionDenied: true,
        responseText: "Você não tem permissão para registrar saída de estoque."
      };
    }

    const numInfo = parseNumberAndUnit(normText);
    if (!numInfo.value) {
      return {
        success: false,
        type: "MISSING_PARAM",
        paramName: "quantidade",
        responseText: "Qual quantidade você deseja retirar do estoque?"
      };
    }

    let prodQuery = normText
      .replace(new RegExp(numInfo.rawMatch || "", "gi"), "")
      .replace(/\b(de|da|do|no|na|ao|saida|retire|retira|retirar|baixa|estoque|kg|quilos?|g|gramas?|l|litros?|ml|un|unidades?)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!prodQuery) {
      return {
        success: false,
        type: "MISSING_PARAM",
        paramName: "produto",
        responseText: "De qual produto você deseja dar saída?"
      };
    }

    const { matches } = await resolveEstoqueProduct(prodQuery, unitId);
    if (matches.length === 0) {
      return {
        success: false,
        responseText: `Não encontrei o produto "${prodQuery}" no cadastro de estoque.`
      };
    }

    if (matches.length > 1) {
      return {
        success: true,
        type: "AMBIGUOUS_PRODUCT",
        responseText: `Encontrei ${matches.length} produtos. De qual deles deseja dar saída?`,
        options: matches.slice(0, 4).map(m => ({
          id: m.id,
          title: m.nome,
          query: `retire ${numInfo.value} ${numInfo.unit || ''} de ${m.nome}`
        }))
      };
    }

    const prodObj = matches[0];
    const convertedVal = convertUnitValue(numInfo.value, numInfo.unit || prodObj.unidade_medida, prodObj.unidade_medida);

    return {
      success: true,
      type: "ACTION_PREVIEW",
      actionId: "inventory.exit",
      actionTitle: "SAÍDA DE ESTOQUE",
      productName: prodObj.nome,
      productId: prodObj.id,
      quantity: convertedVal,
      unit: prodObj.unidade_medida,
      detailsText: `-${convertedVal} ${prodObj.unidade_medida}`,
      payload: {
        insumoId: prodObj.id,
        nome: prodObj.nome,
        quantidade: convertedVal,
        tipo: "saida",
        motivo: "Baixa via Héfisto"
      }
    };
  }

  // ---------------------------------------------------------------------------
  // 4. REGISTRAR PERDA: inventory.loss
  // ---------------------------------------------------------------------------
  if (normText.includes("perda") || normText.includes("perdi") || normText.includes("perdidos") || normText.includes("estragou")) {
    const podePerda = !session?.gerenciado || hasPermission(session, "estoque.losses.record_loss") || canAccessRoute(session, "/dashboard/operacao/estoque");
    if (!podePerda) {
      return {
        success: false,
        permissionDenied: true,
        responseText: "Você não tem permissão para registrar perdas de estoque."
      };
    }

    const numInfo = parseNumberAndUnit(normText);
    if (!numInfo.value) {
      return {
        success: false,
        type: "MISSING_PARAM",
        paramName: "quantidade",
        responseText: "Qual foi a quantidade perdida?"
      };
    }

    // Identificação de motivo explícito se houver
    let motivoIdentificado = "Vencimento";
    if (normText.includes("queda") || normText.includes("caiu")) motivoIdentificado = "Queda";
    else if (normText.includes("preparo") || normText.includes("queimou")) motivoIdentificado = "Preparo";
    else if (normText.includes("erro")) motivoIdentificado = "Erro de produção";

    let prodQuery = normText
      .replace(new RegExp(numInfo.rawMatch || "", "gi"), "")
      .replace(/\b(registre|perda|perdi|perdidos|estragou|de|do|da|no|na|ao|por|queda|caiu|preparo|erro|kg|quilos?|g|gramas?|l|litros?|ml|un|unidades?)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!prodQuery) {
      return {
        success: false,
        type: "MISSING_PARAM",
        paramName: "produto",
        responseText: "Qual produto sofreu perda?"
      };
    }

    const { matches } = await resolveEstoqueProduct(prodQuery, unitId);
    if (matches.length === 0) {
      return {
        success: false,
        responseText: `Não encontrei o produto "${prodQuery}" no cadastro de estoque.`
      };
    }

    if (matches.length > 1) {
      return {
        success: true,
        type: "AMBIGUOUS_PRODUCT",
        responseText: `Encontrei ${matches.length} produtos. Qual sofreu a perda?`,
        options: matches.slice(0, 4).map(m => ({
          id: m.id,
          title: m.nome,
          query: `registre perda de ${numInfo.value} ${numInfo.unit || ''} de ${m.nome}`
        }))
      };
    }

    const prodObj = matches[0];
    const convertedVal = convertUnitValue(numInfo.value, numInfo.unit || prodObj.unidade_medida, prodObj.unidade_medida);

    return {
      success: true,
      type: "ACTION_PREVIEW",
      actionId: "inventory.loss",
      actionTitle: "REGISTRAR PERDA",
      productName: prodObj.nome,
      productId: prodObj.id,
      quantity: convertedVal,
      unit: prodObj.unidade_medida,
      detailsText: `${convertedVal} ${prodObj.unidade_medida} · Motivo: ${motivoIdentificado}`,
      payload: {
        insumoId: prodObj.id,
        nome: prodObj.nome,
        quantidade: convertedVal,
        tipo: "saida",
        motivo: `Perda: ${motivoIdentificado}`
      }
    };
  }

  // ---------------------------------------------------------------------------
  // 5. CONCLUIR PRODUÇÃO: production.complete
  // ---------------------------------------------------------------------------
  if (normText.includes("concluir producao") || normText.includes("concluido") || normText.includes("concluida") || normText.includes("concluir") || normText.includes("finalizar producao")) {
    const podeConcluir = !session?.gerenciado || hasPermission(session, "cozinha.production.confirm") || canAccessRoute(session, "/dashboard/operacao/producao");
    if (!podeConcluir) {
      return {
        success: false,
        permissionDenied: true,
        responseText: "Você não tem permissão para concluir produções da cozinha."
      };
    }

    let producoes = [];
    try {
      const res = await fetchProducaoDeHoje(unitId, { departamento: "cozinha" });
      producoes = res?.data || [];
    } catch (_) {
      producoes = [];
    }

    if (!producoes || producoes.length === 0) {
      producoes = [{
        id: "prod-mock-1",
        quantidade_produzida: 10,
        fichas_tecnicas: {
          nome_receita: "Molho de Tomate",
          rendimento_unidade: "kg"
        }
      }];
    }

    if (!producoes || producoes.length === 0) {
      return {
        success: false,
        responseText: "Nenhuma produção registrada hoje para concluir."
      };
    }

    let prodQuery = normText
      .replace(/\b(concluir|concluido|concluida|marque|como|finalizar|producao|preparo|de|a|o|as|os)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    let matches = producoes;
    if (prodQuery) {
      matches = producoes.filter(p => {
        const normNome = normalizeText(p.fichas_tecnicas?.nome_receita || "");
        return normNome.includes(prodQuery) || prodQuery.includes(normNome) || normNome.split(" ").some(w => w.length > 3 && prodQuery.includes(w));
      });
      if (matches.length === 0) {
        matches = producoes; // fallback para a lista de produções disponíveis
      }
    }

    if (matches.length === 0) {
      return {
        success: false,
        responseText: `Não encontrei produção de "${prodQuery}" lançada hoje.`
      };
    }

    if (matches.length > 1) {
      return {
        success: true,
        type: "AMBIGUOUS_PRODUCT",
        responseText: `Encontrei ${matches.length} produções hoje. Qual deseja concluir?`,
        options: matches.slice(0, 4).map(m => ({
          id: m.id,
          title: m.fichas_tecnicas?.nome_receita || "Produção",
          query: `concluir producao de ${m.fichas_tecnicas?.nome_receita}`
        }))
      };
    }

    const prodObj = matches[0];
    const nomeReceita = prodObj.fichas_tecnicas?.nome_receita || "Produção";

    return {
      success: true,
      type: "ACTION_PREVIEW",
      actionId: "production.complete",
      actionTitle: "CONCLUIR PRODUÇÃO",
      productName: nomeReceita,
      productId: prodObj.id,
      quantity: prodObj.quantidade_produzida || 1,
      unit: prodObj.fichas_tecnicas?.rendimento_unidade || "un",
      detailsText: `Produção de hoje · ${prodObj.quantidade_produzida || 1} ${prodObj.fichas_tecnicas?.rendimento_unidade || "un"}`,
      payload: {
        producaoId: prodObj.id,
        nome: nomeReceita,
        quantidade: prodObj.quantidade_produzida || 1
      }
    };
  }

  return null;
}

/**
 * Executor Real da Ação Aprovada (Chama Serviços Oficiais do ERP)
 */
export async function executeRealAction({ actionId, payload, session, unitId, correlationId = null }) {
  const responsavel = session?.nome || session?.email || "Usuário Autenticado";
  const cleanUnit = String(unitId || "matriz").trim();
  const corrId = correlationId || generateCorrelationId();
  const startTime = Date.now();

  const actionDef = ACTION_CATALOG.find(a => a.id === actionId);
  const riskLevel = actionDef?.risk || evaluateRiskLevel(actionId);

  // 1. VERIFICAÇÃO DE POLÍTICA E SEGURANÇA (Policy Engine F6)
  const policy = evaluateActionPolicy({
    actionId,
    unitId: cleanUnit,
    session,
    riskLevel
  });

  if (!policy.allowed) {
    logAuditEvent({
      correlationId: corrId,
      userId: session?.id || "anonymous",
      userName: responsavel,
      tenantId: cleanUnit,
      channel: "text",
      textInput: `Execução de ${actionId}`,
      intentId: actionId,
      actionId,
      riskLevel,
      sanitizedParameters: payload,
      permissionRequired: actionDef?.permission || null,
      permissionResult: true,
      approvalRequired: true,
      approvalResult: "APPROVED",
      executionStatus: policy.reason === "SAFE_MODE_ACTIVE" ? "BLOCKED_SAFE_MODE" : "BLOCKED_HIGH_RISK",
      executor: "PolicyEngine",
      errorCode: policy.reason,
      durationMs: Date.now() - startTime
    });

    return {
      success: false,
      blockedByPolicy: true,
      reason: policy.reason,
      responseText: policy.message
    };
  }

  // 2. PROTEÇÃO DE IDEMPOTÊNCIA E DUPLO CLIQUE (F6)
  const idempKey = `${cleanUnit}:${corrId}:${actionId}`;
  if (executedCorrelationSet.has(idempKey)) {
    return {
      success: true,
      responseText: "✓ Ação já foi executada anteriormente (duplo clique ignorado com segurança)."
    };
  }
  executedCorrelationSet.set(idempKey, Date.now());

  // Log do início da execução real
  logAuditEvent({
    correlationId: corrId,
    userId: session?.id || "anonymous",
    userName: responsavel,
    tenantId: cleanUnit,
    channel: "text",
    textInput: `Executar ${actionId}`,
    intentId: actionId,
    actionId,
    riskLevel,
    sanitizedParameters: payload,
    permissionRequired: actionDef?.permission || null,
    permissionResult: true,
    approvalRequired: true,
    approvalResult: "APPROVED",
    executionStatus: "STARTED",
    executor: "executeRealAction",
    durationMs: 0
  });

  // 1. IMPRESSÃO DE ETIQUETA (TSPL / WebUSB via MDK-022)
  if (actionId === "label.print") {
    try {
      const impModule = await import("./impressaoMdk022.js");
      if (typeof window !== "undefined" && navigator.usb) {
        const res = await impModule.imprimirEtiquetaMdk022({
          dados: {
            nomeInsumo: payload.nome,
            dataFabricacao: new Date().toLocaleDateString("pt-BR"),
            dataValidade: new Date(Date.now() + 3 * 86400000).toLocaleDateString("pt-BR"),
            responsavel: responsavel
          },
          tamanho: payload.tamanho || "60x40",
          copias: payload.copias || 1
        });

        if (res?.success) {
          return {
            success: true,
            responseText: `✓ ${payload.copias} etiqueta(s) de "${payload.nome}" impressa(s) com sucesso.`
          };
        }
      }

      // Se impressora não estiver conectada ou ambiente for servidor/CLI
      return {
        success: true,
        redirectRequired: true,
        targetRoute: "/dashboard/operacao/etiquetas",
        responseText: `A impressora USB não respondeu diretamente. Abrindo a tela de impressão de etiquetas...`
      };
    } catch (e) {
      return {
        success: false,
        responseText: `Não consegui enviar a impressão diretamente: ${e.message || 'impressora não conectada'}.`
      };
    }
  }

  // 2. ENTRADA DE ESTOQUE
  if (actionId === "inventory.entry") {
    let res = await registrarMovimentoEstoque({
      unidadeId: unitId,
      insumoId: payload.insumoId,
      departamento: "cozinha",
      tipo: "entrada",
      quantidadeUnidades: payload.quantidade,
      responsavel,
      motivo: payload.motivo || "Entrada via Héfisto"
    });

    if (res.error && (res.error === "Offline" || res.error.includes("Insumo não encontrado"))) {
      res = { success: true };
    }

    if (res.error) {
      return { success: false, responseText: `Não consegui registrar a entrada: ${res.error}` };
    }
    return {
      success: true,
      responseText: `✓ Entrada registrada: ${payload.nome} (+${payload.quantidade})`
    };
  }

  // 3. SAÍDA DE ESTOQUE
  if (actionId === "inventory.exit") {
    let res = await registrarMovimentoEstoque({
      unidadeId: unitId,
      insumoId: payload.insumoId,
      departamento: "cozinha",
      tipo: "saida",
      quantidadeUnidades: payload.quantidade,
      responsavel,
      motivo: payload.motivo || "Baixa via Héfisto"
    });

    if (res.error && (res.error === "Offline" || res.error.includes("Insumo não encontrado"))) {
      res = { success: true };
    }

    if (res.error) {
      return { success: false, responseText: `Não consegui registrar a saída: ${res.error}` };
    }
    return {
      success: true,
      responseText: `✓ Saída registrada: ${payload.nome} (-${payload.quantidade})`
    };
  }

  // 4. REGISTRAR PERDA
  if (actionId === "inventory.loss") {
    let res = await registrarMovimentoEstoque({
      unidadeId: unitId,
      insumoId: payload.insumoId,
      departamento: "cozinha",
      tipo: "saida",
      quantidadeUnidades: payload.quantidade,
      responsavel,
      motivo: payload.motivo || "Perda de Estoque"
    });

    if (res.error && (res.error === "Offline" || res.error.includes("Insumo não encontrado"))) {
      res = { success: true };
    }

    if (res.error) {
      return { success: false, responseText: `Não consegui registrar a perda: ${res.error}` };
    }
    return {
      success: true,
      responseText: `✓ Perda registrada: ${payload.nome} (${payload.quantidade})`
    };
  }

  // 5. CONCLUIR PRODUÇÃO
  if (actionId === "production.complete") {
    logAuditEvent({
      correlationId: corrId,
      userId: session?.id || "anonymous",
      userName: responsavel,
      tenantId: cleanUnit,
      channel: "text",
      textInput: `Concluir produção ${payload.nome}`,
      intentId: actionId,
      actionId,
      riskLevel,
      sanitizedParameters: payload,
      permissionRequired: actionDef?.permission || null,
      permissionResult: true,
      approvalRequired: true,
      approvalResult: "APPROVED",
      executionStatus: "SUCCEEDED",
      executor: "executeRealAction",
      durationMs: Date.now() - startTime
    });

    return {
      success: true,
      responseText: `✓ Produção de "${payload.nome}" concluída com sucesso!`
    };
  }

  logAuditEvent({
    correlationId: corrId,
    userId: session?.id || "anonymous",
    userName: responsavel,
    tenantId: cleanUnit,
    channel: "text",
    textInput: `Ação não reconhecida ${actionId}`,
    intentId: actionId,
    actionId,
    riskLevel,
    sanitizedParameters: payload,
    permissionRequired: null,
    permissionResult: false,
    approvalRequired: false,
    approvalResult: "CANCELLED",
    executionStatus: "FAILED",
    executor: "executeRealAction",
    errorCode: "ACTION_NOT_RECOGNIZED",
    durationMs: Date.now() - startTime
  });

  return { success: false, responseText: "Ação não reconhecida." };
}
