"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Sparkles, User, Settings, LogOut, ChevronDown, Menu, X, ChevronRight, Bell } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { hasPermission } from "../../lib/permissions-catalog.mjs";

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
  const [atalho, setAtalho] = useState("Ctrl");
  useEffect(() => { if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setAtalho("⌘"); }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  const podeInteligencia = !!sessao && (!sessao.gerenciado || hasPermission(sessao, "dashboard.intelligence.view"));
  const modules = [
    ...(podeInteligencia ? [{
      id: "inteligencia",
      label: "Inteligência",
      href: "/dashboard/inteligencia"
    }] : []),
    {
      id: "operacao",
      label: "PDV",
      href: "/dashboard/operacao/inteligente",
      submodules: [
        // é a Central Operacional (checklists/processos), não a inteligência do Héfisto
        { label: "Central operacional", href: "/dashboard/operacao/inteligente" },
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
        // Uma área só: saldo e contagem são abas dentro de Estoque.
        { label: "Estoque", href: "/dashboard/operacao/estoque" },
        { label: "Compras e Custo Médio", href: "/dashboard/operacao/estoque/compras" },
        { label: "CMV Real", href: "/dashboard/operacao/estoque/cmv" },
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
        { label: "Painel do RH", href: "/dashboard/rh" },
        { label: "Ponto e Espelho", href: "/dashboard/rh/ponto" },
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
      <header className="bg-hf-menu border-b border-hf-menu-border text-hf-menu-text sticky top-0 z-50 shadow-sm shrink-0 w-full relative print:hidden" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="h-16 flex items-center justify-between px-4 lg:px-8 w-full">
        <div className="flex items-center gap-4 lg:gap-6 h-full">
          {/* HAMBURGER MOBILE */}
          <button 
            onClick={() => setMobileDrawerOpen(true)} 
            aria-label="Abrir menu" className="xl:hidden w-11 h-11 flex items-center justify-center text-hf-menu-muted hover:text-hf-menu-text transition-colors"
          >
            <Menu size={24} />
          </button>

          <Link href="/dashboard" className="flex items-center gap-2 shrink-0 group">
            <div className="w-8 h-8 bg-hf-accent rounded-lg flex items-center justify-center transform group-hover:rotate-12 transition-transform">
              <span className="text-hf-accent-fg font-black text-lg">H</span>
            </div>
            <span className="font-black tracking-tight text-xl hidden sm:block">Héfisto</span>
          </Link>

          {/* NAVEGAÇÃO DESKTOP COM SUBMENUS */}
          <nav className="hidden xl:flex items-center h-full gap-2">
            {modules.map((mod) => {
              const isActive = pathname.startsWith(mod.href) || (mod.id === "rh" && pathname.includes("/rh"));
              const isHovered = hoveredModule === mod.id;
              // Eventos é uma tela só, sem submenu. Ler mod.submodules nele
              // derrubava o app inteiro só de passar o mouse no menu.
              const temSubmenu = mod.submodules?.length > 0;

              return (
                <div 
                  key={mod.id} 
                  className="h-full relative flex items-center"
                  onMouseEnter={() => setHoveredModule(mod.id)}
                  onMouseLeave={() => setHoveredModule(null)}
                >
                  <Link 
                    href={mod.href} 
                    aria-current={isActive ? "page" : undefined}
                    className={`h-full px-3 flex items-center gap-1 text-[13px] font-bold whitespace-nowrap transition-colors border-b-2 mt-[2px] ${isActive ? 'text-hf-menu-text border-hf-menu-accent' : 'text-hf-menu-muted border-transparent hover:text-hf-menu-text hover:bg-hf-menu-hover'}`}
                  >
                    {mod.label}
                    {temSubmenu && <ChevronDown size={12} className={`opacity-50 transition-transform ${isHovered ? 'rotate-180' : ''}`} />}
                  </Link>

                  {/* DROPDOWN SUBMENU */}
                  {isHovered && temSubmenu && (
                    <div className="absolute top-full left-0 mt-0 w-64 bg-hf-surface border border-hf-border rounded-b-2xl rounded-tr-2xl z-[100] shadow-2xl overflow-hidden py-2 animate-in fade-in slide-in-from-top-2">
                      {mod.submodules.map(sub => (
                        <Link 
                          key={sub.href} 
                          href={sub.href}
                          className="flex items-center px-4 py-2.5 text-sm font-medium text-hf-text-2 hover:text-hf-text hover:bg-hf-elevated transition-colors"
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
          <button onClick={onOpenSearch} aria-label="Abrir a Central de Comando" className="hidden md:flex items-center gap-3 bg-hf-menu-hover hover:border-hf-menu-muted border border-hf-menu-border transition-colors rounded-xl px-3.5 py-2 w-44 lg:w-60 2xl:w-80 group text-left">
            <Search size={16} className="text-hf-menu-muted group-hover:text-hf-menu-text transition-colors shrink-0" />
            <span className="text-sm font-medium text-hf-menu-muted truncate flex-1">Pesquisar ou comandar…</span>
            <kbd className="hidden lg:inline-flex items-center gap-1 text-[10px] font-bold text-hf-menu-muted bg-hf-menu px-1.5 py-0.5 rounded border border-hf-menu-border font-sans">
              {atalho} K
            </kbd>
          </button>

          <button onClick={onOpenSearch} aria-label="Abrir a Central de Comando" className="md:hidden w-11 h-11 rounded-xl bg-hf-menu-hover flex items-center justify-center text-hf-menu-text border border-hf-menu-border">
            <Search size={18} />
          </button>

          <div className="w-px h-6 bg-hf-menu-border hidden sm:block mx-1"></div>

          
          <div className="relative" ref={notifRef}>
            <button onClick={() => setNotifOpen(!notifOpen)} aria-label="Notificações" className="relative w-11 h-11 rounded-xl bg-hf-menu-hover border border-hf-menu-border flex items-center justify-center text-hf-menu-text hover:border-hf-menu-muted transition-all group" title="Notificações">
              <Bell size={18} />
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-hf-surface rounded-2xl shadow-xl shadow-black/10 border border-hf-border py-4 px-4 z-50 animate-in fade-in slide-in-from-top-2 flex flex-col items-center justify-center text-center gap-2">
                <Bell size={24} className="text-hf-muted" />
                <p className="text-sm font-bold text-hf-text-2">Nenhuma notificação no momento</p>
              </div>
            )}
          </div>


          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(!menuOpen)} aria-label="Conta" className="flex items-center gap-2 hover:bg-hf-menu-hover p-1 rounded-full transition-colors border border-transparent hover:border-hf-menu-border">
              <div className="w-8 h-8 rounded-full bg-hf-menu-accent flex items-center justify-center text-hf-menu font-bold text-sm shrink-0">
                {sessao?.nome?.substring(0,1).toUpperCase() || <User size={16}/>}
              </div>
              
            </button>
            
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-hf-surface rounded-2xl shadow-xl shadow-black/10 border border-hf-border py-2 z-50 animate-in fade-in slide-in-from-top-2 text-hf-text">
                <div className="px-4 py-3 border-b border-hf-border mb-2">
                  <div className="text-sm font-bold text-hf-text">{sessao?.nome}</div>
                  <div className="text-xs text-hf-text-2 truncate">{sessao?.email}</div>
                </div>
                <Link href="/dashboard/configuracoes" className="flex items-center gap-3 px-4 py-2 text-sm text-hf-text hover:bg-hf-elevated font-medium">
                  <Settings size={16} className="text-hf-muted"/> Configurações
                </Link>
                <button onClick={onSair} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-hf-text hover:bg-hf-elevated font-medium text-left">
                  <LogOut size={16} className="text-hf-muted"/> Sair do sistema
                </button>
              </div>
            )}
          </div>
        </div>
              </div>
      </header>

      {/* MOBILE MENU DRAWER */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-[100] flex xl:hidden print:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileDrawerOpen(false)}></div>
          <div className="relative w-80 max-w-[80vw] h-full bg-hf-menu border-r border-hf-menu-border flex flex-col shadow-2xl animate-in slide-in-from-left">
            <div className="flex items-center justify-between p-4 border-b border-hf-menu-border" style={{ marginTop: "env(safe-area-inset-top, 0px)" }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-hf-accent rounded-lg flex items-center justify-center">
                  <span className="text-hf-accent-fg font-black text-lg">H</span>
                </div>
                <span className="font-black tracking-tight text-xl text-hf-menu-text">Héfisto</span>
              </div>
              <button onClick={() => setMobileDrawerOpen(false)} aria-label="Fechar menu" className="w-11 h-11 flex items-center justify-center text-hf-menu-muted hover:text-hf-menu-text rounded-xl hover:bg-hf-menu-hover">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
              {modules.map((mod) => {
                const isExpanded = expandedMobileModule === mod.id;
                const isActive = pathname.startsWith(mod.href) || (mod.id === "rh" && pathname.includes("/rh"));
                
                // Sem submenu não há o que expandir: o botão vira o próprio
                // link. Antes ele expandia uma lista inexistente e quebrava.
                if (!(mod.submodules?.length > 0)) {
                  return (
                    <Link key={mod.id} href={mod.href}
                      className={`w-full flex items-center justify-between p-3 rounded-xl font-bold transition-colors ${isActive ? 'bg-hf-menu-hover text-hf-menu-text shadow-[inset_2px_0_0_rgb(var(--hf-menu-accent))]' : 'text-hf-menu-muted hover:bg-hf-menu-hover hover:text-hf-menu-text'}`}>
                      {mod.label}
                    </Link>
                  );
                }

                return (
                  <div key={mod.id} className="flex flex-col">
                    <button 
                      onClick={() => setExpandedMobileModule(isExpanded ? null : mod.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl font-bold transition-colors ${isActive ? 'bg-hf-menu-hover text-hf-menu-text shadow-[inset_2px_0_0_rgb(var(--hf-menu-accent))]' : 'text-hf-menu-muted hover:bg-hf-menu-hover hover:text-hf-menu-text'}`}
                    >
                      {mod.label}
                      <ChevronRight size={16} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>
                    
                    {isExpanded && (
                      <div className="flex flex-col gap-1 ml-4 mt-1 border-l border-hf-menu-border pl-3 py-1">
                        {mod.submodules.map((sub) => (
                          <Link 
                            key={sub.href} 
                            href={sub.href}
                            className="p-2 text-sm font-medium text-hf-menu-muted hover:text-hf-menu-text rounded-lg hover:bg-hf-menu-hover"
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