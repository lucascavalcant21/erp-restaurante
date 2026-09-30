import { responder, recusar, bancoDoServidor, freioPorIp } from "../../../../lib/server/portais-http.mjs";
import { lerCardapioPublico } from "../../../../lib/server/negocio-publico.mjs";

// SEC-DADOS-2 — cardápio público (/cardapio/[unidade]) sem leitura anônima de
// `produtos` e `unidades`: só produtos ativos, com id, nome, preço e
// categoria; da loja, só nome, se está aberta e a taxa de entrega.
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const freio = freioPorIp(request, "cardapio-publico", { maximo: 240 });
  if (freio) return freio;
  const { unidade } = await params;
  const banco = bancoDoServidor();
  if (banco.resposta) return banco.resposta;
  const r = await lerCardapioPublico({ db: banco.db, unidade });
  if (!r.ok) return recusar(r);
  return responder({ unidade: r.unidade, produtos: r.produtos });
}
