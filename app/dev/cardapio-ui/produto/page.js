import { notFound } from "next/navigation";
import VitrineProduto from "./VitrineProduto";

// Editar produto com os dados de exemplo do protótipo, só para comparar o
// desenho (a tela de verdade é /dashboard/operacao/cardapio/produtos/[id]).
export const metadata = { title: "Vitrine — editar produto", robots: { index: false, follow: false } };

export default function Pagina() {
  if (process.env.NODE_ENV === "production") notFound();
  return <VitrineProduto />;
}
