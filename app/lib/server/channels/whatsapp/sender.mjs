// ═══════════════════════════════════════════════════════════════
// FASE 3A — WHATSAPP SENDER & INTERACTIVE BUTTON SERIALIZER
// app/lib/server/channels/whatsapp/sender.mjs
// ═══════════════════════════════════════════════════════════════

const sentWhatsAppLog = [];

/**
 * Envia uma mensagem de texto simples pelo WhatsApp Meta Graph API.
 */
export async function sendWhatsAppTextMessage({ recipientPhone, text }) {
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipientPhone,
    type: "text",
    text: { body: text }
  };

  sentWhatsAppLog.push({ recipientPhone, type: "text", text, payload, timestamp: Date.now() });

  if (process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    try {
      const url = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
      await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error("Erro ao enviar mensagem Meta WhatsApp API:", err);
    }
  }

  return { success: true, payload };
}

/**
 * Serializa e envia mensagens interativas com botões oficiais (Quick Reply Buttons) do Meta Cloud API.
 * 
 * @param {object} params
 * @param {string} params.recipientPhone - Telefone de destino
 * @param {string} params.bodyText - Texto formatado do corpo da prévia
 * @param {Array<{ id: string, title: string }>} params.buttons - Botões interativos (ex: CONFIRM_cnf-xxx)
 */
export async function sendWhatsAppInteractiveButtons({ recipientPhone, bodyText, buttons }) {
  const formattedButtons = buttons.slice(0, 3).map(btn => ({
    type: "reply",
    reply: {
      id: btn.id,
      title: btn.title.slice(0, 20) // Meta limita títulos a 20 caracteres
    }
  }));

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipientPhone,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: { buttons: formattedButtons }
    }
  };

  sentWhatsAppLog.push({ recipientPhone, type: "interactive", bodyText, buttons, payload, timestamp: Date.now() });

  if (process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    try {
      const url = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
      await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error("Erro ao enviar botões interativos WhatsApp API:", err);
    }
  }

  return { success: true, payload };
}

/**
 * Utilitário para consultar mensagens enviadas em testes sintéticos.
 */
export function getSentWhatsAppLog() {
  return sentWhatsAppLog;
}

/**
 * Limpa o log de mensagens enviadas (para reset de testes).
 */
export function clearSentWhatsAppLog() {
  sentWhatsAppLog.length = 0;
}
