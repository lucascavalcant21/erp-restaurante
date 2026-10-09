// POST /api/intelligence/actions/confirm — o ÚNICO caminho que executa uma
// ação da inteligência. Corpo: { acaoId, confirmacaoTexto? }. A ação é
// buscada no servidor pelo id + usuário + unidade da sessão.
import { atenderInteligencia } from "../../../../lib/intelligence/server/http.mjs";
import { s } from "../../../../lib/intelligence/schemas/schema.mjs";

export const dynamic = "force-dynamic";
const schema = s.object({ acaoId: s.uuid(), confirmacaoTexto: s.opcional(s.string({ max: 20 })) });

export async function POST(request) {
  return atenderInteligencia(request, async ({ servicoAcoes, corpo, correlationId }) => {
    const p = schema.parse({ acaoId: corpo.acaoId, confirmacaoTexto: corpo.confirmacaoTexto ?? null });
    if (!p.ok) return { corpo: { erro: "Ação inválida.", codigo: "PEDIDO_INVALIDO" }, status: 400 };
    return { corpo: { ...(await servicoAcoes.confirmar({ ...p.valor, correlationId })), correlationId } };
  }, { limitePorMinuto: 20 });
}
