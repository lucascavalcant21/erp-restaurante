"use client";

// Eventos & Reservas: três áreas numa barra só, como a Marmitaria. Antes a
// visão geral empilhava o funil (numa caixa de altura fixa) e a lista de
// reservas, e a Agenda só era achada por um botão escondido no funil.
// A tela de um evento (orçamento em etapas) tem cabeçalho próprio e fica fora
// da barra.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, UtensilsCrossed } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { canAccessRoute } from "../../lib/permissions-catalog.mjs";

const BASE = "/dashboard/reservas-eventos";
const FUNIL = `${BASE}/eventos`;

const AREAS = [
  { href: FUNIL, rotulo: "Funil de eventos", curto: "Funil", icone: BookOpen, ativo: (p) => p === BASE || p === FUNIL },
  { href: `${BASE}/agenda`, rotulo: "Agenda", curto: "Agenda", icone: CalendarDays },
  { href: `${BASE}/reservas`, rotulo: "Reservas de mesa", curto: "Reservas", icone: UtensilsCrossed },
];

export default function ReservasEventosLayout({ children }) {
  const pathname = usePathname() || "";
  const { sessao, unidadeAtiva, unidadeInfo } = useERP();
  if (pathname.startsWith(`${FUNIL}/`)) return children;

  // Quem só tem a permissão da visão geral não abre /eventos (regra mais
  // específica): o funil dele é a própria visão geral.
  const pode = (href) => !sessao?.gerenciado || canAccessRoute(sessao, href);
  const areas = AREAS
    .map((a) => (a.href === FUNIL && !pode(FUNIL) ? { ...a, href: BASE } : a))
    .filter((a) => pode(a.href));

  return (
    <div className="min-h-full bg-hf-bg">
      <div className="mx-auto w-full max-w-[1500px] px-4 pb-16 pt-4 sm:px-6">
        <header className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-hf-accent">Operação</p>
          <h1 className="text-xl font-black text-hf-text sm:text-2xl">Eventos &amp; Reservas</h1>
          {unidadeInfo?.nome && <p className="text-sm text-hf-text-2">{unidadeInfo.nome}</p>}
        </header>
        {areas.length > 1 && (
          <nav aria-label="Áreas de eventos e reservas" className="mb-5 grid grid-cols-3 gap-1 rounded-2xl border border-hf-border bg-hf-surface p-1 sm:max-w-xl">
            {areas.map((a) => {
              const ativo = a.ativo ? a.ativo(pathname) : pathname === a.href || pathname.startsWith(`${a.href}/`);
              const Icone = a.icone;
              return (
                <Link key={a.href} href={a.href} aria-current={ativo ? "page" : undefined}
                  className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-2 text-center text-sm font-semibold transition ${ativo ? "bg-hf-accent text-hf-accent-fg" : "text-hf-text-2 hover:bg-hf-elevated hover:text-hf-text"}`}>
                  <Icone size={16} className="hidden shrink-0 sm:block" />
                  <span className="sm:hidden">{a.curto}</span><span className="hidden sm:inline">{a.rotulo}</span>
                </Link>
              );
            })}
          </nav>
        )}
        {unidadeAtiva ? children : (
          <div className="rounded-xl border border-hf-warning/30 bg-hf-warning/5 px-3 py-2.5 text-sm text-hf-text">Selecione uma unidade no topo da tela para ver eventos e reservas.</div>
        )}
      </div>
    </div>
  );
}
