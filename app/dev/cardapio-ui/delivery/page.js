import { notFound } from "next/navigation";
import VitrineDelivery from "./VitrineDelivery";

// Início do delivery na vitrine: com os dados de exemplo do protótipo (para
// comparar o desenho) ou, com ?real=1, com um retrato do cardápio real gerado
// em public/dev-cardapio/cardapio-real.json (fora do Git).
export const metadata = { title: "Vitrine — início do delivery", robots: { index: false, follow: false } };

export default function Pagina() {
  if (process.env.NODE_ENV === "production") notFound();
  return <VitrineDelivery />;
}
