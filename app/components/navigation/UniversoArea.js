"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Lock } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { homeDoUsuario } from "../../lib/auth";
import { canAccessRoute } from "../../lib/permissions-catalog.mjs";
import { universoPorId } from "../../lib/menu-principal.mjs";
import { fetchFilaKDS } from "../../lib/kds";
import IconeModulo from "../ui/IconeModulo";
import { useMinhaAssinatura } from "../../lib/assinatura";
import { linkCheckout, rotaLiberada } from "../../lib/planos.mjs";

// Tela de cards de Cozinha, Bar ou Salão. A lista mora em menu-principal.mjs.
// Visual inspirado no Nina (pedido do dono, 07/11/2026): trilha e data no topo,
// card grafite de destaque (KDS ou comandas) e cards com ícone colorido,
// título, descrição e seta.

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

function dataCurta(d) {
  // "sexta-feira, 07 nov." (sem o "de" do formato longo)
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "short" })
    .format(d)
    .replace(" de ", " ");
}

/** Pedidos na fila do KDS do setor. null = não carregou: não mostra número. */
function useResumoKds(unidadeId, setor) {
  const [resumo, setResumo] = useState(null);
  useEffect(() => {
    if (!setor || !unidadeId || unidadeId === "todas") { setResumo(null); return undefined; }
    let vivo = true;
    const carregar = async () => {
      const { data, error } = await fetchFilaKDS(unidadeId, setor);
      if (!vivo) return;
      if (error) { setResumo(null); return; }
      const prontos = data.filter((t) => t.itens.length > 0 && t.itens.every((i) => i.status === "pronto")).length;
      setResumo({ ativos: data.length - prontos, prontos });
    };
    carregar();
    const timer = setInterval(carregar, 30000);
    return () => { vivo = false; clearInterval(timer); };
  }, [unidadeId, setor]);
  return resumo;
}

function CardDestaque({ card, destaque, resumo, trancado = false }) {
  return (
    <section
      aria-label={card.label}
      className="flex flex-col gap-4 rounded-[22px] bg-hf-menu p-5 text-hf-menu-text sm:flex-row sm:items-center sm:justify-between sm:p-6"
    >
      <div className="flex min-w-0 items-start gap-4">
        <IconeModulo item={{ ...card, cor: "verde" }} tamanho="md" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">{card.label}</h2>
          <p className="text-sm text-hf-menu-muted">{card.desc}</p>
          {resumo && (
            <p className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums tracking-tight">{resumo.ativos}</span>
              <span className="text-xs leading-tight text-hf-menu-muted">
                {resumo.ativos === 1 ? "pedido ativo" : "pedidos ativos"}
                <br />
                {plural(resumo.prontos, "pronto", "prontos")} para sair
              </span>
            </p>
          )}
        </div>
      </div>
      <Link
        href={trancado ? linkCheckout(card.href) : card.href}
        className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-hf-menu shadow-none transition hover:bg-hf-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hf-accent"
      >
        {trancado && <Lock size={16} aria-hidden="true" />}
        {destaque.acao}
      </Link>
    </section>
  );
}

// Plano Grátis (14/11/2026): o card pago aparece com cadeado e leva ao checkout.
function CardModulo({ card, trancado = false }) {
  return (
    <Link
      href={trancado ? linkCheckout(card.href) : card.href}
      aria-label={trancado ? `${card.label} (plano Completo)` : undefined}
      className="group relative flex min-h-[76px] min-w-0 items-center gap-3.5 rounded-[18px] border border-hf-border bg-hf-surface p-3.5 shadow-xs transition hover:border-hf-border-strong hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hf-accent sm:min-h-[84px] sm:items-start sm:p-4"
    >
      <IconeModulo item={card} tamanho="md" className={trancado ? "opacity-50" : ""} />
      <span className="min-w-0 flex-1 pr-5">
        <span className="block text-[15px] font-semibold leading-snug tracking-tight text-hf-text">{card.label}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-hf-muted line-clamp-2">{card.desc}</span>
      </span>
      {trancado ? (
        <Lock size={15} aria-hidden="true" className="absolute right-3.5 top-3.5 text-hf-accent" />
      ) : (
        <ArrowUpRight
          size={16}
          aria-hidden="true"
          className="absolute right-3.5 top-3.5 text-hf-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-hf-text"
        />
      )}
    </Link>
  );
}

