// POST /api/intelligence/feedback — resposta a um insight (aprendizado por
// dados persistidos). Tenant e usuário vêm da sessão, não do corpo.
import { atenderInteligencia } from "../../../lib/intelligence/server/http.mjs";
import { feedbackSchema, linhaDeFeedback } from "../../../lib/intelligence/memory/feedback.mjs";
import { auditar, ETAPA_AUDITORIA } from "../../../lib/intelligence/audit/auditoria.mjs";

export const dynamic = "force-dynamic";

export async function POST(request) {
  return atenderInteligencia(request, async ({ ic, store, persistente, corpo, correlationId }) => {
    const p = feedbackSchema.parse({
      insightId: corpo.insightId, insightTipo: corpo.insightTipo, resposta: corpo.resposta,
      opcao: corpo.opcao ?? null, comentario: corpo.comentario ?? null,
    });
    if (!p.ok) return { corpo: { erro: "Resposta inválida.", codigo: "PEDIDO_INVALIDO" }, status: 400 };
    if (p.valor.resposta === "opcao" && !p.valor.opcao) return { corpo: { erro: "Escolha uma opção.", codigo: "PEDIDO_INVALIDO" }, status: 400 };
    if (!persistente) return { corpo: { erro: "Memória da inteligência indisponível neste servidor.", codigo: "NAO_CONFIGURADO" }, status: 503 };
    await store.registrarFeedback(linhaDeFeedback(ic.escopo, p.valor));
    await auditar(store, ic.escopo, { correlationId, etapa: ETAPA_AUDITORIA.FEEDBACK, resultado: { insight: p.valor.insightId, resposta: p.valor.resposta, opcao: p.valor.opcao } });
    return { corpo: { ok: true } };
  });
}
