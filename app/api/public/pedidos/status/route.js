import { responder, recusar, bancoDoServidor, freioPorIp } from "../../../../lib/server/portais-http.mjs";
import { lerPedidosPublicos } from "../../../../lib/server/negocio-publico.mjs";

// "Meus pedidos" do cardápio: o andamento dos pedidos que o próprio aparelho
// fez (ele guarda os ids). GET ?unidade=<u>&ids=<id1>,<id2> — no máximo 10.
// Sai só etapa, total, horário e itens (id, quantidade, preço); nunca nome,
// telefone ou endereço.
export const dynamic = "force-dynamic";

export async function GET(request) {
  const freio = freioPorIp(request, "pedidos-status", { maximo: 120 });
  if (freio) return freio;
  const url = new URL(request.url);
  const banco = bancoDoServidor();
  if (banco.resposta) return banco.resposta;
  const r = await lerPedidosPublicos({
    db: banco.db,
    unidade: url.searchParams.get("unidade") || "",
    ids: String(url.searchParams.get("ids") || "").split(",").slice(0, 10),
  });
  if (!r.ok) return recusar(r);
  return responder({ pedidos: r.pedidos });
}
