import { responder, recusar, bancoDoServidor, freioPorIp, corpoJson } from "../../../lib/server/portais-http.mjs";
import { cadastrarClientePublico } from "../../../lib/server/negocio-publico.mjs";

// Cadastro do cliente pelo QR do restaurante (CRM + desconto nos pedidos do
// cardápio). POST { unidade, nome, telefone, email?, aniversario?, aceite, novidades? }.
// Quem grava é o banco (fidelidade_cadastrar); a resposta não diz se o
// telefone já era cliente.
export const dynamic = "force-dynamic";

export async function POST(request) {
  const freio = freioPorIp(request, "cadastro-publico", { maximo: 8 });
  if (freio) return freio;
  const corpo = await corpoJson(request);
  if (!corpo) return responder({ erro: "Envio inválido.", codigo: "parametro_invalido" }, 400);
  const banco = bancoDoServidor();
  if (banco.resposta) return banco.resposta;
  const r = await cadastrarClientePublico({ db: banco.db, unidade: String(corpo.unidade || ""), corpo });
  if (!r.ok) return r.campo ? responder({ erro: r.mensagem, codigo: r.codigo, campo: r.campo }, r.status) : recusar(r);
  return responder({ ok: true, desconto_pct: r.desconto_pct, aplica: r.aplica, final: r.final });
}
