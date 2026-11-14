"use client";

// Os dois planos lado a lado com a escolha do período (Mensal, Semestral −20%,
// Anual −40%) e as formas de pagamento (decisão do dono, 14/11/2026). Usado na
// página pública /planos e na tela de assinatura. `acao(plano, periodo)`
// devolve o botão de cada cartão.

import { useState } from "react";
import { CreditCard, QrCode } from "lucide-react";
import CartaoPlano from "./CartaoPlano";
import { FORMAS_PAGAMENTO, PERIODOS, PLANOS } from "../../lib/planos.mjs";

export default function TabelaPlanos({ planoAtual = null, acao = () => null }) {
  const [periodo, setPeriodo] = useState("anual");
  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label="Período de pagamento" className="mx-auto flex w-full max-w-md gap-1 rounded-full border border-hf-border bg-hf-surface p-1 shadow-xs">
        {PERIODOS.map((p) => {
          const ativo = periodo === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => setPeriodo(p.id)}
              className={`flex min-h-[44px] flex-1 flex-col items-center justify-center rounded-full px-2 text-sm font-semibold leading-tight shadow-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hf-accent ${ativo ? "bg-hf-menu text-white" : "text-hf-text-2 hover:bg-hf-elevated"}`}
            >
              {p.nome}
              {p.descontoPct > 0 && (
                <span className={`text-[11px] font-semibold ${ativo ? "text-hf-menu-accent" : "text-hf-accent"}`}>−{p.descontoPct}%</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CartaoPlano plano={PLANOS.gratis} selo={planoAtual === "gratis" ? "Seu plano" : null}>
          {acao(PLANOS.gratis, periodo)}
        </CartaoPlano>
        <CartaoPlano plano={PLANOS.completo} periodo={periodo} destaque selo={planoAtual === "completo" ? "Seu plano" : "Tudo incluído"}>
          {acao(PLANOS.completo, periodo)}
        </CartaoPlano>
      </div>

      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-sm text-hf-text-2">
        <span className="inline-flex items-center gap-1.5"><CreditCard size={16} aria-hidden="true" /> {FORMAS_PAGAMENTO.filter((f) => f.id !== "pix").map((f) => f.nome).join(" ou ")}</span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1.5"><QrCode size={16} aria-hidden="true" /> Pix</span>
        <span className="w-full text-xs text-hf-muted">Semestral e anual são pagos de uma vez, com o desconto já aplicado.</span>
      </p>
    </div>
  );
}
