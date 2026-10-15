import ExperienceApp from "../components/ExperienceApp";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: "Héfisto Experience — O Restaurante na Palma da Mão",
    description: "Cardápio inteligente, pedidos na mesa e atendimento exclusivo."
  };
}

export default async function ExperienceUnidadePage({ params, searchParams }) {
  const { unidade } = await params;
  const { mesa } = (await searchParams) || {};
  return <ExperienceApp unidadeId={unidade} mesaInicial={mesa || null} />;
}
