import { notFound } from "next/navigation";
import VitrinePainel from "./VitrinePainel";

// Painel → Cardápio com os dados de exemplo do protótipo, só para comparar o
// desenho (a tela de verdade é /dashboard/operacao/cardapio/produtos).
export const metadata = { title: "Vitrine — painel do cardápio", robots: { index: false, follow: false } };

export default function Pagina() {
  if (process.env.NODE_ENV === "production") notFound();
  return <VitrinePainel />;
}
