import { responder, recusar, bancoDoServidor, freioPorIp, corpoJson } from "../../../../../lib/server/portais-http.mjs";
import { criarChamadoGarcomExperience } from "../../../../../lib/server/experience.mjs";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const freio = freioPorIp(request, "experience-chamado", { maximo: 60 });
  if (freio) return freio;

  const { unidade } = await params;
  const corpo = await corpoJson(request, 8 * 1024);
  if (!corpo) {
    return responder({ erro: "Dados inválidos.", codigo: "requisicao_invalida" }, 400);
  }

  const { mesa, tipo, solicitanteNome, observacao } = corpo;
  const banco = bancoDoServidor();
  const db = banco?.db || null;

  const resultado = await criarChamadoGarcomExperience({
    db,
    unidadeId: unidade,
    mesaNumero: mesa,
    tipo,
    solicitanteNome,
    observacao
  });

  if (!resultado.ok) return recusar(resultado);
  return responder(resultado, 201);
}
