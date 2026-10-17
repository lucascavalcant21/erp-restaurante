import { responder, recusar, bancoDoServidor, freioPorIp, corpoJson } from "../../../../../lib/server/portais-http.mjs";
import { lancarPedidoMesaExperience } from "../../../../../lib/server/experience.mjs";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const freio = freioPorIp(request, "experience-pedido", { maximo: 60 });
  if (freio) return freio;

  const { unidade } = await params;
  const corpo = await corpoJson(request, 32 * 1024);
  if (!corpo) {
    return responder({ erro: "Dados inválidos.", codigo: "requisicao_invalida" }, 400);
  }

  const { mesa, itens, clienteNome, chaveIdempotencia } = corpo;
  const banco = bancoDoServidor();
  const db = banco?.db || null;

  const resultado = await lancarPedidoMesaExperience({
    db,
    unidadeId: unidade,
    mesaNumero: mesa,
    itens,
    clienteNome,
    chaveIdempotencia
  });

  if (!resultado.ok) return recusar(resultado);
  return responder(resultado, 201);
}
