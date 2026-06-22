"use client";

import { useRouter } from "next/navigation";
import { 
  ChefHat, FlaskConical, Package, ShoppingCart, LayoutList, 
  PlusCircle, FileText, Link, CheckSquare, Sparkles, 
  Flame, Tags, BarChart 
} from "lucide-react";

export default function CozinhaHubPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen font-sans pb-24 text-slate-800">
      
      {/* HEADER */}
      <div className="pt-6 pb-8 px-6 max-w-6xl mx-auto flex items-center gap-4">
         <div className="w-16 h-16 rounded-3xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-inner">
            <ChefHat size={32} />
         </div>
         <div>
            <h1 className="text-4xl font-black tracking-tighter text-slate-900">Op. Cozinha</h1>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">Gestão de Produção e Insumos</p>
         </div>
      </div>

      {/* BENTO GRID DE MÓDULOS */}
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 auto-rows-[140px]">
         
         {/* ITEM GIGANTE: Produção do Dia */}
         <button 
           onClick={() => router.push("/dashboard/cozinha/producao")}
           className="col-span-2 lg:col-span-3 row-span-2 rounded-[32px] p-8 relative overflow-hidden group text-left border border-slate-200 bg-white hover:border-orange-300 transition-all shadow-sm"
         >
            <div className="absolute -bottom-10 -right-10 opacity-5 transform group-hover:scale-110 transition-transform duration-700">
               <Flame size={250} />
            </div>
            <div className="relative z-10 h-full flex flex-col justify-between">
               <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mb-4">
                  <Flame size={28} />
               </div>
               <div>
                  <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Produção do Dia</h2>
                  <p className="text-slate-500 font-medium text-sm max-w-xs">Controle de lotes de preparo, baixas de estoque automáticas e rotinas de pré-preparo matinais.</p>
               </div>
            </div>
         </button>

         {/* ITENS MÉDIOS: Cardápio e Fichas */}
         <button onClick={() => router.push("/dashboard/operacao/cardapio")} className="col-span-2 row-span-1 rounded-[24px] p-6 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between group">
            <div className="flex justify-between items-start">
               <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors"><FileText size={20} /></div>
               <Link size={16} className="text-slate-300" />
            </div>
            <div>
               <h3 className="font-bold text-slate-800 text-lg">Cardápio Digital</h3>
               <p className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">Gestão de Itens e QR Code</p>
            </div>
         </button>

         <button onClick={() => router.push("/dashboard/operacao/fichas")} className="col-span-1 lg:col-span-2 row-span-1 rounded-[24px] p-6 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between group">
            <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors"><LayoutList size={20} /></div>
            <div>
               <h3 className="font-bold text-slate-800 text-lg">Ficha Técnica</h3>
               <p className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">Rendimentos e Custos</p>
            </div>
         </button>

         <button onClick={() => router.push("/dashboard/operacao/engenharia")} className="col-span-1 row-span-1 rounded-[24px] p-6 bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-all flex flex-col justify-between group">
            <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center"><BarChart size={20} /></div>
            <div>
               <h3 className="font-bold text-white text-lg leading-tight">Engenharia Menu</h3>
            </div>
         </button>

         {/* ITENS NORMAIS (1x1) */}
         <button onClick={() => router.push("/dashboard/operacao/ingredientes")} className="col-span-1 row-span-1 rounded-[24px] p-5 bg-white border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-center items-center gap-2 group text-center">
            <FlaskConical size={24} className="text-fuchsia-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-slate-700 text-sm">Ingredientes</h3>
         </button>

         <button onClick={() => router.push("/dashboard/operacao/estoque")} className="col-span-1 row-span-1 rounded-[24px] p-5 bg-white border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-center items-center gap-2 group text-center">
            <Package size={24} className="text-amber-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-slate-700 text-sm">Estoque Físico</h3>
         </button>

         <button onClick={() => router.push("/dashboard/operacao/compras")} className="col-span-1 row-span-1 rounded-[24px] p-5 bg-white border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-center items-center gap-2 group text-center">
            <ShoppingCart size={24} className="text-blue-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-slate-700 text-sm">Lista de Compras</h3>
         </button>

         <button onClick={() => router.push("/dashboard/operacao/criar-prato")} className="col-span-1 row-span-1 rounded-[24px] p-5 bg-white border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-center items-center gap-2 group text-center">
            <PlusCircle size={24} className="text-emerald-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-slate-700 text-sm leading-tight">Criação de Pratos</h3>
         </button>

         <button onClick={() => router.push("/dashboard/operacao/etiquetas")} className="col-span-1 row-span-1 rounded-[24px] p-5 bg-white border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-center items-center gap-2 group text-center">
            <Tags size={24} className="text-slate-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-slate-700 text-sm">Etiquetas</h3>
         </button>

         {/* DOCK INFERIOR (Checklists) */}
         <div className="col-span-2 lg:col-span-5 flex flex-col md:flex-row gap-4 mt-2">
            
            <button onClick={() => router.push("/dashboard/checklists?dept=cozinha&tipo=operacional")} className="flex-1 rounded-[20px] p-5 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-all flex items-center gap-4 group">
               <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-indigo-600 shadow-sm"><CheckSquare size={20} /></div>
               <div className="text-left"><p className="font-bold text-indigo-900">Checklist Operacional</p><p className="text-[10px] uppercase font-bold text-indigo-400">Abertura e Fechamento</p></div>
            </button>

            <button onClick={() => router.push("/dashboard/checklists?dept=cozinha&tipo=limpeza")} className="flex-1 rounded-[20px] p-5 bg-cyan-50 border border-cyan-100 hover:bg-cyan-100 transition-all flex items-center gap-4 group">
               <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-cyan-600 shadow-sm"><Sparkles size={20} /></div>
               <div className="text-left"><p className="font-bold text-cyan-900">Checklist de Limpeza</p><p className="text-[10px] uppercase font-bold text-cyan-400">Higiene Diária e Semanal</p></div>
            </button>

         </div>

      </div>
    </div>
  );
}
