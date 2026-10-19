import { redirect } from "next/navigation";
import { caminhoDoCardapio } from "../../../lib/cardapio-link.mjs";

// O carrinho do delivery antigo gerava um PIX de demonstração e dizia
// "pedido impresso para o chef" sem nada disso acontecer (B-030). A sacola
// agora fica no cardápio digital.
export const dynamic = "force-dynamic";

export default async function DeliveryCarrinhoPage({ params }) {
  const { loja } = await params;
  redirect(caminhoDoCardapio(loja));
}
