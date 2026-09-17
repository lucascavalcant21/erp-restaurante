import {
  formatPercentPointsVariation,
  formatMonetaryVariation,
  getComparableDateRanges,
  rankRelevantChanges
} from "../app/lib/hefisto-analytics-helpers.mjs";
import { executeAnalyticsQuery, ANALYTICS_CATALOG } from "../app/lib/hefisto-analytics.js";
import { processHefistoIntent } from "../app/lib/hefisto-intents.js";
import { hasPermission } from "../app/lib/permissions-catalog.mjs";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(` ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(` ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runF4Tests() {
  console.log("==================================================");
  console.log("   HÉFISTO FASE F4 — INTELIGÊNCIA ANALÍTICA & DIAGNÓSTICOS");
  console.log("==================================================\n");

  // ---------------------------------------------------------------------------
  // TEST 1: HELPER MATEMÁTICO — PONTOS PERCENTUAIS (p.p.)
  // ---------------------------------------------------------------------------
  console.log("--- 1. Cálculo de Pontos Percentuais (p.p.) ---");
  const pp1 = formatPercentPointsVariation(33.0, 30.0);
  assert(pp1.formatted === "+3,0 p.p.", `30% -> 33% deve ser +3,0 p.p. (obtido: ${pp1.formatted})`);

  const pp2 = formatPercentPointsVariation(28.7, 31.2);
  assert(pp2.formatted === "-2,5 p.p.", `31.2% -> 28.7% deve ser -2.5 p.p. (obtido: ${pp2.formatted})`);

  // ---------------------------------------------------------------------------
  // TEST 2: VALIDAÇÃO DE DIVISÃO POR ZERO E MONETÁRIO
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Variação Monetária & Proteção contra Divisão por Zero ---");
  const monZero = formatMonetaryVariation(1000, 0);
  assert(monZero.pctFormatted === "Sem base de comparação", "Período anterior = 0 deve retornar 'Sem base de comparação'");

  const monNormal = formatMonetaryVariation(12000, 10000);
  assert(monNormal.pctFormatted === "+20,0%", "R$10k -> R$12k deve calcular +20,0%");
  assert(monNormal.monetaryFormatted.includes("2.000,00"), "Diferença monetária deve ser +R$ 2.000,00");

  // ---------------------------------------------------------------------------
  // TEST 3: COMPARAÇÃO DE PERÍODOS EQUIVALENTES (MÊS PARCIAL)
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Resolução de Períodos Equivalentes (Dia 17) ---");
  const mockRefDate = new Date("2026-09-17T12:00:00Z");
  const ranges = getComparableDateRanges("este_mes", mockRefDate);
  assert(ranges.isPartialMonth === true, "Identificou dia 17 como mês em andamento (parcial)");
  assert(ranges.current.de.endsWith("-01") && ranges.current.ate.endsWith("-17"), "Período atual: dia 1 ao dia 17 de setembro");
  assert(ranges.previous.de.endsWith("-01") && ranges.previous.ate.endsWith("-17"), "Período anterior: dia 1 ao dia 17 de agosto (mesmo número de dias)");

  // ---------------------------------------------------------------------------
  // TEST 4: PERGUNTA DE REFERÊNCIA — "POR QUE MEU CMV AUMENTOU?"
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. Diagnóstico de CMV (Por que meu CMV aumentou?) ---");
  const adminSession = { id: "admin-1", nome: "Gerente Operacional", papel: "admin", gerenciado: false };
  const mockUnitId = "unit-test-123";

  const cmvAnalysis = await executeAnalyticsQuery({
    text: "Por que meu CMV aumentou?",
    session: adminSession,
    unitId: mockUnitId
  });

  assert(cmvAnalysis.type === "ANALYTICS_RESULT", "Retornou resultado analítico estruturado");
  assert(cmvAnalysis.metricHighlight.variationStr.includes("p.p."), "Variação de CMV exibida em pontos percentuais (p.p.)");
  assert(cmvAnalysis.evidenceList.length >= 3, "Retornou lista de evidências determinísticas");
  assert(cmvAnalysis.sources.includes("CMV"), "Identificou a fonte oficial de CMV");
  assert(cmvAnalysis.spokenSummary.includes("pontos percentuais"), "Síntese de voz formatada para TTS em 1-2 frases");

  // ---------------------------------------------------------------------------
  // TEST 5: PERGUNTA DE REFERÊNCIA — "POR QUE MEU RESULTADO CAIU?"
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. Diagnóstico de DRE (Por que meu resultado caiu?) ---");
  const dreAnalysis = await executeAnalyticsQuery({
    text: "Por que meu resultado caiu?",
    session: adminSession,
    unitId: mockUnitId
  });

  assert(dreAnalysis.type === "ANALYTICS_RESULT", "Retornou diagnóstico de resultado DRE");
  assert(dreAnalysis.drilldownActions.some(a => a.route === "/dashboard/financeiro/dre"), "Possui drill-down para a tela oficial de DRE");

  // ---------------------------------------------------------------------------
  // TEST 6: HISTÓRICO DE AUMENTO DE PREÇOS
  // ---------------------------------------------------------------------------
  console.log("\n--- 6. Histórico de Preços (Quais produtos aumentaram de preço?) ---");
  const priceAnalysis = await executeAnalyticsQuery({
    text: "Quais produtos aumentaram de preço?",
    session: adminSession,
    unitId: mockUnitId
  });

  assert(priceAnalysis.evidenceList.some(e => e.includes("Camarão") || e.includes("R$")), "Reportou variação de preço real por unidade de medida");

  // ---------------------------------------------------------------------------
  // TEST 7: ANÁLISE DE PERDAS DE ESTOQUE
  // ---------------------------------------------------------------------------
  console.log("\n--- 7. Análise de Perdas (Quanto perdi este mês?) ---");
  const lossAnalysis = await executeAnalyticsQuery({
    text: "Quanto perdi este mês?",
    session: adminSession,
    unitId: mockUnitId
  });

  assert(lossAnalysis.title.includes("PERDAS"), "Retornou relatório de perdas");
  assert(!lossAnalysis.summaryText.includes("pior funcionário"), "Sem perseguição a colaboradores (analisa insumos e processos)");

  // ---------------------------------------------------------------------------
  // TEST 8: SIMULAÇÃO MATEMÁTICA (WHAT-IF) SEM MUTAÇÃO DE BANCO
  // ---------------------------------------------------------------------------
  console.log("\n--- 8. Simulação Matemática (What-If) ---");
  const simResult = await executeAnalyticsQuery({
    text: "Se meu CMV voltar para 28%, qual o impacto?",
    session: adminSession,
    unitId: mockUnitId
  });

  assert(simResult.title.includes("SIMULAÇÃO"), "Marcação explícita como SIMULAÇÃO");
  assert(simResult.sources[0].includes("0 mutações"), "Confirmação de zero alterações registradas no ERP");

  // ---------------------------------------------------------------------------
  // TEST 9: SEGURANÇA, BLOQUEIO DE PERMISSÃO & ISOLAMENTO
  // ---------------------------------------------------------------------------
  console.log("\n--- 9. Segurança & Bloqueio por Permissão ---");
  const limitedSession = {
    id: "user-limitado",
    nome: "Operador Sem Financeiro",
    gerenciado: true,
    cargo: "Atendente",
    permissoes_personalizadas: []
  };

  const blockedAnalysis = await executeAnalyticsQuery({
    text: "Por que meu resultado caiu?",
    session: limitedSession,
    unitId: mockUnitId
  });

  assert(blockedAnalysis.permissionDenied === true, "Bloqueou análise financeira para usuário não autorizado");

  // ---------------------------------------------------------------------------
  // TEST 10: INTEGRAÇÃO COM PROCESSHEFISTOINTENT (MECANISMO GLOBAL)
  // ---------------------------------------------------------------------------
  console.log("\n--- 10. Integração Global de Intenções (processHefistoIntent) ---");
  const globalAnalyticIntent = await processHefistoIntent({
    text: "Por que meu CMV aumentou?",
    session: adminSession,
    unitId: mockUnitId
  });

  assert(globalAnalyticIntent.type === "ANALYTICS_RESULT", "Mecanismo global processou pergunta analítica F4 com sucesso");

  // ---------------------------------------------------------------------------
  // RESUMO FINAL DOS TESTES F4
  // ---------------------------------------------------------------------------
  console.log("\n==================================================");
  console.log(`RESULTADO DA FASE F4: ${passed} PASSOU | ${failed} FALHOU`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runF4Tests();
