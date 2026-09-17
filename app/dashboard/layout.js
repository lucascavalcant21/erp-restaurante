"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { lerSessao, encerrarSessao } from "../lib/auth";
import { canAccessRoute, permittedRoutes } from "../lib/permissions-catalog.mjs";
import { getBottomNavPreset } from "../lib/navigation-registry.mjs";
import { addRecentRoute } from "../lib/user-preferences.js";
import { useERP } from "../context/ERPContext";
import HefistoAssistant from "../components/HefistoAssistant";
import BuscaAutoScroll from "../components/BuscaAutoScroll";
import SinoCadastros from "../components/SinoCadastros";
import HefistoButton from "../components/navigation/HefistoButton";
import CommandCenterModal from "../components/navigation/CommandCenterModal";
import AllModulesCatalog from "../components/navigation/AllModulesCatalog";
import { isFeatureEnabled } from "../lib/feature-flags";
import {
  Users, BarChart, Store, Settings, LogOut, ChevronDown, Check,
  UtensilsCrossed, Package, Wallet, Menu, X, Truck, ChefHat, GlassWater,
  Home, ClipboardList, UserRound, ShoppingCart, Bell, SlidersHorizontal, Briefcase,
  Loader2, CheckCircle2, AlertTriangle, Tag, WifiOff
} from "lucide-react";

// ESTRUTURA UNIFICADA DA SIDEBAR (6 MÓDULOS PRINCIPAIS)
const SIDEBAR_MENU = [
  {
    category: "Início",
    home: "/dashboard",
    icon: BarChart,
    items: [
      { label: "Painel Geral", href: "/dashboard" },
      { label: "Central Operacional", href: "/dashboard/operacao/inteligente" }
    ]
  },
  {
    category: "Operação",
    home: "/dashboard/operacao/fichas?dept=cozinha",
    icon: ChefHat,
    items: [
      { label: "Fichas Técnicas (Cozinha)", href: "/dashboard/operacao/fichas?dept=cozinha" },
      { label: "Fichas de Drinks (Bar)", href: "/dashboard/operacao/fichas?dept=bar" },
      { label: "Guia de Montagem", href: "/dashboard/operacao/montagem?dept=cozinha" },
      { label: "Ingredientes & Produtos", href: "/dashboard/operacao/ingredientes?dept=cozinha" },
      { label: "Produção do Dia", href: "/dashboard/operacao/producao?dept=cozinha" },
      { label: "Impressão de Etiquetas", href: "/dashboard/operacao/etiquetas" },
      { label: "Mesas & Pagamentos", href: "/dashboard/salao/mesas" },
      { label: "KDS da Cozinha", href: "/dashboard/cozinha/kds" },
      { label: "Checklists & Rotinas", href: "/dashboard/checklists" },
      { label: "Treinamentos & Trilhas", href: "/dashboard/treinamentos" },
      { label: "Controles de Limpeza", href: "/dashboard/operacao/controles" },
      { label: "Orçamento de Eventos", href: "/dashboard/operacao/orcamento?dept=cozinha" }
    ]
  },
  {
    category: "Estoque & Compras",
    home: "/dashboard/operacao/estoque",
    icon: Package,
    items: [
      { label: "Visão Geral do Estoque", href: "/dashboard/operacao/estoque" },
      // A tela de 10 campos, em linguagem de cozinha. Estava sem link nenhum:
      // so se chegava nela digitando a URL.
      { label: "Estoque — modo operação", href: "/dashboard/operacao/estoque/tablet" },
      { label: "Impressão de Etiquetas", href: "/dashboard/operacao/etiquetas" },
      { label: "Pedidos de Compras", href: "/dashboard/operacao/compras?dept=cozinha" },
      { label: "Entrada de Notas Fiscais", href: "/dashboard/operacao/notas?dept=cozinha" },
      { label: "Gestão de Embalagens", href: "/dashboard/operacao/embalagens?dept=cozinha" },
      { label: "Produtos de Limpeza", href: "/dashboard/operacao/limpeza" }
    ]
  },
  {
    category: "RH & Pessoas",
    home: "/dashboard/rh",
    icon: Users,
    items: [
      { label: "Painel de RH", href: "/dashboard/rh" },
      { label: "Registro de Ponto", href: "/dashboard/rh/ponto" },
      { label: "Corrigir Batida", href: "/dashboard/rh/ponto/corrigir" },
      { label: "Quiosque de Ponto", href: "/dashboard/ponto" },
      { label: "Extras & Banco de Horas", href: "/dashboard/rh/extra" },
      { label: "Ponto Facial", href: "/dashboard/rh/facial" },
      { label: "Recrutamento & Vagas", href: "/dashboard/rh/recrutamento" },
      { label: "Folha de Pagamento", href: "/dashboard/rh/fechamento" },
      { label: "Semana do Restaurante", href: "/dashboard/rh/semana" },
      { label: "Organograma", href: "/dashboard/rh/organograma" },
      { label: "Atas de Reunião", href: "/dashboard/rh/atas" },
      { label: "Compras do Mês", href: "/dashboard/rh/gastos-admin" }
    ]
  },
  {
    category: "Financeiro & Fiscal",
    home: "/dashboard/financeiro",
    icon: Wallet,
    items: [
      { label: "Fluxo de Caixa", href: "/dashboard/financeiro" },
      { label: "Resultado (DRE)", href: "/dashboard/financeiro/dre" },
      { label: "Análise de CMV", href: "/dashboard/financeiro/cmv" },
      { label: "Pizza do Lucro", href: "/dashboard/financeiro/pizza" },
      { label: "Dados Fiscais", href: "/dashboard/gestao/fiscal" }
    ]
  },
  {
    category: "Gestão & Ajustes",
    home: "/dashboard/gestao/inventario",
    icon: Store,
    items: [
      { label: "Inventário Físico", href: "/dashboard/gestao/inventario" },
      { label: "Manutenção", href: "/dashboard/gestao/manutencao" },
      { label: "Relatórios", href: "/dashboard/relatorios" },
      { label: "Clientes (CRM)", href: "/dashboard/clientes" },
      { label: "Configurações", href: "/dashboard/configuracoes" },
      { label: "Usuários e Acessos", href: "/dashboard/configuracoes/usuarios" },
      { label: "Perfis de Acesso", href: "/dashboard/configuracoes/perfis" }
    ]
  }
];

