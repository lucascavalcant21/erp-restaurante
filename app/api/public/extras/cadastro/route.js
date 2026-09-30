import { responder, recusar, bancoDoServidor, freioPorIp, corpoJson } from "../../../../lib/server/portais-http.mjs";
import { validarCadastroExtra, registrarCadastroExtra } from "../../../../lib/server/portais-publicos.mjs";

// SEC-RH-1.3A — cadastro público de extras.
//
// Antes o navegador anônimo fazia INSERT direto em extras_cadastros, o que
// exigia grant de tabela ao anon. Agora o anon não tem grant nenhum: quem
// grava é o servidor, com lista fechada de campos.
//
// POST { unidade, form, respostas, website }  →  { ok, convite? }
// `website` é um campo-isca invisível: robô preenche, gente não.
export const dynamic = "force-dynamic";

export async function POST(request) {
  const freio = freioPorIp(request, "extras-cadastro", { maximo: 5 });
  if (freio) return freio;
  const corpo = await corpoJson(request);
  if (!corpo) return responder({ erro: "Envio inválido.", codigo: "parametro_invalido" }, 400);
  if (corpo.website) return responder({ ok: true }); // isca: finge sucesso, não grava

  const v = validarCadastroExtra(corpo.unidade, corpo.form, corpo.respostas);
  if (!v.ok) return recusar(v);
  const banco = bancoDoServidor();
  if (banco.resposta) return banco.resposta;

  const r = await registrarCadastroExtra({ db: banco.db, payload: v.payload });
  if (!r.ok) return recusar(r);
  return responder({ ok: true, convite: r.convite || null });
}
