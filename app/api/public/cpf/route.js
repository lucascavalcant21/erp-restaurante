import { responder, recusar, bancoDoServidor, freioPorIp, corpoJson } from "../../../lib/server/portais-http.mjs";
import { cadastrarPorCpf, entrarPorCpf } from "../../../lib/server/negocio-publico.mjs";

// Entrar e cadastrar pelo CPF no tablet da mesa e no QR (FIDELIDADE-3).
// POST { unidade, acao: "entrar", cpf } → { encontrado, nome, desconto_pct }
// POST { unidade, acao: "cadastrar", nome, cpf, aniversario, uf, cidade, bairro, telefone, aceite, novidades? }
// A resposta nunca traz telefone nem CPF; o freio por IP segura tentativa em massa.
export const dynamic = "force-dynamic";

export async function POST(request) {
  const corpo = await corpoJson(request);
  if (!corpo) return responder({ erro: "Envio inválido.", codigo: "parametro_invalido" }, 400);
  const acao = corpo.acao === "cadastrar" ? "cadastrar" : "entrar";
  const freio = freioPorIp(request, `cpf-${acao}`, { maximo: acao === "entrar" ? 12 : 6 });
  if (freio) return freio;
  const banco = bancoDoServidor();
  if (banco.resposta) return banco.resposta;
  const unidade = String(corpo.unidade || "");
  const r = acao === "cadastrar"
    ? await cadastrarPorCpf({ db: banco.db, unidade, corpo })
    : await entrarPorCpf({ db: banco.db, unidade, cpf: corpo.cpf });
  if (!r.ok) return r.campo ? responder({ erro: r.mensagem, codigo: r.codigo, campo: r.campo }, r.status) : recusar(r);
  const { ok, ...dados } = r;
  return responder(dados);
}
