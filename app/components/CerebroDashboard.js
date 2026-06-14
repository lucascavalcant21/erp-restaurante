"use client";

import { useState, useEffect, useMemo } from "react";
import { Brain, TrendingUp, DollarSign, Users, Package } from "lucide-react";
import { Card, SectionLabel, fmtBRL } from "./ui";
import { UNIDADES } from "../lib/unidades";
import { carregarDadosDaUnidade, consolidarRede, fmtPct } from "../lib/cerebro";
import { checkAlertasLimpeza } from "../lib/suprimentos";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar, Legend
} from "recharts";

export default function CerebroDashboard() {
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertasLimpeza, setAlertasLimpeza] = useState([]);

  useEffect(() => {
    let vivo = true;
    Promise.all(UNIDADES.map(carregarDadosDaUnidade)).then((res) => {
      if (vivo) {
        setUnidades(res);
        setLoading(false);
      }
    });
    
    checkAlertasLimpeza().then((res) => {
      if (vivo && res.data) setAlertasLimpeza(res.data);
    });
    
    return () => { vivo = false; };
  }, []);

  const rede = useMemo(() => consolidarRede(unidades), [unidades]);

  // Prepara dados de evolução (últimos 30 dias)
  const dadosEvolucao = useMemo(() => {
    if (!unidades.length) return [];
    const dias = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    for (let i = 29; i >= 0; i--) {
      const d = new Date(hoje.getTime() - i * 86400000);
      const strData = d.toISOString().slice(0, 10);
      const diaFormatado = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      
      let receitaDia = 0;
      let despesaDia = 0;

      unidades.forEach(u => {
        u.lancamentos30?.forEach(l => {
          if (l.data.startsWith(strData)) {
            if (l.tipo === "entrada") receitaDia += Number(l.valor) || 0;
            if (l.tipo === "saida") despesaDia += Number(l.valor) || 0;
          }
        });
      });

      dias.push({
        data: diaFormatado,
        Receita: receitaDia,
        Despesa: despesaDia,
        Lucro: receitaDia - despesaDia
      });
    }
    return dias;
  }, [unidades]);

  // Prepara dados de pizza (Custos vs Lucro)
  const dadosPizza = useMemo(() => {
    if (!rede || rede.receita === 0) return [];
    const cmvEstimado = (rede.cmv / 100) * rede.receita;
    const cmo = rede.folha;
    const outrosCustos = Math.max(0, rede.despesa - cmo - cmvEstimado);
    const lucroLiquido = Math.max(0, rede.lucro);

    return [
      { name: "Lucro Líquido", value: lucroLiquido, color: "#10B981" },
      { name: "CMV (Mercadoria)", value: cmvEstimado, color: "#F59E0B" },
      { name: "CMO (Mão de Obra)", value: cmo, color: "#8B5CF6" },
      { name: "Outras Despesas", value: outrosCustos, color: "#EF4444" }
    ].filter(d => d.value > 0);
  }, [rede]);

  // Prepara dados de barras (Ranking Unidades)
  const dadosRanking = useMemo(() => {
    return unidades.map(u => ({
      name: u.nome,
      Receita: u.receita30,
      Lucro: u.lucro30
    })).sort((a, b) => b.Receita - a.Receita);
  }, [unidades]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Brain size={48} className="animate-pulse" style={{ color: "var(--accent)" }} />
        <p style={{ color: "var(--dim)", fontWeight: 600 }}>O Cérebro está processando dados das unidades...</p>
      </div>
    );
  }

  const kpiBox = (label, value, Icon, color, sub) => (
    <Card className="p-5 flex flex-col justify-between" style={{ borderBottom: `4px solid ${color}`, boxShadow: `0 10px 30px -10px ${color}20` }}>
      <div className="flex justify-between items-start mb-4">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon size={22} style={{ color }} />
        </div>
        <p className="text-[11px] uppercase font-bold tracking-widest mt-2" style={{ color: "var(--dim)" }}>{label}</p>
      </div>
      <div>
        <p className="text-3xl font-black tracking-tight" style={{ color: "var(--fg)" }}>{value}</p>
        {sub && <p className="text-xs font-semibold mt-1" style={{ color: "var(--muted)" }}>{sub}</p>}
      </div>
    </Card>
  );

  return (
    <div className="p-4 space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)", boxShadow: "0 8px 16px rgba(139, 92, 246, 0.25)" }}>
          <Brain size={24} color="#fff" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: "var(--fg)" }}>Cérebro ERP</h1>
          <p className="text-sm font-semibold" style={{ color: "var(--dim)" }}>Central de Inteligência • Últimos 30 dias</p>
        </div>
      </div>

      <div>
        <SectionLabel>Visão Macro da Rede</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpiBox("Receita Total", fmtBRL(rede.receita), TrendingUp, "#10B981", "Faturamento somado")}
          {kpiBox("Lucro Líquido", fmtBRL(rede.lucro), DollarSign, rede.lucro >= 0 ? "#3B82F6" : "#EF4444", "Receitas - Despesas")}
          {kpiBox("CMV Médio", fmtPct(rede.cmv), Package, rede.cmv > 35 ? "#EF4444" : "#F59E0B", "Custo da Mercadoria Vendida")}
          {kpiBox("CMO Médio", fmtPct(rede.cmo), Users, rede.cmo > 30 ? "#EF4444" : "#8B5CF6", "Custo de Mão de Obra")}
        </div>
      </div>

      {alertasLimpeza.length > 0 && (
        <div className="p-4 rounded-2xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Package size={20} color="#EF4444" />
            <p className="font-bold text-[#EF4444]">Alertas de Abastecimento (Limpeza & Suprimentos)</p>
          </div>
          <div className="space-y-2">
            {alertasLimpeza.map((alerta, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm font-semibold" style={{ color: "var(--fg)" }}>
                <span>Unidade <span className="uppercase text-[#EF4444]">{alerta.unidade_id}</span> precisa de <strong>{alerta.item}</strong></span>
                <span className="text-xs" style={{ color: "var(--dim)" }}>Estoque: {alerta.quantidade} (Mín: {alerta.minimo})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gráficos Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gráfico de Evolução (Ocupa 2 colunas) */}
        <div className="lg:col-span-2">
          <SectionLabel>Evolução de Crescimento (30 Dias)</SectionLabel>
          <Card className="p-4 h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dadosEvolucao} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                <XAxis dataKey="data" stroke="var(--dim)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--dim)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${value/1000}k`} />
                <RTooltip 
                  contentStyle={{ backgroundColor: 'var(--panel)', border: 'none', borderRadius: '8px', color: 'var(--fg)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value) => fmtBRL(value)}
                  labelStyle={{ color: 'var(--dim)', fontWeight: 'bold', marginBottom: '8px' }}
                />
                <Area type="monotone" dataKey="Receita" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorReceita)" />
                <Area type="monotone" dataKey="Despesa" stroke="#EF4444" strokeWidth={3} fillOpacity={1} fill="url(#colorDespesa)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Gráfico de Pizza */}
        <div>
          <SectionLabel>Distribuição de Custos</SectionLabel>
          <Card className="p-4 h-[350px] flex flex-col">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dadosPizza}
                  cx="50%" cy="45%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {dadosPizza.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RTooltip formatter={(value) => fmtBRL(value)} contentStyle={{ backgroundColor: 'var(--panel)', border: 'none', borderRadius: '8px', color: 'var(--fg)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: '600', color: 'var(--dim)' }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Gráfico de Barras / Ranking */}
        <div className="lg:col-span-3">
          <SectionLabel>Ranking de Unidades (Receita vs Lucro)</SectionLabel>
          <Card className="p-4 h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosRanking} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                <XAxis dataKey="name" stroke="var(--dim)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--dim)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${value/1000}k`} />
                <RTooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: 'var(--panel)', border: 'none', borderRadius: '8px', color: 'var(--fg)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value) => fmtBRL(value)}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                <Bar dataKey="Receita" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={40} />
                <Bar dataKey="Lucro" fill="#10B981" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

      </div>
    </div>
  );
}
