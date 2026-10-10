// Ponte do agente (HDEV-WA-001): o PC do dono (npm run hefisto:ponte) busca os
// comandos de desenvolvimento da fila e devolve as respostas por aqui.
// Autenticação: Authorization: Bearer <WHATSAPP_PONTE_SEGREDO> (32+ caracteres).
// A ponte nunca escolhe o destinatário: o número vem da fila, gravado pelo webhook.
//
// GET  → { itens: [{ id, comando, args }] }  (marca a ponte como online)
// POST { id, ok, resposta } → grava e responde no WhatsApp
import { timingSafeEqual } from "node:crypto";
import { filaDoServidor } from "../../../../lib/whatsapp/servidor.mjs";
import { enviar as enviarPeloProvedor } from "../../../../lib/whatsapp/envio.mjs";
import { dentroDoLimite } from "../../../../lib/server/limite-por-ip.mjs";
import { mascarar } from "../../../../lib/whatsapp/numero.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SEM_CACHE = { "Cache-Control": "no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (corpo, status = 200) => Response.json(corpo, { status, headers: SEM_CACHE });

function autorizada(request) {
  const segredo = process.env.WHATSAPP_PONTE_SEGREDO || "";
  if (segredo.length < 32) return false;
  const dado = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const a = Buffer.from(dado), b = Buffer.from(segredo);
  return a.length === b.length && timingSafeEqual(a, b);
}

function porta(request) {
  if (!dentroDoLimite("wa-ponte", { maximo: 60, janelaMs: 60_000 })) return json({ erro: "limite" }, 429);
  if (!autorizada(request)) return json({ erro: "não autorizada" }, 401);
  return null;
}

export async function GET(request) {
  const recusa = porta(request);
  if (recusa) return recusa;
  try {
    return json(await filaDoServidor().pegar(5));
  } catch {
    return json({ erro: "fila indisponível" }, 503);
  }
}

export async function POST(request) {
  const recusa = porta(request);
  if (recusa) return recusa;
  const corpo = await request.json().catch(() => null);
  if (!corpo || !UUID.test(String(corpo.id || "")) || typeof corpo.resposta !== "string") return json({ erro: "pedido inválido" }, 400);
  try {
    const numero = await filaDoServidor().concluir(corpo.id, { ok: corpo.ok !== false, resposta: corpo.resposta });
    if (!numero) return json({ erro: "comando não está em execução" }, 409);
    const envio = await enviarPeloProvedor({ para: numero, texto: corpo.resposta.slice(0, 8000) });
    console.log("[whatsapp] envio ponte", JSON.stringify({ comando: corpo.id, para: mascarar(numero), ok: envio.ok, ids: envio.ids || [], status: envio.status || null, erro: envio.erro || null }));
    return json({ ok: true, enviado: envio.ok });
  } catch {
    return json({ erro: "fila indisponível" }, 503);
  }
}
