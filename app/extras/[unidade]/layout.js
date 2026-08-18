// Cartão do link no WhatsApp. Sem isto, colar o endereço mostrava só o domínio
// repetido três vezes — quem recebia não sabia do que se tratava.

const titulo = (unidade) => {
  const nome = String(unidade || "").replace(/[-_]+/g, " ").trim();
  if (!nome) return "Cadastro de prestadores de serviço";
  return `Cadastro de prestadores de serviço · ${nome.replace(/\b\w/g, (c) => c.toUpperCase())}`;
};

export async function generateMetadata({ params }) {
  const { unidade } = await params;
  const descricao = "Entre no nosso banco de profissionais em 2 minutos: função, dias "
    + "disponíveis e horário. Não precisa criar conta.";

  return {
    title: titulo(unidade),
    description: descricao,
    openGraph: {
      title: titulo(unidade),
      description: descricao,
      type: "website",
      locale: "pt_BR",
    },
    twitter: {
      card: "summary",
      title: titulo(unidade),
      description: descricao,
    },
  };
}

export default function LayoutExtras({ children }) {
  return children;
}
