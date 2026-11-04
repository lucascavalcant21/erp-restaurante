"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, BarChart, Bike, BookOpen, CalendarClock, Carrot, CheckSquare, ChefHat,
  ClipboardList, FileText, Flame, GlassWater, GraduationCap, Layers, MessageSquareText,
  MonitorPlay, Package, PlusCircle, QrCode, ShoppingCart, Smartphone, Sparkles, SprayCan, Store, Tag,
  Thermometer, Users, UtensilsCrossed, Wine,
} from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { canAccessRoute } from "../../lib/permissions-catalog.mjs";
import { universoPorId } from "../../lib/menu-principal.mjs";

const ICONES = {
  BarChart, Bike, BookOpen, CalendarClock, Carrot, CheckSquare, ChefHat, ClipboardList,
  FileText, Flame, GlassWater, GraduationCap, Layers, MessageSquareText, MonitorPlay, Package,
  PlusCircle, QrCode, ShoppingCart, Smartphone, Sparkles, SprayCan, Store, Tag, Thermometer, Users,
  UtensilsCrossed, Wine,
};

/** Tela de cards de Cozinha, Bar ou Salão. A lista mora em menu-principal.mjs. */
export default function UniversoArea({ id, children }) {
  const { sessao, unidadeInfo } = useERP();
  const universo = universoPorId(id);
  const Icone = ICONES[universo.icone];

  // Quem tem perfil gerenciado só vê os cards das telas que pode abrir.
  const secoes = useMemo(() => {
    const limitado = !!sessao?.gerenciado || !!sessao?.is_app;
    return universo.secoes
      .map((secao) => ({
        ...secao,
        cards: secao.cards.filter((card) => {
          if (!limitado) return true;
          const [rota, busca = ""] = card.href.split("?");
          return canAccessRoute(sessao, rota, busca);
        }),
      }))
      .filter((secao) => secao.cards.length > 0);
  }, [universo, sessao]);

  return (
    <div className="min-h-full bg-hf-bg px-4 pb-24 pt-4 sm:px-6 sm:pt-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center gap-3">
          <Link
            href="/dashboard"
            aria-label="Voltar ao início"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-hf-border bg-hf-surface text-hf-text hover:bg-hf-elevated"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-hf-accent text-hf-accent-fg">
            <Icone size={26} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-hf-text">{universo.titulo}</h1>
            <p className="truncate text-sm font-medium text-hf-muted">
              {universo.subtitulo}{unidadeInfo?.nome ? ` · ${unidadeInfo.nome}` : ""}
            </p>
          </div>
        </header>

        {secoes.map((secao) => (
          <section key={secao.titulo} aria-label={secao.titulo} className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-hf-muted">{secao.titulo}</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {secao.cards.map((card) => {
                const IconeCard = ICONES[card.icone];
                return (
                  <Link
                    key={card.href}
                    href={card.href}
                    className="group flex min-h-[120px] min-w-0 flex-col justify-between gap-3 rounded-2xl border border-hf-border bg-hf-surface p-4 shadow-sm transition-colors hover:border-hf-accent"
                  >
                    <span className="flex items-center justify-between">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-hf-elevated text-hf-accent">
                        <IconeCard size={21} aria-hidden="true" />
                      </span>
                      <ArrowRight size={16} aria-hidden="true" className="text-hf-muted transition-transform group-hover:translate-x-0.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black leading-tight text-hf-text">{card.label}</span>
                      <span className="mt-1 block text-xs font-medium leading-snug text-hf-muted">{card.desc}</span>
                    </span>
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
