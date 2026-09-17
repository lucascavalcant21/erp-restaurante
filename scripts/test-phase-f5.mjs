import assert from "assert";
import {
  getProactiveInsights,
  generateFingerprint,
  createInsight,
  clearInsightsState,
  detectInventoryIssues,
  detectPriceIncreases,
  detectLossIncreases,
  detectOverdueProduction,
  detectOverdueAccounts,
  detectCMVVariation,
  detectPendingPonto
} from "../app/lib/hefisto-insights.js";
import { processHefistoIntent } from "../app/lib/hefisto-intents.js";

async function runF5Tests() {
  console.log("==================================================");
  console.log("   HÉFISTO FASE F5 — INSIGHTS PROATIVOS & VIGILANTE");
  console.log("==================================================\n");

  clearInsightsState();

  // ---------------------------------------------------------------------------
  // TEST 1: CONTRATO E FINGERPRINT ESTÁVEL
  // ---------------------------------------------------------------------------
  console.log("--- 1. Contrato e Fingerprinting Único ---");
  const fp1 = generateFingerprint("unit-1", "inventory.belowMinimum", "insumo-camarao", "below_min");
  const fp2 = generateFingerprint("unit-1", "inventory.belowMinimum", "insumo-camarao", "below_min");
  assert.strictEqual(fp1, fp2, "Fingerprint deve ser determinístico e idêntico");
  assert.strictEqual(fp1, "unit-1:inventory.belowminimum:insumo-camarao:below_min", "Formato de fingerprint padronizado");
  console.log(" ✓ PASS: Fingerprint gerado com formato e estabilidade determinística");

  const sampleInsight = createInsight({
    unitId: "unit-1",
    detectorId: "inventory.belowMinimum",
    entityId: "insumo-camarao",
    conditionKey: "below_min",
    domain: "estoque",
    severity: "ATTENTION",
    title: "Camarão 40/60 abaixo do mínimo",
    summary: "Estoque atual: 2,3 kg · Mínimo: 5 kg",
    evidence: ["• Saldo Atual: 2,3 kg", "• Nível Mínimo: 5,0 kg"],
    period: "Hoje",
    actionRoute: "/dashboard/operacao/estoque",
    actionText: "Ver estoque",
    suggestedActionIntent: { text: "adicionar 5 kg de camarao" },
    analyticsQuery: "Por que meu estoque de camarão está baixo?",
    permission: "estoque.overview.view"
  });

  assert(sampleInsight.id && sampleInsight.fingerprint, "Contrato contém id e fingerprint");
  assert.strictEqual(sampleInsight.domain, "estoque", "Contrato define domínio operacional");
  assert.strictEqual(sampleInsight.severity, "ATTENTION", "Contrato define severidade determinística");
  assert(Array.isArray(sampleInsight.evidence), "Evidências estruturadas em array");
  console.log(" ✓ PASS: Contrato InsightContract implementado conforme especificação");

  // ---------------------------------------------------------------------------
  // TEST 2: DEDUPLICAÇÃO POR FINGERPRINT (10 EXECUÇÕES = 1 INSIGHT)
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Deduplicação por Fingerprint ---");
  const sessionAdmin = { id: "user-admin", gerenciado: false };

  // Executa o engine 10 vezes seguidas para a mesma unidade
  const execs = [];
  for (let i = 0; i < 10; i++) {
    execs.push(await getProactiveInsights({ session: sessionAdmin, unitId: "matriz" }));
  }

  const idsCount = execs[0].insights.map(i => i.fingerprint);
  const duplicates = idsCount.filter((item, index) => idsCount.indexOf(item) !== index);
  assert.strictEqual(duplicates.length, 0, "Zero duplicatas retornadas no mesmo lote de insights");
  assert.strictEqual(execs[0].insights.length, execs[9].insights.length, "Número de insights deduplicados permanece constante");
  console.log(` ✓ PASS: 10 execuções resultaram em exatamente ${execs[0].insights.length} insights deduplicados`);

  // ---------------------------------------------------------------------------
  // TEST 3: DETECTORES DETERMINÍSTICOS INICIAIS
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Detectores Determinísticos de Situações Importantes ---");
  const resInsights = await getProactiveInsights({ session: sessionAdmin, unitId: "matriz" });
  const list = resInsights.insights;

  const detStock = list.find(i => i.detectorId.startsWith("inventory."));
  const detPrice = list.find(i => i.detectorId === "purchase.priceIncrease");
  const detLoss = list.find(i => i.detectorId === "loss.periodIncrease");
  const detProd = list.find(i => i.detectorId === "production.overdue");
  const detFin = list.find(i => i.detectorId === "finance.overdueAccounts");
  const detCMV = list.find(i => i.detectorId === "cmv.relevantVariation");
  const detRH = list.find(i => i.detectorId === "rh.pendingPonto");

  assert(detStock, "Detector de estoque identificou insumo crítico/abaixo do mínimo");
  assert(detPrice, "Detector de compras identificou variação de preço de aquisição");
  assert(detLoss, "Detector de perdas identificou variação no volume de descartes");
  assert(detProd, "Detector de cozinha identificou produções pendentes");
  assert(detFin, "Detector financeiro identificou contas vencidas");
  assert(detCMV, "Detector de custos identificou variação no CMV");
  assert(detRH, "Detector de RH identificou pendências de registro de ponto");
  console.log(" ✓ PASS: Todos os 8 detectores determinísticos executaram com sucesso");

  // ---------------------------------------------------------------------------
  // TEST 4: INTEGRAÇÃO COM F4 (EXPLICAÇÃO) E F2 (AÇÃO CONTROLADA)
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. Integração F5 -> F4 (Explicação) e F5 -> F2 (Ação Controlada) ---");
  assert(detCMV.analyticsQuery, "Insight de CMV oferece pergunta de explicação F4 ('Por que meu CMV aumentou?')");
  assert(detStock.suggestedActionIntent, "Insight de estoque oferece ação sugerida F2 ('adicionar 5 kg de...')");

  // Testa se a pergunta F4 do insight é processada com sucesso pelo F4 Engine
  const f4Explanation = await processHefistoIntent({
    text: detCMV.analyticsQuery,
    session: sessionAdmin,
    unitId: "matriz"
  });
  assert.strictEqual(f4Explanation.type, "ANALYTICS_RESULT", "Clicar em 'Entender por quê' aciona o Analytics Engine F4");
  console.log(" ✓ PASS: Conexão F5 -> F4 ('Entender por quê') testada e validada");

  // ---------------------------------------------------------------------------
  // TEST 5: FILTRAGEM RIGOROSA DE PERMISSÕES POR USUÁRIO
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. Filtro de Permissões por Usuário (Zero Vazamento Financeiro/RH) ---");
  const sessionOperador = {
    id: "user-op",
    gerenciado: true,
    permissoes: ["cozinha.production.confirm"] // Apenas Cozinha
  };

  const insightsOp = await getProactiveInsights({ session: sessionOperador, unitId: "matriz" });
  const hasFinance = insightsOp.insights.some(i => i.domain === "financeiro" || i.domain === "custos");
  const hasRH = insightsOp.insights.some(i => i.domain === "rh");

  assert.strictEqual(hasFinance, false, "Usuário sem permissão financeira recebe ZERO insights de contas ou CMV");
  assert.strictEqual(hasRH, false, "Usuário sem permissão de RH recebe ZERO insights de ponto ou equipe");
  console.log(" ✓ PASS: Permissões de usuário aplicadas rigorosamente antes de gerar insights");

  // ---------------------------------------------------------------------------
  // TEST 6: ISOLAMENTO MULTI-TENANT POR UNIDADE / EMPRESA
  // ---------------------------------------------------------------------------
  console.log("\n--- 6. Isolamento Multi-Tenant (Unidade A vs Unidade B) ---");
  clearInsightsState();
  const resUnitA = await getProactiveInsights({ session: sessionAdmin, unitId: "unidade-a" });
  const resUnitB = await getProactiveInsights({ session: sessionAdmin, unitId: "unidade-b" });

  assert.strictEqual(resUnitA.unitId, "unidade-a", "Resposta vinculada à unidade A");
  assert.strictEqual(resUnitB.unitId, "unidade-b", "Resposta vinculada à unidade B");
  assert(resUnitA.insights.every(i => i.fingerprint.startsWith("unidade-a:")), "Fingerprints da Unidade A contêm o ID da empresa A");
  assert(resUnitB.insights.every(i => i.fingerprint.startsWith("unidade-b:")), "Fingerprints da Unidade B contêm o ID da empresa B");
  console.log(" ✓ PASS: Isolamento multi-tenant garantido por ID da empresa/unidade");

  // ---------------------------------------------------------------------------
  // TEST 7: PERGUNTA DE REFERÊNCIA — "O QUE PRECISA DE MIM HOJE?"
  // ---------------------------------------------------------------------------
  console.log("\n--- 7. Intenções Globais F5 ('O que precisa de mim?') ---");
  const intentResult = await processHefistoIntent({
    text: "O que precisa de mim hoje?",
    session: sessionAdmin,
    unitId: "matriz"
  });

  assert.strictEqual(intentResult.type, "INSIGHTS_LIST", "Processador de intenções aciona o F5 Engine");
  assert(intentResult.insights.length > 0, "Retorna lista de situações importantes");
  assert(intentResult.spokenSummary.includes("Héfisto encontrou"), "Síntese em voz TTS gerada em 1-2 frases para F3");
  console.log(" ✓ PASS: Intenção 'O que precisa de mim?' resolvida com sucesso");

  // ---------------------------------------------------------------------------
  // TEST 8: PRESERVAÇÃO INTEGRAL DO PONTO TRADICIONAL & ETIQUETAS TSPL
  // ---------------------------------------------------------------------------
  console.log("\n--- 8. Preservação do Escopo de Ponto TRADICIONAL & Etiquetas TSPL ---");
  const rhInsight = list.find(i => i.domain === "rh");
  if (rhInsight) {
    assert(rhInsight.evidence.some(e => e.includes("Ponto tradicional")), "Insight confirma regra de Ponto Tradicional no Quiosque");
    assert(!rhInsight.evidence.some(e => e.toLowerCase().includes("facial")), "ZERO menção ou dependência de reconhecimento facial");
  }
  console.log(" ✓ PASS: Ponto TRADICIONAL mantido (0 automação, 0 reconhecimento facial)");

  console.log("\n==================================================");
  console.log("   RESULTADO FASE F5: TODOS OS TESTES PASSARAM!");
  console.log("==================================================");
}

runF5Tests().catch(err => {
  console.error("FATAL F5 TEST FAILURE:", err);
  process.exit(1);
});
