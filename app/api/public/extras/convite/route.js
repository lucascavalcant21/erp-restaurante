import { responder, recusar, bancoDoServidor, freioPorIp, corpoJson } from "../../../../lib/server/portais-http.mjs";
import { lerConviteExtra } from "../../../../lib/server/portais-publicos.mjs";

// SEC-RH-1.3A — substitui a RPC extra_cadastro_publico(uuid).
//
// A RPC devolvia nome, telefone, nascimento e endereço de QUALQUER candidato a
// quem tivesse o id do cadastro. O convite é um token aleatório de 256 bits,
// gravado só como hash, que vale 30 minutos e 3 leituras, e devolve apenas os
// campos que o formulário de vagas pré-preenche.
//
// POST { token } → { dados } | 404 (mesma resposta para inválido, expirado ou gasto)
export const dynamic = "force-dynamic";

export async function POST(request) {
  const freio = freioPorIp(request, "extras-convite", { maximo: 20 });
  if (freio) return freio;
  const corpo = await corpoJson(request, 1024);
  if (!corpo) return responder({ erro: "Envio inválido.", codigo: "parametro_invalido" }, 400);
  const banco = bancoDoServidor();
  if (banco.resposta) return banco.resposta;
  const r = await lerConviteExtra({ db: banco.db, token: corpo.token });
  if (!r.ok) return recusar(r);
  return responder({ dados: r.dados });
}
