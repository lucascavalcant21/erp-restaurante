import { notFound } from "next/navigation";
import VitrinePromocoes from "./VitrinePromocoes";

// Painel → Promoções com os dados de exemplo do protótipo, só para comparar o
// desenho (a tela de verdade é /dashboard/operacao/cardapio/promocoes).
export const metadata = { title: "Vitrine — promoções", robots: { index: false, follow: false } };

export default function Pagina() {
  if (process.env.NODE_ENV === "production") notFound();
  return <VitrinePromocoes />;
}
