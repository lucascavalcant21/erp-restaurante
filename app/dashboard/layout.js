"use client";

import { useState, useEffect } from "react";
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
    category: "Operação Garçons",
    icon: Truck,
    items: [
      { label: "Delivery & iFood", href: "/dashboard/salao/online" },
      { label: "Painel de Senhas (TV)", href: "/chamada/dinamico" },
      { label: "Canais de Venda", href: "/dashboard/canais/ifood" },
      { label: "Cupons de Desconto", href: "/dashboard/marketing/cupons" },
      { label: "Cardápio Digital (QR)", href: "/dashboard/operacao/cardapio" },
      { label: "Observações Padrão", href: "/dashboard/operacao/observacoes" }
    ]
  },
  {
    category: "Operação Cozinha",
    icon: ChefHat,
    items: [
      { label: "Catálogo e Preços", href: "/dashboard/operacao/produtos" },
      { label: "Fichas Técnicas", href: "/dashboard/operacao/fichas?dept=cozinha" },
      { label: "Ingredientes e Insumos", href: "/dashboard/operacao/ingredientes?dept=cozinha" },
      { label: "Controle de Estoque", href: "/dashboard/operacao/estoque?dept=cozinha" },
      { label: "Lista de Compras", href: "/dashboard/operacao/compras" },
      { label: "Notas de Entrada (NF)", href: "/dashboard/operacao/notas" },
      { label: "Produção Diária", href: "/dashboard/operacao/producao" },
      { label: "Validade e Etiquetas", href: "/dashboard/operacao/etiquetas?dept=cozinha" },
      { label: "Rotinas Operacionais", href: "/dashboard/operacao/rotina" },
      { label: "Orçamento de Eventos", href: "/dashboard/operacao/orcamento" }
    ]
  },
  {
    category: "Operação Bar",
    icon: GlassWater,
    items: [
      { label: "Drinks e Coquetéis", href: "/dashboard/operacao/drinks" },
      { label: "Fichas de Drinks", href: "/dashboard/operacao/fichas?dept=bar" },
      { label: "Ingredientes Bar", href: "/dashboard/operacao/ingredientes?dept=bar" },
      { label: "Estoque do Bar", href: "/dashboard/operacao/estoque?dept=bar" },
      { label: "Etiquetas do Bar", href: "/dashboard/operacao/etiquetas?dept=bar" }
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
          ? "bg-blue-500/10 text-blue-400" 
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
      }`}
    >
      <div className={`w-1.5 h-1.5 rounded-full transition-colors ${isActive ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'bg-transparent'}`} />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

function Sidebar({ mobileOpen, setMobileOpen }) {
  const pathname = usePathname();
  
  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/80 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-72 bg-[#0A1128] border-r border-slate-800/50
        flex flex-col transform transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* Logo Area */}
        <div className="h-16 flex items-center justify-between px-6 shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-transparent pointer-events-none" />
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <UtensilsCrossed size={16} className="text-white" />
            </div>
            <span className="text-xl font-black text-white tracking-tight">Hefisto</span>
          </div>
          
          <button onClick={() => setMobileOpen(false)} className="lg:hidden text-slate-400 hover:text-white relative z-10 p-2">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Menu */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
          {SIDEBAR_MENU.map((section, idx) => (
            <div key={idx} className="animate-in fade-in slide-in-from-left-2" style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}>
              <h3 className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                <section.icon size={12} className="text-slate-600" /> {section.category}
              </h3>
              <div className="space-y-0.5">
                {section.items.map((item, itemIdx) => (
                  <SidebarItem key={itemIdx} item={item} pathname={pathname} />
                ))}
              </div>
            </div>
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

function TopHeader({ onSair, setMobileOpen }) {
  const { unidades, unidadeAtiva, setUnidadeAtiva, podeTrocar, unidadeInfo } = useERP();

  return (
    <header className="h-16 border-b border-slate-200/60 bg-white/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 shrink-0 sticky top-0 z-30 shadow-sm">
      
      <div className="flex items-center gap-4">
         <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
            <Menu size={22} />
         </button>
         <h1 className="text-lg font-black text-slate-800 hidden sm:block tracking-tight">
            {unidadeInfo?.nome ? `Dashboard · ${unidadeInfo.nome}` : "Painel de Controle"}
         </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
         {podeTrocar && (
           <div className="relative group">
             <button className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 text-slate-700 px-3 py-2 rounded-xl transition-all shadow-sm text-xs font-bold uppercase">
                <Store size={14} className="text-slate-400"/> 
                <span className="max-w-[120px] sm:max-w-xs truncate">{unidadeInfo?.nome || 'Nenhuma Lj.'}</span> 
                <ChevronDown size={14} className="text-slate-400"/>
             </button>
             <div className="absolute right-0 top-full mt-2 w-64 bg-white text-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 hidden group-hover:block border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
               {unidades.map(u => (
                 <button key={u.id} onClick={() => setUnidadeAtiva(u.id)} className="w-full text-left px-4 py-3 text-sm font-bold hover:bg-slate-50 border-b border-slate-50 last:border-0 flex justify-between items-center group/btn transition-colors">
                   {u.nome}
                   {u.id === unidadeAtiva && <Check size={16} className="text-blue-500"/>}
                 </button>
               ))}
             </div>
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

  useEffect(() => {
    let vivo = true;
    lerSessao().then((s) => {
      if (!vivo) return;
      if (!s) { router.replace("/login"); return; }
      setSessao(s);
    });
    // Fecha o menu mobile quando mudar de rota
    setMobileOpen(false);
    return () => { vivo = false; };
  }, [pathname, router]);

  async function sair() {
    await encerrarSessao();
    router.replace("/login");
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden print:bg-white print:block print:h-auto print:min-h-0">
      
      {/* Sidebar Lateral Escura */}
      <div className="print:hidden h-full flex shrink-0">
         <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      </div>
      
      {/* Área Principal de Conteúdo */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden print:h-auto print:block print:overflow-visible relative">
        <div className="print:hidden shrink-0">
           <TopHeader onSair={sair} setMobileOpen={setMobileOpen} />
        </div>
        
        {/* Main Content Area com Scrollbar customizada */}
        <main className="flex-1 overflow-y-auto custom-scrollbar animate-page-in relative print:overflow-visible print:block">
          {children}
        </main>
      </div>
      
    </div>
  );
}
