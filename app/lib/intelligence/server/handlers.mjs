// Handlers de "Pergunte ao Héfisto" e do Daily Brief, compartilhados pelas rotas
// /api/intelligence/{ask,brief} e pelo canal do WhatsApp (app/lib/whatsapp).
// Rodam DENTRO de atenderInteligencia: sessão, tenant, permissão e auditoria já
// foram resolvidos lá. Aqui não existe outro caminho de acesso a dados.
import { processarComando, pedidoSchema } from "../commands/command-bus.mjs";
import { generateDailyBrief } from "../insights/daily-brief.mjs";
import { auditar, ETAPA_AUDITORIA } from "../audit/auditoria.mjs";

/**
 * @param {object} [opcoes]
 * @param {(servico: object) => object} [opcoes.envolverAcoes] troca o serviço de ações
 *   (o WhatsApp usa para recusar ações: ali não há tela para a confirmação).
 */
export function handlerAsk({ envolverAcoes = null } = {}) {
  return async ({ ic, motor, store, servicoAcoes, corpo, correlationId, nomeUsuario, provedor }) => {
    const p = pedidoSchema.parse({
      texto: corpo.texto ?? null, chave: corpo.chave ?? null, continuar: corpo.continuar ?? null, canal: corpo.canal ?? null,
      conversa: corpo.conversa ?? null,
    });
    if (!p.ok) return { corpo: { erro: "Pedido inválido.", codigo: "PEDIDO_INVALIDO" }, status: 400 };
    const acoes = envolverAcoes ? envolverAcoes(servicoAcoes) : servicoAcoes;
    return { corpo: await processarComando({ pedido: p.valor, ic, motor, servicoAcoes: acoes, store, provedor, nomeUsuario, correlationId }) };
  };
}

export function handlerBrief() {
  return async ({ ic, motor, store, correlationId, nomeUsuario }) => {
    const inicio = Date.now();
    const brief = await generateDailyBrief({ motor, store, nomeUsuario });
    await auditar(store, ic.escopo, {
      correlationId, etapa: ETAPA_AUDITORIA.BRIEF, consultas: motor.ambiente.dbe.consultas, latenciaMs: Date.now() - inicio,
      resultado: { criticos: brief.critical.length, importantes: brief.warnings.length, oportunidades: brief.opportunities.length },
    });
    return { corpo: { brief, correlationId } };
  };
}
