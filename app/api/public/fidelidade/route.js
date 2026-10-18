import { responder, recusar, bancoDoServidor, freioPorIp } from "../../../lib/server/portais-http.mjs";
import { lerFidelidadePublica } from "../../../lib/server/negocio-publico.mjs";

// Fidelidade no cardápio: selos e cashback do cliente DESTE aparelho.
// GET ?unidade=<u>&pedidos=<id1>,<id2> — ids de pedidos que o aparelho fez.
// O telefone vem do banco (de um pedido já concluído), nunca da requisição;
// dele só saem os 4 últimos dígitos.
export const dynamic = "force-dynamic";

export async function GET(request) {
  const freio = freioPorIp(request, "fidelidade-publica", { maximo: 60 });
  if (freio) return freio;
  const url = new URL(request.url);
  const banco = bancoDoServidor();
  if (banco.resposta) return banco.resposta;
  const r = await lerFidelidadePublica({
    db: banco.db,
    unidade: url.searchParams.get("unidade") || "",
    ids: String(url.searchParams.get("pedidos") || "").split(",").slice(0, 10),
  });
  if (!r.ok) return recusar(r);
  const { ok, ...dados } = r;
  return responder(dados);
}
