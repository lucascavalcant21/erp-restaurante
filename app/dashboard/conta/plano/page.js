"use client";

// PLANO E ASSINATURA — o plano da empresa e a troca para o Completo.
//
// Decisão do dono (14/11/2026): plano Grátis e plano Completo, com tudo, por
// R$ 89,90 por mês; semestral com 20% e anual com 40% de desconto; crédito,
// débito ou Pix. Enquanto a cobrança online não existe (meio de pagamento
// ainda não escolhido), "Assinar" abre o WhatsApp comercial configurado em
// NEXT_PUBLIC_HEFISTO_WHATSAPP_COMERCIAL. Sem número, o botão avisa que a
// cobrança online está em preparação. Nada é cobrado por esta tela.

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CreditCard, Lock, MessageCircle } from "lucide-react";
import CabecalhoTela from "../../../components/ui/CabecalhoTela";
import TabelaPlanos from "../../../components/planos/TabelaPlanos";
import { useERP } from "../../../context/ERPContext";
import { useMinhaAssinatura } from "../../../lib/assinatura";
import { situacaoAssinatura } from "../../../lib/conta.mjs";
import { MENU_PRINCIPAL } from "../../../lib/menu-principal.mjs";
import { linkComercial, precoNoPeriodo, reais } from "../../../lib/planos.mjs";
import { canAccessRoute } from "../../../lib/permissions-catalog.mjs";

const WHATSAPP_COMERCIAL = process.env.NEXT_PUBLIC_HEFISTO_WHATSAPP_COMERCIAL || "";

function AvisoArea() {
  const busca = useSearchParams();
  const area = MENU_PRINCIPAL.find((m) => m.id === busca.get("area"));
  if (!area) return null;
  return (
    <div className="flex items-start gap-3 rounded-[22px] border border-hf-accent/40 bg-hf-surface p-4 text-sm text-hf-text">
      <Lock size={18} className="mt-0.5 shrink-0 text-hf-accent" aria-hidden="true" />
      <p><strong className="font-semibold">{area.label}</strong> faz parte do plano Completo. Assine para liberar esta área para a sua equipe.</p>
    </div>
  );
}

export default function PlanoPage() {
  const { sessao, unidadeInfo } = useERP();
  const assinatura = useMinhaAssinatura(sessao);
  const situacao = situacaoAssinatura(assinatura);
  const atual = situacao.plano?.id || null;
  const administra = !!sessao && !sessao.is_app && canAccessRoute(sessao, "/dashboard/configuracoes/usuarios", "");

  return (
    <div className="mx-auto w-full max-w-4xl pb-10">
      <CabecalhoTela titulo="Plano e assinatura" subtitulo="O que a sua empresa tem no Héfisto" icone={CreditCard} voltarPara="/dashboard/conta" />

      <div className="space-y-6 px-4 sm:px-6 lg:px-8">
        <Suspense fallback={null}><AvisoArea /></Suspense>

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
            const link = linkComercial(WHATSAPP_COMERCIAL, { plano, periodo, empresa: unidadeInfo?.nome });
            if (!link) {
              return (
                <p className="rounded-2xl border border-white/20 px-4 py-3 text-center text-sm text-white/80">
                  Cobrança online em preparação. Fale com o responsável pelo Héfisto para assinar.
                </p>
              );
            }
            return (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-hf-surface text-base font-semibold text-hf-text transition hover:bg-hf-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hf-accent"
              >
                <MessageCircle size={18} aria-hidden="true" /> Assinar por {reais(precoNoPeriodo(plano, periodo).totalCentavos)}
              </a>
            );
          }}
        />
      </div>
    </div>
  );
}
