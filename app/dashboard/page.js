"use client";

import { useEffect, useState, useMemo } from "react";
import { useERP } from "../context/ERPContext";
import { carregarDadosDaUnidade, fmtPct } from "../lib/cerebro";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, AlertTriangle, 
  Users, ShoppingCart, Calendar, Loader2, PackageX 
} from "lucide-react";

export default function DashboardIndex() {
  const { unidadeAtiva } = useERP();
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!unidadeAtiva) return;
      setLoading(true);
      try {
        const result = await carregarDadosDaUnidade(unidadeAtiva);
        setDados(result);
      } catch (err) {
        console.error("Erro ao carregar dados da unidade", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [unidadeAtiva]);

  // Processamento de Lançamentos para o Gráfico Financeiro
  const chartFinanceiro = useMemo(() => {
    if (!dados || !dados.lancamentos30) return [];
    
    // Agrupar por data (YYYY-MM-DD)
    const agrupado = {};
    const hoje = new Date();
    // Preencher os últimos 15 dias com 0 para o gráfico não ficar vazio se houver falhas
    for(let i = 14; i >= 0; i--) {
      const d = new Date(hoje);
      d.setDate(d.getDate() - i);
      const strDate = d.toISOString().split('T')[0];
      agrupado[strDate] = { data: strDate, label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), Receitas: 0, Despesas: 0 };
    }

    dados.lancamentos30.forEach(l => {
      const dStr = new Date(l.data).toISOString().split('T')[0];
      if (!agrupado[dStr]) {
        const dObj = new Date(l.data);
        // Considerando fuso horário se precisar, mas simplificando:
        const localDate = new Date(dObj.getTime() + dObj.getTimezoneOffset() * 60000);
        agrupado[dStr] = { data: dStr, label: localDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), Receitas: 0, Despesas: 0 };
      }
      if (l.tipo === "entrada") agrupado[dStr].Receitas += Number(l.valor) || 0;
      if (l.tipo === "saida") agrupado[dStr].Despesas += Number(l.valor) || 0;
    });

    return Object.values(agrupado).sort((a, b) => a.data.localeCompare(b.data));
  }, [dados]);

  // Processamento de Ranking de Produtos
  const topProdutos = useMemo(() => {
    if (!dados || !dados.producoes30) return [];
    
    const produtosMap = {};
    dados.producoes30.forEach(p => {
      const nome = p.prato_nome || "Desconhecido";
      if (!produtosMap[nome]) produtosMap[nome] = { nome, qtd: 0, lucro: 0 };
      produtosMap[nome].qtd += Number(p.quantidade) || 0;
      produtosMap[nome].lucro += (Number(p.receita_potencial) || 0) - (Number(p.custo_total) || 0);
    });

    return Object.values(produtosMap)
      .sort((a, b) => b.lucro - a.lucro)
      .slice(0, 5);
  }, [dados]);

  const fmtBRL = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  if (loading) {
    return (
      <div className="flex flex-col h-[calc(100vh-72px)] items-center justify-center text-slate-500">
        <Loader2 size={40} className="animate-spin text-emerald-500 mb-4" />
        <p className="font-bold">Carregando visão geral...</p>
      </div>
    );
  }

  if (!dados) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 pb-20">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Visão Geral da Unidade</h1>
        <p className="text-slate-500 font-medium mt-1">Resumo dos últimos 30 dias de operação real.</p>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Faturamento */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <DollarSign size={20} />
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Faturamento</p>
          </div>
          <h2 className="text-2xl font-black text-slate-800">{fmtBRL(dados.receita30)}</h2>
        </div>

        {/* Lucro/Prejuízo */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${dados.lucro30 >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              {dados.lucro30 >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Lucro Líquido</p>
          </div>
          <h2 className={`text-2xl font-black ${dados.lucro30 >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtBRL(dados.lucro30)}</h2>
        </div>

        {/* CMV & CMO */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
             <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Custo Mercadoria</p>
                <div className="flex items-end gap-2">
                   <h2 className="text-xl font-black text-slate-800">{fmtPct(dados.cmv)}</h2>
                   {dados.cmv > 35 && <AlertTriangle size={14} className="text-orange-500 mb-1" />}
                </div>
             </div>
             <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Custo Mão de Obra</p>
                <div className="flex items-end gap-2 justify-end">
                   {dados.cmo > 30 && <AlertTriangle size={14} className="text-orange-500 mb-1" />}
                   <h2 className="text-xl font-black text-slate-800">{fmtPct(dados.cmo)}</h2>
                </div>
             </div>
          </div>
        </div>

        {/* RH & Estoque */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
             <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Users size={12}/> Equipe Ativa</p>
                <h2 className="text-xl font-black text-slate-800">{dados.equipe} <span className="text-xs text-slate-400 font-medium">func.</span></h2>
             </div>
             <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 justify-end"><PackageX size={12}/> Estoque Crítico</p>
                <h2 className={`text-xl font-black ${dados.criticos > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{dados.criticos} <span className="text-xs text-slate-400 font-medium">itens</span></h2>
             </div>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gráfico Financeiro */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-6">Evolução Financeira Diária</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartFinanceiro} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(val) => `R$${val/1000}k`} />
                <RechartsTooltip 
                  formatter={(value) => fmtBRL(value)}
                  labelStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="Receitas" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorReceita)" />
                <Area type="monotone" dataKey="Despesas" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorDespesa)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ranking e Eventos */}
        <div className="space-y-6">
          
          {/* Top Produtos */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
             <div className="flex items-center gap-2 mb-6">
               <ShoppingCart size={18} className="text-indigo-500"/>
               <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Ranking de Pratos (Lucro)</h3>
             </div>
             
             {topProdutos.length === 0 ? (
               <div className="text-center py-8 text-slate-400 text-sm font-medium">Nenhum dado de produção recente.</div>
             ) : (
               <div className="space-y-4">
                 {topProdutos.map((p, i) => (
                   <div key={i} className="flex items-center justify-between">
                     <div className="flex items-center gap-3 overflow-hidden">
                       <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-[10px] flex items-center justify-center shrink-0">{i+1}</span>
                       <span className="text-sm font-bold text-slate-700 truncate">{p.nome}</span>
                     </div>
                     <span className="text-sm font-black text-indigo-600 shrink-0 ml-2">{fmtBRL(p.lucro)}</span>
                   </div>
                 ))}
               </div>
             )}
          </div>

          {/* Feriados e Eventos */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
             <div className="flex items-center gap-2 mb-6">
               <Calendar size={18} className="text-amber-500"/>
               <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Próximos Eventos</h3>
             </div>
             
             {(!dados.eventos || dados.eventos.length === 0) ? (
               <div className="text-center py-8 text-slate-400 text-sm font-medium">Nenhum evento agendado.</div>
             ) : (
               <div className="space-y-3">
                 {dados.eventos.slice(0, 3).map((e, i) => {
                   const d = new Date(e.data_evento);
                   return (
                     <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex flex-col items-center justify-center shrink-0">
                          <span className="text-[8px] font-bold text-amber-500 uppercase">{d.toLocaleDateString('pt-BR', { month: 'short' })}</span>
                          <span className="text-sm font-black text-slate-700 leading-none">{d.getDate()}</span>
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-bold text-slate-700 truncate">{e.nome_evento || e.titulo || "Evento"}</p>
                          <p className="text-xs text-slate-500 truncate">{e.descricao || "Marketing / Feriado"}</p>
                        </div>
                     </div>
                   )
                 })}
               </div>
             )}
          </div>

        </div>
      </div>
      
    </div>
  );
}
