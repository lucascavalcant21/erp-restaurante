// POST /api/intelligence/actions/cancel — cancela uma ação proposta (nada é alterado).
import { atenderInteligencia } from "../../../../lib/intelligence/server/http.mjs";
import { s } from "../../../../lib/intelligence/schemas/schema.mjs";

export const dynamic = "force-dynamic";
const schema = s.object({ acaoId: s.uuid() });

export async function POST(request) {
  return atenderInteligencia(request, async ({ servicoAcoes, corpo, correlationId }) => {
    const p = schema.parse({ acaoId: corpo.acaoId });
    if (!p.ok) return { corpo: { erro: "Ação inválida.", codigo: "PEDIDO_INVALIDO" }, status: 400 };
    return { corpo: { ...(await servicoAcoes.cancelar({ ...p.valor, correlationId })), correlationId } };
  });
}
