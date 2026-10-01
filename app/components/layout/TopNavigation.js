"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Sparkles, User, Settings, LogOut, ChevronDown, Menu, X, ChevronRight, Bell } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export default function TopNavigation({ sessao, onSair, onOpenSearch }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const menuRef = useRef(null);
  const notifRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(event.target)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const [hoveredModule, setHoveredModule] = useState(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [expandedMobileModule, setExpandedMobileModule] = useState(null);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  const modules = [
    {
      id: "operacao",
      label: "PDV",
      href: "/dashboard/operacao/inteligente",
      submodules: [
        { label: "Inteligente", href: "/dashboard/operacao/inteligente" },
        { label: "Controles & Checklists", href: "/dashboard/operacao/controles" },
        { label: "Limpeza", href: "/dashboard/operacao/limpeza" },
        { label: "Manutenção", href: "/dashboard/operacao/manutencao" }
      ]
    },
    {
      id: "cardapio",
      label: "Cardápio",
      href: "/dashboard/operacao/fichas",
      submodules: [
        { label: "Cadastro de Ingredientes", href: "/dashboard/operacao/ingredientes" },
        { label: "Fichas Técnicas", href: "/dashboard/operacao/fichas" },
        { label: "Cardápio Digital", href: "/dashboard/operacao/cardapio" },
        { label: "Produção Diária", href: "/dashboard/operacao/producao" },
        { label: "Engenharia de Menu", href: "/dashboard/operacao/engenharia" }
      ]
    },
    {
      id: "estoque",
      label: "Operacional",
      href: "/dashboard/operacao/estoque",
      submodules: [
        { label: "Controle de Estoque", href: "/dashboard/operacao/estoque?gestao=1" },
        { label: "Inventários / Contagens", href: "/dashboard/operacao/estoque/contagens" },
        { label: "Compras e Custo Médio", href: "/dashboard/operacao/estoque/compras" },
        { label: "Cotações e Compras", href: "/dashboard/operacao/compras" },
        { label: "Recebimento de Notas", href: "/dashboard/operacao/notas" },
        { label: "Fornecedores", href: "/dashboard/operacao/fornecedores" },
        { label: "Impressão de Etiquetas", href: "/dashboard/operacao/etiquetas" }
      ]
    },
    {
      id: "eventos",
      label: "Eventos",
      href: "/dashboard/reservas-eventos"
    },
    {
      id: "rh",
      label: "RH",
      href: "/dashboard/rh",
      submodules: [
        { label: "Visão Geral", href: "/dashboard/rh" },
        { label: "Quadro de Funcionários", href: "/dashboard/rh/funcionario" },
        { label: "Ponto e Espelho", href: "/dashboard/rh/ponto" },
        { label: "Escalas de Trabalho", href: "/dashboard/rh/semana" },
        { label: "Gestão de Extras", href: "/dashboard/rh/extra" },
        { label: "Treinamentos", href: "/dashboard/treinamentos" }
      ]
    },
    {
      id: "financeiro",
      label: "Financeiro",
      href: "/dashboard/financeiro",
      submodules: [
        { label: "Visão Geral", href: "/dashboard/financeiro" },
        { label: "Contas a Pagar", href: "/dashboard/financeiro/contas" },
        { label: "Contas a Receber", href: "/dashboard/financeiro/receber" },
        { label: "Caixa e Contas", href: "/dashboard/financeiro/caixa" },
        { label: "DRE Gerencial", href: "/dashboard/financeiro/dre" }
      ]
    }
  ];

  return (
    <>
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-sm shrink-0 w-full relative" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="h-16 flex items-center justify-between px-4 lg:px-8 w-full">
        <div className="flex items-center gap-4 lg:gap-6 h-full">
          {/* HAMBURGER MOBILE */}
          <button 
            onClick={() => setMobileDrawerOpen(true)} 
            className="xl:hidden w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <Menu size={24} />
          </button>

          <Link href="/dashboard" className="flex items-center gap-2 shrink-0 group">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center transform group-hover:rotate-12 transition-transform shadow-lg shadow-emerald-500/20">
              <span className="text-white font-black text-lg">H</span>
            </div>
            <span className="font-black tracking-tight text-xl hidden sm:block">Héfisto</span>
          </Link>

          {/* NAVEGAÇÃO DESKTOP COM SUBMENUS */}
          <nav className="hidden xl:flex items-center h-full gap-2">
            {modules.map((mod) => {
              const isActive = pathname.startsWith(mod.href) || (mod.id === "rh" && pathname.includes("/rh"));
              const isHovered = hoveredModule === mod.id;

              return (
                <div 
                  key={mod.id} 
                  className="h-full relative flex items-center"
                  onMouseEnter={() => setHoveredModule(mod.id)}
                  onMouseLeave={() => setHoveredModule(null)}
                >
                  <Link 
                    href={mod.href} 
                    className={`h-full px-3 flex items-center gap-1 text-[13px] font-bold whitespace-nowrap rounded-lg transition-colors border-b-2 mt-[2px] ${isActive ? 'text-white border-emerald-500' : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'}`}
                  >
                    {mod.label}
                    <ChevronDown size={12} className={`opacity-50 transition-transform ${isHovered ? 'rotate-180' : ''}`} />
                  </Link>

                  {/* DROPDOWN SUBMENU */}
                  {isHovered && (
                    <div className="absolute top-full left-0 mt-0 w-64 bg-slate-900 border border-slate-800 rounded-b-2xl rounded-tr-2xl z-[100] shadow-2xl overflow-hidden py-2 animate-in fade-in slide-in-from-top-2">
                      {mod.submodules.map(sub => (
                        <Link 
                          key={sub.href} 
                          href={sub.href}
                          className="flex items-center px-4 py-2.5 text-sm font-medium text-zinc-300 hover:text-white hover:bg-slate-700 transition-colors"
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3 md:gap-4 shrink-0">
          <button onClick={onOpenSearch} className="hidden md:flex items-center gap-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors rounded-xl px-4 py-2 w-48 lg:w-80 group text-left">
            <Search size={16} className="text-slate-400 group-hover:text-emerald-400 transition-colors shrink-0" />
            <span className="text-sm font-medium text-slate-400 truncate flex-1">O que quer fazer?</span>
            <kbd className="hidden lg:inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
              <span className="text-xs">⌘</span> K
            </kbd>
          </button>

          <button onClick={onOpenSearch} className="md:hidden w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700">
            <Search size={18} />
          </button>

          <div className="w-px h-6 bg-slate-700 hidden sm:block mx-1"></div>

          
          <div className="relative" ref={notifRef}>
            <button onClick={() => setNotifOpen(!notifOpen)} className="relative w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-600 transition-all group" title="Notificações">
              <Bell size={18} className="group-hover:scale-110 transition-transform" />
              <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full"></span>
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 py-4 px-4 z-50 animate-in fade-in slide-in-from-top-2 flex flex-col items-center justify-center text-center gap-2">
                <Bell size={24} className="text-slate-300" />
                <p className="text-sm font-bold text-slate-500">Nenhuma notificação no momento</p>
              </div>
            )}
          </div>


          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 hover:bg-slate-800 p-1 pr-3 rounded-full transition-colors border border-transparent hover:border-slate-700">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold text-sm shadow-inner shrink-0">
                {sessao?.nome?.substring(0,1).toUpperCase() || <User size={16}/>}
              </div>
              
            </button>
            
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 text-slate-900">
                <div className="px-4 py-3 border-b border-slate-100 mb-2">
                  <div className="text-sm font-bold text-slate-900">{sessao?.nome}</div>
                  <div className="text-xs text-slate-500">{sessao?.email}</div>
                </div>
                <Link href="/dashboard/configuracoes" className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 font-medium">
                  <Settings size={16} className="text-slate-400"/> Configurações
                </Link>
                <button onClick={onSair} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium text-left">
                  <LogOut size={16} className="text-red-400"/> Sair do sistema
                </button>
              </div>
            )}
          </div>
        </div>
              </div>
      </header>

      {/* MOBILE MENU DRAWER */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-[100] flex xl:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileDrawerOpen(false)}></div>
          <div className="relative w-80 max-w-[80vw] h-full bg-slate-900 flex flex-col shadow-2xl animate-in slide-in-from-left">
            <div className="flex items-center justify-between p-4 border-b border-slate-800" style={{ marginTop: "env(safe-area-inset-top, 0px)" }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-black text-lg">H</span>
                </div>
                <span className="font-black tracking-tight text-xl text-white">Héfisto</span>
              </div>
              <button onClick={() => setMobileDrawerOpen(false)} className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-slate-800">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
              {modules.map((mod) => {
                const isExpanded = expandedMobileModule === mod.id;
                const isActive = pathname.startsWith(mod.href) || (mod.id === "rh" && pathname.includes("/rh"));
                
                return (
                  <div key={mod.id} className="flex flex-col">
                    <button 
                      onClick={() => setExpandedMobileModule(isExpanded ? null : mod.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl font-bold transition-colors ${isActive ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-300 hover:bg-slate-800 hover:text-white'}`}
                    >
                      {mod.label}
                      <ChevronRight size={16} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>
                    
                    {isExpanded && (
                      <div className="flex flex-col gap-1 ml-4 mt-1 border-l border-slate-700 pl-3 py-1">
                        {mod.submodules.map((sub) => (
                          <Link 
                            key={sub.href} 
                            href={sub.href}
                            className="p-2 text-sm font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                          >
                            {sub.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}