"use client";

// Identidade "Gestão" (pedido do dono, 08/11/2026): .tema-gestao e barra de
// áreas preta com ícone em cima do nome, como na Marmitaria.
// Eventos & Reservas: três áreas numa barra só, como a Marmitaria. Antes a
// visão geral empilhava o funil (numa caixa de altura fixa) e a lista de
// reservas, e a Agenda só era achada por um botão escondido no funil.
// A tela de um evento (orçamento em etapas) tem cabeçalho próprio e fica fora
// da barra.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, Calculator, ClipboardList, Gauge, Home, Target, UtensilsCrossed } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { canAccessRoute } from "../../lib/permissions-catalog.mjs";
import CabecalhoTela from "../../components/ui/CabecalhoTela";
import { BarraDeAreas } from "../../components/gerencial/PainelGerencial";

const BASE = "/dashboard/reservas-eventos";
const FUNIL = `${BASE}/eventos`;

const AREAS = [
  // Início no modelo do Delivery (dono, 24/11/2026): ações, hoje e próximos eventos.
  { href: BASE, rotulo: "Início", curto: "Início", icone: Home, inicio: true, ativo: (p) => p === BASE },
  { href: FUNIL, rotulo: "Funil de eventos", curto: "Funil", icone: BookOpen },
  { href: `${BASE}/agenda`, rotulo: "Agenda", curto: "Agenda", icone: CalendarDays },
  // Simulador do evento: mesa montada + buffet + bar + equipe, resultado na hora (31/10/2026).
  { href: `${BASE}/rapido`, rotulo: "Simulador", curto: "Simular", icone: Calculator },
  { href: `${BASE}/metas`, rotulo: "Metas", curto: "Metas", icone: Target },
  // Dashboard gerencial no modelo de gestão (pedido do dono, 08/11/2026).
  { href: `${BASE}/gerencial`, rotulo: "Dashboard gerencial", curto: "Dashboard", icone: Gauge },
  // Cadastro único com o delivery (dono, 21/11/2026): fichas, ingredientes, embalagens e bebidas.
  { href: "/dashboard/marmitaria/marmitas", rotulo: "Fichas e cadastros", curto: "Cadastros", icone: ClipboardList },
  { href: `${BASE}/reservas`, rotulo: "Reservas de mesa", curto: "Reservas", icone: UtensilsCrossed },
];

export default function ReservasEventosLayout({ children }) {
  const pathname = usePathname() || "";
  const { sessao, unidadeAtiva, unidadeInfo } = useERP();
  if (pathname.startsWith(`${FUNIL}/`)) return <div className="tema-gestao min-h-full bg-hf-bg">{children}</div>;

  // Quem só tem a permissão da visão geral não abre /eventos (regra mais
  // específica): o funil dele é a própria visão geral.
  const pode = (href) => !sessao?.gerenciado || canAccessRoute(sessao, href);
  // Sem o funil, a visão geral (BASE) já mostra o funil: some o Início.
  const podeFunil = pode(FUNIL);
  const areas = AREAS
    .filter((a) => !(a.inicio && !podeFunil))
    .map((a) => (a.href === FUNIL && !podeFunil ? { ...a, href: BASE, ativo: (p) => p === BASE } : a))
    .filter((a) => pode(a.href));

  return (
    <div className="tema-gestao min-h-full bg-hf-bg">
      <div className="mx-auto w-full max-w-[1500px] px-4 pb-16 pt-3 sm:px-6 lg:px-8">
        <CabecalhoTela embutido titulo="Eventos e reservas" subtitulo="Hoje, próximos eventos, orçamentos e agenda" />
        {areas.length > 1 && (
          <BarraDeAreas rotulo="Áreas de eventos e reservas" areas={areas}
            ativa={(a) => (a.ativo ? a.ativo(pathname) : pathname === a.href || pathname.startsWith(`${a.href}/`))} />
        )}
        {unidadeAtiva ? children : (
          <div className="rounded-xl border border-hf-warning/30 bg-hf-warning/5 px-3 py-2.5 text-sm text-hf-text">Selecione uma unidade no topo da tela para ver eventos e reservas.</div>
        )}
      </div>
    </div>
  );
}
