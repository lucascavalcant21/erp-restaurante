import { NextResponse } from "next/server";
import { exigirSessao } from "./autorizacao-unidade.mjs";
import { carregarPermissoes } from "./permissoes-efetivas.mjs";

// Casca HTTP comum das rotas /api/rh/arquivos/*: sessão, permissões e o host
// do projeto (para reconhecer URL antiga do nosso Storage). A regra fica em
// rh-arquivos.mjs, que é testável sem Next.

const SEM_CACHE = { "Cache-Control": "no-store" };

export const responder = (corpo, status = 200) => NextResponse.json(corpo, { status, headers: SEM_CACHE });

const erroDe = (r) => responder({ erro: r.mensagem, codigo: r.codigo }, r.status);

function hostDoProjeto() {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").host || undefined; }
  catch { return undefined; }
}

/**
 * Autentica e chama `acao({ db, usuario, perms, corpo, hostEsperado })`.
 * A ação devolve { ok, status?, ... }; recusa vira { erro, codigo } sem
 * detalhe interno — nada de mensagem do banco, stack ou caminho de arquivo.
 */
export async function atenderPedidoRH(request, acao) {
  const sessao = await exigirSessao(request);
  if (sessao.erro) return responder({ erro: sessao.erro.mensagem, codigo: sessao.erro.codigo }, sessao.erro.status);

  const corpo = await request.json().catch(() => null);
  if (!corpo || typeof corpo !== "object") return responder({ erro: "Corpo inválido.", codigo: "parametro_invalido" }, 400);

  const perms = await carregarPermissoes(sessao.db, sessao.usuario);
  let r;
  try {
    r = await acao({ db: sessao.db, usuario: sessao.usuario, perms, corpo, hostEsperado: hostDoProjeto() });
  } catch {
    return responder({ erro: "Falha ao processar o arquivo.", codigo: "indisponivel" }, 503);
  }
  if (!r?.ok) return erroDe(r);
  const { ok, status, ...resto } = r;
  return responder(resto, 200);
}
