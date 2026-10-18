import { redirect } from "next/navigation";
import { caminhoDoCardapio } from "../../lib/cardapio-link.mjs";

// O Experience mostrava pratos de demonstração quando a leitura do banco
// falhava (e falhava sempre: pedia colunas que não existem). Os links e QR
// Codes já impressos agora abrem o cardápio digital, com a mesma mesa (B-028).
export const dynamic = "force-dynamic";

export default async function ExperienceUnidadePage({ params, searchParams }) {
  const { unidade } = await params;
  const { mesa } = (await searchParams) || {};
  redirect(caminhoDoCardapio(unidade, { mesa }));
}
