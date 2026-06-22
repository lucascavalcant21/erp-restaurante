"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchDRE, CATEGORIAS_CUSTO } from "../../../lib/financeiro";
import { LineChart, DollarSign, ArrowUpRight, ArrowDownRight, Activity, Percent, PieChart, UtensilsCrossed, Motorbike, FileText } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

export default function DashboardFinanceiroPage() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const [dre, setDre] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
       if(!unidadeAtiva) return;
       setLoading(true);
       const { data } = await fetchDRE(unidadeAtiva);
       setDre(data);
       setLoading(false);
    }
    carregar();
  }, [unidadeAtiva]);

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-slate-50">
      
      {/* HEADER ESCURO */}
      <div className="bg-[#0f172a] pt-8 pb-12 px-6 shadow-2xl relative overflow-hidden text-white border-b border-slate-800">
         <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
            <LineChart size={300} />
         </div>
         <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div>
               <h1 className="text-4xl font-black tracking-tighter">Financeiro</h1>
               <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">DRE Gerencial e Fluxo de Caixa</p>
            </div>
            <div className="flex gap-4">
               <button onClick={() => router.push("/dashboard/financeiro/contas")} className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl flex items-center gap-2 transition-all">
                  <FileText size={18}/> Contas a Pagar
               </button>
            </div>
         </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 -mt-8 relative z-20">
         
         {loading ? (
            <div className="text-center py-20 text-slate-500 font-bold animate-pulse bg-white rounded-3xl shadow-xl">
               Calculando DRE do mês...
            </div>
         ) : !dre ? (
            <div className="text-center py-20 text-slate-500">Erro ao carregar dados.</div>
         ) : (
            <div className="space-y-6">
               
               {/* CARDS PRINCIPAIS (Faturamento e Lucro) */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-xl shadow-slate-200/50 flex flex-col justify-between">
                     <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center"><ArrowUpRight size={24}/></div>
                        <span className="text-[10px] uppercase font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-md">Receitas</span>
                     </div>
                     <div>
                        <p className="text-slate-500 font-medium text-sm">Faturamento Bruto</p>
                        <p className="text-4xl font-black text-slate-900 tracking-tighter">{fmtBRL(dre.faturamentoTotal)}</p>
                     </div>
                  </div>

                  <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-xl shadow-slate-200/50 flex flex-col justify-between">
                     <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-600 flex items-center justify-center"><ArrowDownRight size={24}/></div>
                        <span className="text-[10px] uppercase font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-md">Despesas Pagas</span>
                     </div>
                     <div>
                        <p className="text-slate-500 font-medium text-sm">Custo Total</p>
                        <p className="text-4xl font-black text-slate-900 tracking-tighter">{fmtBRL(dre.totalCustos)}</p>
                     </div>
                  </div>

                  <div className={`${dre.lucroLiquido >= 0 ? 'bg-emerald-500' : 'bg-emerald-500'} p-6 rounded-[32px] shadow-xl text-white flex flex-col justify-between`}>
                     <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center"><DollarSign size={24}/></div>
                        <span className="text-[10px] uppercase font-black bg-black/20 px-2 py-1 rounded-md">Resultado</span>
                     </div>
                     <div>
                        <p className="text-white/80 font-medium text-sm flex justify-between items-center">
                           Lucro Líquido Real
                           <span className="flex items-center gap-1 bg-black/20 px-2 py-1 rounded-full text-xs font-black"><Percent size={12}/> {dre.margem} Margem</span>
                        </p>
                        <p className="text-4xl font-black tracking-tighter">{fmtBRL(dre.lucroLiquido)}</p>
                     </div>
                  </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* DRE DETALHADO (Plano de Contas) */}
                  <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-xl shadow-slate-200/50">
                     <div className="flex items-center gap-3 mb-8">
                        <Activity className="text-slate-600"/>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">DRE Detalhado</h2>
                     </div>

                     <div className="space-y-4">
                        {CATEGORIAS_CUSTO.map(cat => {
                           const valor = dre.custosPorCategoria[cat.id] || 0;
                           const perc = dre.faturamentoTotal > 0 ? ((valor / dre.faturamentoTotal) * 100).toFixed(1) : 0;
                           
                           return (
                              <div key={cat.id} className="group cursor-default">
                                 <div className="flex justify-between items-end mb-2">
                                    <p className="font-bold text-slate-700 flex items-center gap-2">
                                       <span className={`w-3 h-3 rounded-full ${cat.cor}`}></span> {cat.label}
                                    </p>
                                    <div className="text-right">
                                       <p className="font-black text-slate-900">{fmtBRL(valor)}</p>
                                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{perc}% da Receita</p>
                                    </div>
                                 </div>
                                 <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full ${cat.cor} transition-all duration-1000`} style={{ width: `${Math.min(perc, 100)}%` }}></div>
                                 </div>
                              </div>
                           );
                        })}
                     </div>
                  </div>

                  {/* CANAIS DE VENDA */}
                  <div className="space-y-6">
                     <div className="bg-slate-900 text-white p-8 rounded-[32px] shadow-2xl relative overflow-hidden">
                        <div className="absolute -bottom-10 -right-10 opacity-10"><PieChart size={180}/></div>
                        <h2 className="text-2xl font-black tracking-tight mb-8 relative z-10 flex items-center gap-3">Canais de Venda</h2>
                        
                        <div className="space-y-6 relative z-10">
                           <div className="flex items-center gap-4 bg-slate-800 p-4 rounded-2xl border border-slate-700">
                              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center"><UtensilsCrossed size={20}/></div>
                              <div className="flex-1">
                                 <p className="text-xs uppercase font-black tracking-widest text-slate-500 mb-1">Salão (PDV)</p>
                                 <p className="text-2xl font-black">{fmtBRL(dre.fatPorCanal.salao)}</p>
                              </div>
                           </div>

                           <div className="flex items-center gap-4 bg-slate-800 p-4 rounded-2xl border border-slate-700">
                              <div className="w-12 h-12 bg-emerald-500/20 text-slate-500 rounded-xl flex items-center justify-center"><Motorbike size={20}/></div>
                              <div className="flex-1">
                                 <p className="text-xs uppercase font-black tracking-widest text-slate-500 mb-1">Delivery / QR Code</p>
                                 <p className="text-2xl font-black">{fmtBRL(dre.fatPorCanal.delivery + dre.fatPorCanal.qrcode)}</p>
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* FORMAS DE PAGAMENTO */}
                     <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-xl shadow-slate-200/50">
                        <h2 className="text-xl font-black text-slate-800 tracking-tight mb-6">Recebimentos</h2>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                              <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">PIX</p>
                              <p className="text-lg font-black text-slate-800">{fmtBRL(dre.fatPorPagamento.pix)}</p>
                           </div>
                           <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                              <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">Cartão de Crédito</p>
                              <p className="text-lg font-black text-slate-800">{fmtBRL(dre.fatPorPagamento.credito)}</p>
                           </div>
                           <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                              <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">Cartão de Débito</p>
                              <p className="text-lg font-black text-slate-800">{fmtBRL(dre.fatPorPagamento.debito)}</p>
                           </div>
                           <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                              <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">Dinheiro</p>
                              <p className="text-lg font-black text-slate-800">{fmtBRL(dre.fatPorPagamento.dinheiro)}</p>
                           </div>
                        </div>
                     </div>
                  </div>

               </div>
            </div>
         )}
      </div>

    </div>
  );
}
