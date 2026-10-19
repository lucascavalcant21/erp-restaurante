import { bancoDoServidor, freioPorIp, recusar } from "../../../../../../lib/server/portais-http.mjs";
import { lerFotoPublica } from "../../../../../../lib/server/negocio-publico.mjs";

// Foto do prato guardada na ficha técnica (texto base64 no banco). Sai como
// imagem, uma por vez, com cache: o cardápio não carrega megabytes de texto.
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const freio = freioPorIp(request, "cardapio-foto", { maximo: 600 });
  if (freio) return freio;
  const { unidade, produto } = await params;
  const banco = bancoDoServidor();
  if (banco.resposta) return banco.resposta;
  const r = await lerFotoPublica({ db: banco.db, unidade, produto });
  if (!r.ok) return recusar(r);
  return new Response(r.bytes, {
    status: 200,
    headers: {
      "Content-Type": r.tipo,
      "Cache-Control": "public, max-age=600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
