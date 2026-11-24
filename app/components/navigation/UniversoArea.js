"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { homeDoUsuario } from "../../lib/auth";
import { canAccessRoute } from "../../lib/permissions-catalog.mjs";
import { universoPorId } from "../../lib/menu-principal.mjs";
import { fetchFilaKDS } from "../../lib/kds";
import { CartaoGrade, DestaqueDegrade, GradeCartoes, RotuloSecao } from "../ui/Medway";
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

  // Visual da Medway (pedido do dono, 14/11/2026): título grande, o destaque
  // como a faixa em degradê da "Trilha do dia" e os cards em grade de duas
  // colunas com ícone em contorno, como a tela "Menu" do app de referência.
  const textoDestaque = cardDestaque
    ? (resumo ? `${plural(resumo.ativos, "pedido ativo", "pedidos ativos")} · ${plural(resumo.prontos, "pronto", "prontos")} para sair` : cardDestaque.desc)
    : null;

  return (
    <div className="min-h-full bg-mw-bg pb-24 text-mw-texto">
      <div className="mx-auto max-w-5xl space-y-7 px-4 sm:px-6">
        <header className="pt-6">
          <div className="flex items-center gap-2">
            {!telaInicial && (
              <Link
                href="/dashboard"
                aria-label="Voltar ao início"
                className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-mw-marinho hover:bg-mw-card"
              >
                <ArrowLeft size={22} aria-hidden="true" />
              </Link>
            )}
            <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-mw-marinho">{universo.titulo}</h1>
          </div>
          <p className="mt-1 text-[15px] text-mw-sec">{universo.subtitulo}{hoje ? ` · ${hoje}` : ""}</p>
        </header>

        {cardDestaque && (
          <DestaqueDegrade
            href={trancado(cardDestaque) ? linkCheckout(cardDestaque.href) : cardDestaque.href}
            titulo={destaque.acao}
            texto={textoDestaque}
            icone={cardDestaque.icone}
            trancado={trancado(cardDestaque)}
          />
        )}

        {secoes.map((secao) => (
          <section key={secao.titulo} aria-label={secao.titulo} className="space-y-3">
            <RotuloSecao>{secao.titulo}</RotuloSecao>
            <GradeCartoes>
              {secao.cards.map((card) => (
                <CartaoGrade
                  key={card.href}
                  href={trancado(card) ? linkCheckout(card.href) : card.href}
                  icone={card.icone}
                  label={card.label}
                  trancado={trancado(card)}
                />
              ))}
            </GradeCartoes>
          </section>
        ))}

        {secoes.length === 0 && !cardDestaque && (
          <p className="rounded-[22px] border border-mw-borda bg-mw-card p-6 text-center text-[15px] text-mw-sec">
            Seu perfil não tem telas liberadas nesta área. Fale com o administrador.
          </p>
        )}

        {children}
      </div>
    </div>
  );
}
