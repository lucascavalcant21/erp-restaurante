"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { lerSessao, encerrarSessao, getPapel } from "../lib/auth";
import { useERP } from "../context/ERPContext";

// ═══════════════════════════════════════════════════════════════
// ÍCONES
// ═══════════════════════════════════════════════════════════════
const Ic = {
  Menu: ({ size = 22 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="3" y1="6"  x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  Close: ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  ChevronDown: ({ size = 14, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className={className}>
      <path d="M6 9l6 6 6-6"/>
    </svg>
  ),
  Back: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M19 12H5M12 5l-7 7 7 7"/>
    </svg>
  ),
  Search: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  ),
  Dashboard: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  Bell: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  Checklist: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  MenuBook: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>
    </svg>
  ),
  Box: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    </svg>
  ),
  Truck: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/>
      <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  Calendar: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  BarChart: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="16"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  ),
  ArrowsUD: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 4-4"/>
    </svg>
  ),
  Percent: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
    </svg>
  ),
  TrendUp: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  FileText: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  Users: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Clock: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  Badge: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  ),
  UserCheck: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>
    </svg>
  ),
  Megaphone: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 19-7z"/>
    </svg>
  ),
  Star: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  Brain: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-5 0V8a2.5 2.5 0 0 1-2.5-2.5A2.5 2.5 0 0 1 9.5 2z"/>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 5 0V8a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 14.5 2z"/>
    </svg>
  ),
  User: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  ),
  FlaskConical: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M10 2v7.31l-3.72 6.17A2 2 0 0 0 8 18h8a2 2 0 0 0 1.72-2.52L14 9.31V2"/>
      <path d="M8.5 2h7"/>
    </svg>
  ),
  ChefHat: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/>
      <line x1="6" y1="17" x2="18" y2="17"/>
    </svg>
  ),
  LogOut: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
};

// ═══════════════════════════════════════════════════════════════
// MENU — 6 GRUPOS, 19 ITENS
// ═══════════════════════════════════════════════════════════════
const MENU_GROUPS = [
  {
    id: "visao_geral", label: "DASHBOARD",
    items: [
      { id: "dashboard",    label: "Painel Inicial",           Icon: Ic.Dashboard, href: "/dashboard" },
      { id: "notificacoes", label: "Notificações",              Icon: Ic.Bell,      href: "/dashboard/notificacoes" },
    ],
  },
  {
    id: "operacao", label: "GESTÃO OPERACIONAL",
    items: [
      { id: "rotina",        label: "Operação Geral",          Icon: Ic.Checklist,    href: "/dashboard/operacao/rotina" },
      { id: "cardapio",      label: "Cardápio",                Icon: Ic.ChefHat,      href: "/dashboard/operacao/cardapio" },
      { id: "fichas",        label: "Ficha Técnica",           Icon: Ic.MenuBook,     href: "/dashboard/operacao/fichas" },
      { id: "ingredientes",  label: "Ingredientes",            Icon: Ic.FlaskConical, href: "/dashboard/operacao/ingredientes" },
      { id: "estoque",       label: "Estoque",                 Icon: Ic.Box,          href: "/dashboard/operacao/estoque" },
      { id: "fornecedores",  label: "Fornecedores",            Icon: Ic.Truck,        href: "/dashboard/operacao/fornecedores" },
      { id: "eventos",       label: "Gestão de Eventos",       Icon: Ic.Calendar,     href: "/dashboard/operacao/eventos" },
    ],
  },
  {
    id: "financeiro", label: "FINANCEIRO",
    items: [
      { id: "dre",          label: "DRE",                      Icon: Ic.BarChart,  href: "/dashboard/financeiro/dre" },
      { id: "fluxo",        label: "Fluxo de Caixa",           Icon: Ic.ArrowsUD,  href: "/dashboard/financeiro/fluxo" },
      { id: "cmv",          label: "CMV",                      Icon: Ic.Percent,   href: "/dashboard/financeiro/cmv" },
      { id: "margem",       label: "Lucro",                    Icon: Ic.TrendUp,   href: "/dashboard/financeiro/margem" },
      { id: "documentos",   label: "Notas e Boletos",          Icon: Ic.FileText,  href: "/dashboard/financeiro/documentos" },
    ],
  },
  {
    id: "rh_grupo", label: "BPO",
    items: [
      { id: "gestao_rh",   label: "RH",                        Icon: Ic.Users,     href: "/dashboard/rh/gestao" },
      { id: "ponto",       label: "Controle de Ponto",         Icon: Ic.Clock,     href: "/dashboard/rh/ponto" },
      { id: "colaborador", label: "Portal do Colaborador",     Icon: Ic.Badge,     href: "/dashboard/rh/colaborador" },
    ],
  },
  {
    id: "clientes", label: "CLIENTES",
    items: [
      { id: "crm",       label: "CRM",                         Icon: Ic.UserCheck, href: "/dashboard/clientes/crm" },
      { id: "campanhas", label: "Tráfego Pago",                Icon: Ic.Megaphone, href: "/dashboard/clientes/campanhas" },
      { id: "nps",       label: "Avaliações",                  Icon: Ic.Star,      href: "/dashboard/clientes/nps" },
    ],
  },
  {
    id: "ia", label: "HEITOR I.A",
    items: [
      { id: "heitor", label: "Chat Heitor",                    Icon: Ic.Brain,     href: "/dashboard/ia/heitor" },
    ],
  },
];