const baseDaRota = (href = "") => href.split("?")[0];

const ATALHOS_POR_PAPEL = {
  admin: [
    { label: "Início", href: "/dashboard", icon: Home },
    { label: "Cozinha", href: "/dashboard/operacao/fichas?dept=cozinha", icon: ChefHat },
    { label: "Bar", href: "/dashboard/operacao/fichas?dept=bar", icon: GlassWater },
    { label: "RH", href: "/dashboard/rh", icon: Users },
  ],
  gerente: [
    { label: "Início", href: "/dashboard", icon: Home },
    { label: "Cozinha", href: "/dashboard/operacao/fichas?dept=cozinha", icon: ChefHat },
    { label: "Bar", href: "/dashboard/operacao/fichas?dept=bar", icon: GlassWater },
    { label: "RH", href: "/dashboard/rh", icon: Users },
  ],
  financeiro: [
    { label: "Financeiro", href: "/dashboard/financeiro", icon: Wallet },
    { label: "DRE", href: "/dashboard/financeiro/dre", icon: BarChart },
    { label: "Fluxo", href: "/dashboard/financeiro/fluxo", icon: ClipboardList },
    { label: "Fiscal", href: "/dashboard/gestao/fiscal", icon: Store },
  ],
  rh: [
    { label: "RH", href: "/dashboard/rh", icon: Users },
    { label: "Extras", href: "/dashboard/rh/extra", icon: UserRound },
    { label: "Ponto", href: "/dashboard/rh/ponto", icon: Check },
    { label: "Vagas", href: "/dashboard/rh/recrutamento", icon: ClipboardList },
  ],
  estoque: [
    { label: "Tarefas", href: "/dashboard/tarefas", icon: ClipboardList },
    { label: "Estoque", href: "/dashboard/operacao/estoque", icon: Package },
    { label: "Etiquetas", href: "/dashboard/operacao/etiquetas", icon: Check },
    { label: "Compras", href: "/dashboard/operacao/compras?dept=cozinha", icon: ShoppingCart },
  ],
  cozinha: [
    { label: "Tarefas", href: "/dashboard/tarefas", icon: ClipboardList },
    { label: "Receitas", href: "/dashboard/operacao/fichas?dept=cozinha", icon: ChefHat },
    { label: "Produção", href: "/dashboard/operacao/producao?dept=cozinha", icon: Package },
    { label: "Etiquetas", href: "/dashboard/operacao/etiquetas", icon: Check },
  ],
  marketing: [
    { label: "Clientes", href: "/dashboard/clientes/crm", icon: Users },
    { label: "Campanhas", href: "/dashboard/clientes/campanhas", icon: Bell },
    { label: "NPS", href: "/dashboard/clientes/nps", icon: BarChart },
    { label: "Início", href: "/dashboard", icon: Home },
  ],
  caixa: [
    { label: "Vendas", href: "/dashboard/vendas", icon: ShoppingCart },
    { label: "Mesas", href: "/dashboard/mesas", icon: Users },
    { label: "Tarefas", href: "/dashboard/tarefas", icon: ClipboardList },
    { label: "Alertas", href: "/dashboard/notificacoes", icon: Bell },
  ],
  garcom: [
    { label: "Mesas", href: "/dashboard/mesas", icon: Users },
  ],
};

const rotuloPapel = (papel) => ({
  admin: "Administrador", gerente: "Gerente", financeiro: "Financeiro",
  rh: "Recursos Humanos", estoque: "Estoque", cozinha: "Cozinha",
  marketing: "Marketing", caixa: "Caixa", garcom: "Atendimento",
  supervisor: "Supervisor", funcionario: "Funcionário", personalizado: "Personalizado",
  setor: "Usuário de setor", consulta: "Somente consulta", terminal_ponto: "Terminal de ponto",
}[papel] || "Usuário");

