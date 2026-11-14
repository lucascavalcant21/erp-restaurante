"use client";

// PLANO E ASSINATURA — o plano da empresa e a troca para o Completo.
//
// Decisão do dono (14/11/2026): plano Grátis e plano Completo, com tudo, por
// R$ 89,90 por mês; semestral com 20% e anual com 40% de desconto. Por
// enquanto o pagamento é por Pix na chave do dono (Nubank), com o comprovante
// enviado no WhatsApp comercial; a liberação do plano é manual. Crédito e
// débito entram com a cobrança online (BLQ-020). Nada é cobrado por esta tela.

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CreditCard, Lock } from "lucide-react";
import CabecalhoTela from "../../../components/ui/CabecalhoTela";
import TabelaPlanos from "../../../components/planos/TabelaPlanos";
import PagamentoPix from "../../../components/planos/PagamentoPix";
import { useERP } from "../../../context/ERPContext";
import { useMinhaAssinatura } from "../../../lib/assinatura";
import { situacaoAssinatura } from "../../../lib/conta.mjs";
import { MENU_PRINCIPAL } from "../../../lib/menu-principal.mjs";
import { canAccessRoute } from "../../../lib/permissions-catalog.mjs";

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
            return <PagamentoPix plano={plano} periodo={periodo} empresa={unidadeInfo?.nome} />;
          }}
        />
      </div>
    </div>
  );
}
