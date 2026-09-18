// ═══════════════════════════════════════════════════════════════
// FASE 3A — WHATSAPP CHANNEL ADAPTER INTEGRATION
// app/lib/server/channels/whatsapp/adapter.mjs
// ═══════════════════════════════════════════════════════════════

import { createNormalizedMessage } from "../normalized-message.mjs";
import { resolveWhatsAppIdentity } from "./identity.mjs";
import { checkRateLimit } from "./rate-limiter.mjs";
import { sendWhatsAppTextMessage, sendWhatsAppInteractiveButtons } from "./sender.mjs";
import { processHefistoIntent } from "../../../hefisto-intents.js";
import { executeConfirmedTool, cancelConfirmation } from "../../../confirmation-engine.js";
import { supabase, isSupabaseReady } from "../../../supabase.js";

// Store em memória para deduplicação em dev/testes sintéticos
const processedMessagesStore = new Set();

/**
 * Converte o preview do Agent Core em texto formatado para WhatsApp (com marcação Markdown do WhatsApp).
 */
export function serializePreviewForWhatsApp(preview = {}) {
  const title = (preview.title || preview.actionName || "CONFIRMAÇÃO DE AÇÃO").toUpperCase();
  const summary = preview.summary || "";
  const fields = preview.fields || [];

  let text = `*${title}*\n`;
  if (summary) {
    text += `${summary}\n\n`;
  } else {
    text += `\n`;
  }

  fields.forEach(f => {
    text += `• *${f.label}*: ${f.value}\n`;
  });

  text += `\n*Deseja confirmar esta operação?*`;
  return text;
}

/**
 * Processa eventos recebidos do Webhook do WhatsApp.
 * 
 * @param {object} rawPayload - Payload bruto vindo do Meta Webhook
 * @returns {Promise<object>} Resultado do processamento do evento
 */
export async function processWhatsAppIncomingEvent(rawPayload) {
  // 1. Extração da Estrutura Padrão da Meta API
  const entry = rawPayload?.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  const message = value?.messages?.[0];

  if (!message) {
    return { success: true, ignored: true, reason: "Payload sem mensagens de usuário." };
  }

  const externalMessageId = message.id;
  const fromPhone = message.from;
  const timestamp = message.timestamp;

  // 2. Deduplicação do Webhook (Idempotência Externa)
  if (processedMessagesStore.has(externalMessageId)) {
    return { success: true, duplicate: true, externalMessageId };
  }
  processedMessagesStore.add(externalMessageId);

  if (isSupabaseReady()) {
    try {
      const { error } = await supabase
        .from("whatsapp_processed_messages")
        .insert([{ external_message_id: externalMessageId, phone_number: fromPhone }]);
      if (error && error.code === "23505") {
        return { success: true, duplicate: true, externalMessageId };
      }
    } catch (e) {}
  }

  // 3. Resolução de Identidade (Apenas usuários autorizados)
  const identity = await resolveWhatsAppIdentity(fromPhone);
  if (!identity.isAuthorized) {
    await sendWhatsAppTextMessage({
      recipientPhone: fromPhone,
      text: "Acesso Não Autorizado: Este número de WhatsApp não possui cadastro administrativo ativo no Héfisto ERP."
    });
    return { success: false, authorized: false, reason: "Telefone não autorizado." };
  }

  // 4. Rate Limiting por Telefone
  const rateLimit = checkRateLimit(fromPhone);
  if (!rateLimit.allowed) {
    await sendWhatsAppTextMessage({
      recipientPhone: fromPhone,
      text: "Você atingiu o limite de mensagens temporário. Aguarde um minuto e tente novamente."
    });
    return { success: false, rateLimited: true };
  }

  const { session } = identity;
  const conversationId = `wa-${fromPhone}`;

  // 5. Verificar se é uma Resposta a Botão Interativo (Quick Reply Payload)
  let buttonPayload = null;
  if (message.type === "interactive" && message.interactive?.button_reply) {
    buttonPayload = message.interactive.button_reply.id;
  } else if (message.type === "button") {
    buttonPayload = message.button?.payload;
  }

  if (buttonPayload) {
    if (buttonPayload.startsWith("CONFIRM_")) {
      const cnfId = buttonPayload.replace("CONFIRM_", "");
      try {
        const execRes = await executeConfirmedTool({ confirmationId: cnfId, session });
        await sendWhatsAppTextMessage({
          recipientPhone: fromPhone,
          text: `✅ *Ação Executada com Sucesso!*\n\n${execRes.message || "A operação foi efetivada no ERP e registrada na auditoria."}`
        });
        return { success: true, actionExecuted: true, confirmationId: cnfId };
      } catch (err) {
        await sendWhatsAppTextMessage({
          recipientPhone: fromPhone,
          text: `❌ *Falha na Execução*: ${err.message}`
        });
        return { success: false, error: err.message };
      }
    }

    if (buttonPayload.startsWith("CANCEL_")) {
      const cnfId = buttonPayload.replace("CANCEL_", "");
      try {
        await cancelConfirmation({ confirmationId: cnfId, session });
        await sendWhatsAppTextMessage({
          recipientPhone: fromPhone,
          text: "❌ *Operação Cancelada*: A confirmação foi desativada e nenhuma alteração foi realizada no banco."
        });
        return { success: true, actionCancelled: true, confirmationId: cnfId };
      } catch (err) {
        await sendWhatsAppTextMessage({
          recipientPhone: fromPhone,
          text: `Aviso: ${err.message}`
        });
        return { success: false, error: err.message };
      }
    }
  }

  // 6. Normalização da Mensagem de Texto
  const textContent = message.text?.body || message.caption || "";
  const normalizedMsg = createNormalizedMessage({
    channel: "whatsapp",
    externalMessageId,
    externalUserId: fromPhone,
    conversationExternalId: conversationId,
    text: textContent,
    timestamp: timestamp ? timestamp * 1000 : Date.now()
  });

  // 7. Invocação do Agent Core Existente
  const agentResult = await processHefistoIntent({
    text: normalizedMsg.text,
    session,
    unitId: session.unidadeId,
    contextState: { conversationId }
  });

  // 8. Tratamento do Retorno do Agent Core
  if (agentResult.type === "WRITE_PREVIEW" && agentResult.confirmation) {
    const preview = agentResult.confirmation.preview;
    const cnfId = agentResult.confirmation.confirmationId;

    const formattedText = serializePreviewForWhatsApp(preview);
    const buttons = [
      { id: `CONFIRM_${cnfId}`, title: "Confirmar" },
      { id: `CANCEL_${cnfId}`, title: "Cancelar" }
    ];

    await sendWhatsAppInteractiveButtons({
      recipientPhone: fromPhone,
      bodyText: formattedText,
      buttons
    });

    return { success: true, type: "WRITE_PREVIEW_SENT", confirmationId: cnfId };
  }

  if (agentResult.type === "WRITE_EXECUTED") {
    await sendWhatsAppTextMessage({
      recipientPhone: fromPhone,
      text: `✅ *Ação Executada com Sucesso!*\n\n${agentResult.responseText}`
    });
    return { success: true, type: "WRITE_EXECUTED" };
  }

  // Respostas de Consulta READ, Analytics ou Erros
  const responseText = agentResult.responseText || "Não consegui processar a solicitação.";
  await sendWhatsAppTextMessage({
    recipientPhone: fromPhone,
    text: responseText
  });

  return { success: true, type: agentResult.type || "READ_RESPONSE" };
}
