import { responder, recusar, bancoDoServidor, freioPorIp } from "../../../../../lib/server/portais-http.mjs";
import { lerCardapioExperience } from "../../../../../lib/server/experience.mjs";
import { obterBoasVindasConcierge, processarAcaoConcierge, responderPerguntaConcierge } from "../../../../../lib/server/concierge.mjs";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const freio = freioPorIp(request, "experience-concierge", { maximo: 60 });
  if (freio) return freio;

  const { unidade } = await params;
  const banco = bancoDoServidor();
  if (banco.resposta) return banco.resposta;

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { tipo = "welcome", acao, subOpcao, pergunta, idioma = "pt" } = body;

  // Busca catálogo de produtos reais
  const cardapioRes = await lerCardapioExperience({ db: banco.db, unidadeId: unidade });
  const produtos = cardapioRes.ok ? cardapioRes.itens : [];
  const unidadeNome = cardapioRes.unidade?.nome || "Seldeestrela";

  if (tipo === "welcome") {
    const boasVindas = obterBoasVindasConcierge({ unidadeNome, idioma });
    return responder(boasVindas);
  }

  if (tipo === "action") {
    const respostaAcao = processarAcaoConcierge({ acao, subOpcao, produtos, idioma });
    return responder(respostaAcao);
  }

  if (tipo === "query") {
    const respostaQuery = await responderPerguntaConcierge({
      pergunta,
      produtos,
      unidadeNome,
      idioma
    });
    return responder(respostaQuery);
  }

  return recusar({ ok: false, mensagem: "Tipo de requisição inválido para o Concierge." }, 400);
}
