"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { lerSessao, encerrarSessao } from "../lib/auth";
import { canAccessRoute, permittedRoutes } from "../lib/permissions-catalog";
import { useERP } from "../context/ERPContext";
import HefistoAssistant from "../components/HefistoAssistant";
import BuscaAutoScroll from "../components/BuscaAutoScroll";
import SinoCadastros from "../components/SinoCadastros";
import {
  Users, BarChart, Store, Settings, LogOut, ChevronDown, Check,
  UtensilsCrossed, Package, Wallet, Menu, X, Truck, ChefHat, GlassWater,
  Home, ClipboardList, UserRound, ShoppingCart, Bell, SlidersHorizontal, Briefcase,
  Loader2, CheckCircle2, AlertTriangle, Tag, WifiOff
} from "lucide-react";

// NOVO MENU SIDEBAR (PDV e KDS REMOVIDOS)
const SIDEBAR_MENU = [
  {
    category: "Início",
    home: "/dashboard",
    icon: BarChart,
    items: [
      { label: "Painel Geral", href: "/dashboard" }
    ]
  },
  {
    category: "Salão",
    home: "/dashboard/modulo/salao",
    icon: Users,
    items: [
      { label: "Checklist do Salão", href: "/dashboard/operacao/rotina?dept=salao" },
      { label: "Treinamentos", href: "/dashboard/salao/treinamento" }
    ]
  },

  {
    category: "Estoque",
    home: "/dashboard/operacao/estoque",
    icon: Package,
    items: [
      { label: "Estoque", href: "/dashboard/operacao/estoque" }
    ]
  },
  {
    category: "Etiquetas",
    home: "/dashboard/operacao/etiquetas",
    icon: Tag,
    items: [
      { label: "Etiquetas", href: "/dashboard/operacao/etiquetas" }
    ]
  },
  {
    category: "Cozinha",
    home: "/dashboard/modulo/cozinha",
    icon: ChefHat,
    items: [
      { label: "Fichas Técnicas", href: "/dashboard/operacao/fichas?dept=cozinha" },
      { label: "Guia de Montagem", href: "/dashboard/operacao/montagem?dept=cozinha" },
      { label: "Ingredientes", href: "/dashboard/operacao/ingredientes?dept=cozinha" },
      { label: "Compras", href: "/dashboard/operacao/compras?dept=cozinha" },
      { label: "Entrada de Notas", href: "/dashboard/operacao/notas?dept=cozinha" },
      { label: "Embalagens", href: "/dashboard/operacao/embalagens?dept=cozinha" },
      { label: "Produção do Dia", href: "/dashboard/operacao/producao?dept=cozinha" },
      { label: "Controles de Limpeza", href: "/dashboard/operacao/controles" },
      { label: "Central Operacional", href: "/dashboard/operacao/inteligente" },
      { label: "Checklist da Cozinha", href: "/dashboard/operacao/rotina?dept=cozinha" },
      { label: "Orçamento de Eventos", href: "/dashboard/operacao/orcamento?dept=cozinha" }
    ]
  },
  {
    category: "Bar",
    home: "/dashboard/modulo/bar",
    icon: GlassWater,
    items: [
      { label: "Fichas de Drinks", href: "/dashboard/operacao/fichas?dept=bar" },
      { label: "Guia de Montagem", href: "/dashboard/operacao/montagem?dept=bar" },
      { label: "Produtos", href: "/dashboard/operacao/ingredientes?dept=bar" },
      { label: "Compras", href: "/dashboard/operacao/compras?dept=bar" },
      { label: "Entrada de Notas", href: "/dashboard/operacao/notas?dept=bar" },
      { label: "Embalagens", href: "/dashboard/operacao/embalagens?dept=bar" },
      { label: "Produção do Dia", href: "/dashboard/operacao/producao?dept=bar" },
      { label: "Checklist do Bar", href: "/dashboard/operacao/rotina?dept=bar" },
      { label: "Orçamento de Eventos", href: "/dashboard/operacao/orcamento?dept=bar" }
    ]
  },
  {
    category: "Financeiro",
    home: "/dashboard/modulo/financeiro",
    icon: Wallet,
    items: [
      { label: "Fluxo de Caixa", href: "/dashboard/financeiro" },
      { label: "Ponto de Equilíbrio", href: "/dashboard/financeiro/equilibrio" },
      { label: "Resultado (DRE)", href: "/dashboard/financeiro/dre" },
      { label: "CMV", href: "/dashboard/financeiro/cmv" },
      { label: "Dados Fiscais", href: "/dashboard/gestao/fiscal" }
    ]
  },
  {
    category: "Extras",
    home: "/dashboard/rh/extra",
    icon: UserRound,
    items: [
      { label: "Cadastro e Recibos", href: "/dashboard/rh/extra" },
      { label: "Banco de extras", href: "/dashboard/rh/extra/banco" },
      { label: "Cadastro facial do ponto", href: "/dashboard/rh/facial" }
    ]
  },
  {
    category: "Portal de Vagas",
    home: "/dashboard/rh/recrutamento",
    icon: Briefcase,
    items: [
      { label: "Candidatos e vagas", href: "/dashboard/rh/recrutamento" },
      { label: "Ver o portal", href: "/vagas" }
    ]
  },
  {
    category: "Equipe & RH",
    home: "/dashboard/modulo/rh",
    icon: Users,
    items: [
      { label: "Painel de RH", href: "/dashboard/rh" },
      { label: "Ponto", href: "/dashboard/rh/ponto" },
      { label: "Portal do Colaborador", href: "/dashboard/rh/colaborador" },
      { label: "Folha de Pagamento", href: "/dashboard/rh/fechamento" },
      { label: "Organograma", href: "/dashboard/rh/organograma" },
      { label: "Atas de Reunião", href: "/dashboard/rh/atas" },
      { label: "Compras do Mês", href: "/dashboard/rh/gastos-admin" }
    ]
  },
  {
    category: "Gestão & Ajustes",
    home: "/dashboard/modulo/gestao",
    icon: Store,
    items: [
      { label: "Inventário", href: "/dashboard/gestao/inventario" },
      { label: "Manutenção", href: "/dashboard/gestao/manutencao" },
      { label: "Relatórios", href: "/dashboard/relatorios" },
      { label: "Configurações", href: "/dashboard/configuracoes" },
      { label: "Usuários e acessos", href: "/dashboard/configuracoes/usuarios" },
      { label: "Perfis de acesso", href: "/dashboard/configuracoes/perfis" }
    ]
  }
];

