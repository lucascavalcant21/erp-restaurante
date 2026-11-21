"use client";

// Planos na página inicial: o botão de cada cartão leva ao pedido de cadastro
// com o plano e o período já escolhidos.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import TabelaPlanos from "../planos/TabelaPlanos";
import { precoNoPeriodo, reais } from "../../lib/planos.mjs";

function BotaoDoPlano({ plano, periodo }) {
  const pago = plano.precoCentavos > 0;
  const preco = pago ? precoNoPeriodo(plano, periodo) : null;
  const href = `/cadastro?plano=${plano.id}${pago ? `&periodo=${periodo}` : ""}`;
  return (
    <Link
      href={href}
      className={`inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hf-accent ${pago
        ? "bg-hf-surface text-hf-text hover:bg-hf-elevated"
        : "bg-hf-menu text-white hover:opacity-90"}`}
    >
      {preco ? `Quero o Completo · ${reais(preco.totalCentavos)}` : "Começar grátis"}
      <ArrowRight size={18} aria-hidden="true" />
    </Link>
  );
}

export default function PlanosDoInicio() {
  return <TabelaPlanos acao={(plano, periodo) => <BotaoDoPlano plano={plano} periodo={periodo} />} />;
}
