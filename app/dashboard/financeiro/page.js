"use client";

import { useRouter } from "next/navigation";
import { 
  BarChart, PieChart, TrendingDown, DollarSign, 
  Wallet, Sparkles, ClipboardList, Megaphone 
} from "lucide-react";

export default function FinanceiroHubPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen font-sans pb-24 text-slate-800">
      
      {/* HEADER */}
      <div className="pt-6 pb-8 px-6 max-w-6xl mx-auto flex items-center gap-4">
         <div className="w-16 h-16 rounded-3xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner">
            <BarChart size={32} />
         </div>
         <div>
            <h1 className="text-4xl font-black tracking-tighter text-slate-900">Financeiro</h1>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">Gestão de Custos e Resultados</p>
         </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 auto-rows-[140px]">
         
         <button onClick={() => router.push("/dashboard/financeiro/dre")} className="col-span-2 row-span-2 rounded-[32px] p-8 bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-all flex flex-col justify-between group text-left">
            <div className="w-14 h-14 rounded-2xl bg-white/10 text-white flex items-center justify-center"><BarChart size={28} /></div>
            <div>
               <h2 className="text-3xl font-black text-white mb-2">DRE</h2>
               <p className="text-slate-400 font-medium text-sm">Demonstrativo de Resultado do Exercício. Acompanhe lucro bruto, lucro líquido e faturamento.</p>
            </div>
         </button>

         <button onClick={() => router.push("/dashboard/financeiro/cmv")} className="col-span-1 row-span-1 rounded-[24px] p-6 bg-white border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-center items-center gap-2 group text-center">
            <PieChart size={24} className="text-orange-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-slate-700 text-sm">CMV</h3>
            <p className="text-[10px] uppercase font-bold text-slate-400">Custo de Mercadoria</p>
         </button>

         <button onClick={() => router.push("/dashboard/financeiro/cmo")} className="col-span-1 row-span-1 rounded-[24px] p-6 bg-white border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-center items-center gap-2 group text-center">
            <TrendingDown size={24} className="text-indigo-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-slate-700 text-sm">CMO</h3>
            <p className="text-[10px] uppercase font-bold text-slate-400">Custo de Mão de Obra</p>
         </button>

         <button onClick={() => router.push("/dashboard/financeiro/custos-fixos")} className="col-span-1 row-span-1 rounded-[24px] p-6 bg-white border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-center items-center gap-2 group text-center">
            <DollarSign size={24} className="text-red-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-slate-700 text-sm leading-tight">Custo Fixo</h3>
            <p className="text-[10px] uppercase font-bold text-slate-400">Aluguel, Luz, etc.</p>
         </button>

         <button onClick={() => router.push("/dashboard/financeiro/investimentos")} className="col-span-1 row-span-1 rounded-[24px] p-6 bg-white border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-center items-center gap-2 group text-center">
            <Wallet size={24} className="text-emerald-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-slate-700 text-sm">Investimentos</h3>
            <p className="text-[10px] uppercase font-bold text-slate-400">Equip. e Obras</p>
         </button>

         <button onClick={() => router.push("/dashboard/financeiro/limpeza")} className="col-span-1 row-span-1 rounded-[24px] p-6 bg-white border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-center items-center gap-2 group text-center">
            <Sparkles size={24} className="text-cyan-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-slate-700 text-sm leading-tight">Mat. de Limpeza</h3>
            <p className="text-[10px] uppercase font-bold text-slate-400">Custo Suprimentos</p>
         </button>

         <button onClick={() => router.push("/dashboard/financeiro/inventarios")} className="col-span-1 row-span-1 rounded-[24px] p-6 bg-white border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-center items-center gap-2 group text-center">
            <ClipboardList size={24} className="text-amber-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-slate-700 text-sm">Inventários</h3>
            <p className="text-[10px] uppercase font-bold text-slate-400">Perdas/Ajustes</p>
         </button>

         <button onClick={() => router.push("/dashboard/financeiro/marketing")} className="col-span-2 row-span-1 rounded-[24px] p-6 bg-white border border-slate-200 hover:border-slate-300 transition-all flex items-center justify-start gap-4 group">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"><Megaphone size={24} /></div>
            <div className="text-left">
               <h3 className="font-bold text-slate-700 text-lg">Custo Marketing</h3>
               <p className="text-[10px] uppercase font-bold text-slate-400">Tráfego pago, Panfletos e Assessoria</p>
            </div>
         </button>

      </div>
    </div>
  );
}
