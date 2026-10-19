import { responder, recusar, bancoDoServidor, freioPorIp, corpoJson } from "../../../../../lib/server/portais-http.mjs";
import { validarPedidoEvento, registrarPedidoEvento } from "../../../../../lib/server/portais-publicos.mjs";

// Pedido de orçamento do formulário público /eventos/[unidade].
//
// Antes o navegador anônimo fazia INSERT direto em `eventos`, mas o anon não
// tem grant nem policy na tabela (só `authenticated`, sec_unidade): todo
// pedido dava "permission denied" e o lead se perdia. Agora grava o servidor, com lista fechada de campos. A unidade
// vem do banco pelo slug do link; `unidade_id` no corpo é ignorado.
//
// POST { form: { nome, telefone, tipo, data, convidados, obs }, website } → { ok }
// `website` é um campo-isca invisível: robô preenche, gente não.
export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const freio = freioPorIp(request, "eventos-orcamento", { maximo: 5 });
  if (freio) return freio;
  const { unidade } = await params;
  const corpo = await corpoJson(request);
  if (!corpo) return responder({ erro: "Envio inválido.", codigo: "parametro_invalido" }, 400);
  if (corpo.website) return responder({ ok: true }); // isca: finge sucesso, não grava

  const v = validarPedidoEvento(unidade, corpo.form);
  if (!v.ok) return recusar(v);
  const banco = bancoDoServidor();
  if (banco.resposta) return banco.resposta;

  const r = await registrarPedidoEvento({ db: banco.db, slug: v.slug, payload: v.payload });
  if (!r.ok) return recusar(r);
  return responder({ ok: true });
}
