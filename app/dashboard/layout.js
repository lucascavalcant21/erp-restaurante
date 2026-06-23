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
  { id: "salao",        label: "Salão",              icon: Users,        href: "/dashboard/salao/mesas" },
  { id: "kds",          label: "KDS",                icon: Bell,         href: "/dashboard/kds" },
  { id: "cozinha",      label: "Op. Cozinha",        icon: ChefHat,      href: "/dashboard/cozinha" },
  { id: "op_salao",     label: "Op. Salão",          icon: Store,        href: "/dashboard/salao" },
  { id: "bar",          label: "Op. Bar",            icon: GlassWater,   href: "/dashboard/bar" },
  { id: "financeiro",   label: "Financeiro",         icon: BarChart,     href: "/dashboard/financeiro" },
  { id: "rh",           label: "RH",                 icon: Briefcase,    href: "/dashboard/rh" },
  { id: "ponto",        label: "Sistema de Ponto",   icon: Fingerprint,  href: "/dashboard/ponto" },
];

function DesktopSidebar({ onSair }) {
  const router = useRouter();
  const pathname = usePathname();
  const { unidadeInfo } = useERP();
  
  const bgColor = unidadeInfo?.cor || "#0A1128";

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[80px] flex-col items-center py-6 z-50 border-r border-slate-800 shadow-2xl overflow-hidden transition-colors duration-500" style={{ backgroundColor: bgColor }}>
      
      {/* Overlay escuro para garantir que os ícones brancos fiquem legíveis independente da cor */}
      <div className="absolute inset-0 bg-black/30 pointer-events-none"></div>
      
      <div className="relative z-10 flex flex-col items-center w-full h-full">
        <div className="flex flex-col items-center w-full mb-6 cursor-pointer" onClick={() => router.push('/dashboard')}>
          <div className="w-12 h-12 bg-white/20 hover:bg-white/30 backdrop-blur-md transition-all rounded-[14px] flex items-center justify-center text-white font-black text-xl shadow-lg hover:-translate-y-1">
            {unidadeInfo?.nome ? unidadeInfo.nome.charAt(0).toUpperCase() : 'ERP'}
          </div>
          <span className="text-[8px] font-black uppercase text-white/80 text-center w-full truncate px-1 mt-2 tracking-widest" title={unidadeInfo?.nome}>
            {unidadeInfo?.nome || 'Matriz'}
          </span>
        </div>

        <div className="flex-1 flex flex-col w-full gap-2 px-2 overflow-y-auto custom-scrollbar">
          {MODULES.map(item => {
            const active = pathname.includes(item.href);
            return (
              <button key={item.id} onClick={() => router.push(item.href)} title={item.label}
                className={`flex flex-col items-center justify-center w-full aspect-square rounded-2xl transition-all duration-300 group relative ${active ? 'bg-white/20 text-white shadow-lg shadow-black/20 -translate-y-1' : 'text-white/60 hover:text-white hover:bg-white/10 hover:-translate-y-1'}`}>
                <item.icon size={22} className={active ? '' : 'group-hover:scale-110 transition-transform'} />
                <span className="text-[9px] font-bold uppercase mt-1.5 px-1 text-center leading-tight opacity-80">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="w-full px-2 mt-4 flex flex-col gap-2">
           <button onClick={() => router.push('/dashboard/lojas')} title="Gerenciar Lojas" className="flex flex-col items-center justify-center w-full aspect-square text-white/60 hover:text-white hover:bg-white/10 rounded-2xl transition-all duration-300 hover:-translate-y-1">
             <Settings size={22} />
             <span className="text-[9px] font-bold uppercase mt-1.5 px-1 text-center leading-tight">Lojas</span>
           </button>
           <button onClick={onSair} title="Sair" className="flex flex-col items-center justify-center w-full aspect-square text-white/60 hover:text-white hover:bg-white/10 rounded-2xl transition-all duration-300 hover:-translate-y-1">
             <LogOut size={22} />
             <span className="text-[9px] font-bold uppercase mt-1.5 px-1 text-center leading-tight">Sair</span>
           </button>
        </div>
      </div>
    </aside>
  );
}

function MobileBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  // Mostrar apenas os 4 primeiros no mobile, ou scroll horizontal
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0A1128] border-t border-slate-800 flex items-stretch overflow-x-auto custom-scrollbar shadow-[0_-10px_30px_rgba(0,0,0,0.1)]" style={{height:64,paddingBottom:'env(safe-area-inset-bottom)'}}>
      {MODULES.map(item => {
        const active = pathname.includes(item.href);
        return (
          <button key={item.id} onClick={() => router.push(item.href)}
            className={`flex-none w-[20vw] flex flex-col items-center justify-center gap-1 transition-all duration-300 ${active ? 'text-emerald-500 scale-105' : 'text-slate-400 hover:text-slate-200'}`}>
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
    <header className="h-[72px] border-b border-slate-200/60 flex items-center justify-between px-6 sticky top-0 z-40 bg-white/80 backdrop-blur-md shadow-sm transition-all">
      <div className="flex items-center gap-4">
         {/* Seletor de Unidades (Novo Formato) */}
         <div className="relative">
           <button onClick={() => setMenuLojas(!menuLojas)} className="flex items-center gap-2.5 bg-white border border-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5">
              <div className="w-3 h-3 rounded-full shadow-inner" style={{ background: unidadeInfo?.cor || '#059669' }}></div>
              <span className="text-sm font-black text-slate-800">{unidadeInfo?.nome || 'Selecione uma Unidade'}</span>
              {podeTrocar && <ChevronDown size={14} className="text-slate-400" />}
           </button>
           
           {menuLojas && podeTrocar && (
             <>
               <div className="fixed inset-0 z-40" onClick={() => setMenuLojas(false)}></div>
               <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 shadow-[0_20px_40px_rgba(0,0,0,0.1)] rounded-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                     <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Suas Lojas</span>
                     <button onClick={() => { setMenuLojas(false); router.push('/dashboard/lojas'); }} className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-800 hover:underline transition-colors">Gerenciar</button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                     {unidades.map(u => (
                        <button key={u.id} onClick={() => { setUnidadeAtiva(u.id); setMenuLojas(false); }} className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0 group">
                           <div className="flex items-center gap-3">
                              <div className="w-2.5 h-2.5 rounded-full shadow-inner group-hover:scale-110 transition-transform" style={{ background: u.cor }}></div>
                              <span className="text-sm font-bold text-slate-700">{u.nome}</span>
                           </div>
                           {u.id === unidadeAtiva && <Check size={16} className="text-emerald-600" />}
                        </button>
                     ))}
                  </div>
               </div>
             </>
           )}
         </div>
      </div>
      
      <div className="flex items-center gap-4">
        <button onClick={onSair} className="md:hidden p-2 text-slate-400 hover:text-slate-600 bg-white border border-slate-200 shadow-sm rounded-xl transition-all hover:shadow-md hover:-translate-y-0.5">
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
    <div className="flex min-h-screen bg-[#F8FAFC] print:block print:bg-white print:min-h-0">
      <div className="print:hidden"><DesktopSidebar onSair={sair} /></div>
      <div className="print:hidden"><MobileBottomNav /></div>
      <div className="flex-1 flex flex-col min-h-screen md:ml-[80px] w-full overflow-x-hidden print:ml-0 print:overflow-visible print:block print:min-h-0">
        <div className="print:hidden"><TopHeader onSair={sair} /></div>
        <main key={pathname} className="flex-1 pb-[80px] md:pb-8 animate-page-in print:pb-0 print:m-0">
          {children}
        </main>
      </div>
    </div>
  );
}
