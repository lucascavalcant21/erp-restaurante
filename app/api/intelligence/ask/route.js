// POST /api/intelligence/ask — "Pergunte ao Héfisto" (texto ou voz já transcrita).
// Corpo: { texto, chave, canal?, tela?, conversa?, continuar?: { acaoId, campo, valor | valorNumero } }
// `conversa` = a `referencia` da resposta anterior (não confiável: reconferida no servidor).
// Tenant e usuário vêm da sessão + banco (atenderInteligencia), nunca do corpo.
import { atenderInteligencia } from "../../../lib/intelligence/server/http.mjs";
import { processarComando, pedidoSchema } from "../../../lib/intelligence/commands/command-bus.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  return atenderInteligencia(request, async ({ ic, motor, store, servicoAcoes, corpo, correlationId, nomeUsuario, provedor }) => {
    const p = pedidoSchema.parse({
      texto: corpo.texto ?? null, chave: corpo.chave ?? null, continuar: corpo.continuar ?? null, canal: corpo.canal ?? null,
      conversa: corpo.conversa ?? null,
    });
    if (!p.ok) return { corpo: { erro: "Pedido inválido.", codigo: "PEDIDO_INVALIDO" }, status: 400 };
    return { corpo: await processarComando({ pedido: p.valor, ic, motor, servicoAcoes, store, provedor, nomeUsuario, correlationId }) };
  });
}
