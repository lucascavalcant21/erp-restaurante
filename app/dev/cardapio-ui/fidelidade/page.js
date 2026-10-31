import { notFound } from "next/navigation";
import VitrineFidelidadePainel from "./VitrineFidelidadePainel";

// Painel → Fidelidade com os dados de exemplo do protótipo, só para comparar o
// desenho (a tela de verdade é /dashboard/operacao/cardapio/fidelidade).
export const metadata = { title: "Vitrine — fidelidade", robots: { index: false, follow: false } };

export default function Pagina() {
  if (process.env.NODE_ENV === "production") notFound();
  return <VitrineFidelidadePainel />;
}