const baseDaRota = (href = "") => href.split("?")[0];

const ATALHOS_POR_PAPEL = {
  admin: [
    { label: "Início", href: "/dashboard", icon: Home },
    { label: "Cozinha", href: "/dashboard/operacao/fichas?dept=cozinha", icon: ChefHat },
    { label: "Financeiro", href: "/dashboard/financeiro", icon: Wallet },
    { label: "Equipe", href: "/dashboard/rh", icon: Users },
  ],
  gerente: [
    { label: "Início", href: "/dashboard", icon: Home },
    { label: "Tarefas", href: "/dashboard/tarefas", icon: ClipboardList },
    { label: "Operação", href: "/dashboard/operacao/rotina?dept=cozinha", icon: ChefHat },
    { label: "Financeiro", href: "/dashboard/financeiro", icon: Wallet },
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
  cozinha: ["/dashboard/modulo/cozinha", "/dashboard/area", "/dashboard/checklists", "/dashboard/operacao/rotina", "/dashboard/operacao/producao", "/dashboard/operacao/etiquetas", "/dashboard/operacao/validade", "/dashboard/operacao/controles", "/dashboard/operacao/ingredientes", "/dashboard/operacao/fornecedores", "/dashboard/operacao/estoque", "/dashboard/operacao/compras", "/dashboard/operacao/notas", "/dashboard/operacao/fichas", "/dashboard/operacao/montagem", "/dashboard/operacao/produtos", "/dashboard/operacao/orcamento"],
  bar: ["/dashboard/modulo/bar", "/dashboard/area", "/dashboard/checklists", "/dashboard/operacao/rotina", "/dashboard/operacao/producao", "/dashboard/operacao/etiquetas", "/dashboard/operacao/ingredientes", "/dashboard/operacao/estoque", "/dashboard/operacao/compras", "/dashboard/operacao/notas", "/dashboard/operacao/drinks", "/dashboard/operacao/fichas", "/dashboard/operacao/montagem", "/dashboard/operacao/orcamento"],
  salao: ["/dashboard/modulo/salao", "/dashboard/area", "/dashboard/checklists", "/dashboard/mesas", "/dashboard/tarefas", "/dashboard/operacao/rotina", "/dashboard/salao/treinamento", "/dashboard/operacao/observacoes"],
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
    return <div className="min-h-[40vh] flex items-center justify-center px-4 text-sm font-bold text-slate-500">Carregando área correta...</div>;
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
    return <div className="min-h-[40vh] flex items-center justify-center px-4 text-sm font-bold text-slate-500">Verificando acesso...</div>;
  }
  return children;
}

