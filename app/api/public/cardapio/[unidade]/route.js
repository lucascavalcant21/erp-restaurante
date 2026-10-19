import { responder, recusar, bancoDoServidor, freioPorIp } from "../../../../lib/server/portais-http.mjs";
import { lerCardapioPublico } from "../../../../lib/server/negocio-publico.mjs";

// SEC-DADOS-2 — cardápio público (/cardapio/[unidade]) sem leitura anônima de
// `produtos`, `fichas_tecnicas` e `unidades`. Sai o cardápio montado no
// servidor (app/lib/cardapio-digital.mjs): pratos visíveis com o preço que
// vale agora, a vitrine que o dono configurou e, da loja, só nome, se o
// delivery está aberto e a taxa de entrega.
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const freio = freioPorIp(request, "cardapio-publico", { maximo: 240 });
  if (freio) return freio;
  const { unidade } = await params;
  const banco = bancoDoServidor();
  if (banco.resposta) return banco.resposta;
  const r = await lerCardapioPublico({ db: banco.db, unidade });
  if (!r.ok) return recusar(r);
  return responder({ cardapio: r.cardapio });
}
