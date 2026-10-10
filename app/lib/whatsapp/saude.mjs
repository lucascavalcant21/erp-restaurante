// Diagnóstico do canal WhatsApp (HDEV-WA-COEX-001): o que está configurado e
// funcionando, SEM devolver nenhum valor de segredo. Só booleanos, contagens,
// números mascarados e estados. Usado antes/depois do onboarding do YCloud.
import { numerosAutorizados, mascarar, soDigitos } from "./numero.mjs";
import { provedor } from "./envio.mjs";

const tem = (v) => Boolean(v && String(v).trim());

/** Parte pura: o que a configuração diz (testada). */
export function configuracao(env = process.env) {
  const p = provedor(env);
  const meta = { apiToken: tem(env.WHATSAPP_API_TOKEN), phoneNumberId: tem(env.WHATSAPP_PHONE_NUMBER_ID), appSecret: tem(env.WHATSAPP_APP_SECRET), verifyToken: tem(env.WHATSAPP_VERIFY_TOKEN) };
  const ycloud = { apiKey: tem(env.YCLOUD_API_KEY), webhookSecret: tem(env.YCLOUD_WEBHOOK_SECRET), numeroHefisto: soDigitos(env.WHATSAPP_NUMERO_HEFISTO).length >= 10 };
  const comum = { allowlist: numerosAutorizados(env).length, donoAuthUser: tem(env.WHATSAPP_DONO_AUTH_USER_ID), donoUnidade: tem(env.WHATSAPP_DONO_UNIDADE), ponteSegredo: String(env.WHATSAPP_PONTE_SEGREDO || "").length >= 32, serviceRole: tem(env.SUPABASE_SERVICE_ROLE_KEY) };
  const faltando = [];
  if (p === "meta") for (const [k, v] of Object.entries(meta)) if (!v) faltando.push(`meta.${k}`);
  if (p === "ycloud") for (const [k, v] of Object.entries(ycloud)) if (!v) faltando.push(`ycloud.${k}`);
  for (const [k, v] of Object.entries(comum)) if (!v) faltando.push(k);
  return {
    provedor: p,
    numeroHefisto: ycloud.numeroHefisto ? mascarar(env.WHATSAPP_NUMERO_HEFISTO) : null,
    admins: numerosAutorizados(env).map(mascarar),
    meta, ycloud, comum, faltando, pronto: faltando.length === 0,
  };
}

/** Números da conta YCloud (só campos de estado; número mascarado). */
export async function numerosYCloud({ env = process.env, fetchImpl = fetch } = {}) {
  if (!tem(env.YCLOUD_API_KEY)) return { consultado: false };
  try {
    const r = await fetchImpl("https://api.ycloud.com/v2/whatsapp/phoneNumbers?limit=20", { headers: { "X-API-Key": env.YCLOUD_API_KEY } });
    if (!r.ok) return { consultado: true, erro: `HTTP ${r.status}` };
    const j = await r.json().catch(() => null);
    const itens = Array.isArray(j?.items) ? j.items : Array.isArray(j) ? j : [];
    return {
      consultado: true,
      numeros: itens.slice(0, 20).map((n) => ({
        numero: mascarar(n.phoneNumber || n.displayPhoneNumber || ""),
        status: n.status ?? null, qualidade: n.qualityRating ?? null, nome: n.verifiedName ?? null,
        ehHefisto: soDigitos(n.phoneNumber || n.displayPhoneNumber) === soDigitos(env.WHATSAPP_NUMERO_HEFISTO),
      })),
    };
  } catch {
    return { consultado: true, erro: "falha de rede" };
  }
}
