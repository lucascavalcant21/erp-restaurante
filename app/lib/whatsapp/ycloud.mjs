// YCloud (parceiro oficial da Meta) para o número do Héfisto em COEXISTÊNCIA com
// o WhatsApp Business App (HDEV-WA-COEX-001). Docs: docs.ycloud.com (webhooks,
// "send a message directly", coexistence).
//
// Webhook: cabeçalho `YCloud-Signature: t=<unix>,s=<hex>`, HMAC-SHA256 com o
// segredo do endpoint (whsec_…) sobre `${t}.${corpo bruto}`. Sem segredo ou
// assinatura inválida/velha: nada passa (falha fechada), igual ao webhook da Meta.
//
// Eventos que importam:
//   whatsapp.inbound_message.received  mensagem de cliente → pode virar comando
//   whatsapp.message.updated           recibo das mensagens que enviamos
//   whatsapp.smb.message.echoes / .created / whatsapp.smb.history
//                                      o que o dono manda pelo celular e o histórico:
//                                      só registro, NUNCA comando
import { createHmac, timingSafeEqual } from "node:crypto";
import { partir } from "./meta.mjs";

const BASE = "https://api.ycloud.com/v2";
export const TOLERANCIA_S = 5 * 60;

function iguais(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Confere `YCloud-Signature` (t=…,s=…) contra o corpo bruto. */
export function assinaturaYCloudValida(corpoBruto, cabecalho, segredo, agoraS = Math.floor(Date.now() / 1000)) {
  if (!segredo || !cabecalho) return false;
  const partes = Object.fromEntries(String(cabecalho).split(",").map((p) => p.trim().split("=")).filter((p) => p.length === 2));
  const t = Number(partes.t), s = String(partes.s || "").toLowerCase();
  if (!Number.isFinite(t) || !/^[0-9a-f]{64}$/.test(s)) return false;
  if (Math.abs(agoraS - t) > TOLERANCIA_S) return false; // reenvio velho (replay)
  const esperado = createHmac("sha256", segredo).update(`${t}.${corpoBruto}`, "utf8").digest("hex");
  return iguais(esperado, s);
}

const digitos = (n) => String(n ?? "").replace(/\D/g, "");

/**
 * Evento YCloud → o formato do gateway.
 * @returns {{ tipo: "mensagem"|"status"|"eco"|"historico"|"outro", eventoId: string|null, mensagem?: object, status?: object }}
 */
export function lerEventoYCloud(ev) {
  const eventoId = ev?.id ? String(ev.id) : null;
  const tipo = String(ev?.type || "");
  if (tipo === "whatsapp.inbound_message.received") {
    const m = ev.whatsappInboundMessage || {};
    if (!m.from || !(m.wamid || m.id)) return { tipo: "outro", eventoId };
    const texto = m.type === "text" ? m.text?.body
      : m.type === "interactive" ? (m.interactive?.button_reply?.title || m.interactive?.list_reply?.title)
      : m.type === "button" ? m.button?.text : null;
    const ts = m.sendTime ? Math.floor(Date.parse(m.sendTime) / 1000) : null;
    return {
      tipo: "mensagem", eventoId,
      mensagem: { id: String(m.wamid || m.id), de: digitos(m.from), para: digitos(m.to), tipo: String(m.type || ""), texto: typeof texto === "string" ? texto : null, ts: Number.isFinite(ts) ? ts : null },
    };
  }
  if (tipo === "whatsapp.message.updated") {
    const m = ev.whatsappMessage || {};
    return {
      tipo: "status", eventoId,
      status: { id: String(m.wamid || m.id || ""), status: String(m.status || ""), para: digitos(m.to), erros: m.errorCode ? [{ codigo: m.errorCode, titulo: String(m.errorMessage || "").slice(0, 120) }] : [] },
    };
  }
  if (tipo === "whatsapp.smb.message.echoes" || tipo === "whatsapp.smb.message.created") return { tipo: "eco", eventoId };
  if (tipo === "whatsapp.smb.history") return { tipo: "historico", eventoId };
  return { tipo: "outro", eventoId };
}

/**
 * Envia texto pelo YCloud (sendDirectly: síncrono, devolve o id).
 * @returns {Promise<{ ok: boolean, ids?: string[], status?: number, erro?: string }>}
 */
export async function enviarTextoYCloud({ para, texto, env = process.env, fetchImpl = fetch }) {
  const chave = env.YCLOUD_API_KEY, de = digitos(env.WHATSAPP_NUMERO_HEFISTO);
  if (!chave || de.length < 10) return { ok: false, erro: "YCLOUD_API_KEY/WHATSAPP_NUMERO_HEFISTO ausentes" };
  const ids = [];
  for (const parte of partir(texto)) {
    let r;
    try {
      r = await fetchImpl(`${BASE}/whatsapp/messages/sendDirectly`, {
        method: "POST",
        headers: { "X-API-Key": chave, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `+${de}`, to: `+${digitos(para)}`, type: "text", text: { body: parte, preview_url: false } }),
      });
    } catch {
      return { ok: false, ids, erro: "falha de rede ao chamar o YCloud" };
    }
    const corpo = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, ids, status: r.status, erro: corpo?.error ? `${corpo.error.code || ""} ${corpo.error.message || ""}`.trim().slice(0, 200) : `HTTP ${r.status}` };
    if (corpo?.status === "failed") return { ok: false, ids, erro: `${corpo.errorCode || ""} ${corpo.errorMessage || ""}`.trim().slice(0, 200) || "falhou" };
    const id = corpo?.wamid || corpo?.id;
    if (id) ids.push(String(id));
  }
  return { ok: true, ids };
}
