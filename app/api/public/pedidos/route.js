import { responder, recusar, bancoDoServidor, freioPorIp, corpoJson } from "../../../lib/server/portais-http.mjs";
import { validarPedidoPublico, criarPedidoPublico } from "../../../lib/server/negocio-publico.mjs";

// SEC-DADOS-2 — pedido do cardápio público (QR da mesa / delivery do cardápio).
//
// Antes: o navegador anônimo gravava `pedidos` e `pedidos_itens` direto, com
// o preço de cada item calculado no próprio navegador. Agora o servidor recebe
// só id e quantidade, busca o preço no banco e calcula o total.
//
// POST { unidade, cliente: { tipo, nome, telefone, endereco?, troco?, mesa? }, itens: [{ id, quantidade, observacao? }] }
export const dynamic = "force-dynamic";

export async function POST(request) {
  const freio = freioPorIp(request, "pedido-publico", { maximo: 12 });
  if (freio) return freio;
  const corpo = await corpoJson(request);
  if (!corpo) return responder({ erro: "Envio inválido.", codigo: "parametro_invalido" }, 400);
  const v = validarPedidoPublico(corpo);
  if (!v.ok) return recusar(v);
  const banco = bancoDoServidor();
  if (banco.resposta) return banco.resposta;
  const r = await criarPedidoPublico({ db: banco.db, pedido: v.pedido });
  if (!r.ok) return recusar(r);
  return responder({ ok: true, total: r.total });
}
