import { responder, recusar, bancoDoServidor, freioPorIp } from "../../../../../lib/server/portais-http.mjs";
import { lerCardapioExperience } from "../../../../../lib/server/experience.mjs";
import { gerarExperienciaPrato } from "../../../../../lib/server/discover.mjs";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const freio = freioPorIp(request, "experience-discover", { maximo: 120 });
  if (freio) return freio;

  const { unidade } = await params;
  const { searchParams } = new URL(request.url);
  const produtoId = searchParams.get("produtoId");

  if (!produtoId) {
    return recusar({ ok: false, mensagem: "Parâmetro produtoId é obrigatório." }, 400);
  }

  const banco = bancoDoServidor();
  const db = banco?.db || null;

  // Busca prato no cardápio
  const cardapioRes = await lerCardapioExperience({ db, unidadeId: unidade });
  if (!cardapioRes.ok) return recusar(cardapioRes);

  const listaProdutos = cardapioRes.produtos || cardapioRes.itens || [];
  const prato = listaProdutos.find(p => String(p.id) === String(produtoId));
  if (!prato) {
    return recusar({ ok: false, mensagem: "Prato não encontrado no cardápio." }, 404);
  }

  const experiencia = gerarExperienciaPrato({ prato });
  return responder(experiencia);
}
