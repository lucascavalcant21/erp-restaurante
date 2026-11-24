"use client";

// Checkout do Héfisto Completo e tela "Plano e assinatura" (mesmo conteúdo).
//
// Decisões do dono (14/11/2026): plano Grátis e plano Completo por R$ 89,90
// por mês; semestral com 20% e anual com 40% de desconto. Tocar num cadeado
// leva ao checkout. Por enquanto o pagamento é por Pix na chave do dono
// (Nubank), com o comprovante no WhatsApp comercial; a liberação é manual.
// Crédito e débito entram com a cobrança online (BLQ-020). Nada é cobrado
// por esta tela.

import { CreditCard, Lock, Sparkles } from "lucide-react";
import CabecalhoTela from "../ui/CabecalhoTela";
import TabelaPlanos from "./TabelaPlanos";
import PagamentoPix from "./PagamentoPix";
import { useERP } from "../../context/ERPContext";
import { useMinhaAssinatura } from "../../lib/assinatura";
import { situacaoAssinatura } from "../../lib/conta.mjs";
import { telaDaRota } from "../../lib/menu-principal.mjs";
import { canAccessRoute } from "../../lib/permissions-catalog.mjs";
import { PLANOS } from "../../lib/planos.mjs";

/** Nome da tela trancada que trouxe a pessoa ao checkout ("Comandas", "Financeiro"…). */
function nomeDaTela(de) {
  if (!de) return null;
  const [rota, busca = ""] = String(de).split("?");
  const { area, item } = telaDaRota(rota, busca ? `?${busca}` : "", null) || {};
  if (rota.startsWith("/dashboard/inteligencia")) return "Jhon e Nico (assistentes)";
  return item?.label || area?.label || null;
}

export default function PaginaAssinatura({ checkout = false, de = null }) {
  const { sessao, unidadeInfo } = useERP();
  const assinatura = useMinhaAssinatura(sessao);
  const situacao = situacaoAssinatura(assinatura);
  const atual = situacao.plano?.id || null;
  const administra = !!sessao && !sessao.is_app && canAccessRoute(sessao, "/dashboard/configuracoes/usuarios", "");
  const tela = nomeDaTela(de);

  return (
    <div className="mx-auto w-full max-w-4xl pb-10">
      <CabecalhoTela
        titulo={checkout ? "Assinar o Héfisto Completo" : "Plano e assinatura"}
        subtitulo={checkout ? "Libere tudo para você e sua equipe" : "O que a sua empresa tem no Héfisto"}
        icone={checkout ? Sparkles : CreditCard}
        voltar={checkout ? "historico" : "area"}
        voltarPara={checkout ? null : "/dashboard/conta"}
      />

      <div className="space-y-6 px-4 sm:px-6 lg:px-8">
        {checkout && (
          <div className="flex items-start gap-3 rounded-[22px] border border-hf-accent/40 bg-hf-surface p-4 text-[15px] text-hf-text">
            <Lock size={20} className="mt-0.5 shrink-0 text-hf-accent" aria-hidden="true" />
            <p>
              {tela ? <><strong className="font-semibold">{tela}</strong> faz parte do plano Completo.</> : "Esta função faz parte do plano Completo."}{" "}
              Assine para liberar tudo: {PLANOS.completo.destaques.slice(1, 4).map((d) => d.toLowerCase()).join("; ")} e muito mais.
            </p>
          </div>
        )}

        <section className="rounded-[22px] border border-hf-border bg-hf-surface p-5 shadow-xs">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-hf-muted">Seu plano</p>
          {assinatura === undefined ? (
            <p className="mt-2 text-sm text-hf-muted">Carregando…</p>
          ) : (
            <>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-hf-text">{situacao.rotulo}</p>
              <p className="mt-1 text-sm text-hf-muted">{situacao.detalhe}</p>
            </>
          )}
        </section>

        <TabelaPlanos
          planoAtual={atual}
          acao={(plano, periodo) => {
            if (!plano.precoCentavos || atual === "completo") return null;
            if (!administra) return <p className="text-center text-sm text-white/80">Peça ao administrador da empresa para assinar.</p>;
            return <PagamentoPix plano={plano} periodo={periodo} empresa={unidadeInfo?.nome} />;
          }}
        />
      </div>
    </div>
  );
}
