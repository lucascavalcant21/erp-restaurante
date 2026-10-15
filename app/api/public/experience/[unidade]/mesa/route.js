import { responder, recusar, bancoDoServidor, freioPorIp } from "../../../../../lib/server/portais-http.mjs";
import { lerComandaMesaExperience } from "../../../../../lib/server/experience.mjs";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const freio = freioPorIp(request, "experience-mesa", { maximo: 300 });
  if (freio) return freio;

  const { unidade } = await params;
  const { searchParams } = new URL(request.url);
  const mesa = searchParams.get("mesa");

  if (!mesa) {
    return responder({ erro: "Número da mesa é obrigatório.", codigo: "mesa_obrigatoria" }, 400);
  }

  const banco = bancoDoServidor();
  if (banco.resposta) return banco.resposta;

  const resultado = await lerComandaMesaExperience({
    db: banco.db,
    unidadeId: unidade,
    mesaNumero: mesa
  });

  if (!resultado.ok) return recusar(resultado);
  return responder(resultado);
}
