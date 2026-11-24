"use client";

// Planos da página pública com a escolha do período e o botão de cada plano.

import { MessageCircle } from "lucide-react";
import TabelaPlanos from "../components/planos/TabelaPlanos";
import { linkComercial, precoNoPeriodo, reais } from "../lib/planos.mjs";

const WHATSAPP_COMERCIAL = process.env.NEXT_PUBLIC_HEFISTO_WHATSAPP_COMERCIAL || "";

function BotaoComecar({ plano, periodo }) {
  const pago = plano.precoCentavos > 0;
  const link = linkComercial(WHATSAPP_COMERCIAL, { plano, periodo });
  if (!link) {
    return <p className={`text-center text-sm ${pago ? "text-white/75" : "text-hf-muted"}`}>Cadastro online em preparação.</p>;
  }
  const preco = pago ? precoNoPeriodo(plano, periodo) : null;
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hf-accent ${pago
        ? "bg-hf-surface text-hf-text hover:bg-hf-elevated"
        : "bg-hf-menu text-white hover:opacity-90"}`}
    >
      <MessageCircle size={18} aria-hidden="true" />
      {preco ? `Assinar por ${reais(preco.totalCentavos)}` : "Começar grátis"}
    </a>
  );
}

export default function SecaoPlanos() {
  return <TabelaPlanos acao={(plano, periodo) => <BotaoComecar plano={plano} periodo={periodo} />} />;
}