const ALL_NAV_IDS = MENU_GROUPS.flatMap((g) => g.items.map((i) => i.id));

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function fmtBRL(v) {
  if (v == null) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}
function fmtDataHora(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
    " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtDuracao(entrada, saida) {
  if (!saida) return "Ativa";
  const min = Math.round((new Date(saida) - new Date(entrada)) / 60000);
  if (min < 60) return `${min}min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}
function useHistoricoLogin() {
  const [historico, setHistorico] = useState([]);
  useEffect(() => {
    try { setHistorico(JSON.parse(localStorage.getItem("erp_login_hist") || "[]")); } catch (_) {}
  }, []);
  return { historico };
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTES BASE
// ═══════════════════════════════════════════════════════════════
const Skel = ({ cls = "" }) => (
  <div className={`rounded-lg ${cls}`} style={{ background: 'linear-gradient(90deg,#1E293B 25%,#334155 50%,#1E293B 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
);
function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl ${className}`}
      style={{ background: 'var(--card)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
      {children}
    </div>
  );
}
function SectionTitle({ children }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest mb-3 px-0.5" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>{children}</p>;
}
function TelaEmBreve({ titulo, descricao }) {
  return (
    <div className="px-4 pt-5 pb-28">
      <h1 className="text-2xl font-black mb-1" style={{ color: 'var(--fg)' }}>{titulo}</h1>
      <p className="text-sm font-medium mb-8" style={{ color: 'var(--dim)' }}>{descricao}</p>
      <Card className="p-8 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(5,150,105,0.12)' }}>
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={1.8}>
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <p className="text-sm font-bold mb-1" style={{ color: 'var(--fg-soft)' }}>Em desenvolvimento</p>
        <p className="text-xs font-medium" style={{ color: 'var(--dim)' }}>Este módulo estará disponível em breve.</p>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SELETOR DE MÊS
// ═══════════════════════════════════════════════════════════════
function SeletorMes({ mes, ano, onChange }) {
  const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const prev = () => { let m = mes - 1, a = ano; if (m < 0) { m = 11; a--; } onChange(m, a); };
  const next = () => { let m = mes + 1, a = ano; if (m > 11) { m = 0; a++; } onChange(m, a); };
  return (
    <div className="flex items-center gap-2">
      <button onClick={prev} className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center active:bg-neutral-200">
        <Ic.Back size={12} />
      </button>
      <span className="text-xs font-bold text-neutral-700 w-20 text-center">{MESES[mes]} {ano}</span>
      <button onClick={next} className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center active:bg-neutral-200">
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TELA PAINEL INICIAL
// ═══════════════════════════════════════════════════════════════
const EMPTY_DASH = {
  faturamento: null, custos_totais: null, lucro_liquido: null, margem_pct: null,
  distribuicao: [
    { label: "CMV",         cor: "#f97316", pct: null },
    { label: "Mão de Obra", cor: "#ec4899", pct: null },
    { label: "Operacional", cor: "#10b981", pct: null },
    { label: "Impostos",    cor: "#ef4444", pct: null },
  ],
};

// Mock: últimos 6 meses (substituir por API quando PDV integrado)
const MESES_LABEL = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const GRAFICO_MOCK = [18400, 21200, 19800, 23500, 22100, 25300];

// Alertas carregados do Supabase — sem dados fictícios
const ALERTAS_ESTOQUE = [];
const ALERTAS_EVENTOS = [];

const ATALHOS = [
  { id: "cardapio",     label: "Cardápio",     Icon: Ic.ChefHat,      href: "/dashboard/operacao/cardapio",     cor: "#10b981" },
  { id: "estoque",      label: "Estoque",      Icon: Ic.Box,          href: "/dashboard/operacao/estoque",      cor: "#3b82f6" },
  { id: "eventos",      label: "Eventos",      Icon: Ic.Calendar,     href: "/dashboard/operacao/eventos",      cor: "#f97316" },
  { id: "fichas",       label: "Fichas",       Icon: Ic.MenuBook,     href: "/dashboard/operacao/fichas",       cor: "#8b5cf6" },
  { id: "ingredientes", label: "Ingredientes", Icon: Ic.FlaskConical, href: "/dashboard/operacao/ingredientes", cor: "#ec4899" },
  { id: "fornecedores", label: "Fornecedores", Icon: Ic.Truck,        href: "/dashboard/operacao/fornecedores", cor: "#06b6d4" },
];

function TelaDashboard({ mes, ano, dados, loading, sessao }) {
  const router = useRouter();
  const d    = dados || EMPTY_DASH;
  const nome = sessao?.nome?.split(" ")[0] || "Operador";
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  // Gráfico de barras
  const hoje     = new Date();
  const barras   = Array.from({ length: 6 }, (_, i) => {
    const dt = new Date(hoje.getFullYear(), hoje.getMonth() - 5 + i, 1);
    return { label: MESES_LABEL[dt.getMonth()], valor: GRAFICO_MOCK[i], atual: i === 5 };
  });
  const maxValor = Math.max(...barras.map(b => b.valor));
  const BAR_H = 72; // px

  const totalAlertas = ALERTAS_ESTOQUE.length + ALERTAS_EVENTOS.length;

  return (
    <div className="px-4 pt-5 pb-28 space-y-6">

      {/* Saudação */}
      <div>
        <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--dim)' }}>{saudacao},</p>
        <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--fg)' }}>{nome} 👋</h1>
      </div>

      {/* KPI Cards 2×2 */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Faturamento",   val: d.faturamento   != null ? fmtBRL(d.faturamento)   : null, dot: "#059669" },
          { label: "Custos Totais", val: d.custos_totais != null ? fmtBRL(d.custos_totais) : null, dot: "#EF4444" },
          { label: "Lucro Líquido", val: d.lucro_liquido != null ? fmtBRL(d.lucro_liquido) : null, dot: "#3B82F6" },
          { label: "Margem",        val: d.margem_pct    != null ? `${d.margem_pct}%`       : null, dot: "#8B5CF6" },
        ].map(({ label, val, dot }) => (
          <div key={label} className="rounded-2xl p-4"
            style={{ background: 'var(--card)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot }} />
              <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--muted)', letterSpacing: '0.06em' }}>{label}</p>
            </div>
            {loading || val == null
              ? <Skel cls="h-6 w-20" />
              : <p className="text-lg font-bold" style={{ color: 'var(--fg)' }}>{val}</p>}
          </div>
        ))}
      </div>

      {/* Gráfico de Desempenho */}
      <div>
        <SectionTitle>Desempenho — Últimos 6 Meses</SectionTitle>
        <Card className="p-4">
          <div className="flex items-end gap-2" style={{ height: BAR_H + 28 }}>
            {barras.map((b) => {
              const h = maxValor > 0 ? Math.round((b.valor / maxValor) * BAR_H) : 8;
              return (
                <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
                  <p className="text-[9px] font-black text-neutral-400 leading-none">
                    {b.valor >= 1000 ? `${(b.valor / 1000).toFixed(0)}k` : b.valor}
                  </p>
                  <div
                    className="w-full rounded-t-lg transition-all duration-700"
                    style={{ height: `${h}px`, backgroundColor: b.atual ? "#10b981" : "#334155" }}
                  />
                  <p className={`text-[9px] font-black leading-none`} style={{ color: b.atual ? 'var(--accent)' : 'var(--dim)' }}>
                    {b.label}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] font-medium text-center mt-3" style={{ color: 'var(--elevated)' }}>
            Dados simulados · integre seu PDV para valores reais
          </p>
        </Card>
      </div>

      {/* Distribuição de Custos */}
      <div>
        <SectionTitle>Distribuição de Custos</SectionTitle>
        <Card className="p-4">
          {d.distribuicao.map(({ label, cor, pct }) => (
            <div key={label} className="mb-3 last:mb-0">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold" style={{ color: 'var(--fg-soft)' }}>{label}</span>
                {loading || pct == null ? <Skel cls="h-3 w-8" /> : <span className="text-xs font-black" style={{ color: cor }}>{pct}%</span>}
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                {!loading && pct != null && (
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: cor }} />
                )}
              </div>
            </div>
          ))}
          {!loading && d.faturamento == null && (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--dim)' }}><Ic.BarChart size={18} /></div>
              <p className="text-xs font-bold" style={{ color: 'var(--subtle)' }}>Sem dados para o período</p>
              <p className="text-[11px] font-medium" style={{ color: 'var(--dim)' }}>Registre vendas e custos para ver o painel.</p>
            </div>
          )}
        </Card>
      </div>

      {/* Alertas */}
      {totalAlertas > 0 && (
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <SectionTitle>Atenção Necessária</SectionTitle>
            <button
              onClick={() => router.push("/dashboard/notificacoes")}
              className="text-[10px] font-black text-accent active:opacity-70"
            >
              Ver todas →
            </button>
          </div>
          <div className="space-y-2">
            {ALERTAS_ESTOQUE.map((item) => (
              <button key={item.nome} onClick={() => router.push("/dashboard/operacao/estoque")}
                className="w-full rounded-xl px-4 py-3 flex items-center gap-3 active:scale-95 transition-all text-left"
                style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderLeft: '3px solid #EF4444' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: '#FEE2E2', color: '#DC2626' }}>
                  <Ic.Box size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: '#7F1D1D' }}>{item.nome}</p>
                  <p className="text-[10px] font-medium mt-0.5" style={{ color: '#DC2626' }}>Crítico — {item.quantidade} {item.unidade} (mín: {item.minimo})</p>
                </div>
              </button>
            ))}
            {ALERTAS_EVENTOS.map((ev) => (
              <button key={ev.nome} onClick={() => router.push("/dashboard/operacao/eventos")}
                className="w-full rounded-xl px-4 py-3 flex items-center gap-3 active:scale-95 transition-all text-left"
                style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderLeft: '3px solid #F59E0B' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: '#FEF3C7', color: '#D97706' }}>
                  <Ic.Calendar size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: '#78350F' }}>{ev.nome}</p>
                  <p className="text-[10px] font-medium mt-0.5" style={{ color: '#D97706' }}>Em {ev.dias} dias — confirme o cardápio</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Acesso Rápido */}
      <div>
        <SectionTitle>Acesso Rápido</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {ATALHOS.map((a) => {
            const AIcon = a.Icon;
            return (
              <button key={a.id} onClick={() => router.push(a.href)}
                className="rounded-xl p-3 flex flex-col items-center gap-2 active:scale-95 transition-all"
                style={{ background: 'var(--card)', border: '1px solid rgba(255,255,255,0.07)' }}
                onMouseOver={e=>e.currentTarget.style.background='#263548'}
                onMouseOut={e=>e.currentTarget.style.background='var(--card)'}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--fg)' }}>
                  <AIcon size={16} />
                </div>
                <p className="text-[10px] font-semibold text-center leading-tight" style={{ color: 'var(--muted)' }}>{a.label}</p>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TELA DRE GERENCIAL
// ═══════════════════════════════════════════════════════════════
function TelaDRE({ mes, ano }) {
  const [dados, setDados]     = useState(null);
  const [loading, setLoading] = useState(true);
  const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  useEffect(() => {
    setLoading(true);
    fetch(`/api/dre?mes=${mes + 1}&ano=${ano}`)
      .then((r) => r.json())
      .then((d) => { setDados(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [mes, ano]);
  const rows = dados?.linhas || [];
  return (
    <div className="px-4 pt-5 pb-28">
      <h1 className="text-2xl font-black mb-1" style={{ color: 'var(--fg)' }}>DRE Gerencial</h1>
      <p className="text-sm font-medium mb-5" style={{ color: 'var(--dim)' }}>{MESES[mes]} {ano}</p>
      {loading
        ? [1,2,3,4,5].map((i) => <Skel key={i} cls="h-14 mb-2" />)
        : rows.length === 0
          ? (
            <Card className="p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--dim)' }}><Ic.BarChart size={22} /></div>
              <p className="text-sm font-bold mb-1" style={{ color: 'var(--fg-soft)' }}>Sem dados para o período</p>
              <p className="text-xs font-medium" style={{ color: 'var(--dim)' }}>Registre lançamentos financeiros para gerar o DRE.</p>
            </Card>
          )
          : (
            <Card>
              {rows.map((r, i) => (
                <div key={i} className={`flex justify-between items-center px-4 py-3`}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: r.destaque ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                  <p style={{ fontSize: 13, fontWeight: r.destaque ? 700 : 500, color: r.destaque ? 'var(--fg)' : 'var(--muted)' }}>{r.label}</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: r.valor >= 0 ? 'var(--accent)' : 'var(--danger)' }}>{fmtBRL(r.valor)}</p>
                </div>
              ))}
            </Card>
          )
      }
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TELA CONTROLE DE ESTOQUE
// ═══════════════════════════════════════════════════════════════
function TelaEstoque() {
  const [busca, setBusca]     = useState("");
  const [itens, setItens]     = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/estoque")
      .then((r) => r.json())
      .then((d) => { setItens(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);
  const filtrados = itens.filter((i) => i.nome?.toLowerCase().includes(busca.toLowerCase()));
  return (
    <div className="px-4 pt-5 pb-28">
      <h1 className="text-2xl font-black mb-4" style={{ color: 'var(--fg)' }}>Controle de Estoque</h1>
      <div className="relative mb-4">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--dim)' }}><Ic.Search size={16} /></div>
        <input type="search" placeholder="Buscar insumo..." value={busca} onChange={(e) => setBusca(e.target.value)}
          style={{ width: '100%', background: 'var(--card)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, paddingLeft: 40, paddingRight: 16, paddingTop: 10, paddingBottom: 10, fontSize: 13, fontWeight: 500, color: 'var(--fg)', outline: 'none' }} />
      </div>
      {loading
        ? [1,2,3,4].map((i) => <Skel key={i} cls="h-16 mb-2" />)
        : filtrados.length === 0
          ? (
            <Card className="p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--dim)' }}><Ic.Box size={22} /></div>
              <p className="text-sm font-bold mb-1" style={{ color: 'var(--fg-soft)' }}>Nenhum insumo cadastrado</p>
              <p className="text-xs font-medium" style={{ color: 'var(--dim)' }}>Adicione insumos para controlar seu estoque.</p>
            </Card>
          )
          : (
            <Card>
              {filtrados.map((it, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-black"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--subtle)' }}>
                    {it.nome?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--fg)' }}>{it.nome}</p>
                    <p className="text-xs font-medium" style={{ color: 'var(--dim)' }}>{it.unidade} · {it.categoria}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-black ${it.qtd <= (it.minimo || 0) ? "text-accent" : "text-neutral-800"}`}>{it.qtd}</p>
                    <p className="text-[10px] text-neutral-400 font-medium">qtd</p>
                  </div>
                </div>
              ))}
            </Card>
          )
      }
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TELA CARDÁPIO E FICHA TÉCNICA
// ═══════════════════════════════════════════════════════════════
function TelaCardapio() {
  const [receitas, setReceitas] = useState([]);
  const [loading, setLoading]   = useState(true);
  useEffect(() => {
    fetch("/api/receitas")
      .then((r) => r.json())
      .then((d) => { setReceitas(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);
  return (
    <div className="px-4 pt-5 pb-28">
      <h1 className="text-2xl font-black text-neutral-900 mb-1">Cardápio e Ficha Técnica</h1>
      <p className="text-sm text-neutral-400 font-medium mb-5">Cadastro de pratos e custo de insumos.</p>
      {loading
        ? [1,2,3].map((i) => <Skel key={i} cls="h-16 mb-2" />)
        : receitas.length === 0
          ? (
            <Card className="p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mb-3"><Ic.MenuBook size={22} /></div>
              <p className="text-sm font-bold text-neutral-700 mb-1">Nenhuma ficha técnica cadastrada</p>
              <p className="text-xs text-neutral-400 font-medium">Crie fichas para calcular o custo dos seus pratos.</p>
            </Card>
          )
          : (
            <Card className="divide-y divide-neutral-100">
              {receitas.map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0 text-accent">
                    <Ic.MenuBook size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-neutral-800 truncate">{r.nome}</p>
                    <p className="text-xs text-neutral-400 font-medium">{r.categoria}</p>
                  </div>
                  {r.custo != null && <p className="text-sm font-black text-accent flex-shrink-0">{fmtBRL(r.custo)}</p>}
                </div>
              ))}
            </Card>
          )
      }
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TELA MINHA CONTA / PERFIL
// ═══════════════════════════════════════════════════════════════
function TelaConta({ sessao, onSair }) {
  const unidades = ["Seldeestrela", "Tico Tico Saladas", "Burguer"];
  const [unidade, setUnidade]         = useState(0);
  const [fotoUrl, setFotoUrl]         = useState(null);
  const [mostrarHist, setMostrarHist] = useState(false);
  const { historico }                 = useHistoricoLogin();
  const fileRef                       = useRef(null);
  const papel                         = sessao ? getPapel(sessao.papel) : null;

  const onFoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target.result;
      setFotoUrl(b64);
      try { localStorage.setItem("erp_foto_perfil", b64); } catch (_) {}
    };
    reader.readAsDataURL(file);
  };
  useEffect(() => {
    try { const s = localStorage.getItem("erp_foto_perfil"); if (s) setFotoUrl(s); } catch (_) {}
  }, []);

  return (
    <div className="px-4 pt-5 pb-28">
      <h1 className="text-2xl font-black text-neutral-900 mb-5">Meu Perfil</h1>

      <Card className="p-5 mb-4">
        <div className="flex items-center gap-4">
          <button onClick={() => fileRef.current?.click()} className="relative flex-shrink-0 group">
            {fotoUrl
              ? <img src={fotoUrl} alt="Foto" className="w-16 h-16 rounded-full object-cover shadow-md ring-2 ring-accent/40" />
              : <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent to-accent-strong flex items-center justify-center text-white text-2xl font-black shadow-md ring-2 ring-accent/40">
                  {sessao?.nome?.[0]?.toUpperCase() || "U"}
                </div>
            }
            <div className="absolute inset-0 rounded-full bg-accent-strong/30 flex items-center justify-center opacity-0 group-active:opacity-100 transition-opacity">
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFoto} />
          <div className="flex-1 min-w-0">
            <p className="text-base font-black text-neutral-900 leading-tight">{sessao?.nome || "Usuário"}</p>
            <p className="text-xs text-neutral-400 font-medium mb-1">{papel?.label || "—"}</p>
            <span className="inline-flex items-center gap-1.5 bg-brand-50 text-brand-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              Sessão ativa
            </span>
          </div>
        </div>
        {papel && (
          <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center gap-2">
            <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: papel.cor + "20" }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: papel.cor }} />
            </div>
            <p className="text-xs text-neutral-500 font-medium">
              Acesso: <span className="text-neutral-800 font-bold">{papel.label}</span>
              {sessao?.unidade && <span className="text-neutral-400"> · {sessao.unidade}</span>}
            </p>
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center justify-between">
          <div className="text-center"><p className="text-base font-black text-neutral-900">{historico.length}</p><p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wide">Sessões</p></div>
          <div className="w-px h-8 bg-neutral-100" />
          <div className="text-center"><p className="text-base font-black text-neutral-900">Pro</p><p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wide">Plano</p></div>
          <div className="w-px h-8 bg-neutral-100" />
          <div className="text-center"><p className="text-base font-black text-neutral-900">3</p><p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wide">Unidades</p></div>
        </div>
      </Card>

      <SectionTitle>Unidade Ativa</SectionTitle>
      <Card className="p-1 mb-4">
        {unidades.map((u, i) => (
          <button key={u} onClick={() => setUnidade(i)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${unidade === i ? "bg-brand-50" : "active:bg-neutral-50"}`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${unidade === i ? "bg-accent text-white" : "bg-neutral-100 text-neutral-500"}`}>
              {u[0]}
            </div>
            <span className={`text-sm font-bold flex-1 text-left ${unidade === i ? "text-brand-900" : "text-neutral-700"}`}>{u}</span>
            {unidade === i && <span className="text-accent text-[10px] font-black bg-brand-50 px-2 py-0.5 rounded-full">ATIVA</span>}
          </button>
        ))}
      </Card>

      <button onClick={() => setMostrarHist(!mostrarHist)} className="w-full flex items-center justify-between mb-2 px-1">
        <SectionTitle>Histórico de Acesso</SectionTitle>
        <span className={`text-neutral-400 transition-transform duration-200 mb-2 ${mostrarHist ? "rotate-180" : ""}`}>
          <Ic.ChevronDown size={16} />
        </span>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${mostrarHist ? "max-h-[500px]" : "max-h-0"}`}>
        <Card className="divide-y divide-neutral-100 mb-4">
          {historico.length === 0
            ? <div className="px-4 py-6 text-center"><p className="text-xs text-neutral-400">Nenhuma sessão registrada ainda.</p></div>
            : historico.map((s, i) => (
              <div key={s.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-neutral-800">{s.dispositivo}</span>
                      {i === 0 && !s.saida && <span className="text-[9px] font-black text-accent bg-brand-50 px-1.5 py-0.5 rounded-full">ATUAL</span>}
                    </div>
                    <p className="text-xs text-neutral-500 font-medium">Entrada: <span className="text-neutral-700 font-bold">{fmtDataHora(s.entrada)}</span></p>
                    {s.saida && <p className="text-xs text-neutral-500 font-medium">Saída: <span className="text-neutral-700 font-bold">{fmtDataHora(s.saida)}</span></p>}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${!s.saida ? "bg-brand-50 text-brand-900" : "bg-neutral-100 text-neutral-500"}`}>
                    {fmtDuracao(s.entrada, s.saida)}
                  </span>
                </div>
              </div>
            ))
          }
        </Card>
      </div>

      <button onClick={onSair}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl border-2 border-[rgba(5,150,105,0.3)] text-accent text-sm font-bold active:bg-red-50 transition-colors mt-2">
        <Ic.LogOut size={16} />
        Sair da conta
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SIDEBAR ESTÁTICA — ícones sempre visíveis, expande no hover
// ═══════════════════════════════════════════════════════════════
function SidebarMenu({ navId, onNav, sessao, onSair, navPermitidos }) {
  const [exp, setExp] = useState(false);
  const papel = sessao ? getPapel(sessao.papel) : null;
  const sideRouter = useRouter();
  let naoLidas = 0;
  try { const ctx = useERP(); naoLidas = ctx.naoLidas; } catch (_) {}

  const W_COL = 64;
  const W_EXP = 260;

  return (
    <aside
      onMouseEnter={() => setExp(true)}
      onMouseLeave={() => setExp(false)}
      style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        width: exp ? W_EXP : W_COL,
        background: 'var(--surface)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        transition: 'width 220ms cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>

      {/* Logo */}
      <div style={{
        height: 56, flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center',
        padding: '0 18px', gap: 12,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: 'linear-gradient(135deg,#059669,#34D399)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <div style={{ opacity: exp ? 1 : 0, transition: 'opacity 160ms', whiteSpace: 'nowrap', overflow: 'hidden' }}>
          <p style={{ color: 'var(--fg)', fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>Cerebro ERP</p>
          {papel && <p style={{ color: papel.cor, fontSize: 10, fontWeight: 600, marginTop: 1 }}>{papel.label}</p>}
        </div>
      </div>

      {/* Usuário */}
      <div style={{
        margin: '10px 8px 4px',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        padding: '8px 10px',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: 'linear-gradient(135deg,#059669,#34D399)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 12, fontWeight: 700,
        }}>
          {sessao?.nome?.[0]?.toUpperCase() || "U"}
        </div>
        <div style={{ opacity: exp ? 1 : 0, transition: 'opacity 160ms', overflow: 'hidden', whiteSpace: 'nowrap', minWidth: 0 }}>
          <p style={{ color: 'var(--fg)', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {sessao?.nome?.split(" ")[0] || "Usuário"}
          </p>
          <p style={{ color: 'var(--dim)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {sessao?.email || ""}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }}>
        {MENU_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => navPermitidos.includes(item.id));
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.id} style={{ marginBottom: 8 }}>
              {/* Rótulo do grupo — só visível quando expandido */}
              <div style={{
                height: 20, display: 'flex', alignItems: 'center',
                padding: '0 18px', overflow: 'hidden',
                opacity: exp ? 1 : 0, transition: 'opacity 160ms',
              }}>
                <p style={{ color: 'var(--elevated)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  {group.label}
                </p>
              </div>
              {visibleItems.map((item) => {
                const active = navId === item.id;
                const NavIcon = item.Icon;
                return (
                  <button key={item.id}
                    onClick={() => item.id === "dashboard" ? onNav("dashboard") : sideRouter.push(item.href)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      gap: 12, padding: exp ? '9px 14px' : '9px 0',
                      justifyContent: exp ? 'flex-start' : 'center',
                      background: active ? 'rgba(5,150,105,0.14)' : 'transparent',
                      color: active ? 'var(--accent-fg)' : 'var(--subtle)',
                      border: 'none', cursor: 'pointer',
                      transition: 'background 120ms, color 120ms',
                      borderLeft: active ? '2px solid #34D399' : '2px solid transparent',
                    }}
                    onMouseOver={e => {
                      if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--fg-soft)'; }
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.background = active ? 'rgba(5,150,105,0.14)' : 'transparent';
                      e.currentTarget.style.color = active ? 'var(--accent-fg)' : 'var(--subtle)';
                    }}>
                    <div style={{ flexShrink: 0, width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <NavIcon size={16} />
                    </div>
                    <span style={{
                      fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
                      opacity: exp ? 1 : 0, transition: 'opacity 160ms',
                      flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{item.label}</span>
                    {item.id === "notificacoes" && naoLidas > 0 && exp && (
                      <span style={{
                        minWidth: 18, height: 18, background: 'var(--danger)',
                        color: 'white', fontSize: 9, fontWeight: 700,
                        borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 4px', flexShrink: 0,
                      }}>
                        {naoLidas > 9 ? "9+" : naoLidas}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Rodapé */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 0 12px' }}>
        <button
          onClick={() => onNav("conta")}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            gap: 12, padding: exp ? '8px 14px' : '8px 0',
            justifyContent: exp ? 'flex-start' : 'center',
            color: 'var(--subtle)', background: 'transparent', border: 'none', cursor: 'pointer',
            transition: 'background 120ms, color 120ms',
          }}
          onMouseOver={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.color='var(--fg-soft)'; }}
          onMouseOut={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--subtle)'; }}>
          <div style={{ width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Ic.User size={15} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', opacity: exp ? 1 : 0, transition: 'opacity 160ms' }}>
            Meu Perfil
          </span>
        </button>
        <button
          onClick={onSair}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            gap: 12, padding: exp ? '8px 14px' : '8px 0',
            justifyContent: exp ? 'flex-start' : 'center',
            color: 'var(--subtle)', background: 'transparent', border: 'none', cursor: 'pointer',
            transition: 'background 120ms, color 120ms',
          }}
          onMouseOver={e=>{ e.currentTarget.style.background='rgba(239,68,68,0.08)'; e.currentTarget.style.color='#F87171'; }}
          onMouseOut={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--subtle)'; }}>
          <div style={{ width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Ic.LogOut size={15} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', opacity: exp ? 1 : 0, transition: 'opacity 160ms' }}>
            Sair da conta
          </span>
        </button>
      </div>
    </aside>
  );
}

// ═══════════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════════
function Header({ sessao, navId, onNavNotif }) {
  const activeItem = MENU_GROUPS.flatMap((g) => g.items).find((i) => i.id === navId);
  const title = navId === "conta" ? "Meu Perfil" : (activeItem?.label || "Cerebro ERP");
  let naoLidas = 0;
  try { const ctx = useERP(); naoLidas = ctx.naoLidas; } catch (_) {}

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 30,
      height: 56, display: 'flex', alignItems: 'center',
      padding: '0 20px', gap: 12,
      background: 'var(--surface)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: 'var(--fg)', fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </p>
      </div>
      <button onClick={onNavNotif}
        style={{
          position: 'relative', width: 36, height: 36, borderRadius: 8, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid rgba(255,255,255,0.08)', color: 'var(--muted)',
          background: 'transparent', cursor: 'pointer',
        }}
        onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,0.06)'}
        onMouseOut={e=>e.currentTarget.style.background='transparent'}>
        <Ic.Bell size={16} />
        {naoLidas > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 16, height: 16, background: 'var(--danger)',
            color: 'white', fontSize: 9, fontWeight: 700,
            borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px',
          }}>
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>
      {sessao && (
        <div style={{
          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 13, fontWeight: 700,
          background: 'linear-gradient(135deg,#059669,#34D399)',
        }}>
          {sessao.nome?.[0]?.toUpperCase() || "U"}
        </div>
      )}
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const router = useRouter();
  const [authOk,   setAuthOk]   = useState(false);
  const [sessao,   setSessao]   = useState(null);
  const [navId,    setNavId]    = useState("dashboard");
  const [dashData, setDashData] = useState(null);
  const [dashLoad, setDashLoad] = useState(true);
  const [mes,      setMes]      = useState(new Date().getMonth());
  const [ano,      setAno]      = useState(new Date().getFullYear());

  function getNavPermitidos(papelId) {
    const p = getPapel(papelId);
    if (p.id === "admin") return ALL_NAV_IDS;
    // Mapeia nav antigos para novos IDs
    const mapa = {
      dashboard: "dashboard", insumos: "estoque", categorias: "estoque",
      receitas: "cardapio", dre: "dre", conta: "conta",
      rh: "gestao_rh", colaboradores: "colaborador", eventos: "eventos",
      crm: "crm", marketing: "campanhas", documentos: "documentos",
      fluxo_caixa: "fluxo", cmv: "cmv", escala: "ponto", nps: "nps",
    };
    const mapeados = (p.nav || []).map((id) => mapa[id] || id).filter(Boolean);
    return [...new Set(["dashboard", ...mapeados])];
  }

  useEffect(() => {
    const s = lerSessao();
    if (!s) { router.replace("/login"); return; }
    setSessao(s);
    setAuthOk(true);
    setDashLoad(false);
  }, []);

  if (!authOk) return null;

  return (
    <>
      <Header
        sessao={sessao}
        navId="dashboard"
        onNavNotif={() => router.push("/dashboard/notificacoes")}
      />
      <main style={{ flex: 1, overflowY: "auto" }}>
        <TelaDashboard
          mes={mes}
          ano={ano}
          dados={dashData}
          loading={dashLoad}
          sessao={sessao}
        />
      </main>
    </>
  );
}