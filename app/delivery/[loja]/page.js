import { redirect } from "next/navigation";
import { caminhoDoCardapio } from "../../lib/cardapio-link.mjs";

// O delivery antigo mostrava pratos, sugestões e banners de demonstração,
// um PIX "copia e cola" que não pagava nada e pontos de fidelidade sem regra,
// tudo preso a uma unidade fixa (B-030). Os links já divulgados agora abrem o
// cardápio digital no modo delivery, com os pratos da ficha técnica e o
// preço conferido pelo servidor.
export const dynamic = "force-dynamic";

export default async function DeliveryLojaPage({ params }) {
  const { loja } = await params;
  redirect(caminhoDoCardapio(loja));
}
