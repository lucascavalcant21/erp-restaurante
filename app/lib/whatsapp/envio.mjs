// Envio pelo provedor configurado: WHATSAPP_PROVEDOR = "meta" (padrão, Cloud API
// direto) ou "ycloud" (parceiro, coexistência com o WhatsApp Business App).
// Nenhum número fixo: o remetente vem de WHATSAPP_PHONE_NUMBER_ID (meta) ou
// WHATSAPP_NUMERO_HEFISTO (ycloud).
import { enviarTexto as enviarMeta } from "./meta.mjs";
import { enviarTextoYCloud } from "./ycloud.mjs";

export const provedor = (env = process.env) => (String(env.WHATSAPP_PROVEDOR || "meta").toLowerCase() === "ycloud" ? "ycloud" : "meta");

export function enviar({ para, texto, env = process.env, fetchImpl = fetch }) {
  return provedor(env) === "ycloud"
    ? enviarTextoYCloud({ para, texto, env, fetchImpl })
    : enviarMeta({ para, texto, env, fetchImpl });
}
