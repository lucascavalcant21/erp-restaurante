"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { lerSessao, encerrarSessao, podeAcessar } from "../lib/auth";
import { useERP } from "../context/ERPContext";
import {
  Users, Bell, ChefHat, GlassWater, BarChart, 
  Briefcase, Fingerprint, Store, Settings, LogOut, ChevronDown, Check
} from "lucide-react";

const MODULES = [
  { id: "salao",        label: "Salão (PDV)",        icon: Users,        href: "/dashboard/salao/mesas" },
  { id: "kds",          label: "KDS",                icon: Bell,         href: "/dashboard/kds" },
  { id: "cozinha",      label: "Op. Cozinha",        icon: ChefHat,      href: "/dashboard/cozinha" },
  { id: "op_salao",     label: "Op. Salão",          icon: Store,        href: "/dashboard/salao" },
  { id: "bar",          label: "Op. Bar",            icon: GlassWater,   href: "/dashboard/bar" },
  { id: "financeiro",   label: "Financeiro",         icon: BarChart,     href: "/dashboard/financeiro" },
  { id: "rh",           label: "Recursos Humanos",   icon: Briefcase,    href: "/dashboard/rh" },
  { id: "ponto",        label: "Sistema de Ponto",   icon: Fingerprint,  href: "/dashboard/ponto" },
];

function DesktopSidebar({ onSair }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[80px] bg-[#0f172a] flex-col items-center py-6 z-50 border-r border-white/5">
      <div onClick={() => router.push('/dashboard')} className="w-12 h-12 bg-orange-500 hover:bg-orange-400 transition-all rounded-[14px] flex items-center justify-center mb-6 text-white font-black text-xl cursor-pointer shadow-[0_0_20px_rgba(249,115,22,0.3)]">
        H
      </div>

      <div className="flex-1 flex flex-col w-full gap-2 px-2 overflow-y-auto custom-scrollbar">
        {MODULES.map(item => {
          const active = pathname.includes(item.href);
          return (
            <button key={item.id} onClick={() => router.push(item.href)} title={item.label}
              className={`flex flex-col items-center justify-center w-full aspect-square rounded-2xl transition-all group relative ${active ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              <item.icon size={22} className={active ? '' : 'group-hover:scale-110 transition-transform'} />
              <span className="text-[9px] font-bold uppercase mt-1.5 px-1 text-center leading-tight opacity-80">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="w-full px-2 mt-4 flex flex-col gap-2">
         <button onClick={() => router.push('/dashboard/lojas')} title="Gerenciar Lojas" className="flex flex-col items-center justify-center w-full aspect-square text-slate-400 hover:text-white hover:bg-slate-800 rounded-2xl transition-all">
           <Settings size={22} />
           <span className="text-[9px] font-bold uppercase mt-1.5 px-1 text-center leading-tight">Lojas</span>
         </button>
         <button onClick={onSair} title="Sair" className="flex flex-col items-center justify-center w-full aspect-square text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-2xl transition-all">
           <LogOut size={22} />
           <span className="text-[9px] font-bold uppercase mt-1.5 px-1 text-center leading-tight">Sair</span>
         </button>
      </div>
    </aside>
  );
}

function MobileBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  // Mostrar apenas os 4 primeiros no mobile, ou scroll horizontal
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0f172a] border-t border-slate-800 flex items-stretch overflow-x-auto custom-scrollbar" style={{height:64,paddingBottom:'env(safe-area-inset-bottom)'}}>
      {MODULES.map(item => {
        const active = pathname.includes(item.href);
        return (
          <button key={item.id} onClick={() => router.push(item.href)}
            className={`flex-none w-[20vw] flex flex-col items-center justify-center gap-1 transition-colors ${active ? 'text-orange-500' : 'text-slate-400'}`}>
            <item.icon size={20} />
            <span className="text-[9px] font-bold uppercase truncate px-1 w-full text-center">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function TopHeader({ onSair }) {
  const { unidades, unidadeAtiva, setUnidadeAtiva, podeTrocar, unidadeInfo } = useERP();
  const router = useRouter();
  const [menuLojas, setMenuLojas] = useState(false);

  return (
    <header className="h-[64px] border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-40 bg-white shadow-sm">
      <div className="flex items-center gap-4">
         {/* Seletor de Unidades (Novo Formato) */}
         <div className="relative">
           <button onClick={() => setMenuLojas(!menuLojas)} className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: unidadeInfo?.cor || '#22C55E' }}></div>
              <span className="text-sm font-black text-slate-800">{unidadeInfo?.nome || 'Selecione uma Unidade'}</span>
              {podeTrocar && <ChevronDown size={14} className="text-slate-400" />}
           </button>
           
           {menuLojas && podeTrocar && (
             <>
               <div className="fixed inset-0 z-40" onClick={() => setMenuLojas(false)}></div>
               <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 shadow-xl rounded-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                     <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Suas Lojas</span>
                     <button onClick={() => { setMenuLojas(false); router.push('/dashboard/lojas'); }} className="text-[10px] font-bold uppercase tracking-widest text-orange-500 hover:underline">Gerenciar</button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                     {unidades.map(u => (
                        <button key={u.id} onClick={() => { setUnidadeAtiva(u.id); setMenuLojas(false); }} className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0">
                           <div className="flex items-center gap-3">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: u.cor }}></div>
                              <span className="text-sm font-bold text-slate-700">{u.nome}</span>
                           </div>
                           {u.id === unidadeAtiva && <Check size={16} className="text-emerald-500" />}
                        </button>
                     ))}
                  </div>
               </div>
             </>
           )}
         </div>
      </div>
      
      <div className="flex items-center gap-4">
        <button onClick={onSair} className="md:hidden p-2 text-slate-400 hover:text-red-500 bg-slate-50 rounded-xl transition-colors">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

export default function DashboardLayout({ children }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [sessao, setSessao] = useState(null);

  useEffect(() => {
    let vivo = true;
    lerSessao().then((s) => {
      if (!vivo) return;
      if (!s) { router.replace("/login"); return; }
      setSessao(s);
    });
    return () => { vivo = false; };
  }, [router]);

  async function sair() {
    await encerrarSessao();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      <DesktopSidebar onSair={sair} />
      <MobileBottomNav />
      <div className="flex-1 flex flex-col min-h-screen md:ml-[80px] w-full overflow-x-hidden">
        <TopHeader onSair={sair} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 pb-[80px] md:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
