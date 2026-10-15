import ExperienceApp from "../../components/ExperienceApp";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { mesa } = await params;
  return {
    title: `Héfisto Experience — Mesa ${mesa}`,
    description: "Cardápio inteligente, pedidos na mesa e atendimento exclusivo."
  };
}

export default async function ExperienceMesaPage({ params }) {
  const { unidade, mesa } = await params;
  return <ExperienceApp unidadeId={unidade} mesaInicial={mesa} />;
}
