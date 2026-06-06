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
    id: "visao_geral", label: "VISÃO GERAL",
    items: [
      { id: "dashboard",    label: "Painel Inicial",           Icon: Ic.Dashboard, href: "/dashboard" },
      { id: "notificacoes", label: "Notificações",              Icon: Ic.Bell,      href: "/dashboard/notificacoes" },
    ],
  },
  {
    id: "operacao", label: "OPERAÇÃO",
    items: [
      { id: "rotina",        label: "Rotina da Loja",          Icon: Ic.Checklist,    href: "/dashboard/operacao/rotina" },
      { id: "cardapio",      label: "Cardápio",                Icon: Ic.ChefHat,      href: "/dashboard/operacao/cardapio" },
      { id: "fichas",        label: "Ficha Técnica",           Icon: Ic.MenuBook,     href: "/dashboard/operacao/fichas" },
      { id: "ingredientes",  label: "Cadastro de Ingredientes",Icon: Ic.FlaskConical, href: "/dashboard/operacao/ingredientes" },
      { id: "estoque",       label: "Controle de Estoque",     Icon: Ic.Box,          href: "/dashboard/operacao/estoque" },
      { id: "fornecedores",  label: "Fornecedores",            Icon: Ic.Truck,        href: "/dashboard/operacao/fornecedores" },
      { id: "eventos",       label: "Gestão de Eventos",       Icon: Ic.Calendar,     href: "/dashboard/operacao/eventos" },
    ],
  },
  {
    id: "financeiro", label: "FINANCEIRO",
    items: [
      { id: "dre",          label: "DRE Gerencial",            Icon: Ic.BarChart,  href: "/dashboard/financeiro/dre" },
      { id: "fluxo",        label: "Fluxo de Caixa",           Icon: Ic.ArrowsUD,  href: "/dashboard/financeiro/fluxo" },
      { id: "cmv",          label: "Análise de CMV",           Icon: Ic.Percent,   href: "/dashboard/financeiro/cmv" },
      { id: "margem",       label: "Margem de Lucro",          Icon: Ic.TrendUp,   href: "/dashboard/financeiro/margem" },
      { id: "documentos",   label: "Notas e Boletos",          Icon: Ic.FileText,  href: "/dashboard/financeiro/documentos" },
    ],
  },
  {
    id: "rh_grupo", label: "EQUIPE & RH",
    items: [
      { id: "gestao_rh",   label: "Gestão de RH",             Icon: Ic.Users,     href: "/dashboard/rh/gestao" },
      { id: "ponto",       label: "Controle de Ponto",        Icon: Ic.Clock,     href: "/dashboard/rh/ponto" },
      { id: "colaborador", label: "Portal do Colaborador",    Icon: Ic.Badge,     href: "/dashboard/rh/colaborador" },
    ],
  },
  {
    id: "clientes", label: "CLIENTES",
    items: [
      { id: "crm",       label: "CRM",                        Icon: Ic.UserCheck, href: "/dashboard/clientes/crm" },
      { id: "campanhas", label: "Campanhas de Vendas",        Icon: Ic.Megaphone, href: "/dashboard/clientes/campanhas" },
      { id: "nps",       label: "Avaliações (NPS)",           Icon: Ic.Star,      href: "/dashboard/clientes/nps" },
    ],
  },
  {
    id: "ia", label: "ASSISTENTE IA",
    items: [
      { id: "heitor", label: "Central Heitor IA",             Icon: Ic.Brain,     href: "/dashboard/ia/heitor" },
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
const Skel = ({ cls = "" }) => <div className={`animate-pulse bg-neutral-100 rounded-xl ${cls}`} />;
function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-2xl shadow-sm ${className}`}>{children}</div>;
}
function SectionTitle({ children }) {
  return <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 px-1">{children}</p>;
}
function TelaEmBreve({ titulo, descricao }) {
  return (
    <div className="px-4 pt-5 pb-28">
      <h1 className="text-2xl font-black text-neutral-900 mb-1">{titulo}</h1>
      <p className="text-sm text-neutral-400 font-medium mb-8">{descricao}</p>
      <Card className="p-8 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={1.8}>
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <p className="text-sm font-bold text-neutral-700 mb-1">Em desenvolvimento</p>
        <p className="text-xs text-neutral-400 font-medium">Este módulo estará disponível em breve.</p>
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

// Alertas mock — substituir por fetch Supabase quando integrado
const ALERTAS_ESTOQUE = [
  { nome: "Feijão Carioca", quantidade: 3, minimo: 5, unidade: "KG" },
  { nome: "Alface Crespa",  quantidade: 2, minimo: 5, unidade: "MAÇO" },
];
const ALERTAS_EVENTOS = [
  { nome: "Aniversário 50 anos João", dias: 15 },
];

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
    <div className="px-4 pt-5 pb-28 space-y-5">

      {/* Saudação */}
      <div>
        <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">{saudacao},</p>
        <h1 className="text-2xl font-black text-neutral-900 leading-tight">{nome} 👋</h1>
      </div>

      {/* KPI Cards 2×2 */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Faturamento",   val: d.faturamento   != null ? fmtBRL(d.faturamento)   : null, cor: "#10b981" },
          { label: "Custos Totais", val: d.custos_totais != null ? fmtBRL(d.custos_totais) : null, cor: "#f97316" },
          { label: "Lucro Líquido", val: d.lucro_liquido != null ? fmtBRL(d.lucro_liquido) : null, cor: "#3b82f6" },
          { label: "Margem",        val: d.margem_pct    != null ? `${d.margem_pct}%`       : null, cor: "#8b5cf6" },
        ].map(({ label, val, cor }) => (
          <Card key={label} className="p-4">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">{label}</p>
            {loading || val == null
              ? <Skel cls="h-7 w-24 mt-1" />
              : <p className="text-xl font-black leading-tight" style={{ color: cor }}>{val}</p>}
          </Card>
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
                    style={{ height: `${h}px`, backgroundColor: b.atual ? "#10b981" : "#e5e7eb" }}
                  />
                  <p className={`text-[9px] font-black leading-none ${b.atual ? "text-[#10b981]" : "text-neutral-400"}`}>
                    {b.label}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-neutral-300 font-medium text-center mt-3">
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
                <span className="text-xs font-bold text-neutral-700">{label}</span>
                {loading || pct == null ? <Skel cls="h-3 w-8" /> : <span className="text-xs font-black" style={{ color: cor }}>{pct}%</span>}
              </div>
              <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                {!loading && pct != null && (
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: cor }} />
                )}
              </div>
            </div>
          ))}
          {!loading && d.faturamento == null && (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center mb-2"><Ic.BarChart size={18} /></div>
              <p className="text-xs font-bold text-neutral-500">Sem dados para o período</p>
              <p className="text-[11px] text-neutral-400 font-medium">Registre vendas e custos para ver o painel.</p>
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
              className="text-[10px] font-black text-[#10b981] active:opacity-70"
            >
              Ver todas →
            </button>
          </div>
          <div className="space-y-2">
            {ALERTAS_ESTOQUE.map((item) => (
              <button key={item.nome} onClick={() => router.push("/dashboard/operacao/estoque")}
                className="w-full bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 flex items-center gap-3 active:scale-95 transition-all text-left">
                <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0 text-rose-500">
                  <Ic.Box size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-rose-800 truncate">{item.nome}</p>
                  <p className="text-[10px] font-bold text-rose-500">Estoque crítico — {item.quantidade} {item.unidade} (mín: {item.minimo})</p>
                </div>
              </button>
            ))}
            {ALERTAS_EVENTOS.map((ev) => (
              <button key={ev.nome} onClick={() => router.push("/dashboard/operacao/eventos")}
                className="w-full bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3 active:scale-95 transition-all text-left">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-500">
                  <Ic.Calendar size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-amber-800 truncate">{ev.nome}</p>
                  <p className="text-[10px] font-bold text-amber-600">Em {ev.dias} dias — confirme o cardápio</p>
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
                className="bg-white border border-neutral-100 rounded-2xl shadow-sm p-3 flex flex-col items-center gap-2 active:scale-95 transition-all">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: a.cor + "15", color: a.cor }}>
                  <AIcon size={18} />
                </div>
                <p className="text-[10px] font-black text-neutral-700 text-center leading-tight">{a.label}</p>
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
      <h1 className="text-2xl font-black text-neutral-900 mb-1">DRE Gerencial</h1>
      <p className="text-sm text-neutral-400 font-medium mb-5">{MESES[mes]} {ano}</p>
      {loading
        ? [1,2,3,4,5].map((i) => <Skel key={i} cls="h-14 mb-2" />)
        : rows.length === 0
          ? (
            <Card className="p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mb-3"><Ic.BarChart size={22} /></div>
              <p className="text-sm font-bold text-neutral-700 mb-1">Sem dados para o período</p>
              <p className="text-xs text-neutral-400 font-medium">Registre lançamentos financeiros para gerar o DRE.</p>
            </Card>
          )
          : (
            <Card className="divide-y divide-neutral-100">
              {rows.map((r, i) => (
                <div key={i} className={`flex justify-between items-center px-4 py-3 ${r.destaque ? "bg-neutral-50" : ""}`}>
                  <p className={`text-sm ${r.destaque ? "font-black text-neutral-900" : "font-medium text-neutral-600"}`}>{r.label}</p>
                  <p className={`text-sm font-bold ${r.valor >= 0 ? "text-[#10b981]" : "text-red-500"}`}>{fmtBRL(r.valor)}</p>
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
      <h1 className="text-2xl font-black text-neutral-900 mb-4">Controle de Estoque</h1>
      <div className="relative mb-4">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"><Ic.Search size={16} /></div>
        <input type="search" placeholder="Buscar insumo..." value={busca} onChange={(e) => setBusca(e.target.value)}
          className="w-full bg-white border border-neutral-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm font-medium text-neutral-800 outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 transition-all shadow-sm" />
      </div>
      {loading
        ? [1,2,3,4].map((i) => <Skel key={i} cls="h-16 mb-2" />)
        : filtrados.length === 0
          ? (
            <Card className="p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mb-3"><Ic.Box size={22} /></div>
              <p className="text-sm font-bold text-neutral-700 mb-1">Nenhum insumo cadastrado</p>
              <p className="text-xs text-neutral-400 font-medium">Adicione insumos para controlar seu estoque.</p>
            </Card>
          )
          : (
            <Card className="divide-y divide-neutral-100">
              {filtrados.map((it, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0 text-sm font-black text-neutral-500">
                    {it.nome?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-neutral-800 truncate">{it.nome}</p>
                    <p className="text-xs text-neutral-400 font-medium">{it.unidade} · {it.categoria}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-black ${it.qtd <= (it.minimo || 0) ? "text-red-500" : "text-neutral-800"}`}>{it.qtd}</p>
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
                  <div className="w-9 h-9 rounded-xl bg-[#edfbf3] flex items-center justify-center flex-shrink-0 text-[#10b981]">
                    <Ic.MenuBook size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-neutral-800 truncate">{r.nome}</p>
                    <p className="text-xs text-neutral-400 font-medium">{r.categoria}</p>
                  </div>
                  {r.custo != null && <p className="text-sm font-black text-[#10b981] flex-shrink-0">{fmtBRL(r.custo)}</p>}
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
              ? <img src={fotoUrl} alt="Foto" className="w-16 h-16 rounded-full object-cover shadow-md ring-2 ring-[#10b981]/40" />
              : <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#10b981] to-[#059669] flex items-center justify-center text-white text-2xl font-black shadow-md ring-2 ring-[#10b981]/40">
                  {sessao?.nome?.[0]?.toUpperCase() || "U"}
                </div>
            }
            <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-active:opacity-100 transition-opacity">
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
            <span className="inline-flex items-center gap-1.5 bg-[#edfbf3] text-[#0a6c4b] text-[10px] font-bold px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
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
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${unidade === i ? "bg-[#edfbf3]" : "active:bg-neutral-50"}`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${unidade === i ? "bg-[#10b981] text-white" : "bg-neutral-100 text-neutral-500"}`}>
              {u[0]}
            </div>
            <span className={`text-sm font-bold flex-1 text-left ${unidade === i ? "text-[#0a6c4b]" : "text-neutral-700"}`}>{u}</span>
            {unidade === i && <span className="text-[#10b981] text-[10px] font-black bg-[#edfbf3] px-2 py-0.5 rounded-full">ATIVA</span>}
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
                      {i === 0 && !s.saida && <span className="text-[9px] font-black text-[#10b981] bg-[#edfbf3] px-1.5 py-0.5 rounded-full">ATUAL</span>}
                    </div>
                    <p className="text-xs text-neutral-500 font-medium">Entrada: <span className="text-neutral-700 font-bold">{fmtDataHora(s.entrada)}</span></p>
                    {s.saida && <p className="text-xs text-neutral-500 font-medium">Saída: <span className="text-neutral-700 font-bold">{fmtDataHora(s.saida)}</span></p>}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${!s.saida ? "bg-[#edfbf3] text-[#0a6c4b]" : "bg-neutral-100 text-neutral-500"}`}>
                    {fmtDuracao(s.entrada, s.saida)}
                  </span>
                </div>
              </div>
            ))
          }
        </Card>
      </div>

      <button onClick={onSair}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl border-2 border-red-200 text-red-500 text-sm font-bold active:bg-red-50 transition-colors mt-2">
        <Ic.LogOut size={16} />
        Sair da conta
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SIDEBAR MENU LATERAL
// ═══════════════════════════════════════════════════════════════
function SidebarMenu({ open, onClose, navId, onNav, sessao, onSair, navPermitidos }) {
  const initialGroup = MENU_GROUPS.find((g) => g.items.some((i) => i.id === navId))?.id || "visao_geral";
  const [expanded, setExpanded] = useState(initialGroup);
  const papel = sessao ? getPapel(sessao.papel) : null;
  const sideRouter = useRouter();
  let naoLidas = 0;
  try { const ctx = useERP(); naoLidas = ctx.naoLidas; } catch (_) {}

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      <aside className={`fixed top-0 left-0 bottom-0 z-50 w-[300px] bg-[#fbf9f5] flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "-translate-x-full"}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-10 pb-5 border-b border-neutral-200">
          <div>
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mb-0.5">Cerebro ERP</p>
            <p className="text-base font-black text-neutral-900 leading-tight">{sessao?.nome?.split(" ")[0] || "Usuário"}</p>
            {papel && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: papel.cor }} />
                <p className="text-xs text-neutral-500 font-medium">{papel.label}</p>
              </div>
            )}
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center active:bg-neutral-200 flex-shrink-0">
            <Ic.Close size={18} />
          </button>
        </div>

        {/* Itens */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {MENU_GROUPS.map((group) => {
            const visibleItems = group.items.filter((item) => navPermitidos.includes(item.id));
            if (visibleItems.length === 0) return null;
            const isExp = expanded === group.id;
            return (
              <div key={group.id} className="mb-1">
                <button
                  onClick={() => setExpanded(isExp ? "" : group.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl active:bg-neutral-100 transition-colors"
                >
                  <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{group.label}</span>
                  <Ic.ChevronDown size={12} className={`text-neutral-400 transition-transform duration-200 ${isExp ? "rotate-180" : ""}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-200 ${isExp ? "max-h-[500px]" : "max-h-0"}`}>
                  {visibleItems.map((item) => {
                    const active = navId === item.id;
                    const NavIcon = item.Icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onClose();
                          if (item.id === "dashboard") {
                            onNav("dashboard");
                          } else {
                            sideRouter.push(item.href);
                          }
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl mb-0.5 transition-all ${active ? "bg-[#edfbf3]" : "active:bg-neutral-100"}`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? "bg-[#10b981] text-white" : "bg-neutral-100 text-neutral-500"}`}>
                          <NavIcon size={16} />
                        </div>
                        <span className={`text-sm font-bold text-left leading-tight flex-1 ${active ? "text-[#0a6c4b]" : "text-neutral-700"}`}>{item.label}</span>
                        {item.id === "notificacoes" && naoLidas > 0 && (
                          <span className="min-w-[18px] h-[18px] bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 leading-none flex-shrink-0">
                            {naoLidas > 9 ? "9+" : naoLidas}
                          </span>
                        )}
                        {active && item.id !== "notificacoes" && <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Rodapé */}
        <div className="border-t border-neutral-200 px-3 py-4 space-y-1">
          <button
            onClick={() => { onNav("conta"); onClose(); }}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${navId === "conta" ? "bg-[#edfbf3]" : "active:bg-neutral-100"}`}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${navId === "conta" ? "bg-[#10b981] text-white" : "bg-neutral-100 text-neutral-500"}`}>
              <Ic.User size={16} />
            </div>
            <span className={`text-sm font-bold flex-1 text-left ${navId === "conta" ? "text-[#0a6c4b]" : "text-neutral-700"}`}>Meu Perfil</span>
          </button>
          <button
            onClick={() => { onSair(); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-500 active:bg-red-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
              <Ic.LogOut size={16} />
            </div>
            <span className="text-sm font-bold text-left">Sair da conta</span>
          </button>
        </div>
      </aside>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════════
function Header({ onMenuOpen, sessao, navId, onNavNotif }) {
  const activeItem = MENU_GROUPS.flatMap((g) => g.items).find((i) => i.id === navId);
  const title = navId === "conta" ? "Meu Perfil" : (activeItem?.label || "Cerebro ERP");
  // Tenta usar o context; se não disponível (fora do Provider) ignora
  let naoLidas = 0;
  try {
    const ctx = useERP();
    naoLidas = ctx.naoLidas;
  } catch (_) {}

  return (
    <header className="sticky top-0 z-30 bg-[#fbf9f5]/95 backdrop-blur-sm border-b border-neutral-200 px-4 py-3 flex items-center gap-3">
      <button onClick={onMenuOpen}
        className="w-9 h-9 rounded-full bg-white border border-neutral-200 flex items-center justify-center active:bg-neutral-50 transition-colors shadow-sm flex-shrink-0">
        <Ic.Menu size={18} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest leading-none mb-0.5">Cerebro ERP</p>
        <p className="text-sm font-black text-neutral-900 leading-tight truncate">{title}</p>
      </div>
      {/* Sino de notificações com badge */}
      <button
        onClick={onNavNotif}
        className="relative w-9 h-9 rounded-full bg-white border border-neutral-200 flex items-center justify-center active:bg-neutral-50 transition-colors shadow-sm flex-shrink-0">
        <Ic.Bell size={17} />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5 leading-none">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>
      {sessao && (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#10b981] to-[#059669] flex items-center justify-center text-white text-sm font-black shadow-sm flex-shrink-0">
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
  const [menuOpen, setMenuOpen] = useState(false);
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
    return [...new Set(mapeados)];
  }

  useEffect(() => {
    const s = lerSessao();
    if (!s) { router.replace("/login"); return; }
    setSessao(s);
    const perm = getNavPermitidos(s.papel);
    setNavId(perm[0] || "dashboard");
    setAuthOk(true);
  }, []);

  const navPermitidos = authOk ? getNavPermitidos(sessao?.papel) : [];

  const handleSair = () => { encerrarSessao(); router.replace("/login"); };

  const MES_FINANCEIROS = ["dashboard", "dre", "fluxo", "cmv", "margem"];

  useEffect(() => {
    if (!authOk || navId !== "dashboard") return;
    setDashLoad(true);
    fetch(`/api/dashboard?mes=${mes + 1}&ano=${ano}`)
      .then((r) => r.json())
      .then((raw) => {
        // Normalize API response shape to match component expectations
        const dist = raw.distribuicao || {};
        const normalized = {
          faturamento:   raw.faturamento   ?? null,
          custos_totais: raw.custos        ?? null,
          lucro_liquido: raw.lucro         ?? null,
          margem_pct:    raw.margem        ?? null,
          distribuicao: Array.isArray(raw.distribuicao) ? raw.distribuicao : [
            { label: "CMV",         cor: "#f97316", pct: dist.cmv         ?? null },
            { label: "Mão de Obra", cor: "#ec4899", pct: dist.mao_de_obra ?? null },
            { label: "Operacional", cor: "#10b981", pct: dist.operacional ?? null },
            { label: "Impostos",    cor: "#ef4444", pct: dist.impostos    ?? null },
          ],
        };
        setDashData(normalized);
        setDashLoad(false);
      })
      .catch(() => setDashLoad(false));
  }, [mes, ano, navId, authOk]);

  if (!authOk) {
    return (
      <div className="min-h-screen bg-[#fbf9f5] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#10b981] flex items-center justify-center shadow-lg">
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <p className="text-sm font-bold text-neutral-500">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbf9f5]">
      <SidebarMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        navId={navId}
        onNav={setNavId}
        sessao={sessao}
        onSair={handleSair}
        navPermitidos={navPermitidos}
      />

      <Header onMenuOpen={() => setMenuOpen(true)} sessao={sessao} navId={navId} onNavNotif={() => setNavId("notificacoes")} />

      {MES_FINANCEIROS.includes(navId) && (
        <div className="flex justify-end px-4 pt-3">
          <SeletorMes mes={mes} ano={ano} onChange={(m, a) => { setMes(m); setAno(a); }} />
        </div>
      )}

      <main>
        {navId === "dashboard"    && <TelaDashboard mes={mes} ano={ano} dados={dashData} loading={dashLoad} sessao={sessao} />}
        {navId === "notificacoes" && <TelaEmBreve titulo="Notificações" descricao="Central de alertas do sistema." />}
        {navId === "rotina"       && <TelaEmBreve titulo="Rotina da Loja" descricao="Checklists e tarefas diárias." />}
        {navId === "cardapio"     && <TelaCardapio />}
        {navId === "estoque"      && <TelaEstoque />}
        {navId === "fornecedores" && <TelaEmBreve titulo="Fornecedores" descricao="Lista de contatos e pedidos." />}
        {navId === "eventos"      && <TelaEmBreve titulo="Gestão de Eventos" descricao="Planejamento, reservas e break-even." />}
        {navId === "dre"          && <TelaDRE mes={mes} ano={ano} />}
        {navId === "fluxo"        && <TelaEmBreve titulo="Fluxo de Caixa" descricao="Entradas e saídas diárias." />}
        {navId === "cmv"          && <TelaEmBreve titulo="Análise de CMV" descricao="Custo de mercadoria vendida." />}
        {navId === "margem"       && <TelaEmBreve titulo="Margem de Lucro" descricao="Ranking de lucratividade dos produtos." />}
        {navId === "documentos"   && <TelaEmBreve titulo="Notas e Boletos" descricao="Contas a pagar e notas fiscais de entrada." />}
        {navId === "gestao_rh"    && <TelaEmBreve titulo="Gestão de RH" descricao="Cadastro de funcionários e documentos." />}
        {navId === "ponto"        && <TelaEmBreve titulo="Controle de Ponto" descricao="Espelho e batida de ponto mobile." />}
        {navId === "colaborador"  && <TelaEmBreve titulo="Portal do Colaborador" descricao="Área restrita de treinamentos e holerites." />}
        {navId === "crm"          && <TelaEmBreve titulo="CRM" descricao="Gestão de relacionamento e histórico do cliente." />}
        {navId === "campanhas"    && <TelaEmBreve titulo="Campanhas de Vendas" descricao="Ações de marketing e cupons." />}
        {navId === "nps"          && <TelaEmBreve titulo="Avaliações (NPS)" descricao="Pesquisas de satisfação e feedback." />}
        {navId === "heitor"       && <TelaEmBreve titulo="Central Heitor IA" descricao="Painel de automação e análises preditivas." />}
        {navId === "conta"        && <TelaConta sessao={sessao} onSair={handleSair} />}
      </main>
    </div>
  );
}
