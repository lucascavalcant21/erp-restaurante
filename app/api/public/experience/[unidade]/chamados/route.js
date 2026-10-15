import { responder, recusar, bancoDoServidor, freioPorIp, corpoJson } from "../../../../../lib/server/portais-http.mjs";
import { listarChamadosAtivosExperience, atualizarStatusChamadoExperience } from "../../../../../lib/server/experience.mjs";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const freio = freioPorIp(request, "experience-chamados-lista", { maximo: 400 });
  if (freio) return freio;

  const { unidade } = await params;
  const banco = bancoDoServidor();
  if (banco.resposta) return banco.resposta;

  const resultado = await listarChamadosAtivosExperience({
    db: banco.db,
    unidadeId: unidade
  });

  return responder(resultado);
}

export async function PATCH(request, { params }) {
  const freio = freioPorIp(request, "experience-chamado-update", { maximo: 200 });
  if (freio) return freio;

  const corpo = await corpoJson(request, 8 * 1024);
  if (!corpo) {
    return responder({ erro: "Dados inválidos.", codigo: "requisicao_invalida" }, 400);
  }

  const { chamadoId, novoStatus, atendidoPor } = corpo;
  const banco = bancoDoServidor();
  if (banco.resposta) return banco.resposta;

  const resultado = await atualizarStatusChamadoExperience({
    db: banco.db,
    chamadoId,
    novoStatus,
    atendidoPor
  });

  if (!resultado.ok) return recusar(resultado);
  return responder(resultado);
}
