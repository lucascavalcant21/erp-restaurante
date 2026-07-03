"use client";

import { useState, useEffect } from "react";
import { useERP } from "../context/ERPContext";
import { 
   TrendingUp, DollarSign, ShoppingBag, Receipt, ArrowUpRight, ArrowDownRight, 
   AlertCircle, Clock, PackageOpen, Calendar
} from "lucide-react";

export default function DashboardIndex() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    // Simula o carregamento de dados do backend toda vez que a unidade mudar
    setLoading(true);
    setTimeout(() => {
       // Dados fictícios baseados no ID da unidade para parecerem únicos
       const idStr = String(unidadeAtiva);
       const seed = idStr.charCodeAt(idStr.length - 1) || 5;
       
       setMetrics({
          faturamentoHoje: 1250 * seed + 300,
          faturamentoOntem: 1100 * seed + 200,
          pedidosHoje: 15 * seed,
          ticketMedio: 85 + seed,
          despesasHoje: 450 * seed,
          // Histórico dos últimos 7 dias para o mini gráfico
          historicoVendas: Array.from({ length: 7 }).map((_, i) => ({
             dia: ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][i],
             valor: 800 * seed + Math.random() * 2000
          })),
          alertasEstoque: [
             { item: "Coca-Cola 2L", atual: 5, minimo: 12 },
             { item: "Farinha de Trigo", atual: "2 kg", minimo: "10 kg" }
          ],
          contasPagar: [
             { desc: "Fornecedor Ambev", valor: 1250.00, venc: "Hoje" },
             { desc: "Energia Elétrica", valor: 890.50, venc: "Amanhã" }
          ]
       });
       setLoading(false);
    }, 600);
  }, [unidadeAtiva]);

  const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  if (loading || !metrics) {
     return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400 gap-4">
           <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-blue-500"></div>
           <p className="font-bold text-sm tracking-widest uppercase">Carregando métricas da unidade...</p>
        </div>
     );
  }

  const variacaoFaturamento = ((metrics.faturamentoHoje - metrics.faturamentoOntem) / metrics.faturamentoOntem) * 100;
  const isPositivo = variacaoFaturamento >= 0;
  
  // Encontrar o maior valor do histórico para normalizar a altura das barras (max = 100%)
  const maxVenda = Math.max(...metrics.historicoVendas.map(h => h.valor));

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8 pb-12">
       {/* HEADER DO DASHBOARD */}
       <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Visão Geral</h1>
          <p className="text-slate-500 mt-1 font-medium">Acompanhe os resultados de <strong className="text-blue-600">{unidadeInfo?.nome || "sua loja"}</strong> em tempo real.</p>
       </div>

       {/* CARDS SUPERIORES */}
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Faturamento */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
             <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500">
                   <DollarSign size={24} />
                </div>
                <div className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${isPositivo ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                   {isPositivo ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
                   {Math.abs(variacaoFaturamento).toFixed(1)}%
                </div>
             </div>
             <div>
                <p className="text-sm font-bold text-slate-400 mb-1">Faturamento Hoje</p>
                <h3 className="text-3xl font-black text-slate-800 tracking-tight">{fmtBRL(metrics.faturamentoHoje)}</h3>
             </div>
          </div>

          {/* Card 2: Pedidos */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
             <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500">
                   <ShoppingBag size={24} />
                </div>
             </div>
             <div>
                <p className="text-sm font-bold text-slate-400 mb-1">Pedidos Realizados</p>
                <h3 className="text-3xl font-black text-slate-800 tracking-tight">{metrics.pedidosHoje}</h3>
             </div>
          </div>

          {/* Card 3: Ticket Médio */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
             <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-500">
                   <TrendingUp size={24} />
                </div>
             </div>
             <div>
                <p className="text-sm font-bold text-slate-400 mb-1">Ticket Médio</p>
                <h3 className="text-3xl font-black text-slate-800 tracking-tight">{fmtBRL(metrics.ticketMedio)}</h3>
             </div>
          </div>

          {/* Card 4: Despesas Hoje */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
             <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500">
                   <Receipt size={24} />
                </div>
             </div>
             <div>
                <p className="text-sm font-bold text-slate-400 mb-1">Contas a Pagar Hoje</p>
                <h3 className="text-3xl font-black text-slate-800 tracking-tight">{fmtBRL(metrics.despesasHoje)}</h3>
             </div>
          </div>
       </div>

       {/* SEÇÃO INFERIOR: GRÁFICOS E ALERTAS */}
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Gráfico de Vendas */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col">
             <div className="flex items-center justify-between mb-8">
                <div>
                   <h3 className="text-lg font-black text-slate-800">Desempenho da Semana</h3>
                   <p className="text-xs font-bold text-slate-400">Vendas brutas nos últimos 7 dias</p>
                </div>
                <button className="text-blue-500 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                   Ver Relatório
                </button>
             </div>
             
             {/* Simple CSS Bar Chart */}
             <div className="flex-1 flex items-end gap-2 sm:gap-4 h-48 mt-auto">
                {metrics.historicoVendas.map((dia, idx) => {
                   const heightPerc = (dia.valor / maxVenda) * 100;
                   return (
                      <div key={idx} className="flex-1 flex flex-col items-center justify-end group">
                         {/* Tooltip on hover */}
                         <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded mb-2 pointer-events-none whitespace-nowrap">
                            {fmtBRL(dia.valor)}
                         </div>
                         {/* Bar */}
                         <div 
                            className="w-full max-w-[48px] bg-blue-100 group-hover:bg-blue-500 rounded-t-xl transition-all duration-300 relative overflow-hidden" 
                            style={{ height: `${heightPerc}%` }}
                         >
                            <div className="absolute bottom-0 left-0 right-0 top-0 bg-gradient-to-t from-blue-600 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"/>
                         </div>
                         <span className="text-xs font-bold text-slate-400 mt-3 uppercase">{dia.dia}</span>
                      </div>
                   )
                })}
             </div>
          </div>

          {/* Painel de Alertas Operacionais */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
             <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                <AlertCircle size={20} className="text-orange-500"/>
                Alertas da Loja
             </h3>

             <div className="space-y-6">
                
                {/* Alertas de Estoque */}
                <div>
                   <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1">
                      <PackageOpen size={14}/> Estoque Baixo
                   </h4>
                   <div className="space-y-3">
                      {metrics.alertasEstoque.map((est, i) => (
                         <div key={i} className="flex justify-between items-center p-3 bg-orange-50 rounded-xl border border-orange-100 hover:border-orange-200 transition-colors cursor-pointer">
                            <span className="text-sm font-bold text-slate-700">{est.item}</span>
                            <div className="text-right">
                               <p className="text-xs font-black text-orange-600">{est.atual}</p>
                               <p className="text-[9px] font-medium text-slate-500">Min: {est.minimo}</p>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>

                {/* Contas a Pagar Perto do Vencimento */}
                <div>
                   <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1">
                      <Calendar size={14}/> Contas Vencendo
                   </h4>
                   <div className="space-y-3">
                      {metrics.contasPagar.map((conta, i) => (
                         <div key={i} className="flex justify-between items-center p-3 bg-rose-50 rounded-xl border border-rose-100 hover:border-rose-200 transition-colors cursor-pointer">
                            <div className="min-w-0">
                               <span className="text-sm font-bold text-slate-700 block truncate">{conta.desc}</span>
                               <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 mt-0.5">
                                  <Clock size={10}/> Vence {conta.venc}
                               </span>
                            </div>
                            <span className="text-sm font-black text-slate-800 shrink-0 ml-2">{fmtBRL(conta.valor)}</span>
                         </div>
                      ))}
                   </div>
                </div>
                
             </div>
          </div>
       </div>

    </div>
  );
}
