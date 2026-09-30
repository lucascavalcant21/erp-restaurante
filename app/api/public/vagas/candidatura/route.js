import { responder, recusar, bancoDoServidor, freioPorIp, corpoJson } from "../../../../lib/server/portais-http.mjs";
import { validarCandidatura, registrarCandidatura } from "../../../../lib/server/portais-publicos.mjs";
import { gerarLaudoIA } from "../../../../lib/recrutamento";

// SEC-RH-1.3A — candidatura pelo portal público de vagas.
//
// Antes: INSERT ... SELECT direto em `candidatos` pelo anon — e a tabela
// respondia 200 com os candidatos a qualquer visitante. Agora grava o
// servidor; a nota do teste de perfil é calculada aqui (antes vinha pronta do
// navegador) e o status é sempre "Novo".
//
// POST { unidade, dados, respostas, website } → { ok }
export const dynamic = "force-dynamic";

export async function POST(request) {
  const freio = freioPorIp(request, "vagas-candidatura", { maximo: 5 });
  if (freio) return freio;
  const corpo = await corpoJson(request);
  if (!corpo) return responder({ erro: "Envio inválido.", codigo: "parametro_invalido" }, 400);
  if (corpo.website) return responder({ ok: true }); // isca: finge sucesso, não grava

  const v = validarCandidatura(corpo.unidade, corpo.dados, corpo.respostas, { gerarLaudo: gerarLaudoIA });
  if (!v.ok) return recusar(v);
  const banco = bancoDoServidor();
  if (banco.resposta) return banco.resposta;

  const r = await registrarCandidatura({ db: banco.db, payload: v.payload });
  if (!r.ok) return recusar(r);
  return responder({ ok: true });
}
