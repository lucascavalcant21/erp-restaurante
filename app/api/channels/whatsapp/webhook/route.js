import crypto from "crypto";
import { processWhatsAppIncomingEvent } from "../../../../lib/server/channels/whatsapp/adapter.mjs";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Valida a assinatura HMAC-SHA256 enviada no cabeçalho 'X-Hub-Signature-256' pela Meta.
 */
function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader || !appSecret) return true;
  const expectedHash = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");
  const signature = signatureHeader.replace("sha256=", "").trim();
  return crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(signature));
}

/**
 * GET — Desafio de verificação do Webhook da Meta.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "hefisto_verify_token";

  if (mode === "subscribe" && token === verifyToken) {
    console.log("✓ Webhook do WhatsApp verificado com sucesso pelo Meta Graph API.");
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  return Response.json({ error: "Token de verificação inválido." }, { status: 403 });
}

/**
 * POST — Recepção de eventos e mensagens do WhatsApp.
 */
export async function POST(request) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("x-hub-signature-256");
    const appSecret = process.env.WHATSAPP_APP_SECRET;

    if (appSecret && signatureHeader) {
      const isValid = verifyMetaSignature(rawBody, signatureHeader, appSecret);
      if (!isValid) {
        console.error("❌ Assinatura inválida no Webhook do WhatsApp.");
        return Response.json({ error: "Assinatura inválida." }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);

    // Processamento assíncrono do evento sem bloquear a resposta HTTP de 200 da Meta
    processWhatsAppIncomingEvent(payload).catch(err => {
      console.error("Erro no processamento de evento do WhatsApp:", err);
    });

    return Response.json({ success: true, status: "EVENT_RECEIVED" }, { status: 200 });
  } catch (err) {
    console.error("Erro no manipulador POST do Webhook do WhatsApp:", err);
    return Response.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
