import { responder, recusar, bancoDoServidor, freioPorIp, corpoJson } from "../../../../lib/server/portais-http.mjs";
import { registrarAparelho, conteudoDaTela } from "../../../../lib/server/sinalizacao.mjs";

// Player das TVs (/tv). Sem login, por definição: a TV prova quem é com o
// segredo que recebeu ao se registrar (cabeçalho X-Tela-Segredo; o banco só
// guarda o SHA-256). O que sai é só o roteiro da própria tela: mídias com URL
// assinada e temporária e o cardápio público (o mesmo do QR Code).
//   POST { acao: "registrar" }                → { segredo, codigo, expira_em }
//   POST { acao: "conteudo", exibindo }       → { estado, roteiro, … }
export const dynamic = "force-dynamic";

const aparelhoDe = (request) => String(request.headers.get("user-agent") || "").slice(0, 200);

export async function POST(request) {
  const corpo = (await corpoJson(request, 8 * 1024)) || {};
  const banco = bancoDoServidor();
  if (banco.resposta) return banco.resposta;

  if (corpo.acao === "registrar") {
    // Uma loja liga várias TVs de uma vez atrás do mesmo IP: folga para isso.
    const freio = freioPorIp(request, "sinal-tv-registrar", { maximo: 60 });
    if (freio) return freio;
    const r = await registrarAparelho(banco.db, { aparelho: aparelhoDe(request) });
    return r.ok ? responder({ segredo: r.segredo, codigo: r.codigo, expira_em: r.expira_em }) : recusar({ ...r, codigo: "indisponivel", mensagem: r.erro });
  }

  // Cada TV pergunta a cada 15 s (40 vezes em 10 min); 75 TVs atrás do mesmo IP cabem.
  const freio = freioPorIp(request, "sinal-tv-conteudo", { maximo: 3000 });
  if (freio) return freio;
  const segredo = request.headers.get("x-tela-segredo") || "";
  const r = await conteudoDaTela(banco.db, { segredo, exibindo: corpo.exibindo, aparelho: aparelhoDe(request) });
  if (!r.ok) return recusar({ ...r, codigo: "indisponivel", mensagem: r.erro });
  const { ok, ...resto } = r;
  return responder(resto);
}
