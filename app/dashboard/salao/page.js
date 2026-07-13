"use client";

import { useRouter } from "next/navigation";
import { Store, CheckSquare, GraduationCap } from "lucide-react";

export default function SalaoHubPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen font-sans pb-24 text-slate-800">
      
      {/* HEADER */}
      <div className="pt-5 sm:pt-6 pb-6 sm:pb-8 px-4 sm:px-6 max-w-6xl mx-auto flex items-center gap-3 sm:gap-4">
         <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 rounded-2xl sm:rounded-3xl bg-slate-100 text-slate-800 flex items-center justify-center shadow-inner">
            <Store size={32} />
         </div>
         <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900">Op. Salão</h1>
            <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">Gestão de Equipe e Padronização</p>
         </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
         
         {/* ITEM NOVO: DELIVERY */}
         <button onClick={() => router.push("/dashboard/salao/online")} className="rounded-[32px] p-6 sm:p-10 bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-xl shadow-slate-900/20 flex flex-col justify-between group text-left min-h-56 sm:h-64">
            <div className="w-16 h-16 rounded-2xl bg-white/10 text-white flex items-center justify-center mb-6">
               <Store size={32} />
            </div>
            <div>
               <h2 className="text-2xl font-black mb-2">Gestor Delivery</h2>
               <p className="text-slate-300 font-medium text-sm">Receba, aceite e gerencie os pedidos online feitos pelo Cardápio QR Code e Delivery.</p>
            </div>
         </button>

         <button onClick={() => router.push("/dashboard/operacao/rotina?dept=salao&tipo=operacional")} className="rounded-[32px] p-6 sm:p-10 bg-white border-2 border-slate-200 hover:border-slate-400 transition-all shadow-sm flex flex-col justify-between group text-left min-h-56 sm:h-64">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center mb-6">
               <CheckSquare size={32} />
            </div>
            <div>
               <h2 className="text-2xl font-black text-slate-900 mb-2">Checklist Operacional</h2>
               <p className="text-slate-700 font-medium text-sm">Procedimentos de abertura do salão, conferência de mesas, banheiros e fechamento de caixa.</p>
            </div>
         </button>

         <button onClick={() => router.push("/dashboard/salao/treinamento")} className="rounded-[32px] p-6 sm:p-10 bg-white border-2 border-slate-200 hover:border-slate-400 transition-all shadow-sm flex flex-col justify-between group text-left min-h-56 sm:h-64">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center mb-6">
               <GraduationCap size={32} />
            </div>
            <div>
               <h2 className="text-2xl font-black text-slate-900 mb-2">Treinamento dos Garçons</h2>
               <p className="text-slate-700 font-medium text-sm">Manuais de atendimento, scripts de venda sugestiva, postura e regras do restaurante.</p>
            </div>
         </button>

      </div>
    </div>
  );
}
