// ═══════════════════════════════════════════════════════════════
// FASE 3A — WHATSAPP CHANNEL ADAPTER EVALUATION & SAFETY SUITE
// scripts/test-phase-3a-whatsapp.mjs
// ═══════════════════════════════════════════════════════════════

import crypto from "crypto";
import { GET as webhookGET, POST as webhookPOST } from "../app/api/channels/whatsapp/webhook/route.js";
import { processWhatsAppIncomingEvent, serializePreviewForWhatsApp } from "../app/lib/server/channels/whatsapp/adapter.mjs";
import { resolveWhatsAppIdentity, registerWhatsAppIdentity } from "../app/lib/server/channels/whatsapp/identity.mjs";
import { checkRateLimit, clearRateLimiter } from "../app/lib/server/channels/whatsapp/rate-limiter.mjs";
import { getSentWhatsAppLog, clearSentWhatsAppLog } from "../app/lib/server/channels/whatsapp/sender.mjs";
import { createNormalizedMessage } from "../app/lib/server/channels/normalized-message.mjs";

console.log("==========================================");
console.log("EXECUTING FASE 3A WHATSAPP CHANNEL SUITE");
console.log("==========================================\n");

function mockMetaPayload({ from = "5511987654321", messageId = `msg-${Date.now()}`, text = "", buttonPayload = null }) {
  const msgObj = {
    from,
    id: messageId,
    timestamp: Math.floor(Date.now() / 1000),
  };

  if (buttonPayload) {
    msgObj.type = "interactive";
    msgObj.interactive = {
      type: "button_reply",
      button_reply: { id: buttonPayload, title: "Confirmar" }
    };
  } else {
    msgObj.type = "text";
    msgObj.text = { body: text };
  }

  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "entry-1",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "+5511987654321", phone_number_id: "phone-123" },
              messages: [msgObj]
            },
            field: "messages"
          }
        ]
      }
    ]
  };
}

