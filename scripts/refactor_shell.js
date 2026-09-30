const fs = require('fs');

// 1. GLOBALS.CSS
const cssTokens = `
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --surface: #F7F8F7;
  --panel: #FFFFFF;
  --card: #FFFFFF;
  --header-bg: #071521;
  --header-hover: #0B1926;
  --header-border: #0D1D2B;
  --border: #E5E9EE;
  --border-light: #F1F5F9;
  --fg: #102031;
  --fg-muted: #66758A;
  --fg-inverse: #FFFFFF;
  --primary: #059669;
  --primary-hover: #047857;
  --primary-light: #D1FAE5;
  --success: #10B981;
  --warning: #F59E0B;
  --danger: #EF4444;
  --info: #3B82F6;
  --font-sans: 'Inter', sans-serif;
}

body {
  background-color: var(--surface);
  color: var(--fg);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

/* Utilities for cards, inputs, and buttons */
.card-premium {
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 4px 20px -4px rgba(16, 32, 49, 0.04);
}
.input-premium {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  color: var(--fg);
  font-size: 0.875rem;
  outline: none;
  transition: all 0.2s ease;
}
.input-premium:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}
.btn-primary {
  background-color: var(--primary);
  color: white;
  font-weight: 600;
  border-radius: 12px;
  padding: 0.75rem 1.5rem;
  transition: all 0.2s ease;
}
.btn-primary:hover {
  background-color: var(--primary-hover);
}
.btn-secondary {
  background-color: var(--card);
  border: 1px solid var(--border);
  color: var(--fg);
  font-weight: 600;
  border-radius: 12px;
  padding: 0.75rem 1.5rem;
  transition: all 0.2s ease;
}
.btn-secondary:hover {
  background-color: var(--surface);
}

.custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
`;

fs.writeFileSync('app/globals.css', cssTokens, 'utf-8');

// 2. TOP NAVIGATION
const topNavContent = `"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Sparkles, User, Settings, LogOut, ChevronDown, Menu } from "lucide-react";
import { useState } from "react";

export default function TopNavigation({ sessao, onSair, onOpenSearch }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { label: "Operação", href: "/dashboard/operacao/inteligente" },
    { label: "Cardápio & Produção", href: "/dashboard/operacao/fichas" },
    { label: "Estoque & Compras", href: "/dashboard/operacao/estoque" },
    { label: "Vendas & CRM", href: "/dashboard/reservas-eventos/reservas" },
    { label: "Eventos & Reservas", href: "/dashboard/reservas-eventos/eventos" },
    { label: "RH", href: "/dashboard/rh" },
    { label: "Financeiro", href: "/dashboard/financeiro" },
    { label: "Relatórios", href: "/dashboard/relatorios" },
  ];

  return (
    <header className="bg-[#071521] border-b border-[#0D1D2B] text-white sticky top-0 z-50 shadow-sm h-16 flex items-center justify-between px-4 lg:px-8 shrink-0 w-full">
      <div className="flex items-center gap-8 h-full">
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0 group">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center transform group-hover:rotate-12 transition-transform shadow-lg shadow-emerald-500/20">
            <span className="text-white font-black text-lg">H</span>
          </div>
          <span className="font-black tracking-tight text-xl hidden sm:block">Héfisto</span>
        </Link>
        <nav className="hidden xl:flex items-center h-full gap-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={\`h-full px-3 flex items-center text-[13px] font-bold rounded-lg transition-colors border-b-2 mt-[2px] \${isActive ? 'text-white border-emerald-500' : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'}\`}>
                {item.label}
              </Link>
            );
          })}
          <div className="h-full px-3 flex items-center text-[13px] font-bold text-slate-400 hover:text-white hover:bg-white/5 rounded-lg cursor-pointer transition-colors border-b-2 border-transparent mt-[2px]">
            Mais <ChevronDown size={14} className="ml-1 opacity-70" />
          </div>
        </nav>
      </div>
      <div className="flex items-center gap-3 md:gap-4 shrink-0">
        <button onClick={onOpenSearch} className="hidden md:flex items-center gap-3 bg-[#0B1926] hover:bg-[#102031] border border-[#102031] transition-colors rounded-xl px-4 py-2 w-64 lg:w-80 group text-left">
          <Search size={16} className="text-slate-400 group-hover:text-emerald-400 transition-colors shrink-0" />
          <span className="text-sm font-medium text-slate-400 truncate flex-1">O que você quer fazer agora?</span>
          <kbd className="hidden lg:inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-[#071521] px-1.5 py-0.5 rounded border border-[#102031]">
            <span className="text-xs">⌘</span> K
          </kbd>
        </button>
        <button onClick={onOpenSearch} className="md:hidden w-10 h-10 rounded-xl bg-[#0B1926] flex items-center justify-center text-slate-400">
          <Search size={18} />
        </button>
        <div className="w-px h-6 bg-[#102031] hidden sm:block mx-1"></div>
        <button className="relative w-10 h-10 rounded-xl bg-[#0B1926] border border-[#102031] flex items-center justify-center text-emerald-400 hover:bg-[#102031] hover:border-emerald-500/30 transition-all group" title="Héfisto Copiloto">
          <Sparkles size={18} className="group-hover:scale-110 transition-transform" />
          <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 border-2 border-[#071521] rounded-full"></span>
        </button>
        <div className="relative">
          <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 hover:bg-[#0B1926] p-1 pr-3 rounded-full transition-colors border border-transparent hover:border-[#102031]">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold text-sm shadow-inner shrink-0">
              {sessao?.nome?.substring(0,2).toUpperCase() || <User size={16}/>}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-white truncate max-w-[120px]">{sessao?.nome || "Administrador"}</div>
              <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{sessao?.cargo || "Gestão"}</div>
            </div>
            <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
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
    </header>
  );
}`;

