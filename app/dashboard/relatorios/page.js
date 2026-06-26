"use client";

import React, { useState, useEffect } from "react";
import { useERP } from "../../../context/ERPContext";
import { fetchEstatisticasDashboard } from "../../../lib/relatorios";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { TrendingUp, ShoppingBag, Receipt, DollarSign, Calendar, MapPin, Loader2, ArrowRight } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

const COLORS = ['#4970AF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function RelatoriosDashboard() {
  const { unidadeAtiva } = useERP();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [diasFiltro, setDiasFiltro] = useState(30);

  const carregar = async () => {
    if (!unidadeAtiva) return;
    setLoading(true);
    const { data } = await fetchEstatisticasDashboard(unidadeAtiva, diasFiltro);
    setStats(data);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, [unidadeAtiva, diasFiltro]);

  if (loading) return (
     <div className="flex flex-col items-center justify-center h-[80vh] text-slate-400">
        <Loader2 size={48} className="animate-spin mb-4 text-[#4970AF]" />
        <p className="font-bold uppercase tracking-widest text-sm">Processando dados...</p>
     </div>
  );

  if (!stats) return <div className="p-10 font-bold text-center">Nenhum dado encontrado.</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-8 animate-in fade-in">
      
      {/* Header & Filtros */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
         <div>
            <h1 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
               <TrendingUp className="text-[#4970AF]" size={36}/> Dashboard Gerencial
            </h1>
            <p className="text-slate-500 font-medium mt-1">Acompanhamento de Vendas e Desempenho</p>
         </div>

         <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
            {[7, 15, 30].map(d => (
               <button 
                  key={d} 
                  onClick={() => setDiasFiltro(d)}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${diasFiltro === d ? 'bg-[#4970AF] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
               >
                  {d} dias
               </button>
            ))}
         </div>
      </div>

      {/* Cards de KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
         <div className="bg-gradient-to-br from-[#4970AF] to-[#3A5B99] rounded-[24px] p-6 shadow-xl shadow-[#4970AF]/20 text-white relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 bg-white/10 w-32 h-32 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative z-10">
               <div className="flex items-center gap-2 text-blue-100 mb-2">
                  <DollarSign size={20}/>
                  <h3 className="font-bold uppercase tracking-wider text-xs">Faturamento Total</h3>
               </div>
               <p className="text-4xl font-black">{fmtBRL(stats.faturamentoTotal)}</p>
            </div>
         </div>

         <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
               <ShoppingBag size={20}/>
               <h3 className="font-bold uppercase tracking-wider text-xs">Total de Pedidos</h3>
            </div>
            <p className="text-4xl font-black text-slate-800">{stats.qtdPedidos}</p>
         </div>

         <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
               <Receipt size={20}/>
               <h3 className="font-bold uppercase tracking-wider text-xs">Ticket Médio</h3>
            </div>
            <p className="text-4xl font-black text-slate-800">{fmtBRL(stats.ticketMedio)}</p>
         </div>
      </div>

      {/* Gráficos Principais */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
         {/* Evolução de Vendas (Linha) */}
         <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm lg:col-span-2">
            <h3 className="font-black text-slate-700 mb-6 flex items-center gap-2"><Calendar size={18}/> Evolução do Faturamento</h3>
            <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.faturamentoPorDia}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                     <XAxis dataKey="data" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} dx={-10} tickFormatter={(val) => `R$ ${val}`} />
                     <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(value) => [fmtBRL(value), 'Faturamento']}
                     />
                     <Line type="monotone" dataKey="valor" stroke="#4970AF" strokeWidth={4} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                  </LineChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* Canais de Venda (Donut) */}
         <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm">
            <h3 className="font-black text-slate-700 mb-6 flex items-center gap-2"><MapPin size={18}/> Vendas por Canal</h3>
            <div className="h-[200px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie data={stats.canais} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {stats.canais.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                     </Pie>
                     <Tooltip formatter={(value) => fmtBRL(value)} />
                  </PieChart>
               </ResponsiveContainer>
            </div>
            {/* Legenda Customizada */}
            <div className="mt-4 space-y-2">
               {stats.canais.map((c, i) => (
                  <div key={c.name} className="flex justify-between items-center text-sm font-bold">
                     <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></div>
                        <span className="text-slate-600">{c.name}</span>
                     </div>
                     <span className="text-slate-800">{fmtBRL(c.value)}</span>
                  </div>
               ))}
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
         {/* Produtos Mais Vendidos (BarChart Horizontal) */}
         <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm">
            <h3 className="font-black text-slate-700 mb-6">Top 5 Produtos Mais Vendidos</h3>
            <div className="space-y-4">
               {stats.itensMaisVendidos.map((item, index) => {
                  const maxQtd = stats.itensMaisVendidos[0]?.qtd || 1;
                  const pct = (item.qtd / maxQtd) * 100;
                  return (
                     <div key={index} className="group">
                        <div className="flex justify-between text-sm font-bold mb-1">
                           <span className="text-slate-700">{index + 1}. {item.nome}</span>
                           <span className="text-slate-500">{item.qtd} un. ({fmtBRL(item.valor)})</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                           <div className="bg-[#10B981] h-2.5 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }}></div>
                        </div>
                     </div>
                  );
               })}
               {stats.itensMaisVendidos.length === 0 && <p className="text-slate-400 text-sm font-bold">Sem dados suficientes.</p>}
            </div>
         </div>

         {/* Formas de Pagamento */}
         <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm">
            <h3 className="font-black text-slate-700 mb-6">Formas de Pagamento</h3>
            <div className="space-y-4">
               {stats.pagamentos.map((pag, index) => {
                  const maxVal = stats.faturamentoTotal || 1;
                  const pct = (pag.value / maxVal) * 100;
                  return (
                     <div key={index}>
                        <div className="flex justify-between text-sm font-bold mb-1">
                           <span className="text-slate-700">{pag.name}</span>
                           <span className="text-slate-500">{fmtBRL(pag.value)}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                           <div className="bg-[#4970AF] h-2.5 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }}></div>
                        </div>
                     </div>
                  );
               })}
               {stats.pagamentos.length === 0 && <p className="text-slate-400 text-sm font-bold">Sem dados suficientes.</p>}
            </div>
         </div>
      </div>

    </div>
  );
}
