import { notFound } from "next/navigation";
import Vitrine from "./Vitrine";

// Vitrine da base visual do cardápio digital (Etapa 1). Serve para comparar
// cada componente com o protótipo (scripts/cardapio-digital/print-prototipo.mjs).
// Os textos são os do protótipo, por isso a página não existe em produção.
export const metadata = { title: "Vitrine — cardápio digital", robots: { index: false, follow: false } };

export default function VitrineCardapioUi() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Vitrine />;
}
