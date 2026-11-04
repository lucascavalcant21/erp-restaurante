import { responder, recusar } from "../../../../lib/server/portais-http.mjs";
import { autorizarLeituraDaUnidade } from "../../../../lib/server/autorizacao-unidade.mjs";
import { carregarPermissoes, permite } from "../../../../lib/server/permissoes-efetivas.mjs";
import { obterMetricasIntelligenceExperience } from "../../../../lib/server/experience.mjs";

export const dynamic = "force-dynamic";

// Pedidos e faturamento da unidade: só para quem é dela e tem a permissão da
// tela (S-33). Antes respondia a qualquer pessoa, com a chave de servidor.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const unidade = searchParams.get("unidade");
  const dias = Number(searchParams.get("dias")) || 30;

  const acesso = await autorizarLeituraDaUnidade(request, unidade);
  if (acesso.erro) return recusar(acesso.erro);

  const perms = await carregarPermissoes(acesso.db, acesso.usuario);
  if (!permite(perms, ["cardapio.intelligence_exp.view"])) {
    return recusar({ status: 403, codigo: "sem_permissao", mensagem: "Você não tem permissão para ver estes dados." });
  }

  const resultado = await obterMetricasIntelligenceExperience({
    db: acesso.db,
    unidadeId: unidade,
    dias,
  });

  if (!resultado.ok) return recusar(resultado);
  return responder(resultado);
}
