
const React = { createElement: () => {} };
const Ic = {
  Dashboard: () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  Cart:      () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  Beer:      () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M17 2h-1v8h2a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/><path d="M5 20c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-8H5v8z"/><path d="M4 6h12a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z"/></svg>,
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
  Settings:  () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>,
  Building2: () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>,
  AlertTriangle: () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
};
const MENU_GROUPS = [
  {
    id: "visao_geral", label: "DASHBOARD E INSIGHTS", scope: "ambos",
    items: [
      { id: "dashboard",    label: "Visão Geral",       Icon: Ic.Dashboard, href: "/dashboard" },
      { id: "notificacoes", label: "Central de Avisos",    Icon: Ic.Bell,      href: "/dashboard/notificacoes" },
    ],
  },
  {
    id: "frente_caixa", label: "VENDAS E PDV", scope: "unidade",
    items: [
      { id: "vendas",     label: "PDV Rápido",  Icon: Ic.Cart,     href: "/dashboard/vendas" },
      { id: "mesas",      label: "Gestão de Mesas",   Icon: Ic.Users,    href: "/dashboard/mesas" },
      { id: "delivery",   label: "Logística Delivery", Icon: Ic.Truck, href: "/dashboard/delivery" },
    ],
  },
  {
    id: "operacao", label: "PRODUÇÃO E ROTINA", scope: "unidade",
    items: [
      { id: "cozinha_kds", label: "KDS Cozinha", Icon: Ic.Bell, href: "/dashboard/cozinha/kds" },
      { id: "cozinha",     label: "Preparos", Icon: Ic.ChefHat,  href: "/dashboard/cozinha/producao" },
      { id: "bar",         label: "KDS Bar",      Icon: Ic.Flask, href: "/dashboard/bar" },
      { id: "cervejas",    label: "Taps e Chopes", Icon: Ic.Beer,     href: "/dashboard/cervejas" },
      { id: "tarefas",     label: "Checklists", Icon: Ic.Checklist, href: "/dashboard/tarefas" },
      { id: "montagem",    label: "Fichas Visuais", Icon: Ic.FileText, href: "/dashboard/operacao/montagem?dept=cozinha" },
      { id: "limpeza",     label: "Auditoria de Limpeza", Icon: Ic.Checklist, href: "/dashboard/operacao/limpeza" },
    ],
  },
  {
    id: "estoque", label: "SUPRIMENTOS E CUSTOS", scope: "cerebro",
    items: [
      { id: "estoque",     label: "Inventário Geral", Icon: Ic.Box, href: "/dashboard/operacao/estoque" },
      { id: "fichas",      label: "Engenharia de Cardápio", Icon: Ic.FileText, href: "/dashboard/operacao/fichas" },
      { id: "auditoria",   label: "Controle de Perdas", Icon: Ic.AlertTriangle, href: "/dashboard/gestao/auditoria" },
    ],
  },
  {
    id: "financeiro", label: "FINANCEIRO", scope: "unidade",
    items: [
      { id: "financeiro", label: "Resultados", Icon: Ic.BarChart, href: "/dashboard/financeiro" },
    ],
  },
  {
    id: "clientes", label: "RELACIONAMENTO", scope: "unidade",
    items: [
      { id: "clientes", label: "CRM", Icon: Ic.UserCheck, href: "/dashboard/clientes" },
      { id: "eventos",  label: "Eventos e Reservas", Icon: Ic.Calendar, href: "/dashboard/eventos" },
    ],
  },
  {
    id: "gestao", label: "ADMINISTRAÇÃO", scope: "ambos",
    items: [
      { id: "gestao", label: "Configurações Globais", Icon: Ic.Settings, href: "/dashboard/gestao" },
      { id: "gestao", label: "Dispositivos", Icon: Ic.Settings, href: "/dashboard/gestao/impressoes" },
      { id: "gestao", label: "Automações", Icon: Ic.Checklist, href: "/dashboard/gestao/tarefas" },
      { id: "rh", label: "Colaboradores", Icon: Ic.Users, href: "/dashboard/rh" },
      { id: "organograma", label: "Estrutura", Icon: Ic.Users, href: "/dashboard/rh/organograma" },
      { id: "configuracoes", label: "Políticas de RH", Icon: Ic.Settings, href: "/dashboard/rh/configuracoes" },
      { id: "rede", label: "Lojas e Unidades", Icon: Ic.Building2, href: "/dashboard/rede/gestao" },
    ],
  },
  {
    id: "ia", label: "INTELIGÊNCIA ARTIFICIAL", scope: "cerebro",
    items: [
      { id: "heitor", label: "Hefisto AI", Icon: Ic.Brain, href: "/dashboard/ia/heitor" },
    ],
  },
];

MENU_GROUPS.forEach(g => {
  g.items.forEach(i => {
    if (typeof i.Icon !== 'function') {
      console.log('ERROR ON', i.label);
    } else {
      console.log('OK', i.label);
    }
  });
});
