// POST /api/intelligence/ask — "Pergunte ao Héfisto" (texto ou voz já transcrita).
// Corpo: { texto, chave, canal?, tela?, conversa?, continuar?: { acaoId, campo, valor | valorNumero }, nota?, cardapio? }
// `conversa` = a `referencia` da resposta anterior (não confiável: reconferida no servidor).
// Tenant e usuário vêm da sessão + banco (atenderInteligencia), nunca do corpo.
import { atenderInteligencia } from "../../../lib/intelligence/server/http.mjs";
import { handlerAsk } from "../../../lib/intelligence/server/handlers.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// O cardápio lido de um concorrente (até 300 itens com descrição) passa de 16 KB;
// o conteúdo continua validado item a item pelo pedidoSchema.
const LIMITE_CORPO_ASK = 256 * 1024;

export async function POST(request) {
  return atenderInteligencia(request, handlerAsk(), { limiteCorpo: LIMITE_CORPO_ASK });
}