export default function UniversoArea({ id, children }) {
  const { sessao, unidadeInfo, unidadeAtiva } = useERP();
  const universo = universoPorId(id);
  const [hoje, setHoje] = useState("");
  useEffect(() => { setHoje(dataCurta(new Date())); }, []);

  // Quem tem perfil gerenciado só vê os cards das telas que pode abrir.
  const limitado = !!sessao?.gerenciado || !!sessao?.is_app;
  const pode = (card) => {
    if (!limitado) return true;
    const [rota, busca = ""] = card.href.split("?");
    return canAccessRoute(sessao, rota, busca);
  };

  const destaque = universo.destaque || null;
  const cardDestaque = useMemo(() => {
    if (!destaque) return null;
    const card = universo.secoes.flatMap((s) => s.cards).find((c) => c.href === destaque.href);
    return card && pode(card) ? card : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universo, destaque, sessao, limitado]);

  const secoes = useMemo(() => universo.secoes
    .map((secao) => ({
      ...secao,
      cards: secao.cards.filter((card) => pode(card) && card.href !== cardDestaque?.href),
    }))
    .filter((secao) => secao.cards.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  [universo, sessao, limitado, cardDestaque]);

  const assinatura = useMinhaAssinatura(sessao);
  const trancado = (card) => !rotaLiberada(assinatura?.plano, card.href);
  const resumo = useResumoKds(cardDestaque && !trancado(cardDestaque) ? unidadeAtiva : null, destaque?.setorKds);

  // Para quem começa aqui, esta tela já é o início: uma seta não levaria a lugar nenhum.
  const telaInicial = limitado && homeDoUsuario(sessao) === universo.href;

  return (
    <div className="min-h-full bg-hf-bg px-4 pb-24 pt-4 sm:px-6 sm:pt-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <nav aria-label="Você está em" className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-hf-muted">
              {!telaInicial && (
                <Link
                  href="/dashboard"
                  aria-label="Voltar ao início"
                  className="-ml-1.5 mr-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full text-hf-text-2 hover:bg-hf-elevated hover:text-hf-text"
                >
                  <ArrowLeft size={18} aria-hidden="true" />
                </Link>
              )}
              <span className="truncate">{unidadeInfo?.nome || "Héfisto"}</span>
              <span aria-hidden="true">/</span>
              <span className="text-hf-text-2">{universo.titulo}</span>
            </nav>
            {hoje && <p className="shrink-0 text-xs font-medium text-hf-muted first-letter:uppercase">{hoje}</p>}
          </div>
          <div>
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-hf-text sm:text-[32px]">{universo.titulo}</h1>
            <p className="mt-0.5 text-sm text-hf-muted">{universo.subtitulo}</p>
          </div>
        </header>

        {cardDestaque && <CardDestaque card={cardDestaque} destaque={destaque} resumo={resumo} trancado={trancado(cardDestaque)} />}

        {secoes.map((secao) => (
          <section key={secao.titulo} aria-label={secao.titulo} className="space-y-3">
            <h2 className="text-[13px] font-medium text-hf-muted">{secao.titulo}</h2>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
              {secao.cards.map((card) => <CardModulo key={card.href} card={card} trancado={trancado(card)} />)}
            </div>
          </section>
        ))}

        {secoes.length === 0 && !cardDestaque && (
          <p className="rounded-2xl border border-hf-border bg-hf-surface p-6 text-center text-sm font-semibold text-hf-muted">
            Seu perfil não tem telas liberadas nesta área. Fale com o administrador.
          </p>
        )}

        {children}
      </div>
    </div>
  );
}
