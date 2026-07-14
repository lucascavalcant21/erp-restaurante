"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { lerSessao, encerrarSessao } from "../lib/auth";
import { useERP } from "../context/ERPContext";
import {
  Users, BarChart, Store, Settings, LogOut, ChevronDown, Check,
  UtensilsCrossed, Package, Wallet, Menu, X, Truck, ChefHat, GlassWater
} from "lucide-react";

// NOVO MENU SIDEBAR (PDV e KDS REMOVIDOS)
const SIDEBAR_MENU = [
  {
    category: "Início",
    icon: BarChart,
    items: [
      { label: "Painel Geral", href: "/dashboard" }
    ]
  },
  {
    category: "Salão",
    icon: Users,
    items: [
      { label: "Modo Estação (tela cheia)", href: "/dashboard/area?dept=salao" },
      { label: "Checklist do Salão", href: "/dashboard/operacao/rotina?dept=salao" },
      { label: "Treinamentos", href: "/dashboard/salao/treinamento" },
      { label: "Observações de Atendimento", href: "/dashboard/operacao/observacoes" }
    ]
  },

  {
    category: "Cozinha",
    icon: ChefHat,
    items: [
      { label: "Modo Estação (tela cheia)", href: "/dashboard/area?dept=cozinha" },
      { label: "Produtos e Preços", href: "/dashboard/operacao/produtos" },
      { label: "Fichas Técnicas", href: "/dashboard/operacao/fichas?dept=cozinha" },
      { label: "Guia de Montagem", href: "/dashboard/operacao/montagem?dept=cozinha" },
      { label: "Ingredientes", href: "/dashboard/operacao/ingredientes?dept=cozinha" },
      { label: "Estoque", href: "/dashboard/operacao/estoque?dept=cozinha" },
      { label: "Compras", href: "/dashboard/operacao/compras?dept=cozinha" },
      { label: "Entrada de Notas", href: "/dashboard/operacao/notas?dept=cozinha" },
      { label: "Produção do Dia", href: "/dashboard/operacao/producao?dept=cozinha" },
      { label: "Etiquetas e Validade", href: "/dashboard/operacao/etiquetas?dept=cozinha" },
      { label: "Controles de Limpeza", href: "/dashboard/operacao/controles" },
      { label: "Checklist da Cozinha", href: "/dashboard/operacao/rotina?dept=cozinha" },
      { label: "Orçamento de Eventos", href: "/dashboard/operacao/orcamento?dept=cozinha" }
    ]
  },
  {
    category: "Bar",
    icon: GlassWater,
    items: [
      { label: "Modo Estação (tela cheia)", href: "/dashboard/area?dept=bar" },
      { label: "Drinks e Coquetéis", href: "/dashboard/operacao/drinks" },
      { label: "Fichas de Drinks", href: "/dashboard/operacao/fichas?dept=bar" },
      { label: "Guia de Montagem", href: "/dashboard/operacao/montagem?dept=bar" },
      { label: "Ingredientes", href: "/dashboard/operacao/ingredientes?dept=bar" },
      { label: "Estoque", href: "/dashboard/operacao/estoque?dept=bar" },
      { label: "Compras", href: "/dashboard/operacao/compras?dept=bar" },
      { label: "Entrada de Notas", href: "/dashboard/operacao/notas?dept=bar" },
      { label: "Produção do Dia", href: "/dashboard/operacao/producao?dept=bar" },
      { label: "Etiquetas e Validade", href: "/dashboard/operacao/etiquetas?dept=bar" },
      { label: "Checklist do Bar", href: "/dashboard/operacao/rotina?dept=bar" },
      { label: "Orçamento de Eventos", href: "/dashboard/operacao/orcamento?dept=bar" }
    ]
  },
  {
    category: "Financeiro",
    icon: Wallet,
    items: [
      { label: "Fluxo de Caixa", href: "/dashboard/financeiro" },
      { label: "Resultado (DRE)", href: "/dashboard/financeiro/dre" },
      { label: "CMV", href: "/dashboard/financeiro/cmv" },
      { label: "Dados Fiscais", href: "/dashboard/gestao/fiscal" }
    ]
  },
  {
    category: "Equipe & RH",
    icon: Users,
    items: [
      { label: "Painel de RH", href: "/dashboard/rh" },
      { label: "Ponto", href: "/dashboard/rh/ponto" },
      { label: "Portal do Colaborador", href: "/dashboard/rh/colaborador" },
      { label: "Folha de Pagamento", href: "/dashboard/rh/fechamento" },
      { label: "Organograma", href: "/dashboard/rh/organograma" },
      { label: "Recrutamento", href: "/dashboard/rh/recrutamento" },
      { label: "Refeição da Equipe", href: "/dashboard/rh/cardapio-funcionarios" },
      { label: "Atas de Reunião", href: "/dashboard/rh/atas" },
      { label: "Gastos Administrativos", href: "/dashboard/rh/gastos-admin" }
    ]
  },
  {
    category: "Gestão & Ajustes",
    icon: Store,
    items: [
      { label: "Inventário", href: "/dashboard/gestao/inventario" },
      { label: "Manutenção", href: "/dashboard/gestao/manutencao" },
      { label: "Relatórios", href: "/dashboard/relatorios" },
      { label: "Configurações", href: "/dashboard/configuracoes" }
    ]
  }
];

