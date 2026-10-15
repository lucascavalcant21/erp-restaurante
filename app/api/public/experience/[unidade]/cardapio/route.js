import { responder, recusar, bancoDoServidor, freioPorIp } from "../../../../../lib/server/portais-http.mjs";
import { lerCardapioExperience } from "../../../../../lib/server/experience.mjs";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const freio = freioPorIp(request, "experience-cardapio", { maximo: 300 });
  if (freio) return freio;

  const { unidade } = await params;
  const banco = bancoDoServidor();
  if (banco.resposta) return banco.resposta;

  const resultado = await lerCardapioExperience({ db: banco.db, unidadeId: unidade });
  if (!resultado.ok) return recusar(resultado);

  return responder(resultado);
}
