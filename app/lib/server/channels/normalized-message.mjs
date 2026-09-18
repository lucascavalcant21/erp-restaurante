// ═══════════════════════════════════════════════════════════════
// FASE 3A — NORMALIZED MESSAGE CONTRACT
// app/lib/server/channels/normalized-message.mjs
// ═══════════════════════════════════════════════════════════════

/**
 * Contrato comum padronizado para mensagens recebidas de qualquer canal externo.
 * O Agent Core e a camada de inteligência consomem EXCLUSIVAMENTE este formato.
 */
export function createNormalizedMessage({
  channel = "whatsapp",
  externalMessageId,
  externalUserId,
  conversationExternalId,
  text = "",
  attachments = [],
  timestamp = Date.now(),
  metadata = {}
}) {
  if (!externalMessageId) {
    throw new Error("NormalizedMessage Error: externalMessageId é obrigatório.");
  }
  if (!externalUserId) {
    throw new Error("NormalizedMessage Error: externalUserId é obrigatório.");
  }

  return Object.freeze({
    channel: String(channel).toLowerCase(),
    externalMessageId: String(externalMessageId),
    externalUserId: String(externalUserId).trim(),
    conversationExternalId: String(conversationExternalId || externalUserId).trim(),
    text: String(text || "").trim(),
    attachments: Array.isArray(attachments) ? attachments : [],
    timestamp: Number(timestamp) || Date.now(),
    metadata: typeof metadata === "object" && metadata !== null ? metadata : {}
  });
}
