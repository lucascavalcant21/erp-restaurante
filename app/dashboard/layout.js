"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { lerSessao, encerrarSessao, getPapel } from "../lib/auth";

// ═══════════════════════════════════════════════════════════════
// ÍCONES (subset necessário para o layout)
// ═══════════════════════════════════════════════════════════════
const Ic = {
  Dashboard: () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  Bell:      () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Checklist: () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  ChefHat:   () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><line x1="6" y1="17" x2="18" y2="17"/></svg>,
  MenuBook:  () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>,
  Flask:     () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M10 2v7.31l-3.72 6.17A2 2 0 0 0 8 18h8a2 2 0 0 0 1.72-2.52L14 9.31V2"/><path d="M8.5 2h7"/></svg>,
  Box:       () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>,
  Truck:     () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  Calendar:  () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  BarChart:  () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  ArrowsUD:  () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 4-4"/></svg>,
  Percent:   () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>,
  TrendUp:   () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  FileText:  () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  Users:     () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Clock:     () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Badge:     () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  UserCheck: () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>,
  Megaphone: () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 19-7z"/></svg>,
  Star:      () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Brain:     () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-5 0V8a2.5 2.5 0 0 1-2.5-2.5A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 5 0V8a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 14.5 2z"/></svg>,
  User:      () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  LogOut:    () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

const MENU_GROUPS = [
  {
    id: "visao_geral", label: "DASHBOARD",
    items: [
      { id: "dashboard",    label: "Painel Inicial",       Icon: Ic.Dashboard, href: "/dashboard" },
      { id: "notificacoes", label: "Notificações",          Icon: Ic.Bell,      href: "/dashboard/notificacoes" },
    ],
  },
  {
    id: "operacao", label: "GESTÃO OPERACIONAL",
    items: [
      { id: "rotina",       label: "Operação Geral",       Icon: Ic.Checklist, href: "/dashboard/operacao/rotina" },
      { id: "cardapio",     label: "Cardápio",             Icon: Ic.ChefHat,   href: "/dashboard/operacao/cardapio" },
      { id: "fichas",       label: "Ficha Técnica",        Icon: Ic.MenuBook,  href: "/dashboard/operacao/fichas" },
      { id: "ingredientes", label: "Ingredientes",         Icon: Ic.Flask,     href: "/dashboard/operacao/ingredientes" },
      { id: "estoque",      label: "Estoque",              Icon: Ic.Box,       href: "/dashboard/operacao/estoque" },
      { id: "fornecedores", label: "Fornecedores",         Icon: Ic.Truck,     href: "/dashboard/operacao/fornecedores" },
      { id: "eventos",      label: "Gestão de Eventos",    Icon: Ic.Calendar,  href: "/dashboard/operacao/eventos" },
    ],
  },
  {
    id: "financeiro", label: "FINANCEIRO",
    items: [
      { id: "dre",        label: "DRE",              Icon: Ic.BarChart,  href: "/dashboard/financeiro/dre" },
      { id: "fluxo",      label: "Fluxo de Caixa",   Icon: Ic.ArrowsUD,  href: "/dashboard/financeiro/fluxo" },
      { id: "cmv",        label: "CMV",              Icon: Ic.Percent,   href: "/dashboard/financeiro/cmv" },
      { id: "margem",     label: "Lucro",            Icon: Ic.TrendUp,   href: "/dashboard/financeiro/margem" },
      { id: "documentos", label: "Notas e Boletos",  Icon: Ic.FileText,  href: "/dashboard/financeiro/documentos" },
    ],
  },
  {
    id: "rh_grupo", label: "BPO",
    items: [
      { id: "gestao_rh",  label: "RH",                    Icon: Ic.Users,     href: "/dashboard/rh/gestao" },
      { id: "ponto",      label: "Controle de Ponto",      Icon: Ic.Clock,     href: "/dashboard/rh/ponto" },
      { id: "colaborador",label: "Portal do Colaborador",  Icon: Ic.Badge,     href: "/dashboard/rh/colaborador" },
    ],
  },
  {
    id: "clientes", label: "CLIENTES",
    items: [
      { id: "crm",       label: "CRM",            Icon: Ic.UserCheck, href: "/dashboard/clientes/crm" },
      { id: "campanhas", label: "Tráfego Pago",   Icon: Ic.Megaphone, href: "/dashboard/clientes/campanhas" },
      { id: "nps",       label: "Avaliações",     Icon: Ic.Star,      href: "/dashboard/clientes/nps" },
    ],
  },
  {
    id: "ia", label: "HEITOR I.A",
    items: [
      { id: "heitor", label: "Chat Heitor", Icon: Ic.Brain, href: "/dashboard/ia/heitor" },
    ],
  },
];

// Mapeia pathname → navId
function getNavId(pathname) {
  if (pathname === "/dashboard") return "dashboard";
  if (pathname.includes("/notificacoes")) return "notificacoes";
  if (pathname.includes("/rotina"))       return "rotina";
  if (pathname.includes("/cardapio"))     return "cardapio";
  if (pathname.includes("/fichas"))       return "fichas";
  if (pathname.includes("/ingredientes")) return "ingredientes";
  if (pathname.includes("/estoque"))      return "estoque";
  if (pathname.includes("/fornecedores")) return "fornecedores";
  if (pathname.includes("/eventos"))      return "eventos";
  if (pathname.includes("/dre"))          return "dre";
  if (pathname.includes("/fluxo"))        return "fluxo";
  if (pathname.includes("/cmv"))          return "cmv";
  if (pathname.includes("/margem"))       return "margem";
  if (pathname.includes("/documentos"))   return "documentos";
  if (pathname.includes("/gestao"))       return "gestao_rh";
  if (pathname.includes("/ponto"))        return "ponto";
  if (pathname.includes("/colaborador"))  return "colaborador";
  if (pathname.includes("/crm"))          return "crm";
  if (pathname.includes("/campanhas"))    return "campanhas";
  if (pathname.includes("/nps"))          return "nps";
  if (pathname.includes("/heitor"))       return "heitor";
  return "dashboard";
}

// ═══════════════════════════════════════════════════════════════
// SIDEBAR DO LAYOUT
// ═══════════════════════════════════════════════════════════════
function LayoutSidebar({ sessao, navId, onSair }) {
  const [exp, setExp] = useState(false);
  const router = useRouter();
  const papel = sessao ? getPapel(sessao.papel) : null;

  return (
    <aside
      onMouseEnter={() => setExp(true)}
      onMouseLeave={() => setExp(false)}
      style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        width: exp ? 260 : 64,
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
        {MENU_GROUPS.map((group) => (
          <div key={group.id} style={{ marginBottom: 8 }}>
            <div style={{
              height: 20, display: 'flex', alignItems: 'center',
              padding: '0 18px', overflow: 'hidden',
              opacity: exp ? 1 : 0, transition: 'opacity 160ms',
            }}>
              <p style={{ color: 'var(--elevated)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {group.label}
              </p>
            </div>
            {group.items.map((item) => {
              const active = navId === item.id;
              const NavIcon = item.Icon;
              return (
                <button key={item.id}
                  onClick={() => router.push(item.href)}
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
                    <NavIcon />
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
                    opacity: exp ? 1 : 0, transition: 'opacity 160ms',
                    flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Rodapé */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 0 12px' }}>
        <button
          onClick={() => router.push("/dashboard")}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            gap: 12, padding: exp ? '8px 14px' : '8px 0',
            justifyContent: exp ? 'flex-start' : 'center',
            color: 'var(--subtle)', background: 'transparent', border: 'none', cursor: 'pointer',
          }}
          onMouseOver={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.color='var(--fg-soft)'; }}
          onMouseOut={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--subtle)'; }}>
          <div style={{ width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Ic.User />
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
          }}
          onMouseOver={e=>{ e.currentTarget.style.background='rgba(239,68,68,0.08)'; e.currentTarget.style.color='#F87171'; }}
          onMouseOut={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--subtle)'; }}>
          <div style={{ width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Ic.LogOut />
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
// LAYOUT PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function DashboardLayout({ children }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [sessao, setSessao] = useState(null);

  useEffect(() => {
    const s = lerSessao();
    if (!s) { router.replace("/login"); return; }
    setSessao(s);
  }, [router]);

  const navId = pathname?.split("/")[2] || "dashboard";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0F172A" }}>
      <LayoutSidebar sessao={sessao} navId={navId} onSair={() => { router.replace("/login"); }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", marginLeft: 64, minHeight: "100vh" }}>
        {children}
      </div>
    </div>
  );
}