function moduloDaRota(pathname, dept) {
  const setor = String(dept || "").toLowerCase();
  const categoriaSetor = { salao: "Salão", cozinha: "Cozinha", bar: "Bar" }[setor];
  if (categoriaSetor) {
    const modulo = SIDEBAR_MENU.find((sec) => sec.category === categoriaSetor);
    if (modulo?.items.some((item) => correspondeRota(pathname, baseDaRota(item.href)))) return modulo;
  }

  const moduloHome = SIDEBAR_MENU.find((sec) => sec.home && pathname === baseDaRota(sec.home));
  if (moduloHome) return moduloHome;

  const candidatos = SIDEBAR_MENU.flatMap((sec, sectionIndex) =>
    sec.items.map((item) => ({ sec, item, sectionIndex, rota: baseDaRota(item.href) }))
  )
    .filter(({ rota }) => correspondeRota(pathname, rota))
    .sort((a, b) => b.rota.length - a.rota.length);

  return candidatos[0]?.sec || SIDEBAR_MENU[0];
}

// Rotas liberadas em cada área travada (estação Cozinha/Bar/Salão).
const ROTAS_AREA = {
  cozinha: ["/dashboard/modulo/cozinha", "/dashboard/area", "/dashboard/checklists", "/dashboard/treinamentos", "/dashboard/operacao/rotina", "/dashboard/operacao/producao", "/dashboard/operacao/etiquetas", "/dashboard/operacao/validade", "/dashboard/operacao/controles", "/dashboard/operacao/ingredientes", "/dashboard/operacao/fornecedores", "/dashboard/operacao/estoque", "/dashboard/operacao/compras", "/dashboard/operacao/notas", "/dashboard/operacao/fichas", "/dashboard/operacao/montagem", "/dashboard/operacao/produtos", "/dashboard/operacao/orcamento", "/dashboard/salao/treinamento"],
  bar: ["/dashboard/modulo/bar", "/dashboard/area", "/dashboard/checklists", "/dashboard/treinamentos", "/dashboard/operacao/rotina", "/dashboard/operacao/producao", "/dashboard/operacao/etiquetas", "/dashboard/operacao/ingredientes", "/dashboard/operacao/estoque", "/dashboard/operacao/compras", "/dashboard/operacao/notas", "/dashboard/operacao/drinks", "/dashboard/operacao/fichas", "/dashboard/operacao/montagem", "/dashboard/operacao/orcamento", "/dashboard/salao/treinamento"],
  salao: ["/dashboard/modulo/salao", "/dashboard/area", "/dashboard/checklists", "/dashboard/treinamentos", "/dashboard/mesas", "/dashboard/tarefas", "/dashboard/operacao/rotina", "/dashboard/salao/treinamento", "/dashboard/operacao/observacoes"],
};

// Nestas telas o setor é definido por ?dept=. Uma estação travada nunca pode
// trocar silenciosamente de Cozinha para Bar/Salão apenas alterando a URL.
const ROTAS_SETORIZADAS = [
  "/dashboard/area",
  "/dashboard/checklists",
  "/dashboard/operacao/rotina",
  "/dashboard/checklists/gerenciar",
  "/dashboard/operacao/producao",
  "/dashboard/operacao/etiquetas",
  "/dashboard/operacao/ingredientes",
  "/dashboard/operacao/estoque",
  "/dashboard/operacao/compras",
  "/dashboard/operacao/notas",
  "/dashboard/operacao/fichas",
  "/dashboard/operacao/montagem",
  "/dashboard/operacao/orcamento",
  "/dashboard/salao/treinamento",
];

const rotaEstoqueRapido = pathname => pathname === "/dashboard/operacao/estoque/tablet";

const correspondeRota = (pathname, rota) => {
  if (rota === "/dashboard/checklists") return pathname === rota;
  return pathname === rota || pathname.startsWith(`${rota}/`);
};

function ajustarHrefParaAreaTravada(href) {
  if (typeof window === "undefined") return href;
  try {
    const areaTravada = localStorage.getItem("hefisto_modo_area");
    if (!areaTravada || !ROTAS_AREA[areaTravada]) return href;

    const url = new URL(href, window.location.origin);
    if (!ROTAS_SETORIZADAS.some(rota => correspondeRota(url.pathname, rota))) return href;
    url.searchParams.set("dept", areaTravada);
    return `${url.pathname}${url.search}`;
  } catch (_) {
    return href;
  }
}

