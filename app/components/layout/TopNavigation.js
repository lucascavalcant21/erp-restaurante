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
  // Menu reorganizado (pedido do dono, 29/10/2026): cada área com o que é
  // dela e nomes curtos, para caber inteiro na tela. Financeiro, Eventos e
  // Marmitaria têm a própria barra de áreas, então não têm submenu aqui.
  const modules = [
    ...(podeInteligencia ? [{ id: "inteligencia", label: "Inteligência", href: "/dashboard/inteligencia" }] : []),
    {
      id: "vendas", label: "Vendas", href: "/dashboard/vendas",
      submodules: [
        { label: "PDV e vendas", href: "/dashboard/vendas" },
        { label: "Mesas e salão", href: "/dashboard/salao/mesas" },
        { label: "Pedidos online", href: "/dashboard/salao/online" },
        { label: "Delivery", href: "/dashboard/delivery" },
        { label: "Tela da cozinha (KDS)", href: "/dashboard/cozinha/kds" },
        { label: "Clientes", href: "/dashboard/clientes" },
      ],
    },
    {
      id: "cozinha", label: "Cozinha", href: "/dashboard/cozinha",
      submodules: [
        { label: "Painel da cozinha", href: "/dashboard/cozinha" },
        { label: "Fichas técnicas", href: "/dashboard/operacao/fichas" },
        { label: "Produção do dia", href: "/dashboard/operacao/producao" },
        { label: "Guia de montagem", href: "/dashboard/operacao/montagem?dept=cozinha" },
        { label: "Etiquetas", href: "/dashboard/operacao/etiquetas" },
        { label: "Validades", href: "/dashboard/operacao/validade" },
        { label: "Green Dot Assist (tablet)", href: "/dashboard/assistente" },
      ],
    },
    {
      id: "estoque", label: "Estoque", href: "/dashboard/operacao/estoque",
      submodules: [
        { label: "Estoque", href: "/dashboard/operacao/estoque" },
        { label: "Produtos e ingredientes", href: "/dashboard/operacao/ingredientes" },
        { label: "Compras e custo médio", href: "/dashboard/operacao/estoque/compras" },
        { label: "Cotações e pedidos", href: "/dashboard/operacao/compras" },
        { label: "Entrada de notas", href: "/dashboard/operacao/notas" },
        { label: "Fornecedores", href: "/dashboard/operacao/fornecedores" },
        { label: "CMV real", href: "/dashboard/operacao/estoque/cmv" },
        { label: "Embalagens", href: "/dashboard/operacao/materiais/embalagens" },
      ],
    },
    {
      id: "cardapio", label: "Cardápio", href: "/dashboard/operacao/cardapio",
      submodules: [
        { label: "Cardápio digital", href: "/dashboard/operacao/cardapio" },
        { label: "Produtos e canais", href: "/dashboard/operacao/cardapio/produtos" },
        { label: "Promoções e descontos", href: "/dashboard/operacao/cardapio/promocoes" },
        { label: "Fidelidade e selos", href: "/dashboard/operacao/cardapio/fidelidade" },
        { label: "Engenharia de cardápio", href: "/dashboard/operacao/engenharia" },
        { label: "Campanhas", href: "/dashboard/experience/campanhas" },
        { label: "Experiência do cliente", href: "/dashboard/experience/intelligence" },
      ],
    },
    {
      id: "operacao", label: "Operação", href: "/dashboard/operacao/inteligente",
      submodules: [
        { label: "Central operacional", href: "/dashboard/operacao/inteligente" },
        { label: "Controles e checklists", href: "/dashboard/operacao/controles" },
        { label: "Limpeza", href: "/dashboard/operacao/limpeza" },
        { label: "Produtos de limpeza", href: "/dashboard/operacao/materiais/limpeza" },
        { label: "Máquina de lavar", href: "/dashboard/operacao/materiais/maquina" },
        { label: "Manutenção", href: "/dashboard/operacao/manutencao" },
      ],
    },
    { id: "eventos", label: "Eventos", href: "/dashboard/reservas-eventos" },
    { id: "marmitaria", label: "Marmitaria", href: "/dashboard/marmitaria" },
    {
      id: "rh", label: "Equipe", href: "/dashboard/rh",
      submodules: [
        { label: "Painel da equipe", href: "/dashboard/rh" },
        { label: "Ponto e espelho", href: "/dashboard/rh/ponto" },
        { label: "Extras e banco de horas", href: "/dashboard/rh/extra" },
        { label: "Janta dos funcionários", href: "/dashboard/rh/cardapio-funcionarios" },
        { label: "Treinamentos", href: "/dashboard/treinamentos" },
      ],
    },
    { id: "financeiro", label: "Financeiro", href: "/dashboard/financeiro" },
  ];

  // A área ativa é a do link mais específico que casa com a tela (o KDS fica
  // em /cozinha/kds mas é de Vendas; Compras do estoque não é Cotações).
  const rotaDe = (href) => href.split("?")[0];
  const casa = (href) => pathname === rotaDe(href) || pathname.startsWith(`${rotaDe(href)}/`);
  const ativoId = (() => {
    let melhor = null; let tam = -1;
    for (const m of modules) for (const h of [m.href, ...(m.submodules || []).map((x) => x.href)]) {
      if (casa(h) && rotaDe(h).length > tam) { melhor = m.id; tam = rotaDe(h).length; }
    }
    return melhor;
  })();

  // Filtra módulos caso seja um App dedicado com rotas restritas
  const modulosVisiveis = modules
    .filter((mod) => {
      if (!sessao?.is_app) return true;
      const rotas = sessao.allowed_routes || [];
      const rotaMod = mod.href.split("?")[0];
      const matchMod = rotas.some((r) => r.split("?")[0] === rotaMod || r.startsWith(rotaMod));
      const submodulesValidos = (mod.submodules || []).filter((sub) => {
        const rSub = sub.href.split("?")[0];
        return rotas.some((r) => r.split("?")[0] === rSub || r.startsWith(rSub));
      });
      return matchMod || submodulesValidos.length > 0;
    })
    .map((mod) => {
      if (!sessao?.is_app || !mod.submodules) return mod;
      const rotas = sessao.allowed_routes || [];
      return {
        ...mod,
        submodules: mod.submodules.filter((sub) => {
          const rSub = sub.href.split("?")[0];
          return rotas.some((r) => r.split("?")[0] === rSub || r.startsWith(rSub));
        }),
      };
    });

  return (
    <>
      <header className="bg-hf-menu border-b border-hf-menu-border text-hf-menu-text sticky top-0 z-50 shadow-sm shrink-0 w-full relative print:hidden" style={{ paddingTop: "var(--erp-safe-top)" }}>
        <div className="h-14 flex items-center justify-between gap-3 px-4 lg:px-6 w-full">
        <div className="flex items-center gap-4 lg:gap-5 h-full min-w-0">
          {/* HAMBURGER MOBILE */}
          <button 
            onClick={() => setMobileDrawerOpen(true)} 
            aria-label="Abrir menu" className="xl:hidden w-11 h-11 flex items-center justify-center text-hf-menu-muted hover:text-hf-menu-text transition-colors"
          >
            <Menu size={24} />
          </button>

          <Link href={sessao?.is_app ? (sessao.pagina_inicial || "/dashboard") : "/dashboard"} className="flex items-center gap-2 shrink-0 group">
            <div className="w-8 h-8 bg-hf-accent rounded-lg flex items-center justify-center transform group-hover:rotate-12 transition-transform">
              <span className="text-hf-accent-fg font-black text-lg">H</span>
            </div>
            <span className="font-black tracking-tight text-xl hidden sm:block xl:hidden 2xl:block">Héfisto</span>
          </Link>

          {/* BADGE DE APP DEDICADO / ESTAÇÃO */}
          {sessao?.is_app && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {sessao.app_nome || `App ${sessao.login}`}
            </div>
          )}

          {/* NAVEGAÇÃO DESKTOP COM SUBMENUS */}
          <nav className="hidden xl:flex items-center h-full gap-0.5">
            {modulosVisiveis.map((mod) => {
              const isActive = ativoId === mod.id;
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
                    className={`h-full px-2.5 2xl:px-3 flex items-center gap-1 text-[13px] font-bold whitespace-nowrap transition-colors border-b-2 mt-[2px] ${isActive ? 'text-hf-menu-accent border-hf-menu-accent' : 'text-hf-menu-muted border-transparent hover:text-hf-menu-text hover:bg-hf-menu-hover'}`}
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

        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <button onClick={onOpenSearch} aria-label="Abrir a Central de Comando" className="hidden md:flex xl:hidden 2xl:flex items-center gap-3 bg-hf-menu-hover hover:border-hf-menu-muted border border-hf-menu-border transition-colors rounded-xl px-3.5 py-2 w-44 lg:w-60 2xl:w-72 group text-left">
            <Search size={16} className="text-hf-menu-muted group-hover:text-hf-menu-text transition-colors shrink-0" />
            <span className="text-sm font-medium text-hf-menu-muted truncate flex-1">Pesquisar ou comandar…</span>
            <kbd className="hidden lg:inline-flex items-center gap-1 text-[10px] font-bold text-hf-menu-muted bg-hf-menu px-1.5 py-0.5 rounded border border-hf-menu-border font-sans">
              {atalho} K
            </kbd>
          </button>

          <button onClick={onOpenSearch} aria-label="Abrir a Central de Comando" className="md:hidden xl:flex 2xl:hidden w-11 h-11 rounded-xl bg-hf-menu-hover flex items-center justify-center text-hf-menu-text border border-hf-menu-border">
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
              <div className="absolute right-0 top-full mt-2 w-60 bg-hf-surface rounded-2xl shadow-xl shadow-black/10 border border-hf-border py-2 z-50 animate-in fade-in slide-in-from-top-2 text-hf-text">
                <div className="px-4 py-3 border-b border-hf-border mb-2">
                  <div className="text-sm font-black text-hf-text flex items-center gap-2">
                    {sessao?.is_app && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />}
                    {sessao?.app_nome || sessao?.nome}
                  </div>
                  <div className="text-xs text-hf-text-2 truncate font-semibold">
                    {sessao?.is_app ? `Login: @${sessao.login}` : sessao?.email}
                  </div>
                  {sessao?.is_app && (
                    <div className="text-[10px] text-emerald-600 font-extrabold mt-1 uppercase tracking-wider">
                      App Dedicado da Loja
                    </div>
                  )}
                </div>

                {!sessao?.is_app ? (
                  <>
                    <Link href="/dashboard/configuracoes/apps" className="flex items-center gap-3 px-4 py-2 text-sm text-hf-text hover:bg-hf-elevated font-medium">
                      <span className="text-base">📱</span> Apps &amp; Terminais
                    </Link>
                    <Link href="/dashboard/configuracoes" className="flex items-center gap-3 px-4 py-2 text-sm text-hf-text hover:bg-hf-elevated font-medium">
                      <Settings size={16} className="text-hf-muted"/> Configurações
                    </Link>
                    <button onClick={onSair} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-hf-text hover:bg-hf-elevated font-medium text-left">
                      <LogOut size={16} className="text-hf-muted"/> Sair do sistema
                    </button>
                  </>
                ) : (
                  <button onClick={onSair} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 font-bold text-left transition-colors">
                    <LogOut size={16} className="text-rose-500"/> Sair do App / Trocar
                  </button>
                )}
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
            <div className="flex items-center justify-between px-4 pb-4 border-b border-hf-menu-border" style={{ paddingTop: "calc(var(--erp-safe-top) + 0.75rem)" }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-hf-accent rounded-lg flex items-center justify-center">
                  <span className="text-hf-accent-fg font-black text-lg">H</span>
                </div>
                <span className="font-black tracking-tight text-xl text-hf-menu-text">Héfisto</span>
                {sessao?.is_app && (
                  <span className="text-3xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold uppercase">
                    App
                  </span>
                )}
              </div>
              <button onClick={() => setMobileDrawerOpen(false)} aria-label="Fechar menu" className="w-11 h-11 flex items-center justify-center text-hf-menu-muted hover:text-hf-menu-text rounded-xl hover:bg-hf-menu-hover">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
              {modulosVisiveis.map((mod) => {
                const isExpanded = expandedMobileModule === mod.id;
                const isActive = ativoId === mod.id;
                
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