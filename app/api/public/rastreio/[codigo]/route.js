import { responder, recusar, bancoDoServidor, freioPorIp } from "../../../../lib/server/portais-http.mjs";
import { lerRastreioPublico } from "../../../../lib/server/negocio-publico.mjs";

// SEC-DADOS-2 — rastreio do QR da etiqueta: só o que está impresso no papel.
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const freio = freioPorIp(request, "rastreio-publico", { maximo: 120 });
  if (freio) return freio;
  const { codigo } = await params;
  const banco = bancoDoServidor();
  if (banco.resposta) return banco.resposta;
  const r = await lerRastreioPublico({ db: banco.db, codigo });
  if (!r.ok) return recusar(r);
  return responder({ etiqueta: r.etiqueta });
}
