"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { lerSessao, encerrarSessao } from "../lib/auth";
import { useERP } from "../context/ERPContext";
import {
  Users, BarChart, Store, Settings, LogOut, ChevronDown, Check,
  UtensilsCrossed, Package, Wallet, Menu, X, Truck, ChefHat, GlassWater
} from "lucide-react";

// NOVO MENU SIDEBAR (PDV e KDS REMOVIDOS)
const SIDEBAR_MENU = [
  {
    category: "Visão Geral",
    icon: BarChart,
    items: [
      { label: "Dashboard Principal", href: "/dashboard" }
    ]
  },
  {
    category: "Operação Garçons",
    icon: Users,
    items: [
      { label: "Checklist", href: "/dashboard/operacao/rotina?dept=salao" },
      { label: "Treinamentos", href: "/dashboard/salao/treinamento" },
      { label: "Observações Padrão", href: "/dashboard/operacao/observacoes" }
    ]
  },

  {
    category: "Operação Cozinha",
    icon: ChefHat,
    items: [
      { label: "Catálogo e Preços", href: "/dashboard/operacao/produtos" },
      { label: "Fichas Técnicas", href: "/dashboard/operacao/fichas?dept=cozinha" },
      { label: "Guia de Montagem", href: "/dashboard/operacao/montagem?dept=cozinha" },
      { label: "Ingredientes e Insumos", href: "/dashboard/operacao/ingredientes?dept=cozinha" },
      { label: "Controle de Estoque", href: "/dashboard/operacao/estoque?dept=cozinha" },
      { label: "Lista de Compras", href: "/dashboard/operacao/compras?dept=cozinha" },
      { label: "Notas de Entrada (NF)", href: "/dashboard/operacao/notas?dept=cozinha" },
      { label: "Produção Diária", href: "/dashboard/operacao/producao?dept=cozinha" },
      { label: "Validade e Etiquetas", href: "/dashboard/operacao/etiquetas?dept=cozinha" },
      { label: "Limpeza, Gás e Óleo", href: "/dashboard/operacao/controles" },
      { label: "Checklist", href: "/dashboard/operacao/rotina?dept=cozinha" },
      { label: "Orçamento de Eventos", href: "/dashboard/operacao/orcamento?dept=cozinha" }
    ]
  },
  {
    category: "Operação Bar",
    icon: GlassWater,
    items: [
      { label: "Drinks e Coquetéis", href: "/dashboard/operacao/drinks" },
      { label: "Fichas de Drinks", href: "/dashboard/operacao/fichas?dept=bar" },
      { label: "Guia de Montagem", href: "/dashboard/operacao/montagem?dept=bar" },
      { label: "Ingredientes Bar", href: "/dashboard/operacao/ingredientes?dept=bar" },
      { label: "Estoque do Bar", href: "/dashboard/operacao/estoque?dept=bar" },
      { label: "Lista de Compras", href: "/dashboard/operacao/compras?dept=bar" },
      { label: "Notas de Entrada (NF)", href: "/dashboard/operacao/notas?dept=bar" },
      { label: "Produção do Bar", href: "/dashboard/operacao/producao?dept=bar" },
      { label: "Etiquetas do Bar", href: "/dashboard/operacao/etiquetas?dept=bar" },
      { label: "Checklist", href: "/dashboard/operacao/rotina?dept=bar" },
      { label: "Orçamento de Eventos", href: "/dashboard/operacao/orcamento?dept=bar" }
    ]
  },
  {
    category: "Financeiro & Contábil",
    icon: Wallet,
    items: [
      { label: "Fluxo de Caixa", href: "/dashboard/financeiro" },
      { label: "DRE Gerencial", href: "/dashboard/financeiro/dre" },
      { label: "Análise de CMV", href: "/dashboard/financeiro/cmv" },
      { label: "Dados Fiscais", href: "/dashboard/gestao/fiscal" }
    ]
  },
  {
    category: "Recursos Humanos",
    icon: Users,
    items: [
      { label: "Gestão de RH", href: "/dashboard/rh" },
      { label: "Atas de Reunião", href: "/dashboard/rh/atas" },
      { label: "Gastos Administrativos", href: "/dashboard/rh/gastos-admin" },
      { label: "Ponto Eletrônico", href: "/dashboard/rh/ponto" },
      { label: "Colaboradores", href: "/dashboard/rh/colaborador" },
      { label: "Fechamento de Folha", href: "/dashboard/rh/fechamento" },
      { label: "Organograma", href: "/dashboard/rh/organograma" },
      { label: "Recrutamento", href: "/dashboard/rh/recrutamento" },
      { label: "Cardápio Equipe", href: "/dashboard/rh/cardapio-funcionarios" }
    ]
  },
  {
    category: "Gestão da Loja",
    icon: Store,
    items: [
      { label: "Inventário da Unidade", href: "/dashboard/gestao/inventario" },
      { label: "Serviços de Manutenção", href: "/dashboard/gestao/manutencao" },
      { label: "Relatórios Gerais", href: "/dashboard/relatorios" },
      { label: "Configurações", href: "/dashboard/configuracoes" }
    ]
  }
];

