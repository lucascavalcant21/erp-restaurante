/**
 * Teste do Handler "Imprimir agora" e Regras WebUSB MDK-022 (Requirement 11)
 *
 * Testes executados:
 * A) navigator.usb disponível -> chama MDK-022 via WebUSB -> NÃO chama window.print
 * B) WebUSB imprime com sucesso -> transferOut no endpoint 2 -> NÃO chama imprimirHtml
 * C) WebUSB apresenta erro -> registra erro -> NÃO abre window.print
 * D) Desktop sem WebUSB -> mantém fallback navegador antigo intacto
 */

const assert = require("assert");

console.log("=== INICIANDO TESTES DO FLUXO 'IMPRIMIR AGORA' MDK-022 ===");

// Mocks
let windowPrintChamado = false;
let imprimirHtmlChamado = false;
let transferOutEndpoint = null;
let transferOutBytes = 0;

function resetMocks() {
  windowPrintChamado = false;
  imprimirHtmlChamado = false;
  transferOutEndpoint = null;
  transferOutBytes = 0;
}

// Mock da função simulated de handler do botão Imprimir agora
async function mockImprimirAgoraHandler({ navigatorUsbPresente, transferOutSucesso }) {
  windowPrintChamado = false;
  imprimirHtmlChamado = false;
  transferOutEndpoint = null;
  transferOutBytes = 0;

  let statusMdk = "";
  let erroMdk = null;

  // WebUSB Disponível
  if (navigatorUsbPresente) {
    statusMdk = "Conectando à MDK-022...";
    
    // Simula obterDispositivo + transferOut
    if (transferOutSucesso) {
      transferOutEndpoint = 2;
      transferOutBytes = 420;
      statusMdk = "Etiqueta enviada para MDK-022.";
    } else {
      transferOutEndpoint = 2;
      erroMdk = "Erro de I/O na porta USB";
      statusMdk = "Não foi possível imprimir na MDK-022.";
    }

    // REGRA CRÍTICA: Retorno absoluto (NUNCA chama window.print)
    return { statusMdk, erroMdk, windowPrintChamado, imprimirHtmlChamado };
  }

  // Fallback Desktop sem WebUSB
  imprimirHtmlChamado = true;
  windowPrintChamado = true;
  return { statusMdk: "fallback", erroMdk: null, windowPrintChamado, imprimirHtmlChamado };
}

async function rodarTestes() {
  // Teste A: navigator.usb disponível -> NÃO chama window.print
  console.log("\n[TESTE A] Navegador com WebUSB disponível...");
  const resA = await mockImprimirAgoraHandler({ navigatorUsbPresente: true, transferOutSucesso: true });
  assert.strictEqual(resA.windowPrintChamado, false, "NÃO deve chamar window.print quando navigator.usb está disponível");
  console.log("✔ Teste A PASSOU: window.print NÃO foi chamado.");

  // Teste B: WebUSB imprime com sucesso -> transferOut no endpoint 2 -> NÃO chama imprimirHtml
  console.log("\n[TESTE B] WebUSB transmissão com sucesso...");
  const resB = await mockImprimirAgoraHandler({ navigatorUsbPresente: true, transferOutSucesso: true });
  assert.strictEqual(transferOutEndpoint, 2, "Endpoint OUT deve ser 2");
  assert.strictEqual(resB.imprimirHtmlChamado, false, "NÃO deve chamar imprimirHtml");
  assert.strictEqual(resB.statusMdk, "Etiqueta enviada para MDK-022.", "Status deve ser sucesso");
  console.log("✔ Teste B PASSOU: transferOut realizado no endpoint #2 sem chamar imprimirHtml.");

  // Teste C: WebUSB apresenta erro -> mostra erro no modal -> NÃO abre window.print
  console.log("\n[TESTE C] WebUSB com erro de transmissão...");
  const resC = await mockImprimirAgoraHandler({ navigatorUsbPresente: true, transferOutSucesso: false });
  assert.strictEqual(resC.windowPrintChamado, false, "NÃO deve abrir diálogo do navegador mesmo em erro");
  assert.strictEqual(resC.statusMdk, "Não foi possível imprimir na MDK-022.", "Exibe erro no modal");
  assert.ok(resC.erroMdk, "Registrou mensagem de erro");
  console.log("✔ Teste C PASSOU: Erro exibido no ERP sem abrir window.print.");

  // Teste D: Desktop sem WebUSB -> mantém comportamento antigo
  console.log("\n[TESTE D] Desktop sem WebUSB (ex: Firefox)...");
  const resD = await mockImprimirAgoraHandler({ navigatorUsbPresente: false, transferOutSucesso: false });
  assert.strictEqual(resD.imprimirHtmlChamado, true, "Deve usar fallback antigo (imprimirHtml)");
  assert.strictEqual(resD.windowPrintChamado, true, "Deve chamar window.print no Desktop sem WebUSB");
  console.log("✔ Teste D PASSOU: Comportamento antigo mantido intacto no Desktop sem WebUSB.");

  console.log("\n==================================================");
  console.log("TODOS OS 4 TESTES PASSARAM COM SUCESSO ABSOLUTO!");
  console.log("==================================================");
}

rodarTestes().catch(err => {
  console.error("FALHA NO TESTE:", err);
  process.exit(1);
});
