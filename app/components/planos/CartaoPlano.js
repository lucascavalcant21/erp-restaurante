// Cartão de um plano do Héfisto (página pública /planos e tela de assinatura).
// Os dados vêm de app/lib/planos.mjs. Sem "use client": serve nos dois lados.

import { Check } from "lucide-react";
import { precoNoPeriodo, reais } from "../../lib/planos.mjs";

/**
 * @param {object} p
 * @param {object} p.plano        item de PLANOS
 * @param {boolean} [p.destaque]  cartão escuro (o plano pago)
 * @param {string} [p.selo]       ex.: "Seu plano", "Tudo incluído"
 * @param {string} [p.periodo]    "mensal" | "semestral" | "anual" (plano pago)
 * @param {React.ReactNode} [p.children]  botão de ação
 */
export default function CartaoPlano({ plano, destaque = false, selo = null, periodo = "mensal", children }) {
  const pago = plano.precoCentavos > 0;
  const preco = pago ? precoNoPeriodo(plano, periodo) : null;
  const parcelado = preco && preco.periodo.meses > 1;
  return (
    <article
      className={`relative flex min-w-0 flex-col gap-5 rounded-[26px] border p-6 sm:p-7 ${destaque
        ? "border-hf-menu bg-hf-menu text-white shadow-lg"
        : "border-hf-border bg-hf-surface text-hf-text shadow-xs"}`}
    >
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xl font-semibold tracking-tight">{plano.nome}</h3>
          {selo && (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${destaque ? "bg-hf-menu-accent text-hf-menu" : "border border-hf-accent text-hf-accent"}`}>
              {selo}
            </span>
          )}
        </div>
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          {parcelado && (
            <span className={`w-full text-sm line-through ${destaque ? "text-white/50" : "text-hf-muted"}`}>{reais(plano.precoCentavos)} por mês</span>
          )}
          <span className="text-[40px] font-semibold leading-none tracking-tight">{preco ? reais(preco.porMesCentavos) : "R$ 0"}</span>
          <span className={`text-sm ${destaque ? "text-white/70" : "text-hf-muted"}`}>{preco ? "por mês" : "sem mensalidade"}</span>
        </p>
        {parcelado && (
          <p className={`text-sm font-medium ${destaque ? "text-hf-menu-accent" : "text-hf-accent"}`}>
            {reais(preco.totalCentavos)} no plano {preco.periodo.nome.toLowerCase()} · economia de {reais(preco.economiaCentavos)} ({preco.periodo.descontoPct}%)
          </p>
        )}
        <p className={`text-sm leading-snug ${destaque ? "text-white/80" : "text-hf-muted"}`}>{plano.resumo}</p>
      </header>

      <ul className="flex-1 space-y-2.5">
        {plano.destaques.map((d) => (
          <li key={d} className="flex items-start gap-2.5 text-[15px] leading-snug">
            <Check size={18} strokeWidth={2.4} aria-hidden="true" className={`mt-0.5 shrink-0 ${destaque ? "text-hf-menu-accent" : "text-hf-success"}`} />
            <span>{d}</span>
          </li>
        ))}
      </ul>

      {children && <div className="pt-1">{children}</div>}
    </article>
  );
}
