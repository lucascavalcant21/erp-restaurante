"use client";

import { useERP } from "../../context/ERPContext";
import { useEffect, useState } from "react";
import { Calendar, Users, DollarSign, Activity, AlertTriangle, TrendingUp } from "lucide-react";
import Image from "next/image";

export default function Dashboard() {
  const erp = useERP();
  const [dataLocal, setDataLocal] = useState("");

  useEffect(() => {
    setDataLocal(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  }, []);

  return (
    <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-500">
      
      {/* HEADER HERO AREA */}
      <div className="relative rounded-b-[2.5rem] bg-slate-900 overflow-hidden shadow-2xl">
        <div className="absolute inset-0 opacity-40 mix-blend-overlay">
          {/* Usar imagem gastronômica conforme referência (comida real) */}
          <img 
            src="https://images.unsplash.com/photo-1544025162-8111142154ea?q=80&w=2500&auto=format&fit=crop" 
            alt="Gastronomia" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent"></div>
        </div>

        <div className="relative z-10 p-12 lg:p-16 flex flex-col lg:flex-row items-end justify-between gap-8">
          <div>
            <p className="text-emerald-400 font-bold mb-2 text-sm tracking-widest uppercase">Boa noite, Lucas</p>
            <h1 className="text-5xl font-black text-white tracking-tighter mb-4">Seldeestrela</h1>
            <p className="text-slate-300 font-medium">{dataLocal}</p>
          </div>
          <div className="text-right hidden lg:block">
            <h3 className="text-2xl font-black text-white">Cozinha amazônica.</h3>
            <p className="text-emerald-400 text-sm">Sabores que conectam pessoas.</p>
          </div>
        </div>

        {/* KPIs LAYERED OVER HERO */}
        <div className="relative z-10 px-8 lg:px-12 pb-12">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            
            <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100 flex flex-col justify-between">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <DollarSign size={16} />
                </div>
                <span className="text-xs font-bold text-slate-500 uppercase">Faturamento hoje</span>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">R$ 8.542,00</div>
                <div className="text-xs font-bold text-emerald-600 mt-1 flex items-center gap-1"><TrendingUp size={12}/> +12% vs ontem</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100 flex flex-col justify-between">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Activity size={16} />
                </div>
                <span className="text-xs font-bold text-slate-500 uppercase">CMV hoje</span>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">R$ 2.134,00</div>
                <div className="text-xs font-bold text-emerald-600 mt-1">24,9% (Ideal)</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100 flex flex-col justify-between">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <Calendar size={16} />
                </div>
                <span className="text-xs font-bold text-slate-500 uppercase">Reservas hoje</span>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">28</div>
                <div className="text-xs font-bold text-emerald-600 mt-1 flex items-center gap-1"><TrendingUp size={12}/> +4 vs meta</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100 flex flex-col justify-between">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <Users size={16} />
                </div>
                <span className="text-xs font-bold text-slate-500 uppercase">Eventos</span>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">2</div>
                <div className="text-xs font-bold text-slate-500 mt-1">1 em andamento</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100 flex flex-col justify-between">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="8" width="18" height="8" rx="2"/><path d="M12 8v8"/><path d="M8 8v8"/><path d="M16 8v8"/></svg>
                </div>
                <span className="text-xs font-bold text-slate-500 uppercase">Mesas</span>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">18 / 32</div>
                <div className="text-xs font-bold text-slate-500 mt-1">56% de ocupação</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-lg border border-red-100 flex flex-col justify-between">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <AlertTriangle size={16} />
                </div>
                <span className="text-xs font-bold text-red-600 uppercase">Estoque crítico</span>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">7 itens</div>
                <button className="text-xs font-bold text-slate-500 hover:text-slate-900 mt-1 underline">Ver itens →</button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* DASHBOARD CHARTS & TABLES */}
      <div className="px-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* CHART MOCK 1 */}
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200 lg:col-span-1">
          <h3 className="text-lg font-black text-slate-900 mb-6">Faturamento (últimos 7 dias)</h3>
          <div className="h-64 flex items-end gap-2 border-b border-slate-100 pb-2">
            {/* Mock bars */}
            {[40, 60, 30, 80, 100, 50, 70].map((h, i) => (
              <div key={i} className="flex-1 bg-emerald-100 rounded-t-lg relative group">
                <div className="absolute bottom-0 w-full bg-emerald-500 rounded-t-lg transition-all duration-500" style={{ height: `${h}%` }}></div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2">
            <span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sab</span><span>Dom</span>
          </div>
        </div>

        {/* MOCK CHART 2 */}
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200 lg:col-span-1">
          <h3 className="text-lg font-black text-slate-900 mb-6">Vendas por categoria</h3>
          <div className="flex items-center justify-center h-48">
            <div className="w-40 h-40 rounded-full border-[16px] border-emerald-500 border-r-indigo-500 border-b-amber-500 border-l-rose-500 flex items-center justify-center">
              <div className="text-center">
                <div className="text-xs font-bold text-slate-400">Total</div>
                <div className="text-lg font-black text-slate-900">R$ 8.542</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Pratos Principais</div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Bebidas</div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Entradas</div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600"><div className="w-2 h-2 rounded-full bg-rose-500"></div> Sobremesas</div>
          </div>
        </div>

        {/* MOCK PROXIMOS EVENTOS */}
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200 lg:col-span-1">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-black text-slate-900">Próximos eventos</h3>
            <button className="text-xs font-bold text-slate-500 hover:text-slate-900">Ver todos →</button>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-400 shrink-0">07/11</div>
                <div>
                  <strong className="block text-slate-900 text-sm">Casamento Seldeestrela</strong>
                  <span className="text-xs text-slate-500 font-medium">20 convidados</span>
                </div>
              </div>
              <span className="bg-amber-50 text-amber-600 font-bold text-[10px] px-2 py-1 rounded-lg uppercase tracking-widest">Negociação</span>
            </div>
            
            <div className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-400 shrink-0">14/11</div>
                <div>
                  <strong className="block text-slate-900 text-sm">Jantar Corporativo</strong>
                  <span className="text-xs text-slate-500 font-medium">60 convidados</span>
                </div>
              </div>
              <span className="bg-emerald-50 text-emerald-600 font-bold text-[10px] px-2 py-1 rounded-lg uppercase tracking-widest">Confirmado</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