// Observa também mudanças que alteram somente a consulta da URL. O pathname
// não muda entre ?dept=cozinha e ?dept=bar, por isso esta proteção é separada.
function ProtecaoSetorDaArea({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const consulta = searchParams.toString();
  const deptAtual = searchParams.get("dept");
  const [areaTravada, setAreaTravada] = useState(undefined);
  const areaValida = areaTravada && ROTAS_AREA[areaTravada] ? areaTravada : "";
  const rotaPermitida = !areaValida || ROTAS_AREA[areaValida].some(rota => correspondeRota(pathname, rota));
  const rotaSetorizada = !rotaEstoqueRapido(pathname) && ROTAS_SETORIZADAS.some(rota => correspondeRota(pathname, rota));
  const setorCorreto = !areaValida || !rotaSetorizada || deptAtual === areaValida;

  useEffect(() => {
    const atualizarArea = (evento) => {
      const area = evento?.detail?.area;
      setAreaTravada(area && ROTAS_AREA[area] ? area : "");
    };
    window.addEventListener("hefisto:area-mudou", atualizarArea);
    return () => window.removeEventListener("hefisto:area-mudou", atualizarArea);
  }, []);

  useEffect(() => {
    try {
      const area = localStorage.getItem("hefisto_modo_area");
      const areaAtiva = area && ROTAS_AREA[area] ? area : "";
      setAreaTravada(areaAtiva);
      if (!areaAtiva) return;

      const permitido = ROTAS_AREA[areaAtiva].some(rota => correspondeRota(pathname, rota));
      if (!permitido) {
        router.replace(`/dashboard/area?dept=${areaAtiva}`);
        return;
      }
      if (rotaEstoqueRapido(pathname) || !ROTAS_SETORIZADAS.some(rota => correspondeRota(pathname, rota)) || deptAtual === areaAtiva) return;

      const params = new URLSearchParams(consulta);
      params.set("dept", areaAtiva);
      router.replace(`${pathname}?${params.toString()}`);
    } catch (_) {}
  }, [consulta, deptAtual, pathname, router]);

  if (areaTravada === undefined || !rotaPermitida || !setorCorreto) {
    return <div className="min-h-[40vh] flex items-center justify-center px-4 text-sm font-bold text-muted">Carregando área correta...</div>;
  }
  return children;
}

function ProtecaoPermissao({ sessao, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const permitido = !sessao?.gerenciado || canAccessRoute(sessao, pathname, search);

  useEffect(() => {
    if (!sessao?.gerenciado || permitido) return;
    const fallback = permittedRoutes(sessao)?.[0] || "/login";
    const configured = sessao.home || sessao.pagina_inicial;
    const [configuredPath, configuredQuery = ""] = String(configured || "").split("?");
    router.replace(configured && canAccessRoute(sessao, configuredPath, configuredQuery) ? configured : fallback);
  }, [permitido, pathname, router, search, sessao]);

  if (!sessao || !permitido) {
    return <div className="min-h-[40vh] flex items-center justify-center px-4 text-sm font-bold text-muted">Verificando acesso...</div>;
  }
  return children;
}

function SidebarSection({ section, idx, isExpanded, onToggle, pathname, dept, setMobileOpen, router }) {
  const Icon = section.icon;
  const isSingleItem = section.items.length === 1;

  const hasActiveItem = section.items.some(item => {
    const [base, queryStr] = item.href.split("?");
    const itemDept = new URLSearchParams(queryStr || "").get("dept");
    const pathMatch = pathname === base || (base !== "/dashboard" && pathname.startsWith(base + "/"));
    if (!pathMatch) return false;
    if (itemDept) return dept === itemDept;
    return true;
  });

  return (
    <div className="animate-in fade-in slide-in-from-left-2" style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'both' }}>
      <button
        type="button"
        onClick={() => {
          if (isSingleItem) {
            setMobileOpen(false);
            router.push(ajustarHrefParaAreaTravada(section.items[0].href));
          } else {
            onToggle();
          }
        }}
        className={`w-full min-h-10 px-3 py-2 text-xs font-bold flex items-center justify-between rounded-xl transition-all group outline-none text-left ${
          hasActiveItem
            ? "bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/20"
            : "text-subtle hover:text-white hover:bg-slate-800/60"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon size={17} className={`transition-colors shrink-0 ${hasActiveItem ? "text-emerald-400" : "text-muted group-hover:text-dim"}`} />
          <span className="truncate tracking-tight">{section.category}</span>
        </div>
        {!isSingleItem && (
          <ChevronDown
            size={15}
            className={`text-muted transition-transform duration-200 shrink-0 ${isExpanded ? "rotate-180 text-emerald-400" : ""}`}
          />
        )}
      </button>

      {!isSingleItem && isExpanded && (
        <div className="mt-1 ml-3 pl-3 border-l border-slate-800/80 space-y-0.5 overflow-hidden transition-all">
          {section.items.map((item, itemIdx) => {
            const [base, queryStr] = item.href.split("?");
            const itemDept = new URLSearchParams(queryStr || "").get("dept");
            const isItemActive = (pathname === base || (base !== "/dashboard" && pathname.startsWith(base + "/"))) &&
              (!itemDept || dept === itemDept);

            return (
              <button
                key={itemIdx}
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  router.push(ajustarHrefParaAreaTravada(item.href));
                }}
                className={`w-full min-h-8 px-2.5 py-1.5 text-xs font-medium flex items-center gap-2 rounded-lg transition-colors text-left truncate ${
                  isItemActive
                    ? "bg-emerald-500/20 text-emerald-300 font-bold"
                    : "text-subtle hover:text-slate-200 hover:bg-slate-800/40"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isItemActive ? "bg-emerald-400 shadow-sm shadow-emerald-400" : "bg-slate-600"}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Sidebar({ mobileOpen, setMobileOpen, collapsed, rotasPermitidas, sessao, onSair }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const dept = searchParams.get("dept");

  const [expandedSections, setExpandedSections] = useState({});

  const menu = Array.isArray(rotasPermitidas)
    ? SIDEBAR_MENU.map((sec) => ({
        ...sec,
        items: sec.items.filter((it) => {
          const base = it.href.split("?")[0];
          return rotasPermitidas.some((r) => base === r.split("?")[0] || base.startsWith(r.split("?")[0] + "/"));
        }),
      })).filter((sec) => sec.items.length > 0)
    : SIDEBAR_MENU;

  useEffect(() => {
    const activeSec = menu.find(sec =>
      sec.items.some(item => {
        const base = item.href.split("?")[0];
        return pathname === base || (base !== "/dashboard" && pathname.startsWith(base + "/"));
      })
    );
    if (activeSec) {
      setExpandedSections(prev => ({ ...prev, [activeSec.category]: true }));
    }
  }, [pathname, menu]);

  const toggleSection = (cat) => {
    setExpandedSections(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  return (
    <>
      {mobileOpen && (
        <button type="button" aria-label="Fechar menu"
          className="fixed inset-0 bg-slate-900/80 z-40 backdrop-blur-sm xl:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`
        erp-sidebar fixed inset-y-0 left-0 z-50 bg-[#0A1128] border-r border-slate-800/50
        flex flex-col transition-all duration-300 ease-in-out shadow-2xl whitespace-nowrap overflow-hidden
        xl:static xl:z-auto xl:shadow-none
        ${mobileOpen ? "translate-x-0 w-[min(17rem,calc(100vw-2rem))]" : "-translate-x-full w-[min(17rem,calc(100vw-2rem))]"}` +
        `${collapsed ? " xl:translate-x-0 xl:w-0 xl:border-r-0" : " xl:translate-x-0 xl:w-[230px]"}`} aria-label="Menu principal">
        {/* Logo Area */}
        <div className="erp-sidebar-logo min-h-14 flex items-center justify-between px-3 sm:px-4 shrink-0 relative overflow-hidden border-b border-slate-800/50">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-transparent pointer-events-none" />
          
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2.5 relative z-10 hover:opacity-80 transition-opacity text-left">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <UtensilsCrossed size={14} className="text-white" />
            </div>
            <span className="text-lg font-black text-white tracking-tight">Hefisto</span>
          </button>
          
          <button onClick={() => setMobileOpen(false)} aria-label="Fechar menu" className="w-11 h-11 flex items-center justify-center text-subtle hover:text-white relative z-10 rounded-xl xl:hidden">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Menu */}
        <div className="erp-sidebar-scroll flex-1 overflow-y-auto overscroll-contain custom-scrollbar px-2.5 sm:px-3 py-3 space-y-1.5">
          {menu.map((section, idx) => (
            <SidebarSection
              key={idx}
              section={section}
              idx={idx}
              isExpanded={!!expandedSections[section.category]}
              onToggle={() => toggleSection(section.category)}
              pathname={pathname}
              dept={dept}
              setMobileOpen={setMobileOpen}
              router={router}
            />
          ))}
        </div>
        
        {/* User Profile Footer */}
        <div className="erp-sidebar-footer p-2.5 sm:p-3 border-t border-slate-800/50 shrink-0">
          <div className="bg-slate-800/40 rounded-xl p-2.5 flex items-center gap-2.5 border border-slate-700/40 group">
             <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white text-xs font-bold shadow-inner group-hover:scale-105 transition-transform">
               {String(sessao?.nome || sessao?.email || "U").trim().charAt(0).toUpperCase()}
             </div>
             <div className="min-w-0">
                <p className="text-xs font-bold text-slate-100 leading-tight truncate">{sessao?.nome || "Usuário"}</p>
                <p className="text-3xs font-semibold text-emerald-400 uppercase tracking-wider truncate">{rotuloPapel(sessao?.papel)}</p>
             </div>
          </div>
          <button type="button" onClick={onSair} className="mt-2 flex min-h-9 w-full items-center justify-center gap-2 rounded-xl bg-rose-500/10 px-3 text-xs font-bold uppercase tracking-wider text-rose-300 transition-colors hover:bg-rose-500/20 hover:text-white">
            <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>
    </>
  );
}

function TopHeader({ onToggleSidebar, onOpenCommandCenter }) {
  const { unidadeInfo } = useERP();

  return (
    <header className="erp-top-header min-h-16 border-b border-slate-200/60 bg-white/80 backdrop-blur-md flex items-center justify-between gap-2 px-2 sm:px-4 md:px-6 py-2 shrink-0 sticky top-0 z-30 shadow-sm min-w-0">
      <div className="flex flex-1 items-center justify-between gap-2 md:gap-4 min-w-0">
         <div className="flex items-center gap-2 md:gap-4 shrink-0">
           <button onClick={onToggleSidebar} title="Menu" aria-label="Abrir menu" className="w-11 h-11 flex items-center justify-center text-muted hover:text-slate-800 hover:bg-elevated rounded-xl transition-colors shrink-0">
              <Menu size={22} />
           </button>
           <h1 className="text-base lg:text-lg font-black text-slate-800 hidden md:block tracking-tight truncate min-w-0">
              {unidadeInfo?.nome ? `Dashboard · ${unidadeInfo.nome}` : "Painel de Controle"}
           </h1>
         </div>

         {/* Botão de Busca Universal ✦ Héfisto */}
         <div className="flex-1 flex justify-end sm:justify-center max-w-lg mx-2">
            <HefistoButton onClick={onOpenCommandCenter} />
         </div>
      </div>
    </header>
  );
}

function ModuleBar() {
  return null;
}

function MobileBottomNav({ sessao, onMenu }) {
  const pathname = usePathname();
  const router = useRouter();

  // Se NAVIGATION_V2 estiver ativo, utiliza o preset previsível de 5 posições
  if (isFeatureEnabled("NAVIGATION_V2")) {
    const items = getBottomNavPreset(sessao);
    const ICON_MAP = {
      Home, ChefHat, Tag, Package, Users, Wallet, Calendar, BarChart,
      Settings, ClipboardList, GlassWater, Clock, Grid, Menu, Check, UserCheck, ShieldCheck, Box
    };

    return (
      <nav aria-label="Navegação principal"
        className="erp-mobile-nav print:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur-xl md:hidden">
        <div className="grid min-h-[64px] items-stretch grid-cols-5">
          {items.map((item) => {
            const IconComponent = ICON_MAP[item.icon] || Package;
            const base = item.route ? baseDaRota(item.route) : "";

            let ativo = false;
            if (item.isHome) {
              ativo = pathname === "/dashboard";
            } else if (item.isMenu) {
              ativo = false;
            } else if (base) {
              ativo = pathname === base || (base !== "/dashboard" && pathname.startsWith(`${base}/`));
            }

            const handleClick = () => {
              if (item.isMenu) {
                onMenu();
              } else {
                router.push(ajustarHrefParaAreaTravada(item.route));
              }
            };

            return (
              <button
                key={item.id}
                type="button"
                onClick={handleClick}
                aria-current={ativo ? "page" : undefined}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-3xs font-bold transition-all min-h-[44px] ${
                  ativo ? "text-emerald-600 font-extrabold" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <span className={`flex h-8 w-10 items-center justify-center rounded-xl transition-all ${
                  ativo ? "bg-emerald-100 text-emerald-700 shadow-sm" : "bg-transparent"
                }`}>
                  <IconComponent size={19} />
                </span>
                <span className="w-full truncate text-center px-0.5">{item.shortTitle}</span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  // Fallback para menu legado caso NAVIGATION_V2 esteja inativo
  const candidatos = ATALHOS_POR_PAPEL[sessao?.papel] || ATALHOS_POR_PAPEL.admin;
  const atalhos = sessao?.gerenciado
    ? candidatos.filter((item) => {
        const [path, query = ""] = item.href.split("?");
        return canAccessRoute(sessao, path, query);
      })
    : candidatos;
  const visiveis = atalhos.slice(0, 4);

  return (
    <nav aria-label="Atalhos do meu perfil"
      className="erp-mobile-nav print:hidden fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur-xl md:hidden">
      <div className="grid min-h-[62px] items-stretch" style={{ gridTemplateColumns: `repeat(${visiveis.length + 1}, minmax(0, 1fr))` }}>
        {visiveis.map((item) => {
          const Icon = item.icon;
          const base = baseDaRota(item.href);
          const ativo = pathname === base || (base !== "/dashboard" && pathname.startsWith(`${base}/`));
          return (
            <button key={item.href} type="button" onClick={() => router.push(ajustarHrefParaAreaTravada(item.href))}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-3xs font-bold transition-colors ${ativo ? "text-accent" : "text-subtle"}`}>
              <span className={`flex h-8 w-10 items-center justify-center rounded-xl ${ativo ? "bg-emerald-100" : "bg-transparent"}`}><Icon size={18} /></span>
              <span className="w-full truncate">{item.label}</span>
            </button>
          );
        })}
        <button type="button" onClick={onMenu}
          className="flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-3xs font-bold text-subtle">
          <span className="flex h-8 w-10 items-center justify-center rounded-xl"><Menu size={19} /></span>
          <span>Menu</span>
        </button>
      </div>
    </nav>
  );
}

function SyncFeedback() {
  const [estado, setEstado] = useState({ tipo: "oculto", texto: "" });
  const timerRef = useRef(null);

  useEffect(() => {
    const mostrar = (tipo, texto, duracao = 2400) => {
      clearTimeout(timerRef.current);
      setEstado({ tipo, texto });
      if (duracao) timerRef.current = setTimeout(() => setEstado({ tipo: "oculto", texto: "" }), duracao);
    };

    const aoFeedback = (evento) => {
      const detalhe = evento?.detail || {};
      mostrar(detalhe.tipo || "ok", detalhe.texto || detalhe.mensagem || "Alteração concluída", detalhe.duracao ?? 2400);
    };
    const offline = () => mostrar("offline", "Sem internet · alterações podem não sincronizar", 0);
    const online = () => mostrar("ok", "Conexão restabelecida", 2200);
    window.addEventListener("erp:feedback", aoFeedback);
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    if (!navigator.onLine) offline();

    const fetchOriginal = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const input = args[0];
      const opcoes = args[1] || {};
      const metodo = String(opcoes.method || input?.method || "GET").toUpperCase();
      const url = String(typeof input === "string" ? input : input?.url || "");
      const mutacao = ["POST", "PUT", "PATCH", "DELETE"].includes(metodo) && (url.includes("supabase") || url.includes("/api/"));
      if (mutacao) mostrar("salvando", "Salvando alterações...", 0);
      try {
        const resposta = await fetchOriginal(...args);
        if (mutacao) mostrar(resposta.ok ? "ok" : "erro", resposta.ok ? "Alterações salvas" : "Não foi possível salvar", resposta.ok ? 1800 : 4200);
        return resposta;
      } catch (erro) {
        if (mutacao) mostrar("erro", "Falha de conexão ao salvar", 4200);
        throw erro;
      }
    };

    window.erpFeedback = (texto, tipo = "ok") => mostrar(tipo, texto);
    return () => {
      clearTimeout(timerRef.current);
      window.fetch = fetchOriginal;
      delete window.erpFeedback;
      window.removeEventListener("erp:feedback", aoFeedback);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);

  if (estado.tipo === "oculto") return null;
  const Icone = estado.tipo === "salvando" ? Loader2 : estado.tipo === "ok" ? CheckCircle2 : estado.tipo === "offline" ? WifiOff : AlertTriangle;
  return (
    <div className={`erp-sync-feedback ${estado.tipo}`} role="status" aria-live="polite">
      <Icone size={16} className={estado.tipo === "salvando" ? "animate-spin" : ""} />
      <span>{estado.texto}</span>
    </div>
  );
}

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sessao, setSessao] = useState(null);
  const sessaoRef = useRef(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Estados da Nova Navegação (Fase B)
  const [commandCenterOpen, setCommandCenterOpen] = useState(false);
  const [allModulesOpen, setAllModulesOpen] = useState(false);

  // Recolher a sidebar no desktop (lembra a preferência entre sessões)
  const [collapsed, setCollapsed] = useState(false);
  const [compacto, setCompacto] = useState(false);
  const interfaceTelaCheia = pathname === "/dashboard/operacao/estoque/tablet"
    || pathname === "/dashboard/operacao/etiquetas/tablet";

  // Atalho global CTRL + K para abrir/fechar o Command Center
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandCenterOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("erp_sidebar_collapsed") === "1");
      setCompacto(localStorage.getItem("erp_densidade") === "compacta");
    } catch (_) {}
  }, []);

  useEffect(() => {
    let vivo = true;
    // Modo Ponto (tablet travado): enquanto ativo, qualquer rota volta para o
    // relógio — mesmo fechando e reabrindo o app. Só sai com o PIN do gerente.
    try {
      if (localStorage.getItem("hefisto_modo_ponto") === "1" && !pathname.startsWith("/dashboard/rh/ponto")) {
        router.replace("/dashboard/rh/ponto");
        return;
      }
      // Estação de área travada (Cozinha/Bar/Salão): só circula nos submódulos
      // daquela área; qualquer outra rota volta para o quadro da área.
      const areaTravada = localStorage.getItem("hefisto_modo_area");
      if (areaTravada && ROTAS_AREA[areaTravada]) {
        const permitido = ROTAS_AREA[areaTravada].some(r => correspondeRota(pathname, r));
        if (!permitido) {
          router.replace(`/dashboard/area?dept=${areaTravada}`);
          return;
        }
      }
    } catch (_) {}
    lerSessao().then((s) => {
      if (!vivo) return;
      if (s) {
        sessaoRef.current = s; setSessao(s);
        if (s.must_change_password && pathname !== "/nova-senha") {
          router.replace("/nova-senha?obrigatoria=1");
          return;
        }
        // Registra automaticamente a rota atual nos Recentes do Usuário
        addRecentRoute(s, pathname);
        return;
      }
      if (!sessaoRef.current) router.replace("/login");
    });
    // Fecha o menu mobile quando mudar de rota
    setMobileOpen(false);
    return () => { vivo = false; };
  }, [pathname, router]);

  // Hambúrguer: com NAVIGATION_V2 ativo abre o Command Center no tablet/mobile diretamente!
  function toggleSidebar() {
    if (isFeatureEnabled("NAVIGATION_V2")) {
      setCommandCenterOpen(true);
      return;
    }
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches) {
      setCollapsed((c) => {
        const novo = !c;
        try { localStorage.setItem("erp_sidebar_collapsed", novo ? "1" : "0"); } catch (_) {}
        return novo;
      });
    } else {
      setMobileOpen(true);
    }
  }

  function toggleDensidade() {
    setCompacto((atual) => {
      const novo = !atual;
      try { localStorage.setItem("erp_densidade", novo ? "compacta" : "confortavel"); } catch (_) {}
      return novo;
    });
  }

  async function sair() {
    sessaoRef.current = null;
    // Sair de propósito também esquece o login lembrado (senão o auto-login
    // reconectaria na hora). O "lembrar" vale para quedas de sessão, não para
    // quando a pessoa escolhe sair.
    try {
      localStorage.removeItem("hefisto_acesso");
      localStorage.removeItem("erp_cred");
      localStorage.setItem("erp_lembrar", "0");
    } catch (_) {}
    await encerrarSessao();
    router.replace("/login");
  }

  const rotasPermitidas = sessao?.gerenciado ? permittedRoutes(sessao) : null;
  const acessoRestrito = Array.isArray(rotasPermitidas);

  if (interfaceTelaCheia) {
    return (
      // Sem a barra do app em cima, o cabeçalho da tela cheia encostava na
      // barra de status do celular e o "voltar" ficava alto demais.
      <div className="fixed inset-0 z-[200] overflow-hidden bg-slate-50"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <Suspense fallback={<div className="grid h-screen place-items-center"><Loader2 className="animate-spin text-indigo-600" /></div>}>
          <ProtecaoPermissao sessao={sessao}>
            <ProtecaoSetorDaArea>{children}</ProtecaoSetorDaArea>
          </ProtecaoPermissao>
        </Suspense>
      </div>
    );
  }

  return (
    <div className={`erp-app-shell ${compacto ? "erp-density-compact" : "erp-density-comfortable"} flex h-screen h-[100dvh] min-h-0 bg-[#F8FAFC] overflow-hidden print:bg-card print:block print:h-auto print:min-h-0`}>
      {/* Sidebar — para acessos restritos, mostra só as telas liberadas */}
      <div className="print:hidden h-full flex shrink-0">
         <Suspense fallback={null}>
           <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} collapsed={collapsed} rotasPermitidas={rotasPermitidas} sessao={sessao} onSair={sair} />
         </Suspense>
      </div>

      {/* Área Principal de Conteúdo */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden print:h-auto print:block print:overflow-visible relative">
        <div className="print:hidden shrink-0">
           <TopHeader
             onSair={sair}
             onToggleSidebar={toggleSidebar}
             onOpenCommandCenter={() => setCommandCenterOpen(true)}
             acessoRestrito={acessoRestrito}
             sessao={sessao}
             compacto={compacto}
             onToggleDensidade={toggleDensidade}
           />
        </div>
        <Suspense fallback={null}>
          <ModuleBar rotasPermitidas={rotasPermitidas} />
        </Suspense>
        
        {/* Main Content Area com Scrollbar customizada */}
        <main className="erp-main-content flex-1 min-w-0 overflow-y-auto overscroll-y-contain custom-scrollbar animate-page-in relative print:overflow-visible print:block">
          <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center px-4 text-sm font-bold text-muted">Carregando...</div>}>
            <ProtecaoPermissao sessao={sessao}>
              <ProtecaoSetorDaArea>{children}</ProtecaoSetorDaArea>
            </ProtecaoPermissao>
          </Suspense>
        </main>
      </div>

      {/* Overlays / Modais da Nova Navegação v2 (Fase B) */}
      <CommandCenterModal
        isOpen={commandCenterOpen}
        onClose={() => setCommandCenterOpen(false)}
        sessao={sessao}
        onOpenAllModules={() => {
          setCommandCenterOpen(false);
          setAllModulesOpen(true);
        }}
      />
      <AllModulesCatalog
        isOpen={allModulesOpen}
        onClose={() => setAllModulesOpen(false)}
        sessao={sessao}
      />

      <SyncFeedback />
      <MobileBottomNav sessao={sessao} onMenu={() => isFeatureEnabled("NAVIGATION_V2") ? setCommandCenterOpen(true) : setMobileOpen(true)} />
      {/* Busca de qualquer tela sobe ao topo ao digitar (resultados à vista) */}
      <BuscaAutoScroll />
      {/* Assistente Hefisto — botão flutuante + painel lateral, em todas as telas */}
      <Suspense fallback={null}>
        <HefistoAssistant />
      </Suspense>
    </div>
  );
}
