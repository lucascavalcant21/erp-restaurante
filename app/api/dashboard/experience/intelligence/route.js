import { responder, recusar, bancoDoServidor } from "../../../../lib/server/portais-http.mjs";
import { obterMetricasIntelligenceExperience } from "../../../../lib/server/experience.mjs";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const unidade = searchParams.get("unidade") || "seldeestrela";
  const dias = Number(searchParams.get("dias")) || 30;

  const banco = bancoDoServidor();
  if (banco.resposta) return banco.resposta;

  const resultado = await obterMetricasIntelligenceExperience({
    db: banco.db,
    unidadeId: unidade,
    dias
  });

  if (!resultado.ok) return recusar(resultado);
  return responder(resultado);
}