function SidebarSection({ section, idx, ativo, onOpen }) {
  return (
    <div className="animate-in fade-in slide-in-from-left-2" style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}>
      <button
        onClick={onOpen}
        className={`w-full min-h-10 px-2.5 py-2 text-[11px] xl:text-[10px] font-black uppercase tracking-wider flex items-center justify-between rounded-lg transition-colors group outline-none text-left ${ativo
          ? "bg-emerald-500/10 text-emerald-300"
          : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/40"}`}
      >
        <div className="flex items-center gap-2">
           <section.icon size={16} className={`transition-colors shrink-0 xl:w-[13px] xl:h-[13px] ${ativo ? "text-emerald-400" : "text-slate-600 group-hover:text-slate-400"}`} />
           {section.category}
        </div>
        <ChevronDown size={16} className="-rotate-90 text-slate-600 shrink-0" />
      </button>
    </div>
  );
}

function Sidebar({ mobileOpen, setMobileOpen, collapsed, rotasPermitidas, sessao }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Acesso restrito: mostra só os itens cujas rotas estão liberadas.
  const menu = Array.isArray(rotasPermitidas)
    ? SIDEBAR_MENU.map((sec) => ({
        ...sec,
        items: sec.items.filter((it) => {
          const base = it.href.split("?")[0];
          return rotasPermitidas.some((r) => base === r.split("?")[0] || base.startsWith(r.split("?")[0] + "/"));
        }),
      })).filter((sec) => sec.items.length > 0)
    : SIDEBAR_MENU;
  const moduloAtivo = moduloDaRota(pathname, searchParams.get("dept"));

  return (
    <>
      {/* Overlay no celular E no tablet (a sidebar abre por cima do conteúdo) */}
      {mobileOpen && (
        <button type="button" aria-label="Fechar menu"
          className="fixed inset-0 bg-slate-900/80 z-40 backdrop-blur-sm xl:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container
          Celular/Tablet (< xl): fixa, entra/sai deslizando (overlay) — nunca
          fica "meio aparecendo" na lateral.
          Desktop (xl+): encaixada no layout; recolhe para largura 0 e o
          conteúdo cresce para ocupar o espaço. */}
      <aside className={`
        erp-sidebar fixed inset-y-0 left-0 z-50 bg-[#0A1128] border-r border-slate-800/50
        flex flex-col transition-all duration-300 ease-in-out shadow-2xl whitespace-nowrap overflow-hidden
        xl:static xl:z-auto xl:shadow-none
        ${mobileOpen ? "translate-x-0 w-[min(16rem,calc(100vw-2rem))]" : "-translate-x-full w-[min(16rem,calc(100vw-2rem))]"}
        ${collapsed ? "xl:translate-x-0 xl:w-0 xl:border-r-0" : "xl:translate-x-0 xl:w-[180px]"}
      `} aria-label="Menu principal">
        {/* Logo Area */}
        <div className="erp-sidebar-logo min-h-14 flex items-center justify-between px-3 sm:px-4 shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-transparent pointer-events-none" />
          
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2.5 relative z-10 hover:opacity-80 transition-opacity text-left">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <UtensilsCrossed size={14} className="text-white" />
            </div>
            <span className="text-lg font-black text-white tracking-tight">Hefisto</span>
          </button>
          
          {/* Fechar: no celular fecha o overlay */}
          <button onClick={() => setMobileOpen(false)} aria-label="Fechar menu" className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white relative z-10 rounded-xl xl:hidden">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Menu */}
        <div className="erp-sidebar-scroll flex-1 overflow-y-auto overscroll-contain custom-scrollbar px-2.5 sm:px-3 py-2 space-y-2">
          {menu.map((section, idx) => (
            <SidebarSection key={idx} section={section} idx={idx} ativo={moduloAtivo.category === section.category}
              onOpen={() => {
                const homeBase = baseDaRota(section.home);
                const homePermitida = !Array.isArray(rotasPermitidas) || !section.home || rotasPermitidas.some((rota) => {
                  const permitida = baseDaRota(rota);
                  return homeBase === permitida || homeBase.startsWith(`${permitida}/`);
                });
                const destino = homePermitida && section.home ? section.home : (section.items[0]?.href || "/dashboard");
                setMobileOpen(false);
                router.push(ajustarHrefParaAreaTravada(destino));
              }} />
          ))}
        </div>
        
        {/* User Profile Footer */}
        <div className="erp-sidebar-footer p-2 sm:p-3 border-t border-slate-800/50 shrink-0">
          <div className="bg-slate-800/30 rounded-lg p-2.5 flex items-center gap-2.5 border border-slate-700/50 group">
             <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center text-slate-200 text-sm font-bold shadow-inner group-hover:scale-105 transition-transform">
               {String(sessao?.nome || sessao?.email || "U").trim().charAt(0).toUpperCase()}
             </div>
             <div className="min-w-0">
                <p className="text-sm font-bold text-slate-200 leading-tight truncate">{sessao?.nome || "Usuário"}</p>
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider truncate">{rotuloPapel(sessao?.papel)}</p>
             </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function TopHeader({ onSair, onToggleSidebar, acessoRestrito, sessao, compacto, onToggleDensidade }) {
  const { unidades, unidadeAtiva, setUnidadeAtiva, podeTrocar, unidadeInfo } = useERP();
  const router = useRouter();

  // Seletor de unidade: abre por CLIQUE e fica fixo até escolher ou clicar fora.
  // Trocar de unidade mantém você na MESMA página (os dados recarregam sozinhos).
  const [unidadesAberto, setUnidadesAberto] = useState(false);
  const seletorRef = useRef(null);
  useEffect(() => {
    const fecharFora = (e) => {
      if (seletorRef.current && !seletorRef.current.contains(e.target)) setUnidadesAberto(false);
    };
    document.addEventListener("mousedown", fecharFora);
    document.addEventListener("touchstart", fecharFora);
    return () => {
      document.removeEventListener("mousedown", fecharFora);
      document.removeEventListener("touchstart", fecharFora);
    };
  }, []);

  const handleTrocaUnidade = (id) => {
    setUnidadeAtiva(id);
    setUnidadesAberto(false);
  };

  return (
    <header className="erp-top-header min-h-16 border-b border-slate-200/60 bg-white/80 backdrop-blur-md flex items-center justify-between gap-2 px-2 sm:px-4 md:px-6 py-2 shrink-0 sticky top-0 z-30 shadow-sm min-w-0">

      <div className="flex flex-1 items-center gap-2 md:gap-4 min-w-0">
         <button onClick={onToggleSidebar} title="Menu" aria-label="Abrir menu" className="w-11 h-11 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors shrink-0">
            <Menu size={22} />
         </button>
         <h1 className="text-base lg:text-lg font-black text-slate-800 hidden md:block tracking-tight truncate min-w-0">
            {unidadeInfo?.nome ? `Dashboard · ${unidadeInfo.nome}` : "Painel de Controle"}
         </h1>
      </div>

      <div className="flex items-center justify-end gap-1.5 sm:gap-3 min-w-0 shrink">
         {podeTrocar && (
           <div className="relative min-w-0" ref={seletorRef}>
             <button onClick={() => setUnidadesAberto(a => !a)} aria-expanded={unidadesAberto}
               className="h-11 max-w-[150px] sm:max-w-[240px] md:max-w-xs flex items-center gap-1.5 sm:gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 text-slate-700 px-2.5 sm:px-3 rounded-xl transition-all shadow-sm text-[10px] sm:text-xs font-bold uppercase min-w-0">
                <Store size={14} className="text-slate-400 shrink-0"/>
                <span className="truncate min-w-0">{unidadeInfo?.nome || 'Nenhuma Lj.'}</span>
                <ChevronDown size={14} className="text-slate-400 transition-transform" style={{ transform: unidadesAberto ? "rotate(180deg)" : "none" }}/>
             </button>
             {unidadesAberto && (
               <div className="erp-unit-menu absolute right-0 top-full mt-2 w-[min(16rem,calc(100vw-1rem))] max-h-[min(28rem,calc(100dvh-5rem))] overflow-y-auto overscroll-contain bg-white text-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 animate-in fade-in zoom-in-95 origin-top-right z-50">
                 {unidades.map(u => (
                   <button key={u.id} onClick={() => handleTrocaUnidade(u.id)} className="w-full min-h-12 text-left px-4 py-3 text-sm font-bold hover:bg-slate-50 border-b border-slate-50 last:border-0 flex justify-between items-center gap-3 transition-colors">
                     <span className="min-w-0 break-words">{u.nome}</span>
                     {u.id === unidadeAtiva && <Check size={16} className="text-emerald-500"/>}
                   </button>
                 ))}
               </div>
             )}
           </div>
         )}

         <div className="w-px h-6 bg-slate-200 hidden sm:block mx-1"></div>

         <button onClick={onToggleDensidade}
           className={`hidden md:flex h-11 items-center justify-center gap-2 px-3 rounded-xl transition-colors ${compacto ? "bg-emerald-50 text-emerald-700" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"}`}
           title={compacto ? "Usar visual confortável" : "Usar visual compacto"}>
           <SlidersHorizontal size={17} />
           <span className="text-xs font-bold">{compacto ? "Compacto" : "Confortável"}</span>
         </button>

         <button onClick={onSair} className="w-11 h-11 sm:w-auto flex items-center justify-center gap-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 sm:px-3 rounded-xl transition-colors group shrink-0" title="Sair do Sistema">
           <LogOut size={18} className="group-hover:-translate-x-0.5 transition-transform" />
           <span className="text-sm font-bold hidden sm:block">Sair</span>
         </button>
      </div>
    </header>
  );
}

function ModuleBar({ rotasPermitidas }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const dept = searchParams.get("dept");
  const [aberto, setAberto] = useState(false);

  const modulo = moduloDaRota(pathname, dept);
  const itens = Array.isArray(rotasPermitidas)
    ? modulo.items.filter((item) => {
        const base = baseDaRota(item.href);
        return rotasPermitidas.some((rota) => {
          const permitida = baseDaRota(rota);
          return base === permitida || base.startsWith(`${permitida}/`);
        });
      })
    : modulo.items;
  const itemAtivo = itens
    .filter((item) => correspondeRota(pathname, baseDaRota(item.href)))
    .sort((a, b) => baseDaRota(b.href).length - baseDaRota(a.href).length)[0] || itens[0];

  useEffect(() => { setAberto(false); }, [pathname]);

  if (pathname === "/dashboard/modulo" || pathname.startsWith("/dashboard/modulo/")) return null;

  // Ingredientes, fichas e montagem formam um fluxo próprio e compartilham um
  // cabeçalho operacional mais completo. Evita duas barras de navegação iguais.
  if ([
    "/dashboard/operacao/ingredientes",
    "/dashboard/operacao/fichas",
    "/dashboard/operacao/montagem",
  ].some((rota) => pathname === rota || pathname.startsWith(`${rota}/`))) return null;

  if (itens.length <= 1) return null;
  const Icone = modulo.icon;

  return (
    <nav aria-label={`Menu do módulo ${modulo.category}`}
      className="print:hidden shrink-0 border-b border-slate-200/70 bg-white px-3 sm:px-5 py-2.5 shadow-sm">
      <div className="mx-auto max-w-[1600px]">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-slate-900 text-emerald-300 flex items-center justify-center shrink-0 shadow-sm">
            <Icone size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 break-words">Módulo · {modulo.category}</p>
            <p className="text-xs sm:text-sm font-black text-slate-800 break-words">{itemAtivo?.label || modulo.category}</p>
          </div>
          <span className="hidden md:block text-[10px] font-bold text-slate-400">{itens.length} submódulos conectados</span>
          <button type="button" onClick={() => setAberto((valor) => !valor)} aria-expanded={aberto}
            className={`min-h-10 flex items-center gap-2 rounded-xl px-3 sm:px-4 text-xs font-black transition-all ${aberto ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
            <Menu size={15} /> <span className="hidden sm:inline">{aberto ? "Fechar mapa" : "Explorar módulo"}</span>
            <ChevronDown size={14} className={`transition-transform ${aberto ? "rotate-180" : ""}`} />
          </button>
        </div>

        <div className={`grid transition-all duration-300 ${aberto ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0 overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 sm:p-3">
              {itens.map((item, index) => {
                const base = baseDaRota(item.href);
                const ativo = pathname === base || pathname.startsWith(`${base}/`);
                return (
                  <button key={item.href} type="button" onClick={() => router.push(ajustarHrefParaAreaTravada(item.href))}
                    className={`group min-w-0 flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${ativo
                      ? "border-emerald-300 bg-white shadow-sm ring-2 ring-emerald-100"
                      : "border-transparent bg-white/70 hover:border-slate-200 hover:bg-white hover:shadow-sm"}`}>
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-xs font-black ${ativo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[9px] font-black uppercase tracking-widest ${ativo ? "text-emerald-600" : "text-slate-400"}`}>{ativo ? "Tela atual" : modulo.category}</span>
                      <span className="block text-xs font-black leading-tight text-slate-800 break-words">{item.label}</span>
                    </span>
                    <ChevronDown size={14} className="-rotate-90 shrink-0 text-slate-300 transition-transform group-hover:-translate-y-0.5" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

function MobileBottomNav({ sessao, onMenu }) {
  const pathname = usePathname();
  const router = useRouter();
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
      className="erp-mobile-nav print:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-xl md:hidden">
      <div className="grid min-h-[62px] items-stretch" style={{ gridTemplateColumns: `repeat(${visiveis.length + 1}, minmax(0, 1fr))` }}>
        {visiveis.map((item) => {
          const Icon = item.icon;
          const base = baseDaRota(item.href);
          const ativo = pathname === base || (base !== "/dashboard" && pathname.startsWith(`${base}/`));
          return (
            <button key={item.href} type="button" onClick={() => router.push(ajustarHrefParaAreaTravada(item.href))}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[9px] font-black transition-colors ${ativo ? "text-emerald-700" : "text-slate-400"}`}>
              <span className={`flex h-8 w-10 items-center justify-center rounded-xl ${ativo ? "bg-emerald-100" : "bg-transparent"}`}><Icon size={18} /></span>
              <span className="w-full truncate">{item.label}</span>
            </button>
          );
        })}
        <button type="button" onClick={onMenu}
          className="flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[9px] font-black text-slate-400">
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
  // Recolher a sidebar no desktop (lembra a preferência entre sessões)
  const [collapsed, setCollapsed] = useState(false);
  const [compacto, setCompacto] = useState(false);
  const interfaceTelaCheia = pathname === "/dashboard/operacao/estoque/tablet"
    || pathname === "/dashboard/operacao/etiquetas/tablet";

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
        return;
      }
      if (!sessaoRef.current) router.replace("/login");
    });
    // Fecha o menu mobile quando mudar de rota
    setMobileOpen(false);
    return () => { vivo = false; };
  }, [pathname, router]);

  // Hambúrguer: em desktop largo recolhe/expande; celular e tablet usam overlay.
  function toggleSidebar() {
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
    <div className={`erp-app-shell ${compacto ? "erp-density-compact" : "erp-density-comfortable"} flex h-screen h-[100dvh] min-h-0 bg-[#F8FAFC] overflow-hidden print:bg-white print:block print:h-auto print:min-h-0`}>
      {/* Sidebar — para acessos restritos, mostra só as telas liberadas */}
      <div className="print:hidden h-full flex shrink-0">
         <Suspense fallback={null}>
           <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} collapsed={collapsed} rotasPermitidas={rotasPermitidas} sessao={sessao} />
         </Suspense>
      </div>

      {/* Área Principal de Conteúdo */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden print:h-auto print:block print:overflow-visible relative">
        <div className="print:hidden shrink-0">
           <TopHeader onSair={sair} onToggleSidebar={toggleSidebar} acessoRestrito={acessoRestrito}
             sessao={sessao} compacto={compacto} onToggleDensidade={toggleDensidade} />
        </div>
        <Suspense fallback={null}>
          <ModuleBar rotasPermitidas={rotasPermitidas} />
        </Suspense>
        
        {/* Main Content Area com Scrollbar customizada */}
        <main className="erp-main-content flex-1 min-w-0 overflow-y-auto overscroll-y-contain custom-scrollbar animate-page-in relative print:overflow-visible print:block">
          <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center px-4 text-sm font-bold text-slate-500">Carregando...</div>}>
            <ProtecaoPermissao sessao={sessao}>
              <ProtecaoSetorDaArea>{children}</ProtecaoSetorDaArea>
            </ProtecaoPermissao>
          </Suspense>
        </main>
      </div>
      <SyncFeedback />
      <MobileBottomNav sessao={sessao} onMenu={() => setMobileOpen(true)} />
      {/* Busca de qualquer tela sobe ao topo ao digitar (resultados à vista) */}
      <BuscaAutoScroll />
      {/* Assistente Hefisto — botão flutuante + painel lateral, em todas as telas */}
      <Suspense fallback={null}>
        <HefistoAssistant />
      </Suspense>
    </div>
  );
}
