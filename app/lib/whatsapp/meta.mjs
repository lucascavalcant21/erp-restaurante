// Meta WhatsApp Cloud API (oficial): desafio do webhook, assinatura
// X-Hub-Signature-256, leitura das mensagens e envio de texto.
// Sem segredo configurado, NADA passa (falha fechada; não há token padrão).
// O token de acesso nunca vai para log.
import { createHmac, timingSafeEqual } from "node:crypto";

const VERSAO_GRAPH = "v23.0";
export const LIMITE_TEXTO = 4000; // a Meta aceita 4096 no corpo de texto

function iguais(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** GET do webhook: devolve o challenge se o verify token bater, senão null. */
export function desafioDoWebhook(params, tokenEsperado) {
  if (!tokenEsperado) return null;
  if (params.get("hub.mode") !== "subscribe") return null;
  if (!iguais(params.get("hub.verify_token") || "", tokenEsperado)) return null;
  const c = params.get("hub.challenge") || "";
  return /^[A-Za-z0-9_\-]{1,200}$/.test(c) ? c : null;
}

/** HMAC-SHA256 do corpo BRUTO com o App Secret. Sem segredo ou sem cabeçalho: inválida. */
export function assinaturaValida(corpoBruto, cabecalho, segredo) {
  if (!segredo || !cabecalho) return false;
  const m = /^sha256=([0-9a-f]{64})$/i.exec(String(cabecalho).trim());
  if (!m) return false;
  const esperado = createHmac("sha256", segredo).update(corpoBruto, "utf8").digest("hex");
  return iguais(esperado, m[1].toLowerCase());
}

/** Mensagens de entrada do payload (ignora status de entrega, reações etc.). */
export function extrairMensagens(payload) {
  const out = [];
  for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
    for (const ch of Array.isArray(entry?.changes) ? entry.changes : []) {
      if (ch?.field !== "messages") continue;
      const v = ch.value || {};
      for (const m of Array.isArray(v.messages) ? v.messages : []) {
        if (!m?.id || !m?.from) continue;
        const texto = m.type === "text" ? m.text?.body
          : m.type === "interactive" ? (m.interactive?.button_reply?.title || m.interactive?.list_reply?.title)
          : m.type === "button" ? m.button?.text : null;
        out.push({
          id: String(m.id), de: String(m.from), tipo: String(m.type || ""), texto: typeof texto === "string" ? texto : null,
          ts: Number(m.timestamp) || null, phoneNumberId: v.metadata?.phone_number_id ? String(v.metadata.phone_number_id) : null,
        });
      }
    }
  }
  return out;
}

/** Recibos de entrega das mensagens que ENVIAMOS (sent/delivered/read/failed), com o erro da Meta se houver. */
export function extrairStatus(payload) {
  const out = [];
  for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
    for (const ch of Array.isArray(entry?.changes) ? entry.changes : []) {
      if (ch?.field !== "messages") continue;
      for (const s of Array.isArray(ch.value?.statuses) ? ch.value.statuses : []) {
        if (!s?.id || !s?.status) continue;
        out.push({
          id: String(s.id), status: String(s.status), para: String(s.recipient_id || ""),
          erros: (Array.isArray(s.errors) ? s.errors : []).slice(0, 3).map((e) => ({ codigo: e?.code ?? null, titulo: String(e?.title || e?.message || "").slice(0, 120) })),
        });
      }
    }
  }
  return out;
}

/** Quebra em partes de até `limite` caracteres, preferindo quebra de linha. */
export function partir(texto, limite = LIMITE_TEXTO) {
  const partes = [];
  let resto = String(texto ?? "");
  while (resto.length > limite) {
    let corte = resto.lastIndexOf("\n", limite);
    if (corte < limite / 2) corte = limite;
    partes.push(resto.slice(0, corte).trimEnd());
    resto = resto.slice(corte).trimStart();
  }
  if (resto) partes.push(resto);
  return partes;
}

/**
 * Envia texto para `para` (dígitos). Responde à mensagem do dono dentro da
 * janela de 24 h, então texto livre é permitido.
 * @returns {Promise<{ ok: boolean, ids?: string[], status?: number, erro?: string }>}  ids = message_id da Meta
 */
export async function enviarTexto({ para, texto, env = process.env, fetchImpl = fetch }) {
  const token = env.WHATSAPP_API_TOKEN, numeroId = env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !numeroId) return { ok: false, erro: "WHATSAPP_API_TOKEN/WHATSAPP_PHONE_NUMBER_ID ausentes" };
  const url = `https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION || VERSAO_GRAPH}/${encodeURIComponent(numeroId)}/messages`;
  const ids = [];
  for (const parte of partir(texto)) {
    let r;
    try {
      r = await fetchImpl(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: String(para), type: "text", text: { body: parte, preview_url: false } }),
      });
    } catch {
      return { ok: false, erro: "falha de rede ao chamar a Graph API" };
    }
    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      return { ok: false, ids, status: r.status, erro: corpo?.error ? `${corpo.error.code || ""} ${corpo.error.message || ""}`.trim().slice(0, 200) : `HTTP ${r.status}` };
    }
    const corpo = await r.json().catch(() => null);
    for (const m of Array.isArray(corpo?.messages) ? corpo.messages : []) if (m?.id) ids.push(String(m.id));
  }
  return { ok: true, ids };
}
