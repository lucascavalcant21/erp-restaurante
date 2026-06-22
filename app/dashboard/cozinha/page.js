"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../context/ERPContext";
import { 
  MonitorPlay, Flame, ChefHat, LayoutList, Package, 
  FlaskConical, Truck, Tags, Sparkles, ReceiptText 
} from "lucide-react";

export default function CozinhaHubPage() {
  const { setDepartamento, unidadeInfo } = useERP();
  const router = useRouter();

  useEffect(() => {
    setDepartamento("cozinha");
  }, [setDepartamento]);

  return (
    <div className="min-h-screen bg-slate-950 font-sans pb-24 text-slate-200">
      
      {/* HEADER CENTRO DE COMANDO */}
      <div className="pt-12 pb-10 px-6 max-w-7xl mx-auto">
         <p className="text-orange-500 font-bold uppercase tracking-widest text-sm mb-2 flex items-center gap-2">
            <ChefHat size={16} /> Hub Operacional
         </p>
         <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter">Cozinha Principal.</h1>
         <p className="text-slate-400 font-medium mt-2">Centro de Comando e Despacho da {unidadeInfo?.nome || "Unidade"}</p>
      </div>

      {/* BENTO GRID */}
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 auto-rows-[140px]">
         
         {/* ITEM GIGANTE 1: KDS (Painel Vivo) */}
         <button 
           onClick={() => router.push("/dashboard/cozinha/kds")}
           className="md:col-span-8 md:row-span-2 rounded-[32px] p-8 relative overflow-hidden group text-left border border-orange-500/20 bg-gradient-to-br from-orange-600 to-red-600 hover:shadow-[0_0_80px_rgba(234,88,12,0.3)] hover:-translate-y-1 transition-all"
         >
            <div className="absolute top-0 right-0 p-10 opacity-20 transform group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700">
               <MonitorPlay size={200} />
            </div>
            <div className="relative z-10 h-full flex flex-col justify-between">
               <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white mb-6">
                  <MonitorPlay size={32} />
               </div>
               <div>
                  <h2 className="text-4xl font-black text-white mb-2 tracking-tight">KDS Expedition</h2>
                  <p className="text-orange-100 font-medium text-lg max-w-md">A tela viva da operação. Receba e despache pedidos em tempo real direto do salão e delivery.</p>
               </div>
            </div>
         </button>

         {/* ITEM GIGANTE 2: PRODUÇÃO */}
         <button 
           onClick={() => router.push("/dashboard/cozinha/producao")}
           className="md:col-span-4 md:row-span-2 rounded-[32px] p-8 relative overflow-hidden group text-left border border-slate-700 bg-slate-900 hover:bg-slate-800 hover:border-slate-500 hover:-translate-y-1 transition-all"
         >
            <div className="absolute bottom-0 right-0 opacity-5 transform group-hover:scale-125 transition-transform duration-700">
               <Flame size={180} />
            </div>
            <div className="relative z-10 h-full flex flex-col justify-between">
               <div className="w-16 h-16 rounded-2xl bg-orange-500/20 text-orange-500 flex items-center justify-center mb-6">
                  <Flame size={32} />
               </div>
               <div>
                  <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Lotes de Produção</h2>
                  <p className="text-slate-400 font-medium text-sm">Registro em massa de preparos e pré-preparos. Baixa de estoque automática.</p>
               </div>
            </div>
         </button>

         {/* BLOCOS MENORES DE ENGENHARIA (2x2) */}
         
         <button onClick={() => router.push("/dashboard/operacao/cardapio")} className="md:col-span-3 md:row-span-1 rounded-[24px] p-6 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-600 transition-all flex flex-col justify-center gap-3 group">
            <ChefHat size={28} className="text-blue-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-white">Cardápio & Preços</h3>
         </button>

         <button onClick={() => router.push("/dashboard/operacao/fichas")} className="md:col-span-3 md:row-span-1 rounded-[24px] p-6 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-600 transition-all flex flex-col justify-center gap-3 group">
            <LayoutList size={28} className="text-emerald-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-white">Fichas Técnicas</h3>
         </button>

         <button onClick={() => router.push("/dashboard/operacao/estoque")} className="md:col-span-3 md:row-span-1 rounded-[24px] p-6 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-600 transition-all flex flex-col justify-center gap-3 group">
            <Package size={28} className="text-yellow-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-white">Estoque & Despensa</h3>
         </button>

         <button onClick={() => router.push("/dashboard/operacao/ingredientes")} className="md:col-span-3 md:row-span-1 rounded-[24px] p-6 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-600 transition-all flex flex-col justify-center gap-3 group">
            <FlaskConical size={28} className="text-fuchsia-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-white">Lab. de Insumos</h3>
         </button>

         {/* DOCK INFERIOR (Ferramentas de Apoio) */}
         <div className="md:col-span-12 flex flex-col md:flex-row gap-4 mt-4">
            
            <button onClick={() => router.push("/dashboard/operacao/montagem?dept=cozinha")} className="flex-1 rounded-[20px] p-5 bg-slate-800/50 border border-slate-800 hover:bg-slate-800 hover:border-slate-600 transition-all flex items-center gap-4 group">
               <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 group-hover:text-white"><LayoutList size={18} /></div>
               <div className="text-left"><p className="font-bold text-slate-200">Manuais de Montagem</p><p className="text-[10px] uppercase font-bold text-slate-500">Passo a passo com fotos</p></div>
            </button>

            <button onClick={() => router.push("/dashboard/operacao/fornecedores")} className="flex-1 rounded-[20px] p-5 bg-slate-800/50 border border-slate-800 hover:bg-slate-800 hover:border-slate-600 transition-all flex items-center gap-4 group">
               <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 group-hover:text-white"><Truck size={18} /></div>
               <div className="text-left"><p className="font-bold text-slate-200">Fornecedores</p><p className="text-[10px] uppercase font-bold text-slate-500">Contatos e Negociações</p></div>
            </button>

            <button onClick={() => router.push("/dashboard/operacao/limpeza")} className="flex-1 rounded-[20px] p-5 bg-slate-800/50 border border-slate-800 hover:bg-slate-800 hover:border-slate-600 transition-all flex items-center gap-4 group">
               <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 group-hover:text-white"><Sparkles size={18} /></div>
               <div className="text-left"><p className="font-bold text-slate-200">Checklist de Limpeza</p><p className="text-[10px] uppercase font-bold text-slate-500">Rotinas da brigada</p></div>
            </button>

         </div>

      </div>
    </div>
  );
}
