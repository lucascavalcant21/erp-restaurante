import { responder, recusar, freioPorIp, corpoJson } from "../../../../../lib/server/portais-http.mjs";
import { autorizarLeituraDaUnidade } from "../../../../../lib/server/autorizacao-unidade.mjs";
import { listarChamadosAtivosExperience, atualizarStatusChamadoExperience } from "../../../../../lib/server/experience.mjs";

// Chamados de mesa vistos pelo SALÃO (equipe). Antes era GET/PATCH sem login
// nenhum, com a service role: qualquer pessoa lia e alterava os chamados de
// qualquer unidade (S-29). Agora exige sessão e acesso à unidade, e o PATCH
// só altera chamado desta unidade.
export const dynamic = "force-dynamic";

const negar = (erro) => responder({ erro: erro.mensagem, codigo: erro.codigo }, erro.status);

export async function GET(request, { params }) {
  const freio = freioPorIp(request, "experience-chamados-lista", { maximo: 400 });
  if (freio) return freio;
  const { unidade } = await params;
  const acesso = await autorizarLeituraDaUnidade(request, unidade);
  if (acesso.erro) return negar(acesso.erro);
  const resultado = await listarChamadosAtivosExperience({ db: acesso.db, unidadeId: unidade });
  return responder(resultado);
}

export async function PATCH(request, { params }) {
  const freio = freioPorIp(request, "experience-chamado-update", { maximo: 200 });
  if (freio) return freio;
  const { unidade } = await params;
  const acesso = await autorizarLeituraDaUnidade(request, unidade);
  if (acesso.erro) return negar(acesso.erro);
  const corpo = await corpoJson(request, 8 * 1024);
  if (!corpo) return responder({ erro: "Dados inválidos.", codigo: "requisicao_invalida" }, 400);
  const resultado = await atualizarStatusChamadoExperience({
    db: acesso.db,
    unidadeId: unidade,
    chamadoId: corpo.chamadoId,
    novoStatus: corpo.novoStatus,
    // Quem atendeu é quem está logado, não o que o navegador mandou.
    atendidoPor: acesso.usuario?.nome || null,
  });
  if (!resultado.ok) return recusar(resultado);
  return responder(resultado);
}
