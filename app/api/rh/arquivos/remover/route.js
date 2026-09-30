import { atenderPedidoRH } from "../../../../lib/server/rh-arquivos-http.mjs";
import { removerArquivo } from "../../../../lib/server/rh-arquivos.mjs";

// SEC-RH-1.3A — apaga do Storage o arquivo de um registro de RH.
// POST { fonte, id } → { removido }
// Com o bucket privado, o navegador não apaga objeto nenhum sozinho.
export const dynamic = "force-dynamic";

export async function POST(request) {
  return atenderPedidoRH(request, ({ db, usuario, perms, corpo, hostEsperado }) =>
    removerArquivo({ db, usuario, perms, fonteId: corpo.fonte, id: corpo.id, hostEsperado }));
}