if (!fs.existsSync('app/components/layout')) {
  fs.mkdirSync('app/components/layout', { recursive: true });
}
fs.writeFileSync('app/components/layout/TopNavigation.js', topNavContent, 'utf-8');

// 3. REWRITE LAYOUT.JS COMPLETELY TO REMOVE MASSIVE SIDEBAR LOGIC
const layoutContent = `"use client";
import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { lerSessao, encerrarSessao } from "../lib/auth";
import { canAccessRoute, permittedRoutes } from "../lib/permissions-catalog.mjs";
import { HefistoPageContextProvider } from "../context/HefistoPageContext";
import TopNavigation from "../components/layout/TopNavigation";
import { Loader2 } from "lucide-react";
import CommandCenterModal from "../components/navigation/CommandCenterModal";

function ProtecaoPermissao({ sessao, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const permitido = !sessao?.gerenciado || canAccessRoute(sessao, pathname, search);

  useEffect(() => {
    if (!sessao?.gerenciado || permitido) return;
    const fallback = permittedRoutes(sessao)?.[0] || "/login";
    router.replace(fallback);
  }, [permitido, pathname, router, sessao]);

  if (!sessao || !permitido) {
    return <div className="min-h-[40vh] flex items-center justify-center px-4 text-sm font-bold text-slate-500"><Loader2 className="animate-spin text-emerald-600 mr-2" />Carregando área segura...</div>;
  }
  return children;
}

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sessao, setSessao] = useState(null);
  const sessaoRef = useRef(null);
  const [commandCenterOpen, setCommandCenterOpen] = useState(false);

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
    let vivo = true;
    lerSessao().then((s) => {
      if (!vivo) return;
      if (s) {
        sessaoRef.current = s; setSessao(s);
        return;
      }
      if (!sessaoRef.current) router.replace("/login");
    });
    return () => { vivo = false; };
  }, [pathname, router]);

  async function sair() {
    sessaoRef.current = null;
    try {
      localStorage.removeItem("hefisto_acesso");
      localStorage.removeItem("erp_cred");
      localStorage.setItem("erp_lembrar", "0");
    } catch (_) {}
    await encerrarSessao();
    router.replace("/login");
  }

  const interfaceTelaCheia = pathname === "/dashboard/operacao/estoque/tablet" || pathname === "/dashboard/operacao/etiquetas/tablet" || pathname.startsWith("/dashboard/rh/ponto");

  if (interfaceTelaCheia) {
    return (
      <div className="fixed inset-0 z-[200] overflow-hidden bg-slate-50" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <Suspense fallback={<div className="grid h-screen place-items-center"><Loader2 className="animate-spin text-emerald-600" /></div>}>
          <ProtecaoPermissao sessao={sessao}>
            {children}
          </ProtecaoPermissao>
        </Suspense>
      </div>
    );
  }

  return (
    <HefistoPageContextProvider activeUnitId="matriz" userSession={sessao}>
      <div className="erp-app-shell flex flex-col h-screen h-[100dvh] min-h-0 bg-[#F7F8F7] overflow-hidden print:bg-card print:block print:h-auto print:min-h-0 font-sans">
        
        <TopNavigation sessao={sessao} onSair={sair} onOpenSearch={() => setCommandCenterOpen(true)} />

        <main className="flex-1 w-full max-w-[1920px] mx-auto overflow-y-auto overflow-x-hidden custom-scrollbar relative print:overflow-visible print:block bg-[#F7F8F7]">
          <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center px-4 text-sm font-bold text-slate-500"><Loader2 className="animate-spin text-emerald-600 mr-2" />Carregando módulo...</div>}>
            <ProtecaoPermissao sessao={sessao}>
              {children}
            </ProtecaoPermissao>
          </Suspense>
        </main>

        <CommandCenterModal isOpen={commandCenterOpen} onClose={() => setCommandCenterOpen(false)} sessao={sessao} />
        
      </div>
    </HefistoPageContextProvider>
  );
}`;

fs.writeFileSync('app/dashboard/layout.js', layoutContent, 'utf-8');

console.log("Global setup done!");
