import { redirect } from "next/navigation";
import { caminhoDoCardapio } from "../../../lib/cardapio-link.mjs";

// Link antigo do Experience com a mesa no caminho: abre o cardápio digital
// já com a mesa (B-028).
export const dynamic = "force-dynamic";

export default async function ExperienceMesaPage({ params }) {
  const { unidade, mesa } = await params;
  redirect(caminhoDoCardapio(unidade, { mesa: decodeURIComponent(mesa || "") }));
}
