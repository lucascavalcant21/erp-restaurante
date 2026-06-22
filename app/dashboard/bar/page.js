"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../context/ERPContext";
import { 
  Martini, Flame, ShoppingCart, LayoutList, Package, 
  FlaskConical, Sparkles, Tags, Smartphone, Wine 
} from "lucide-react";

export default function BarHubPage() {
  const { setDepartamento, unidadeInfo } = useERP();
  const router = useRouter();

  useEffect(() => {
    setDepartamento("bar");
  }, [setDepartamento]);

  return (
    <div className="min-h-screen bg-slate-950 font-sans pb-24 text-slate-200">
      
      {/* HEADER CENTRO DE COMANDO (NEON STYLE) */}
      <div className="pt-12 pb-10 px-6 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
         <div>
            <p className="text-purple-500 font-bold uppercase tracking-widest text-sm mb-2 flex items-center gap-2">
               <Martini size={16} /> Hub Operacional
            </p>
            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter">Bar & Balcão.</h1>
            <p className="text-slate-400 font-medium mt-2">Centro de Comando de Bebidas da {unidadeInfo?.nome || "Unidade"}</p>
         </div>
         
         {/* Botão de Acesso Rápido ao Tablet de Estoque */}
         <button onClick={() => router.push("/dashboard/bar/tablet")} className="px-6 py-4 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-2xl font-bold flex items-center gap-3 hover:bg-purple-600 hover:text-white transition-all group shadow-[0_0_20px_rgba(168,85,247,0.15)]">
            <Smartphone size={20} className="group-hover:scale-110 transition-transform" /> 
            Modo Tablet (Baixa de Bebida)
         </button>
      </div>

      {/* BENTO GRID */}
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 auto-rows-[140px]">
         
         {/* ITEM GIGANTE 1: PDV VENDAS */}
         <button 
           onClick={() => router.push("/dashboard/vendas")}
           className="md:col-span-8 md:row-span-2 rounded-[32px] p-8 relative overflow-hidden group text-left border border-purple-500/30 bg-gradient-to-br from-indigo-900 to-purple-900 hover:shadow-[0_0_80px_rgba(168,85,247,0.4)] hover:-translate-y-1 transition-all"
         >
            <div className="absolute top-0 right-0 p-10 opacity-20 transform group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700">
               <ShoppingCart size={200} />
            </div>
            <div className="relative z-10 h-full flex flex-col justify-between">
               <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-purple-300 mb-6 border border-white/20">
                  <ShoppingCart size={32} />
               </div>
               <div>
                  <h2 className="text-4xl font-black text-white mb-2 tracking-tight">PDV & Vendas</h2>
                  <p className="text-purple-200 font-medium text-lg max-w-md">Lançamento rápido de pedidos diretos no balcão, fechamento de contas e mesas.</p>
               </div>
            </div>
         </button>

         {/* ITEM GIGANTE 2: PRODUÇÃO (Drinks) */}
         <button 
           onClick={() => router.push("/dashboard/bar/producao")}
           className="md:col-span-4 md:row-span-2 rounded-[32px] p-8 relative overflow-hidden group text-left border border-cyan-500/20 bg-slate-900 hover:bg-slate-800 hover:border-cyan-500/50 hover:-translate-y-1 transition-all"
         >
            <div className="absolute bottom-0 right-0 opacity-5 transform group-hover:scale-125 transition-transform duration-700">
               <Flame size={180} />
            </div>
            <div className="relative z-10 h-full flex flex-col justify-between">
               <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-6">
                  <Flame size={32} />
               </div>
               <div>
                  <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Preparo & Produção</h2>
                  <p className="text-slate-400 font-medium text-sm">Registro de lotes de pré-preparo de coquetéis, xaropes e sucos com baixa no estoque.</p>
               </div>
            </div>
         </button>

         {/* BLOCOS MENORES DE ENGENHARIA (2x2) */}
         
         <button onClick={() => router.push("/dashboard/operacao/drinks")} className="md:col-span-3 md:row-span-1 rounded-[24px] p-6 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-600 transition-all flex flex-col justify-center gap-3 group">
            <Wine size={28} className="text-pink-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-white">Cardápio de Drinks</h3>
         </button>

         <button onClick={() => router.push("/dashboard/operacao/estoque")} className="md:col-span-3 md:row-span-1 rounded-[24px] p-6 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-600 transition-all flex flex-col justify-center gap-3 group">
            <Package size={28} className="text-indigo-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-white">Estoque do Bar</h3>
         </button>

         <button onClick={() => router.push("/dashboard/operacao/ingredientes")} className="md:col-span-3 md:row-span-1 rounded-[24px] p-6 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-600 transition-all flex flex-col justify-center gap-3 group">
            <FlaskConical size={28} className="text-cyan-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-white">Insumos & Destilados</h3>
         </button>

         <button onClick={() => router.push("/dashboard/operacao/etiquetas")} className="md:col-span-3 md:row-span-1 rounded-[24px] p-6 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-600 transition-all flex flex-col justify-center gap-3 group">
            <Tags size={28} className="text-amber-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-white">Gerar Etiquetas</h3>
         </button>

         {/* DOCK INFERIOR (Ferramentas de Apoio) */}
         <div className="md:col-span-12 flex flex-col md:flex-row gap-4 mt-4">
            
            <button onClick={() => router.push("/dashboard/operacao/montagem?dept=bar")} className="flex-1 rounded-[20px] p-5 bg-slate-800/50 border border-slate-800 hover:bg-slate-800 hover:border-slate-600 transition-all flex items-center gap-4 group">
               <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 group-hover:text-white"><LayoutList size={18} /></div>
               <div className="text-left"><p className="font-bold text-slate-200">Manuais de Montagem</p><p className="text-[10px] uppercase font-bold text-slate-500">Guia Visual de Copos e Garnishes</p></div>
            </button>

            <button onClick={() => router.push("/dashboard/operacao/limpeza")} className="flex-1 rounded-[20px] p-5 bg-slate-800/50 border border-slate-800 hover:bg-slate-800 hover:border-slate-600 transition-all flex items-center gap-4 group">
               <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 group-hover:text-white"><Sparkles size={18} /></div>
               <div className="text-left"><p className="font-bold text-slate-200">Limpeza & Checklist</p><p className="text-[10px] uppercase font-bold text-slate-500">Fechamento do Bar</p></div>
            </button>

         </div>

      </div>
    </div>
  );
}
