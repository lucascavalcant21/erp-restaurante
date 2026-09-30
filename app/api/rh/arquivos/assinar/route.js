import { atenderPedidoRH } from "../../../../lib/server/rh-arquivos-http.mjs";
import { assinarArquivos, ttlDaUrl } from "../../../../lib/server/rh-arquivos.mjs";

// SEC-RH-1.3A — abre documento, atestado ou foto de RH.
//
// POST { itens: [{ fonte, id }] }  →  { itens: [{ fonte, id, ok, url, expiraEm } | { ..., ok:false, status, codigo }] }
//
// A URL devolvida é ASSINADA e CURTA (RH_ARQUIVO_URL_TTL_SEGUNDOS, padrão
// 120 s). Nunca é gravada no banco. Sem sessão: 401. Sem vínculo com a
// unidade do registro ou sem permissão de RH: 403 por item.
export const dynamic = "force-dynamic";

export async function POST(request) {
  return atenderPedidoRH(request, ({ db, usuario, perms, corpo, hostEsperado }) =>
    assinarArquivos({ db, usuario, perms, itens: corpo.itens, ttl: ttlDaUrl(), hostEsperado }));
}
