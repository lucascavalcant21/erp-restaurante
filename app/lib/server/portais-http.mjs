import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "./supabase-server.mjs";
import { dentroDoLimite, ipDoPedido } from "./limite-por-ip.mjs";

// Casca comum das rotas /api/public/*: não há sessão, por definição. O que
// protege é a lista fechada de campos, o limite de envios e a resposta mínima.

const SEM_CACHE = { "Cache-Control": "no-store" };
export const responder = (corpo, status = 200) => NextResponse.json(corpo, { status, headers: SEM_CACHE });
export const recusar = (r) => responder({ erro: r.mensagem, codigo: r.codigo }, r.status);

/** Cliente de servidor, ou uma resposta 503 pronta. Nunca expõe o motivo. */
export function bancoDoServidor() {
  try { return { db: getSupabaseServerClient() }; }
  catch { return { resposta: responder({ erro: "Serviço indisponível no momento.", codigo: "indisponivel" }, 503) }; }
}

export function freioPorIp(request, rota, opcoes) {
  if (dentroDoLimite(`${rota}:${ipDoPedido(request)}`, opcoes)) return null;
  return responder({ erro: "Muitas tentativas. Aguarde alguns minutos.", codigo: "limite" }, 429);
}

export async function corpoJson(request, maxBytes = 64 * 1024) {
  const tamanho = Number(request.headers.get("content-length") || 0);
  if (tamanho > maxBytes) return null;
  const txt = await request.text().catch(() => "");
  if (!txt || txt.length > maxBytes) return null;
  try { const o = JSON.parse(txt); return o && typeof o === "object" ? o : null; } catch { return null; }
}
