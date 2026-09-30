import { responder, recusar, bancoDoServidor, freioPorIp } from "../../../../lib/server/portais-http.mjs";
import { lerTreinamentoPublico } from "../../../../lib/server/portais-publicos.mjs";

// SEC-RH-1.3A — conteúdo público de UM treinamento, pelo token do link.
//
// Antes a página pública lia `treinamentos` direto como anon, pelo id. Agora
// não há grant ao anon: a busca é por token_publico (aleatório, não
// enumerável) e a resposta leva só título, texto, vídeo e metadados de
// exibição — nada de unidade, autor, datas ou ids.
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const freio = freioPorIp(request, "treinamento-publico", { maximo: 120 });
  if (freio) return freio;
  const { token } = await params;
  const banco = bancoDoServidor();
  if (banco.resposta) return banco.resposta;
  const r = await lerTreinamentoPublico({ db: banco.db, token });
  if (!r.ok) return recusar(r);
  return responder({ treinamento: r.treinamento });
}
