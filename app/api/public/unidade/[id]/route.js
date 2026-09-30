import { responder, recusar, bancoDoServidor, freioPorIp } from "../../../../lib/server/portais-http.mjs";
import { lerUnidadePublica } from "../../../../lib/server/negocio-publico.mjs";

// SEC-DADOS-2 — nome e logo da loja para páginas públicas. `unidades` guarda
// CNPJ, endereço fiscal e o token da NF-e: nada disso sai daqui.
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const freio = freioPorIp(request, "unidade-publica", { maximo: 240 });
  if (freio) return freio;
  const { id } = await params;
  const banco = bancoDoServidor();
  if (banco.resposta) return banco.resposta;
  const r = await lerUnidadePublica({ db: banco.db, unidade: id });
  if (!r.ok) return recusar(r);
  return responder({ unidade: r.unidade });
}