function SidebarItem({ item, pathname }) {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  
  let isActive = false;
  if (item.href === "/dashboard") {
     isActive = pathname === "/dashboard";
  } else {
     isActive = pathname === item.href || pathname.startsWith(item.href + '/');
  }

  const handleClick = () => {
    if (item.href === "/chamada/dinamico") {
      window.open(`/chamada/${unidadeAtiva || 'todas'}`, "_blank");
      return;
    }
    router.push(item.href);
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-bold transition-all ${
        isActive 
          ? "bg-emerald-500/10 text-emerald-400" 
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
      }`}
    >
      <div className={`w-1.5 h-1.5 rounded-full transition-colors ${isActive ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-transparent'}`} />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

function SidebarSection({ section, idx, pathname }) {
  // Módulos sempre começam recolhidos; abre só o que tem a página atual dentro.
  const contemAtual = section.items.some(item =>
    item.href !== "/dashboard" && (pathname === item.href.split("?")[0] || pathname.startsWith(item.href.split("?")[0] + "/"))
  );
  const [isOpen, setIsOpen] = useState(contemAtual);

  return (
    <div className="animate-in fade-in slide-in-from-left-2" style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 mb-2 flex items-center justify-between transition-colors group outline-none"
      >
        <div className="flex items-center gap-2">
           <section.icon size={13} className="text-slate-600 group-hover:text-slate-400 transition-colors" /> 
           {section.category}
        </div>
        <ChevronDown size={14} className={`text-slate-600 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
      </button>
      
      <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden min-h-0 space-y-0.5">
          <div className="pb-2">
             {section.items.map((item, itemIdx) => (
               <SidebarItem key={itemIdx} item={item} pathname={pathname} />
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

  return (
    <>
      {/* Overlay no celular E no tablet (a sidebar abre por cima do conteúdo) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/80 z-40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container
          Celular/Tablet (< lg): fixa, entra/sai deslizando (overlay) — nunca
          fica "meio aparecendo" na lateral.
          Desktop (lg+): encaixada no layout; recolhe para largura 0 e o
          conteúdo cresce para ocupar o espaço. */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 bg-[#0A1128] border-r border-slate-800/50
        flex flex-col transition-all duration-300 ease-in-out shadow-2xl whitespace-nowrap overflow-hidden
        lg:static lg:z-auto lg:shadow-none
        ${mobileOpen ? "translate-x-0 w-72" : "-translate-x-full w-72"}
        ${collapsed ? "lg:translate-x-0 lg:w-0 lg:border-r-0" : "lg:translate-x-0 lg:w-72"}
      `}>
        {/* Logo Area */}
        <div className="h-16 flex items-center justify-between px-6 shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-transparent pointer-events-none" />
          
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-3 relative z-10 hover:opacity-80 transition-opacity text-left">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <UtensilsCrossed size={16} className="text-white" />
            </div>
            <span className="text-xl font-black text-white tracking-tight">Hefisto</span>
          </button>
          
          {/* Fechar: no celular fecha o overlay */}
          <button onClick={() => setMobileOpen(false)} className="text-slate-400 hover:text-white relative z-10 p-2 lg:hidden">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Menu */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
          {SIDEBAR_MENU.map((section, idx) => (
            <SidebarSection key={idx} section={section} idx={idx} pathname={pathname} />
          ))}
        </div>
        
        {/* User Profile Footer */}
        <div className="p-4 border-t border-slate-800/50 shrink-0">
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

function TopHeader({ onSair, onToggleSidebar }) {
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
    <header className="h-16 border-b border-slate-200/60 bg-white/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 shrink-0 sticky top-0 z-30 shadow-sm">

      <div className="flex items-center gap-4">
         <button onClick={onToggleSidebar} title="Menu" className="p-2 -ml-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
            <Menu size={22} />
         </button>
         <h1 className="text-lg font-black text-slate-800 hidden sm:block tracking-tight">
            {unidadeInfo?.nome ? `Dashboard · ${unidadeInfo.nome}` : "Painel de Controle"}
         </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
         {podeTrocar && (
           <div className="relative" ref={seletorRef}>
             <button onClick={() => setUnidadesAberto(a => !a)} className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 text-slate-700 px-3 py-2 rounded-xl transition-all shadow-sm text-xs font-bold uppercase">
                <Store size={14} className="text-slate-400"/>
                <span className="max-w-[120px] sm:max-w-xs truncate">{unidadeInfo?.nome || 'Nenhuma Lj.'}</span>
                <ChevronDown size={14} className="text-slate-400 transition-transform" style={{ transform: unidadesAberto ? "rotate(180deg)" : "none" }}/>
             </button>
             {unidadesAberto && (
               <div className="absolute right-0 top-full mt-2 w-64 bg-white text-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 origin-top-right z-50">
                 {unidades.map(u => (
                   <button key={u.id} onClick={() => handleTrocaUnidade(u.id)} className="w-full text-left px-4 py-3 text-sm font-bold hover:bg-slate-50 border-b border-slate-50 last:border-0 flex justify-between items-center transition-colors">
                     {u.nome}
                     {u.id === unidadeAtiva && <Check size={16} className="text-emerald-500"/>}
                   </button>
                 ))}
               </div>
             )}
           </div>
         )}

         <div className="w-px h-6 bg-slate-200 hidden sm:block mx-1"></div>

         <button onClick={onSair} className="flex items-center gap-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 sm:px-3 sm:py-2 rounded-xl transition-colors group" title="Sair do Sistema">
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
    } catch (_) {}
    lerSessao().then((s) => {
      if (!vivo) return;
      if (!s) { router.replace("/login"); return; }
      setSessao(s);
    });
    // Fecha o menu mobile quando mudar de rota
    setMobileOpen(false);
    return () => { vivo = false; };
  }, [pathname, router]);

  // Hambúrguer: no desktop recolhe/expande a sidebar; no celular abre o overlay.
  function toggleSidebar() {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
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
    await encerrarSessao();
    router.replace("/login");
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden print:bg-white print:block print:h-auto print:min-h-0">
      
      {/* Sidebar Lateral Escura */}
      <div className="print:hidden h-full flex shrink-0">
         <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} collapsed={collapsed} />
      </div>

      {/* Área Principal de Conteúdo */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden print:h-auto print:block print:overflow-visible relative">
        <div className="print:hidden shrink-0">
           <TopHeader onSair={sair} onToggleSidebar={toggleSidebar} />
        </div>
        
        {/* Main Content Area com Scrollbar customizada */}
        <main className="flex-1 overflow-y-auto custom-scrollbar animate-page-in relative print:overflow-visible print:block">
          {children}
        </main>
      </div>
      
    </div>
  );
}