async function runWhatsAppTests() {
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition, message) {
    totalCount++;
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passedCount++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      process.exit(1);
    }
  }

  clearSentWhatsAppLog();
  clearRateLimiter();

  // --- 1. TESTE DE VERIFICAÇÃO DO WEBHOOK (GET Challenge) ---
  console.log("--- 1. Testing Webhook GET Verification Challenge ---");
  const reqGetValid = new Request("http://localhost/api/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=hefisto_verify_token&hub.challenge=test_challenge_123");
  const resGetValid = await webhookGET(reqGetValid);
  const textGet = await resGetValid.text();
  assert(resGetValid.status === 200 && textGet === "test_challenge_123", "Webhook GET Challenge verificado com sucesso pelo Meta API (Status 200).");

  const reqGetInvalid = new Request("http://localhost/api/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=token_errado&hub.challenge=123");
  const resGetInvalid = await webhookGET(reqGetInvalid);
  assert(resGetInvalid.status === 403, "Token inválido no GET Challenge rejeitado com Status 403 Forbidden.");

  // --- 2. TESTE DE ASSINATURA E IDENTIDADE ---
  console.log("\n--- 2. Testing Identity Resolver & Authorization ---");
  const adminId = await resolveWhatsAppIdentity("+5511987654321");
  assert(adminId.isAuthorized === true && adminId.role === "ADMIN", "Número de administrador (+5511987654321) resolvido corretamente para perfil ADMIN.");

  const unauthId = await resolveWhatsAppIdentity("+5511999999999");
  assert(unauthId.isAuthorized === false && unauthId.role === "UNKNOWN", "Número desconhecido (+5511999999999) bloqueado (Acesso Não Autorizado).");

  // Teste de chamada de evento para número não autorizado
  clearSentWhatsAppLog();
  const unauthPayload = mockMetaPayload({ from: "5511999999999", text: "Quanto tenho de picanha?" });
  const unauthRes = await processWhatsAppIncomingEvent(unauthPayload);
  assert(unauthRes.authorized === false, "Evento de número não autorizado rejeitado pelo Channel Adapter.");
  const sentLogs = getSentWhatsAppLog();
  assert(sentLogs.length === 1 && sentLogs[0].text.includes("Acesso Não Autorizado"), "Resposta de recusa enviada ao WhatsApp do remetente não autorizado.");

  // --- 3. DEMO MENSAGEM 1: READ PELO WHATSAPP ---
  console.log("\n--- 3. Testing READ Query via WhatsApp (Mensagem 1) ---");
  clearSentWhatsAppLog();
  const msg1Payload = mockMetaPayload({ from: "5511987654321", messageId: "msg-read-01", text: "Quanto tenho de picanha?" });
  const msg1Res = await processWhatsAppIncomingEvent(msg1Payload);
  assert(msg1Res.success === true, "Mensagem 1 (READ) processada pelo Agent Core.");

  const logsMsg1 = getSentWhatsAppLog();
  console.log("DEBUG logsMsg1:", JSON.stringify(logsMsg1, null, 2));

  assert(logsMsg1.length >= 1 && logsMsg1[0].text && logsMsg1[0].text.length > 0, "WhatsApp recebeu resposta real do Agent Core!");

  // --- 4. DEMO MENSAGEM 2: WRITE PREVIEW PELO WHATSAPP ---
  console.log("\n--- 4. Testing WRITE Request & Interactive Preview (Mensagem 2) ---");
  clearSentWhatsAppLog();
  const msg2Payload = mockMetaPayload({ from: "5511987654321", messageId: "msg-write-02", text: "Adicione 15 kg de picanha a 79,90." });
  const msg2Res = await processWhatsAppIncomingEvent(msg2Payload);
  assert(msg2Res.success === true && msg2Res.type === "WRITE_PREVIEW_SENT", "Mensagem 2 (WRITE) gerou prévia interativa.");

  const logsMsg2 = getSentWhatsAppLog();
  assert(logsMsg2.length >= 1 && logsMsg2[0].type === "interactive", "Enviou mensagem interativa com botões oficiais da Meta.");
  assert(logsMsg2[0].buttons.some(b => b.id.startsWith("CONFIRM_")), "Botão [Confirmar] anexado com id opaco de confirmação.");

  const cnfId = msg2Res.confirmationId;
  assert(Boolean(cnfId), "confirmationId armazenado com sucesso.");

  // --- 5. DEMO MENSAGEM 3: CONFIRMAÇÃO POR BOTÃO INTERATIVO ---
  console.log("\n--- 5. Testing Interactive Button Click Confirmation (Mensagem 3) ---");
  clearSentWhatsAppLog();
  const msg3Payload = mockMetaPayload({ from: "5511987654321", messageId: "msg-confirm-03", buttonPayload: `CONFIRM_${cnfId}` });
  const msg3Res = await processWhatsAppIncomingEvent(msg3Payload);
  assert(msg3Res.success === true && msg3Res.actionExecuted === true, "Clique do botão [Confirmar] executou a Tool WRITE com sucesso!");

  const logsMsg3 = getSentWhatsAppLog();
  assert(logsMsg3.length >= 1 && logsMsg3[0].text.includes("Ação Executada com Sucesso"), "Confirmação efetuada e notificada ao usuário no WhatsApp.");

  // --- 6. TESTE DE IDEMPOTÊNCIA DO WEBHOOK ---
  console.log("\n--- 6. Testing Webhook Event Deduplication ---");
  const dupPayload = mockMetaPayload({ from: "5511987654321", messageId: "msg-confirm-03", buttonPayload: `CONFIRM_${cnfId}` });
  const dupRes = await processWhatsAppIncomingEvent(dupPayload);
  assert(dupRes.duplicate === true, "Re-envio do mesmo evento de webhook descartado por duplicidade de externalMessageId.");

  // --- 7. TESTE DE RATE LIMITING ---
  console.log("\n--- 7. Testing Rate Limiter per Phone Number ---");
  clearRateLimiter();
  const testPhone = "+5511987654321";
  for (let i = 0; i < 20; i++) {
    checkRateLimit(testPhone, 20, 60000);
  }
  const overLimit = checkRateLimit(testPhone, 20, 60000);
  assert(overLimit.allowed === false, "Rate Limiter bloqueou a 21ª mensagem do mesmo número dentro de 1 minuto.");

  console.log("\n==========================================");
  console.log(`RESULTS: ${passedCount}/${totalCount} TESTS PASSED PERFECTLY!`);
  console.log("SAFETY PASS: PASS");
  console.log("==========================================");
}

runWhatsAppTests();
