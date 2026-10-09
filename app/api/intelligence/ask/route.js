// POST /api/intelligence/ask — "Pergunte ao Héfisto" (texto ou voz já transcrita).
// Corpo: { texto, chave, canal?, tela?, conversa?, continuar?: { acaoId, campo, valor | valorNumero } }
// `conversa` = a `referencia` da resposta anterior (não confiável: reconferida no servidor).
// Tenant e usuário vêm da sessão + banco (atenderInteligencia), nunca do corpo.
import { atenderInteligencia } from "../../../lib/intelligence/server/http.mjs";
import { handlerAsk } from "../../../lib/intelligence/server/handlers.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  return atenderInteligencia(request, handlerAsk());
}
