import { atenderPedidoRH } from "../../../../lib/server/rh-arquivos-http.mjs";
import { prepararEnvio } from "../../../../lib/server/rh-arquivos.mjs";

// SEC-RH-1.3A — prepara o envio de um arquivo de RH para o bucket privado.
//
// POST { fonte, donoId?, unidadeId?, nomeArquivo, tamanho }
//   → { bucket, path, token, ref }
//
// O servidor escolhe o caminho; o navegador só recebe um token de upload de
// uso único para ESSE caminho. O que se grava no banco é `ref`
// (storage://rh-docs/...), nunca URL.
export const dynamic = "force-dynamic";

export async function POST(request) {
  return atenderPedidoRH(request, ({ db, usuario, perms, corpo }) =>
    prepararEnvio({
      db, usuario, perms,
      fonteId: corpo.fonte,
      donoId: corpo.donoId ?? null,
      unidadeId: corpo.unidadeId ?? null,
      nomeArquivo: corpo.nomeArquivo,
      tamanho: corpo.tamanho,
    }));
}
