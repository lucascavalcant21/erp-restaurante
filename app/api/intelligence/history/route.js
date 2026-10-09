// GET /api/intelligence/history — pedidos recentes do PRÓPRIO usuário nesta unidade.
import { atenderInteligencia } from "../../../lib/intelligence/server/http.mjs";

export const dynamic = "force-dynamic";

export async function GET(request) {
  return atenderInteligencia(request, async ({ ic, store }) => {
    const itens = await store.listarEventos({ unidadeId: ic.escopo.unidadeId, authUserId: ic.escopo.userId, limite: 20 });
    return { corpo: { itens: itens.map((e) => ({ id: e.id, correlationId: e.correlation_id, comando: e.comando, intencao: e.intencao?.intencao || null, resultado: e.resultado?.tipo || null, em: e.created_at })) } };
  });
}
