"use client";

import { useEffect, useState, useMemo } from "react";
import { useERP } from "../context/ERPContext";
import { carregarDadosDaUnidade, fmtPct } from "../lib/cerebro";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, AlertTriangle, 
  Users, ShoppingCart, Calendar as CalendarIcon, Loader2, PackageX 
} from "lucide-react";

// Cores para o gráfico do RH
const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#6366f1'];

export default function DashboardIndex() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!unidadeAtiva) return;
      setLoading(true);
      try {
        const result = await carregarDadosDaUnidade({ id: unidadeAtiva, nome: unidadeInfo?.nome || 'Unidade' });
        setDados(result);
      } catch (err) {
        console.error("Erro ao carregar dados da unidade", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [unidadeAtiva, unidadeInfo]);

  // Processamento de Lançamentos para o Gráfico Financeiro
  const chartFinanceiro = useMemo(() => {
    if (!dados || !dados.lancamentos30) return [];
    const agrupado = {};
    const hoje = new Date();
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
        const localDate = new Date(dObj.getTime() + dObj.getTimezoneOffset() * 60000);
        agrupado[dStr] = { data: dStr, label: localDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), Receitas: 0, Despesas: 0 };
      }
      if (l.tipo === "entrada") agrupado[dStr].Receitas += Number(l.valor) || 0;
      if (l.tipo === "saida") agrupado[dStr].Despesas += Number(l.valor) || 0;
    });
    return Object.values(agrupado).sort((a, b) => a.data.localeCompare(b.data));
  }, [dados]);

  // Processamento de Ranking de Produtos (Melhores e Piores)
  const rankings = useMemo(() => {
    if (!dados || !dados.producoes30) return { top: [], bottom: [] };
    const produtosMap = {};
    dados.producoes30.forEach(p => {
      const nome = p.prato_nome || "Desconhecido";
      if (!produtosMap[nome]) produtosMap[nome] = { nome, qtd: 0, lucro: 0 };
      produtosMap[nome].qtd += Number(p.quantidade) || 0;
      produtosMap[nome].lucro += (Number(p.receita_potencial) || 0) - (Number(p.custo_total) || 0);
    });
    const lista = Object.values(produtosMap).sort((a, b) => b.lucro - a.lucro);
    return {
      top: lista.slice(0, 5),
      bottom: lista.length > 5 ? lista.slice(-5).reverse() : []
    };
  }, [dados]);

  // Processamento de RH (Cargos)
  const chartRH = useMemo(() => {
    if (!dados || !dados.equipeDetalhada) return [];
    const cargos = {};
    dados.equipeDetalhada.forEach(f => {
      const c = f.cargo || 'Outros';
      if (!cargos[c]) cargos[c] = 0;
      cargos[c]++;
    });
    return Object.keys(cargos).map(k => ({ name: k, value: cargos[k] })).sort((a, b) => b.value - a.value);
  }, [dados]);

  // Processamento do Calendário
  const calendarDays = useMemo(() => {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth();
    
    // Pegar o primeiro dia do mês e qual dia da semana cai (0 = Domingo)
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    
    const dias = [];
    // Espaços vazios no início
    for (let i = 0; i < primeiroDia.getDay(); i++) {
      dias.push(null);
    }
    // Preencher dias
    for (let i = 1; i <= ultimoDia.getDate(); i++) {
      const current = new Date(ano, mes, i);
      const strDate = current.toISOString().split('T')[0];
      
      // Encontrar eventos desse dia
      const evts = (dados?.eventos || []).filter(e => {
         return new Date(e.data_evento).toISOString().split('T')[0] === strDate;
      });
      
      dias.push({
        dia: i,
        data: strDate,
        hoje: i === hoje.getDate(),
        eventos: evts
      });
    }
    return dias;
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
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 pb-20">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Visão Geral da Unidade</h1>
        <p className="text-slate-500 font-medium mt-1">Resumo dos últimos 30 dias de operação real.</p>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Faturamento */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm transition hover:shadow-md">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <DollarSign size={20} />
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Faturamento</p>
          </div>
          <h2 className="text-2xl font-black text-slate-800">{fmtBRL(dados.receita30)}</h2>
        </div>

        {/* Lucro/Prejuízo */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm transition hover:shadow-md">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${dados.lucro30 >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              {dados.lucro30 >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Lucro Líquido</p>
          </div>
          <h2 className={`text-2xl font-black ${dados.lucro30 >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtBRL(dados.lucro30)}</h2>
        </div>

        {/* Termômetro de CMO & CMV */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm transition hover:shadow-md">
          <div className="grid grid-cols-2 gap-4 h-full">
             <div className="flex flex-col justify-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">Custo Mercadoria</p>
                <div className="flex items-end gap-1">
                   <h2 className={`text-xl font-black ${dados.cmv > 35 ? 'text-orange-500' : 'text-slate-800'}`}>{fmtPct(dados.cmv)}</h2>
                </div>
                {/* Barrinha CMV */}
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                   <div className={`h-full ${dados.cmv > 35 ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(dados.cmv, 100)}%` }} />
                </div>
             </div>
             <div className="flex flex-col justify-center border-l border-slate-100 pl-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">Custo Mão de Obra</p>
                <div className="flex items-end gap-1">
                   <h2 className={`text-xl font-black ${dados.cmo > 30 ? 'text-red-500' : 'text-slate-800'}`}>{fmtPct(dados.cmo)}</h2>
                </div>
                {/* Barrinha CMO */}
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                   <div className={`h-full ${dados.cmo > 30 ? 'bg-red-500' : dados.cmo > 25 ? 'bg-yellow-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(dados.cmo, 100)}%` }} />
                </div>
             </div>
          </div>
        </div>

        {/* RH & Estoque Simples */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-center transition hover:shadow-md">
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

      {/* Grid Secundário */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Gráfico Financeiro */}
        <div className="xl:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col transition hover:shadow-md">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-6">Evolução Financeira Diária</h3>
          <div className="h-[300px] w-full mt-auto">
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

        {/* Organograma RH */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col transition hover:shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <Users size={18} className="text-blue-500"/>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Organograma (Equipe)</h3>
          </div>
          <p className="text-xs text-slate-400 mb-6 font-medium">Distribuição de funcionários por cargo.</p>
          
          {chartRH.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm font-medium">Nenhum funcionário ativo.</div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartRH}
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {chartRH.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                       contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                       itemStyle={{ fontWeight: 'bold', color: '#334155' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {chartRH.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></div>
                    {entry.name} ({entry.value})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Grid Terciário (Engenharia + Calendário) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Engenharia de Cardápio (Top & Bottom) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm transition hover:shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <ShoppingCart size={18} className="text-indigo-500"/>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Engenharia de Cardápio</h3>
          </div>

          {rankings.top.length === 0 ? (
             <div className="text-center py-8 text-slate-400 text-sm font-medium">Nenhuma produção ou venda.</div>
          ) : (
             <div className="space-y-6">
                <div>
                   <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-3 flex items-center gap-1"><TrendingUp size={14}/> Campeões de Lucro</p>
                   <div className="space-y-3">
                     {rankings.top.map((p, i) => (
                       <div key={i} className="flex items-center justify-between">
                         <div className="flex items-center gap-3 overflow-hidden">
                           <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 font-bold text-[9px] flex items-center justify-center shrink-0">{i+1}</span>
                           <span className="text-sm font-bold text-slate-700 truncate">{p.nome}</span>
                         </div>
                         <span className="text-sm font-black text-emerald-600 shrink-0 ml-2">{fmtBRL(p.lucro)}</span>
                       </div>
                     ))}
                   </div>
                </div>

                {rankings.bottom.length > 0 && (
                   <div className="pt-4 border-t border-slate-100">
                      <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-1"><TrendingDown size={14}/> Atenção (Menor Lucro)</p>
                      <div className="space-y-3">
                        {rankings.bottom.map((p, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <span className="text-sm font-bold text-slate-500 truncate">{p.nome}</span>
                            </div>
                            <span className="text-sm font-bold text-red-400 shrink-0 ml-2">{fmtBRL(p.lucro)}</span>
                          </div>
                        ))}
                      </div>
                   </div>
                )}
             </div>
          )}
        </div>

        {/* Calendário Visual */}
        <div className="xl:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm transition hover:shadow-md">
           <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <CalendarIcon size={18} className="text-amber-500"/>
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Calendário (Eventos e Marketing)</h3>
              </div>
              <div className="text-xs font-bold text-slate-400 uppercase bg-slate-50 px-3 py-1 rounded-full border border-slate-100">Mês Atual</div>
           </div>

           {/* Grid de Dias da Semana */}
           <div className="grid grid-cols-7 gap-2 mb-2">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d}</div>
              ))}
           </div>

           {/* Grid de Dias do Mês */}
           <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((dia, idx) => {
                 if (!dia) return <div key={idx} className="aspect-square rounded-xl bg-slate-50/50"></div>;
                 
                 const hasEvent = dia.eventos.length > 0;
                 return (
                   <div 
                      key={idx} 
                      title={hasEvent ? dia.eventos.map(e => e.titulo || e.nome_evento).join(', ') : ''}
                      className={`
                         aspect-square rounded-xl flex flex-col p-1.5 relative border
                         ${dia.hoje ? 'border-amber-500 bg-amber-50 shadow-sm' : 'border-slate-100 bg-white hover:bg-slate-50'}
                         ${hasEvent ? 'cursor-help' : ''}
                      `}
                   >
                      <span className={`text-xs font-black ${dia.hoje ? 'text-amber-600' : 'text-slate-600'}`}>
                         {dia.dia}
                      </span>
                      {hasEvent && (
                         <div className="mt-auto space-y-1">
                            {dia.eventos.slice(0, 2).map((ev, i) => (
                               <div key={i} className="w-full text-[8px] font-bold text-white bg-amber-500 rounded px-1 py-0.5 truncate leading-none">
                                  {ev.titulo || ev.nome_evento || "Evento"}
                               </div>
                            ))}
                            {dia.eventos.length > 2 && (
                               <div className="w-full text-[8px] font-bold text-amber-500 text-center leading-none">+ {dia.eventos.length - 2}</div>
                            )}
                         </div>
                      )}
                   </div>
                 );
              })}
           </div>

        </div>

      </div>
      
    </div>
  );
}
