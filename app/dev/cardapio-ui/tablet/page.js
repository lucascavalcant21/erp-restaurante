import { notFound } from "next/navigation";
import VitrineTablet from "./VitrineTablet";

// Tablet da mesa com os dados de exemplo do protótipo Main, só para comparar o desenho.
export const metadata = { title: "Vitrine — tablet", robots: { index: false, follow: false } };

export default function Pagina() {
  if (process.env.NODE_ENV === "production") notFound();
  return <VitrineTablet />;
}
