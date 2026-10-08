import { processWhatsAppIncomingEvent } from "../../../../lib/server/channels/whatsapp/adapter.mjs";
import { igualEmTempoConstante, verificarHmac } from "../../../../lib/server/integracoes.mjs";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Valida a assinatura HMAC-SHA256 enviada no cabeçalho 'X-Hub-Signature-256' pela Meta.
 * Fechada: sem segredo, sem cabeçalho ou com prefixo/tamanho diferente → false.
 */
function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  return verificarHmac({ segredo: appSecret, corpoBruto: rawBody, assinatura: signatureHeader, prefixo: "sha256=" });
}

/**
 * GET — Desafio de verificação do Webhook da Meta.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = (process.env.WHATSAPP_VERIFY_TOKEN || "").trim().replace(/^["']|["']$/g, "");
  if (!verifyToken) {
    console.error("❌ WHATSAPP_VERIFY_TOKEN não configurado: verificação do Webhook do WhatsApp recusada.");
    return Response.json({ error: "Token de verificação inválido." }, { status: 403 });
  }

  if (mode === "subscribe" && igualEmTempoConstante(token, verifyToken)) {
    console.log("✓ Webhook do WhatsApp verificado com sucesso pelo Meta Graph API.");
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  return Response.json({ error: "Token de verificação inválido." }, { status: 403 });
}

/**
 * POST — Recepção de eventos e mensagens do WhatsApp.
 * Nada é processado sem WHATSAPP_APP_SECRET configurado (503) e assinatura válida (401).
 */
export async function POST(request) {
  try {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) {
      console.error("❌ WHATSAPP_APP_SECRET não configurado: Webhook do WhatsApp desativado.");
      return Response.json({ error: "Webhook do WhatsApp não configurado." }, { status: 503 });
    }

    const rawBody = await request.text();
    const signatureHeader = request.headers.get("x-hub-signature-256");

    if (!verifyMetaSignature(rawBody, signatureHeader, appSecret)) {
      console.error("❌ Assinatura ausente ou inválida no Webhook do WhatsApp.");
      return Response.json({ error: "Assinatura inválida." }, { status: 401 });
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
