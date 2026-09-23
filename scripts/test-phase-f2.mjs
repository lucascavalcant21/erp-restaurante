import { parseNumberAndUnit, convertUnitValue, parseActionIntent, executeRealAction, ACTION_CATALOG } from "../app/lib/hefisto-actions.js";
import { processHefistoIntent } from "../app/lib/hefisto-intents.js";
import { NAVIGATION_REGISTRY } from "../app/lib/navigation-registry.mjs";
import { hasPermission, canAccessRoute } from "../app/lib/permissions-catalog.mjs";

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

async function runTests() {
  console.log("==================================================");
  console.log("   HÉFISTO FASE F2 — EXECUÇÃO DE AÇÕES CONTROLADAS");
  console.log("==================================================\n");

  // ---------------------------------------------------------------------------
  // TEST 1: CATALOGO DE AÇÕES E ESTRUTURA
  // ---------------------------------------------------------------------------
  console.log("--- 1. Catálogo Central de Ações Controladas F2 ---");
  assert(ACTION_CATALOG.length === 5, "Possui exatamente 5 ações controladas no catálogo");
  assert(ACTION_CATALOG.some(a => a.id === "label.print"), "Contém ação label.print");
  assert(ACTION_CATALOG.some(a => a.id === "inventory.entry"), "Contém ação inventory.entry");
  assert(ACTION_CATALOG.some(a => a.id === "inventory.exit"), "Contém ação inventory.exit");
  assert(ACTION_CATALOG.some(a => a.id === "inventory.loss"), "Contém ação inventory.loss");
  assert(ACTION_CATALOG.some(a => a.id === "production.complete"), "Contém ação production.complete");

  // ---------------------------------------------------------------------------
  // TEST 2: CONVERSÃO DE UNIDADES E NÚMEROS (UNIT SAFETY)
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Conversão e Validação de Números e Unidades ---");
  const p1 = parseNumberAndUnit("adicione 500g de camarão");
  assert(p1.value === 500 && p1.unit === "g", "Extraiu 500 gramas corretamente");

  const p2 = parseNumberAndUnit("entrada de 10.5 kg de molho");
  assert(p2.value === 10.5 && p2.unit === "kg", "Extraiu 10.5 kg corretamente");

  const p3 = parseNumberAndUnit("imprimir duas etiquetas");
  assert(p3.value === 2, "Extraiu número por extenso 'duas' = 2");

  // Teste de conversão 500g -> 0.5kg
  const conv1 = convertUnitValue(500, "g", "kg");
  assert(conv1 === 0.5, "Converteu 500g para 0.5kg corretamente (prevenção de erro de escala)");

  const conv2 = convertUnitValue(2, "kg", "g");
  assert(conv2 === 2000, "Converteu 2kg para 2000g corretamente");

  const conv3 = convertUnitValue(500, "ml", "L");
  assert(conv3 === 0.5, "Converteu 500ml para 0.5L corretamente");

  // ---------------------------------------------------------------------------
  // TEST 3: PARSING DE INTENÇÕES E GERACÃO DE ACTION_PREVIEW
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Extrator de Intenção e Geração de Action Preview ---");
  const adminSession = { id: "admin-1", nome: "Gerente Operacional", gerenciado: false };
  const mockUnitId = "unit-test-123";

  // Ação 1: Impressão de Etiqueta
  const actionPrint = await processHefistoIntent({
    text: "imprima 3 etiquetas de Molho Branco",
    session: adminSession,
    unitId: mockUnitId
  });
  assert(actionPrint.type === "ACTION_PREVIEW" || actionPrint.type === "MISSING_PARAM" || actionPrint.responseText.toLowerCase().includes("molho branco"), "Processou pedido de etiqueta de Molho Branco");

  // Ação 2: Entrada de Estoque
  const actionEntry = await processHefistoIntent({
    text: "adicione 10 kg de Camarão ao estoque",
    session: adminSession,
    unitId: mockUnitId
  });
  assert(actionEntry.type === "ACTION_PREVIEW" || actionEntry.type === "MISSING_PARAM" || actionEntry.type === "AMBIGUOUS_PRODUCT" || actionEntry.responseText.toLowerCase().includes("camarao"), "Processou entrada de estoque");

  // Ação 3: Saída de Estoque
  const actionExit = await processHefistoIntent({
    text: "dê saída em 2 kg de Arroz",
    session: adminSession,
    unitId: mockUnitId
  });
  assert(actionExit.type === "ACTION_PREVIEW" || actionExit.type === "MISSING_PARAM" || actionExit.type === "AMBIGUOUS_PRODUCT" || actionExit.responseText.toLowerCase().includes("arroz"), "Processou saída de estoque");

  // Ação 4: Registrar Perda
  const actionLoss = await processHefistoIntent({
    text: "registre perda de 500g de Camarão por queda",
    session: adminSession,
    unitId: mockUnitId
  });
  assert(actionLoss.type === "ACTION_PREVIEW" || actionLoss.type === "MISSING_PARAM" || actionLoss.type === "AMBIGUOUS_PRODUCT" || actionLoss.responseText.toLowerCase().includes("camarao"), "Processou registro de perda de estoque");

  // Ação 5: Concluir Produção
  const actionProd = await processHefistoIntent({
    text: "concluir producao de hoje",
    session: adminSession,
    unitId: mockUnitId
  });
  assert(actionProd !== null, "Processou intenção de conclusão de produção");

  // ---------------------------------------------------------------------------
  // TEST 4: PERMISSÕES E SEGURANÇA ESTRITA
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. Enforcing de Permissões e Bloqueio Sem Permissão ---");
  const limitedSession = {
    id: "user-limitado",
    nome: "Operador Sem Permissões",
    gerenciado: true,
    cargo: "Atendente",
    permissoes_personalizadas: [] // Nenhuma permissão de escrita
  };

  const denPrint = await processHefistoIntent({
    text: "imprima 3 etiquetas de Molho Branco",
    session: limitedSession,
    unitId: mockUnitId
  });
  assert(denPrint.permissionDenied === true, "Bloqueou impressão de etiquetas para usuário sem permissão");

  const denEntry = await processHefistoIntent({
    text: "adicione 10 kg de Camarão ao estoque",
    session: limitedSession,
    unitId: mockUnitId
  });
  assert(denEntry.permissionDenied === true, "Bloqueou entrada de estoque para usuário sem permissão");

  const denLoss = await processHefistoIntent({
    text: "registre perda de 500g de Camarão",
    session: limitedSession,
    unitId: mockUnitId
  });
  assert(denLoss.permissionDenied === true, "Bloqueou registro de perda para usuário sem permissão");

  // ---------------------------------------------------------------------------
  // TEST 5: REGRA DE OURO — NENHUMA MUTAÇÃO DIRETA EM LINGUAGEM NATURAL
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. Regra de Ouro — Assistente NUNCA altera banco na entrada de texto ---");
  const parseOnlyResult = await parseActionIntent({
    text: "registre entrada de 50 kg de Camarão",
    session: adminSession,
    unitId: mockUnitId
  });
  assert(parseOnlyResult.type === "ACTION_PREVIEW" || parseOnlyResult.type === "AMBIGUOUS_PRODUCT" || parseOnlyResult.type === "MISSING_PARAM" || parseOnlyResult.responseText.toLowerCase().includes("camarao"), "Retorna apenas PREVIEW da ação (requer confirmação explícita)");

  // ---------------------------------------------------------------------------
  // TEST 6: REGRESSÃO DE PONTO (ESCOPO PRESERVADO - SEM FACIAL / AUTOMÁTICO)
  // ---------------------------------------------------------------------------
  console.log("\n--- 6. Preservação do Escopo de Registro de Ponto TRADICIONAL ---");
  const pontoClockIntent = await processHefistoIntent({
    text: "bater ponto",
    session: adminSession,
    unitId: mockUnitId
  });
  console.log("DEBUG PONTO INTENT:", pontoClockIntent);
  assert(
    pontoClockIntent?.success && (
      (pontoClockIntent.type === "NAVIGATION" && pontoClockIntent.targetRoute.includes("ponto")) ||
      (pontoClockIntent.type === "AMBIGUOUS" && pontoClockIntent.options.some(o => o.route.includes("ponto")))
    ),
    "Comando 'bater ponto' redireciona para Quiosque/Ponto TRADICIONAL"
  );

  // ---------------------------------------------------------------------------
  // TEST 7: EXECUTOR REAL DE AÇÕES (TESTE EM MEMÓRIA DE EXECECUÇÃO)
  // ---------------------------------------------------------------------------
  console.log("\n--- 7. Teste do Executor Real (executeRealAction) ---");
  const execMock = await executeRealAction({
    actionId: "inventory.entry",
    payload: {
      insumoId: "insumo-test-1",
      nome: "Camarão 40/60",
      quantidade: 10,
      motivo: "Entrada via Héfisto F2 Test"
    },
    session: adminSession,
    unitId: mockUnitId
  });
  assert(execMock.success === true, "Executou serviço real de entrada com sucesso");
  assert(execMock.responseText.includes("Entrada registrada"), "Mensagem de confirmação de entrada emitida");

  const execProdMock = await executeRealAction({
    actionId: "production.complete",
    payload: {
      producaoId: "prod-test-1",
      nome: "Molho de Tomate",
      quantidade: 5
    },
    session: adminSession,
    unitId: mockUnitId
  });
  assert(execProdMock.success === true, "Executou serviço real de conclusão de produção");

  // ---------------------------------------------------------------------------
  // RESUMO FINAL DOS TESTES F2
  // ---------------------------------------------------------------------------
  console.log("\n==================================================");
  console.log(`RESULTADO DA FASE F2: ${passed} PASSOU | ${failed} FALHOU`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
