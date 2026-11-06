"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft, Bike, BookOpen, Carrot, CheckSquare, ChefHat, Citrus, ConciergeBell, CookingPot,
  FileText, GlassWater, GraduationCap, Hourglass, Martini, MessageSquareText, NotebookPen, Package, Salad,
  Search, ShoppingCart, Smartphone, Sparkles, SprayCan, Star, StickyNote, Store, Tag, Thermometer, Users,
  UtensilsCrossed, WandSparkles, Wine,
} from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { homeDoUsuario } from "../../lib/auth";
import { canAccessRoute } from "../../lib/permissions-catalog.mjs";
import { universoPorId } from "../../lib/menu-principal.mjs";

// O pacote de ícones não tem coqueteleira, e ela diz "bar" melhor que uma chama.
function Coqueteleira({ strokeWidth = 2, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 2h8l1 5H7zM6 7h12l-2 15H8zM10 12h4" />
    </svg>
  );
}

const ICONES = {
  Bike, BookOpen, Carrot, CheckSquare, ChefHat, Citrus, ConciergeBell, CookingPot, Coqueteleira,
  FileText, GlassWater, GraduationCap, Hourglass, Martini, MessageSquareText, NotebookPen, Package, Salad,
  Search, ShoppingCart, Smartphone, Sparkles, SprayCan, Star, StickyNote, Store, Tag, Thermometer, Users,
  UtensilsCrossed, WandSparkles, Wine,
};

/** Tela de cards de Cozinha, Bar ou Salão. A lista mora em menu-principal.mjs. */
export default function UniversoArea({ id, children }) {
  const { sessao, unidadeInfo } = useERP();
  const universo = universoPorId(id);
  const Icone = ICONES[universo.icone];

  // Quem tem perfil gerenciado só vê os cards das telas que pode abrir.
  const limitado = !!sessao?.gerenciado || !!sessao?.is_app;
  const secoes = useMemo(() => universo.secoes
    .map((secao) => ({
      ...secao,
      cards: secao.cards.filter((card) => {
        if (!limitado) return true;
        const [rota, busca = ""] = card.href.split("?");
        return canAccessRoute(sessao, rota, busca);
      }),
    }))
    .filter((secao) => secao.cards.length > 0), [universo, sessao, limitado]);

  // Para quem começa aqui, esta tela já é o início: uma seta não levaria a lugar nenhum.
  const telaInicial = limitado && homeDoUsuario(sessao) === universo.href;

  return (
    <div className="min-h-full bg-hf-bg px-4 pb-24 pt-4 sm:px-6 sm:pt-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex items-center gap-3">
          {!telaInicial && (
            <Link
              href="/dashboard"
              aria-label="Voltar ao início"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-hf-border bg-hf-surface text-hf-text hover:bg-hf-elevated"
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </Link>
          )}
          <Icone size={28} aria-hidden="true" className="shrink-0 text-hf-accent" />
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-hf-text">{universo.titulo}</h1>
            {unidadeInfo?.nome && <p className="truncate text-sm font-medium text-hf-muted">{unidadeInfo.nome}</p>}
          </div>
        </header>

        {secoes.map((secao) => (
          <section key={secao.titulo} aria-label={secao.titulo} className="space-y-2.5">
            <h2 className="text-sm font-extrabold text-hf-text-2">{secao.titulo}</h2>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 md:grid-cols-4 lg:grid-cols-5">
              {secao.cards.map((card) => {
                const IconeCard = ICONES[card.icone];
                return (
                  <Link
                    key={card.href}
                    href={card.href}
                    title={card.desc}
                    className="flex min-h-[124px] min-w-0 flex-col items-center justify-center gap-2.5 rounded-[18px] border border-hf-border bg-hf-surface px-1.5 py-3 text-center shadow-sm transition-colors hover:border-hf-accent sm:min-h-[148px] sm:gap-3 sm:rounded-[20px]"
                  >
                    <span className="grid h-[52px] w-[52px] place-items-center rounded-[15px] bg-hf-accent text-hf-accent-fg sm:h-16 sm:w-16 sm:rounded-[18px]">
                      <IconeCard aria-hidden="true" strokeWidth={1.8} className="h-[26px] w-[26px] sm:h-8 sm:w-8" />
                    </span>
                    <span className="text-xs font-bold leading-tight text-hf-text sm:text-[13px]">{card.label}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        {secoes.length === 0 && (
          <p className="rounded-2xl border border-hf-border bg-hf-surface p-6 text-center text-sm font-bold text-hf-muted">
            Seu perfil não tem telas liberadas nesta área. Fale com o administrador.
          </p>
        )}

        {children}
      </div>
    </div>
  );
}