// Rotas liberadas em cada área travada (estação Cozinha/Bar/Salão).
const ROTAS_AREA = {
  cozinha: ["/dashboard/area", "/dashboard/checklists", "/dashboard/operacao/rotina", "/dashboard/operacao/producao", "/dashboard/operacao/etiquetas", "/dashboard/operacao/controles", "/dashboard/operacao/ingredientes", "/dashboard/operacao/estoque", "/dashboard/operacao/compras", "/dashboard/operacao/notas", "/dashboard/operacao/fichas", "/dashboard/operacao/montagem", "/dashboard/operacao/produtos", "/dashboard/operacao/orcamento"],
  bar: ["/dashboard/area", "/dashboard/checklists", "/dashboard/operacao/rotina", "/dashboard/operacao/producao", "/dashboard/operacao/etiquetas", "/dashboard/operacao/ingredientes", "/dashboard/operacao/estoque", "/dashboard/operacao/compras", "/dashboard/operacao/notas", "/dashboard/operacao/drinks", "/dashboard/operacao/fichas", "/dashboard/operacao/montagem"],
  salao: ["/dashboard/area", "/dashboard/checklists", "/dashboard/operacao/rotina", "/dashboard/salao/treinamento", "/dashboard/operacao/observacoes"],
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
  const rotaSetorizada = ROTAS_SETORIZADAS.some(rota => correspondeRota(pathname, rota));
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
      if (!ROTAS_SETORIZADAS.some(rota => correspondeRota(pathname, rota)) || deptAtual === areaAtiva) return;

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

function SidebarItem({ item, pathname, onNavigate }) {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  
  let isActive = false;
  if (item.href === "/dashboard") {
     isActive = pathname === "/dashboard";
  } else {
     isActive = pathname === item.href || pathname.startsWith(item.href + '/');
  }

  const handleClick = () => {
    onNavigate?.();
    if (item.href === "/chamada/dinamico") {
      window.open(`/chamada/${unidadeAtiva || 'todas'}`, "_blank");
      return;
    }
    router.push(ajustarHrefParaAreaTravada(item.href));
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full min-h-12 xl:min-h-11 flex items-center gap-3 px-3 py-3 xl:py-2.5 rounded-xl text-[15px] xl:text-[13px] font-bold text-left transition-all ${
        isActive
          ? "bg-emerald-500/10 text-emerald-400"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
      }`}
    >
      <div className={`w-2 h-2 xl:w-1.5 xl:h-1.5 rounded-full transition-colors shrink-0 ${isActive ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-transparent'}`} />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

function SidebarSection({ section, idx, pathname, isOpen, onToggle, onNavigate }) {
  // Acordeão controlado pelo pai: só um módulo aberto por vez, e ao navegar
  // para um submódulo tudo recolhe de novo.
  return (
    <div className="animate-in fade-in slide-in-from-left-2" style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}>
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full min-h-12 xl:min-h-11 px-3 py-2.5 xl:py-2 text-[12px] xl:text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 mb-1 flex items-center justify-between transition-colors group outline-none text-left"
      >
        <div className="flex items-center gap-2.5">
           <section.icon size={16} className="text-slate-600 group-hover:text-slate-400 transition-colors shrink-0 xl:w-[13px] xl:h-[13px]" />
           {section.category}
        </div>
        <ChevronDown size={16} className={`text-slate-600 transition-transform duration-200 shrink-0 ${isOpen ? '' : '-rotate-90'}`} />
      </button>
      
      <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden min-h-0 space-y-0.5">
          <div className="pb-2">
             {section.items.map((item, itemIdx) => (
               <SidebarItem key={itemIdx} item={item} pathname={pathname} onNavigate={onNavigate} />
             ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ mobileOpen, setMobileOpen, collapsed }) {
  const pathname = usePathname();
  const router = useRouter();

  // Acordeão: índice do único módulo aberto; navegar recolhe tudo
  const [moduloAberto, setModuloAberto] = useState(null);
  useEffect(() => { setModuloAberto(null); }, [pathname]);

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
        ${mobileOpen ? "translate-x-0 w-[min(18rem,calc(100vw-2rem))]" : "-translate-x-full w-[min(18rem,calc(100vw-2rem))]"}
        ${collapsed ? "xl:translate-x-0 xl:w-0 xl:border-r-0" : "xl:translate-x-0 xl:w-72"}
      `} aria-label="Menu principal">
        {/* Logo Area */}
        <div className="erp-sidebar-logo min-h-16 flex items-center justify-between px-4 sm:px-6 shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-transparent pointer-events-none" />
          
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-3 relative z-10 hover:opacity-80 transition-opacity text-left">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <UtensilsCrossed size={16} className="text-white" />
            </div>
            <span className="text-xl font-black text-white tracking-tight">Hefisto</span>
          </button>
          
          {/* Fechar: no celular fecha o overlay */}
          <button onClick={() => setMobileOpen(false)} aria-label="Fechar menu" className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white relative z-10 rounded-xl xl:hidden">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Menu */}
        <div className="erp-sidebar-scroll flex-1 overflow-y-auto overscroll-contain custom-scrollbar px-3 sm:px-4 py-3 space-y-4">
          {SIDEBAR_MENU.map((section, idx) => (
            <SidebarSection key={idx} section={section} idx={idx} pathname={pathname}
              isOpen={moduloAberto === idx}
              onToggle={() => setModuloAberto(a => a === idx ? null : idx)}
              onNavigate={() => setMobileOpen(false)} />
          ))}
        </div>
        
        {/* User Profile Footer */}
        <div className="erp-sidebar-footer p-3 sm:p-4 border-t border-slate-800/50 shrink-0">
          <div className="bg-slate-800/30 rounded-xl p-3 flex items-center gap-3 border border-slate-700/50 hover:bg-slate-800/50 transition-colors cursor-pointer group">
             <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center text-slate-200 font-bold shadow-inner group-hover:scale-105 transition-transform">
               A
             </div>
             <div className="min-w-0">
                <p className="text-sm font-bold text-slate-200 leading-tight truncate">Admin</p>
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider truncate">Gestor Hefisto</p>
             </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function TopHeader({ onSair, onToggleSidebar, acessoRestrito }) {
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
         {!acessoRestrito && (
         <button onClick={onToggleSidebar} title="Menu" aria-label="Abrir menu" className="w-11 h-11 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors shrink-0">
            <Menu size={22} />
         </button>
         )}
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

         <button onClick={onSair} className="w-11 h-11 sm:w-auto flex items-center justify-center gap-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 sm:px-3 rounded-xl transition-colors group shrink-0" title="Sair do Sistema">
           <LogOut size={18} className="group-hover:-translate-x-0.5 transition-transform" />
           <span className="text-sm font-bold hidden sm:block">Sair</span>
         </button>
      </div>
    </header>
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

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("erp_sidebar_collapsed") === "1"); } catch (_) {}
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
        // Acesso por módulo: só pode circular na rota do seu módulo. Qualquer
        // outra rota volta para ela — vê exclusivamente o módulo liberado.
        if (s.restrito && s.rota) {
          const base = s.rota.split("?")[0];
          if (!(pathname === base || pathname.startsWith(base + "/"))) {
            router.replace(s.rota);
          }
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

  // Acesso por módulo: esconde a barra lateral (vê só o módulo liberado).
  const acessoRestrito = !!sessao?.restrito;

  return (
    <div className="erp-app-shell flex h-screen h-[100dvh] min-h-0 bg-[#F8FAFC] overflow-hidden print:bg-white print:block print:h-auto print:min-h-0">
      {/* Sidebar Lateral Escura — oculta para acessos restritos a um módulo */}
      {!acessoRestrito && (
        <div className="print:hidden h-full flex shrink-0">
           <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} collapsed={collapsed} />
        </div>
      )}

      {/* Área Principal de Conteúdo */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden print:h-auto print:block print:overflow-visible relative">
        <div className="print:hidden shrink-0">
           <TopHeader onSair={sair} onToggleSidebar={toggleSidebar} acessoRestrito={acessoRestrito} />
        </div>
        
        {/* Main Content Area com Scrollbar customizada */}
        <main className="erp-main-content flex-1 min-w-0 overflow-y-auto overscroll-y-contain custom-scrollbar animate-page-in relative print:overflow-visible print:block">
          <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center px-4 text-sm font-bold text-slate-500">Carregando...</div>}>
            <ProtecaoSetorDaArea>{children}</ProtecaoSetorDaArea>
          </Suspense>
        </main>
      </div>
      
    </div>
  );
}
