import { responder, recusar, bancoDoServidor, freioPorIp } from "../../../../lib/server/portais-http.mjs";
import { lerChamadaPublica } from "../../../../lib/server/negocio-publico.mjs";

// SEC-DADOS-2 — TV de chamada do balcão. Antes a tela assinava o tempo real de
// `pedidos` como anon e cada atualização trazia a linha inteira (telefone e
// endereço do cliente). Agora devolve só rótulo, status e horário.
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const freio = freioPorIp(request, "chamada-publica", { maximo: 400 });
  if (freio) return freio;
  const { unidade } = await params;
  const banco = bancoDoServidor();
  if (banco.resposta) return banco.resposta;
  const r = await lerChamadaPublica({ db: banco.db, unidade });
  if (!r.ok) return recusar(r);
  return responder({ pedidos: r.pedidos });
}
