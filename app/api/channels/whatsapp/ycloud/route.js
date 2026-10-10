// Webhook do YCloud → Command Gateway (HDEV-WA-COEX-001: número do Héfisto em
// coexistência com o WhatsApp Business App).
//
// POST assinatura `YCloud-Signature` OBRIGATÓRIA (YCLOUD_WEBHOOK_SECRET; sem
//      segredo, assinatura inválida ou velha: 401 e nada roda). Responde 200 na
//      hora e processa depois (after).
// Só vira comando: mensagem de cliente PARA o número do Héfisto
// (WHATSAPP_NUMERO_HEFISTO). Ecos do celular e histórico: só registro.
// O remetente ainda passa pela allowlist (WHATSAPP_NUMEROS_DONO) no gateway.
import { after } from "next/server";
import { assinaturaYCloudValida, lerEventoYCloud } from "../../../../lib/whatsapp/ycloud.mjs";
import { mesmoNumero, mascarar } from "../../../../lib/whatsapp/numero.mjs";
import { atenderMensagem } from "../../../../lib/whatsapp/gateway.mjs";
import { depsDoServidor } from "../../../../lib/whatsapp/servidor.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LIMITE_CORPO = 256 * 1024;

export async function POST(request) {
  if (Number(request.headers.get("content-length") || 0) > LIMITE_CORPO) return new Response("Payload Too Large", { status: 413 });
  const bruto = await request.text().catch(() => "");
  if (bruto.length > LIMITE_CORPO) return new Response("Payload Too Large", { status: 413 });
  if (!assinaturaYCloudValida(bruto, request.headers.get("ycloud-signature"), process.env.YCLOUD_WEBHOOK_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  let ev;
  try { ev = JSON.parse(bruto); } catch { return new Response("Bad Request", { status: 400 }); }

  const e = lerEventoYCloud(ev);
  if (e.tipo === "status") {
    console.log("[whatsapp] entrega", JSON.stringify({ provedor: "ycloud", id: e.status.id, status: e.status.status, para: mascarar(e.status.para), erros: e.status.erros }));
  } else if (e.tipo === "eco" || e.tipo === "historico") {
    console.log("[whatsapp] coexistencia", JSON.stringify({ evento: ev?.type, id: e.eventoId }));
  } else if (e.tipo === "mensagem") {
    if (!mesmoNumero(e.mensagem.para, process.env.WHATSAPP_NUMERO_HEFISTO)) {
      console.log("[whatsapp]", JSON.stringify({ resultado: "outro_numero", para: mascarar(e.mensagem.para) }));
    } else {
      after(async () => {
        try { await atenderMensagem(e.mensagem, depsDoServidor()); } catch (err) { console.error("[whatsapp] falha no gateway", err?.name || "Erro"); }
      });
    }
  }
  return Response.json({ ok: true });
}
