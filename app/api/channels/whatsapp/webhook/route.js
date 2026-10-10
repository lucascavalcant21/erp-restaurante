// Webhook oficial da Meta (WhatsApp Cloud API) → Command Gateway (HDEV-WA-001).
//
// GET  desafio de verificação (WHATSAPP_VERIFY_TOKEN; sem ele, recusa).
// POST assinatura X-Hub-Signature-256 OBRIGATÓRIA (WHATSAPP_APP_SECRET; sem
//      segredo ou sem assinatura válida, 401 e nada roda). Responde 200 na hora
//      e processa depois (after), para a Meta não reenviar.
//
// Substitui o webhook da fase 3A, que aceitava POST sem assinatura e tinha um
// número de teste fixo como administrador (achado em HDEV-WA-001).
import { after } from "next/server";
import { desafioDoWebhook, assinaturaValida, extrairMensagens, extrairStatus } from "../../../../lib/whatsapp/meta.mjs";
import { atenderMensagem } from "../../../../lib/whatsapp/gateway.mjs";
import { depsDoServidor, auditoriaDoServidor } from "../../../../lib/whatsapp/servidor.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LIMITE_CORPO = 256 * 1024;

export async function GET(request) {
  const challenge = desafioDoWebhook(new URL(request.url).searchParams, process.env.WHATSAPP_VERIFY_TOKEN);
  if (!challenge) return new Response("Forbidden", { status: 403 });
  return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

export async function POST(request) {
  if (Number(request.headers.get("content-length") || 0) > LIMITE_CORPO) return new Response("Payload Too Large", { status: 413 });
  const bruto = await request.text().catch(() => "");
  if (bruto.length > LIMITE_CORPO) return new Response("Payload Too Large", { status: 413 });
  if (!assinaturaValida(bruto, request.headers.get("x-hub-signature-256"), process.env.WHATSAPP_APP_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  let payload;
  try { payload = JSON.parse(bruto); } catch { return new Response("Bad Request", { status: 400 }); }

  // recibos das mensagens que enviamos: sem isso, uma entrega recusada pela Meta não aparece em lugar nenhum
  const registrar = auditoriaDoServidor();
  for (const st of extrairStatus(payload)) {
    await registrar({ provedor: "meta", direcao: "status", wamid: st.id, status: st.status, numero: st.para, erros: st.erros });
  }
  const mensagens = extrairMensagens(payload);
  if (mensagens.length) {
    after(async () => {
      const deps = depsDoServidor();
      for (const m of mensagens) {
        try { await atenderMensagem(m, deps); } catch (e) { console.error("[whatsapp] falha no gateway", e?.name || "Erro"); }
      }
    });
  }
  return Response.json({ ok: true });
}
