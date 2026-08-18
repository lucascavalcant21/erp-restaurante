// Cartão do link no WhatsApp. Sem isto, colar o endereço mostrava só o domínio
// repetido três vezes — quem recebia não sabia do que se tratava.

const titulo = (unidade) => {
  const nome = String(unidade || "").replace(/[-_]+/g, " ").trim();
  if (!nome) return "Trabalhe com a gente";
  return `Trabalhe com a gente · ${nome.replace(/\b\w/g, (c) => c.toUpperCase())}`;
};

export async function generateMetadata({ params }) {
  const { unidade } = await params;
  const descricao = "Veja as vagas abertas e mande sua candidatura em 2 minutos. "
    + "Não precisa criar conta nem enviar currículo em PDF.";

  const imagem = { url: "/icon-512x512.png", width: 512, height: 512, alt: "Hefisto" };

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://erp-restaurante-sand.vercel.app"),
    title: titulo(unidade),
    description: descricao,
    openGraph: {
      title: titulo(unidade),
      description: descricao,
      type: "website",
      locale: "pt_BR",
      images: [imagem],
    },
    twitter: {
      card: "summary",
      images: [imagem.url],
      title: titulo(unidade),
      description: descricao,
    },
  };
}

export default function LayoutVagas({ children }) {
  return children;
}
