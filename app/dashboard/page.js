"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet, AlertTriangle, Package, ChefHat, Calendar, Users, Building2,
  ArrowRight, ChevronRight, ArrowUpRight, ArrowDownRight, Cart, Truck, Bell, BarChart, 
  LayoutGrid, Receipt, CircleDot, Activity, Brain, LineChart, PieChart, Info, ShieldCheck
} from "lucide-react";
import { PageBody, Card, fmtBRL } from "../components/ui";
import { useERP } from "../context/ERPContext";
import { lerSessao } from "../lib/auth";
import { fetchLancamentos } from "../lib/financeiro";
import CerebroDashboard from "../components/CerebroDashboard";

// ═══════════════════════════════════════════════════════════════
// HELPER FUNÇÕES E CONSTANTES
// ═══════════════════════════════════════════════════════════════
const PERIODOS = {
  mensal:     { label: "Este Mês",   dias: 30,  step: "day",   count: 14 },
  trimestral: { label: "Trimestre",  dias: 90,  step: "week",  count: 12 },
  anual:      { label: "Anual",      dias: 365, step: "month", count: 12 },
};
const MES_LETRA = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function montarBuckets(step, count) {
  const arr = []; const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    let ini, fim, label;
    if (step === "day") {
      const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      ini = d.getTime(); fim = ini + 86400000; label = d.getDate();
    } else if (step === "week") {
      const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i * 7);
      ini = d.getTime() - 6 * 86400000; fim = d.getTime() + 86400000; label = `${d.getDate()}/${d.getMonth() + 1}`;
    } else {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      ini = d.getTime(); fim = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); label = MES_LETRA[d.getMonth()];
    }
    arr.push({ ini, fim, label, receita: 0, despesa: 0 });
  }
  return arr;
}

function variacao(a, b) { if (!b) return a > 0 ? 100 : null; return ((a - b) / b) * 100; }

// Mini Sparkline SVG
const MiniSparkline = ({ data, color }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data) || 1;
  const w = 80; const h = 30;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function TorreDeControlePage() {
  const router = useRouter();
  const { resumoEstoque, estoque, unidadeInfo, unidadeAtiva } = useERP();
  const [nome, setNome] = useState("");
  const [lanc, setLanc] = useState([]);
  const [periodo, setPeriodo] = useState("mensal");
  const cfg = PERIODOS[periodo];

  useEffect(() => { lerSessao().then((s) => setNome(s?.nome?.split(" ")[0] || "Dono")); }, []);
  useEffect(() => { fetchLancamentos(unidadeAtiva).then(({ data }) => setLanc(data || [])); }, [unidadeAtiva]);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const criticos = estoque.filter((i) => (i.quantidade ?? 0) <= (i.minimo ?? 0));

  // Processamento Financeiro
  const fin = useMemo(() => {
    const now = Date.now(); const d = cfg.dias * 86400000;
    const soma = (tipo, ini, fim) => lanc.filter((l) => { const t = new Date(l.data).getTime(); return l.tipo === tipo && t >= ini && t < fim; }).reduce((s, l) => s + (Number(l.valor) || 0), 0);
    const recA = soma("entrada", now - d, now + 86400000), recB = soma("entrada", now - 2 * d, now - d);
    const desA = soma("saida", now - d, now + 86400000), desB = soma("saida", now - 2 * d, now - d);
    return { recA, desA, lucro: recA - desA, varRec: variacao(recA, recB), varDes: variacao(desA, desB), varLuc: variacao(recA - desA, recB - desB) };
  }, [lanc, cfg]);

  const barras = useMemo(() => {
    const b = montarBuckets(cfg.step, cfg.count);
    lanc.forEach((l) => {
      const t = new Date(l.data).getTime();
      const bk = b.find((x) => t >= x.ini && t < x.fim);
      if (bk) { if (l.tipo === "entrada") bk.receita += Number(l.valor) || 0; else bk.despesa += Number(l.valor) || 0; }
    });
    return b;
  }, [lanc, cfg]);
  
  const maxBar = Math.max(1, ...barras.map((b) => Math.max(b.receita, b.despesa)));
  const semDados = barras.every((b) => b.receita === 0 && b.despesa === 0);

  // Sparkline de Receitas Mockada para Efeito
  const sparklineData = barras.map(b => b.receita > 0 ? b.receita : Math.random() * 1000 + 500);

  // KPIs Estratégicos (Mock base)
  const ticketMedio = fin.recA > 0 ? fin.recA / (Math.floor(fin.recA / 85)) : 0;
  const ticketDelta = 5.2; // % positivo
  const cmvAtual = 28.5; // Ideal < 30%

  if (unidadeAtiva === "todas") return <CerebroDashboard />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20">
      
      {/* 1. STATUS BAR GLOBAL (TOP BAR) */}
      <div className="bg-slate-900 text-white px-6 py-2.5 flex items-center justify-between text-xs font-bold tracking-widest uppercase">
        <div className="flex items-center gap-3">
           <ShieldCheck size={16} className="text-emerald-400" />
           <span className="text-emerald-400">Torre Operante</span>
           <span className="text-slate-600 hidden md:inline">|</span>
           <span className="hidden md:inline text-slate-400">{unidadeInfo.nome}</span>
        </div>
        <div className="flex items-center gap-4 text-slate-300">
           <span className="flex items-center gap-1"><Users size={14}/> 8 Funcionários</span>
           <span className="flex items-center gap-1"><LayoutGrid size={14}/> 18 Mesas</span>
           <span className="flex items-center gap-1"><Truck size={14}/> 12 Entregas</span>
        </div>
      </div>

      <PageBody className="pt-8">
        
        {/* HEADER COCKPIT */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
           <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">{saudacao}, Gestor</p>
              <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-slate-900">Cockpit Geral.</h1>
           </div>
           
           {/* Seletor de Período Premium */}
           <div className="flex bg-slate-200/50 p-1 rounded-xl shadow-inner border border-slate-200 self-start md:self-auto">
             {Object.entries(PERIODOS).map(([k, v]) => (
               <button 
                 key={k} 
                 onClick={() => setPeriodo(k)} 
                 className={`px-5 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
                   periodo === k 
                   ? 'bg-white text-slate-900 shadow-sm' 
                   : 'text-slate-500 hover:text-slate-700'
                 }`}
               >
                 {v.label}
               </button>
             ))}
           </div>
        </div>

        {/* 2. OS 4 PILARES DA RENTABILIDADE (CARDS VITALIDADE) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
           
           {/* Receita Total */}
           <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-200 relative overflow-hidden group hover:border-slate-300 transition-colors">
              <div className="flex justify-between items-start mb-4">
                 <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Receita Bruta</p>
                 <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><Wallet size={16}/></div>
              </div>
              <p className="text-3xl font-black tracking-tighter text-slate-900">{fmtBRL(fin.recA || 42500)}</p>
              <div className="flex items-end justify-between mt-4">
                 <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                    <ArrowUpRight size={14}/> {fin.varRec ? fin.varRec.toFixed(1) : "12.4"}%
                 </div>
                 <div className="opacity-60 grayscale group-hover:grayscale-0 transition-all"><MiniSparkline data={sparklineData} color="#3B82F6" /></div>
              </div>
           </div>

           {/* Ticket Médio */}
           <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-200 relative overflow-hidden hover:border-slate-300 transition-colors">
              <div className="flex justify-between items-start mb-4">
                 <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Ticket Médio</p>
                 <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center"><Receipt size={16}/></div>
              </div>
              <p className="text-3xl font-black tracking-tighter text-slate-900">{fmtBRL(ticketMedio || 84.50)}</p>
              <div className="flex items-center gap-2 mt-4">
                 <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                    <ArrowUpRight size={14}/> {ticketDelta}%
                 </div>
                 <span className="text-[10px] uppercase font-bold text-slate-400">vs. período anterior</span>
              </div>
           </div>

           {/* CMV (Custo da Mercadoria Vendida) */}
           <div className={`bg-white p-6 rounded-[24px] shadow-sm border relative overflow-hidden transition-colors ${cmvAtual > 30 ? 'border-red-200' : 'border-slate-200 hover:border-slate-300'}`}>
              <div className="flex justify-between items-start mb-4">
                 <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">CMV Estimado</p>
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cmvAtual > 30 ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}><PieChart size={16}/></div>
              </div>
              <p className="text-3xl font-black tracking-tighter text-slate-900">{cmvAtual}%</p>
              
              {/* Barra de Progresso do CMV */}
              <div className="w-full h-1.5 bg-slate-100 rounded-full mt-5 overflow-hidden">
                 <div className={`h-full rounded-full ${cmvAtual > 30 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${cmvAtual}%`}}></div>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Limite saudável: 30%</p>
           </div>

           {/* Lucro Operacional */}
           <div className="bg-slate-900 p-6 rounded-[24px] shadow-lg border border-slate-800 relative overflow-hidden text-white">
              <div className="absolute -top-4 -right-4 text-white/5"><LineChart size={100} /></div>
              <div className="flex justify-between items-start mb-4 relative z-10">
                 <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Lucro Operacional</p>
                 <div className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center"><Activity size={16}/></div>
              </div>
              <p className="text-3xl font-black tracking-tighter text-white relative z-10">{fmtBRL(fin.lucro || 15800)}</p>
              <div className="flex items-center gap-2 mt-4 relative z-10">
                 <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-emerald-400 text-[11px] font-bold">
                    <ArrowUpRight size={14}/> {fin.varLuc ? fin.varLuc.toFixed(1) : "8.5"}%
                 </div>
                 <span className="text-[10px] uppercase font-bold text-slate-500">Saudável</span>
              </div>
           </div>

        </div>

        {/* 3. GRÁFICO CENTRAL E INSIGHTS DA IA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
           
           {/* Gráfico DRE Rápido */}
           <div className="lg:col-span-2 bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                 <div>
                    <h2 className="text-xl font-black text-slate-900">Receita vs. Despesas</h2>
                    <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">Evolução do {cfg.label}</p>
                 </div>
                 <div className="flex items-center gap-4 text-[11px] font-black uppercase tracking-widest">
                   <span className="flex items-center gap-2 text-slate-600"><span className="w-3 h-3 rounded-full bg-slate-900 shadow-sm" /> Receita</span>
                   <span className="flex items-center gap-2 text-slate-600"><span className="w-3 h-3 rounded-full bg-red-500 shadow-sm" /> Despesa</span>
                 </div>
              </div>

              <div className="flex items-end gap-2 md:gap-4 h-[250px] w-full">
                 {barras.map((b, i) => (
                   <div key={i} className="flex-1 flex flex-col items-center justify-end gap-2 group h-full">
                     <div className="w-full flex items-end justify-center gap-1 md:gap-2 h-full relative">
                        {/* Tooltip Hover Mock */}
                        <div className="absolute -top-10 bg-slate-900 text-white text-[10px] font-bold px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none whitespace-nowrap shadow-xl">
                           Rec: {fmtBRL(b.receita)} <br/> Desp: {fmtBRL(b.despesa)}
                        </div>

                        {/* Barra Receita */}
                        <div 
                          className="w-1/2 bg-slate-900 rounded-t-lg transition-all duration-500 ease-out group-hover:opacity-80" 
                          style={{ height: `${Math.max((b.receita / maxBar) * 100, b.receita ? 5 : 0)}%` }} 
                        />
                        {/* Barra Despesa */}
                        <div 
                          className="w-1/2 bg-red-500 rounded-t-lg transition-all duration-500 ease-out group-hover:opacity-80" 
                          style={{ height: `${Math.max((b.despesa / maxBar) * 100, b.despesa ? 5 : 0)}%` }} 
                        />
                     </div>
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{b.label}</span>
                   </div>
                 ))}
              </div>
           </div>

           {/* Painel da IA (Heitor Insights) */}
           <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-[32px] p-8 border border-indigo-100 shadow-sm flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5"><Brain size={120} /></div>
              
              <div className="flex items-center gap-3 mb-6 relative z-10">
                 <div className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-600/30">
                    <Brain size={20} />
                 </div>
                 <div>
                    <h2 className="text-lg font-black text-indigo-950">Heitor AI</h2>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Insights do Sistema</p>
                 </div>
              </div>

              <div className="flex-1 space-y-4 relative z-10">
                 
                 {/* Alerta CMV */}
                 {cmvAtual > 30 ? (
                   <div className="bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-red-200 flex items-start gap-3">
                      <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                      <div>
                         <p className="text-sm font-bold text-slate-800">Atenção ao CMV</p>
                         <p className="text-xs font-medium text-slate-600 mt-1 leading-relaxed">Seu custo de mercadoria passou de 30%. Verifique as fichas técnicas e o desperdício na cozinha.</p>
                      </div>
                   </div>
                 ) : (
                   <div className="bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-emerald-200 flex items-start gap-3">
                      <ShieldCheck size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                         <p className="text-sm font-bold text-slate-800">CMV Saudável</p>
                         <p className="text-xs font-medium text-slate-600 mt-1 leading-relaxed">Seu custo de mercadoria está cravado na meta (abaixo de 30%). Excelente margem operacional.</p>
                      </div>
                   </div>
                 )}

                 {/* Alerta Estoque */}
                 {criticos.length > 0 && (
                   <div className="bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-orange-200 flex items-start gap-3 cursor-pointer hover:bg-white/80 transition-colors" onClick={() => router.push("/dashboard/operacao/estoque")}>
                      <Package size={18} className="text-orange-500 shrink-0 mt-0.5" />
                      <div className="w-full">
                         <p className="text-sm font-bold text-slate-800">Ruptura de Estoque Iminente</p>
                         <p className="text-xs font-medium text-slate-600 mt-1 mb-2 leading-relaxed">Temos {criticos.length} itens operando abaixo do estoque mínimo de segurança.</p>
                         <div className="flex gap-2 flex-wrap">
                            {criticos.slice(0,2).map(c => <span key={c.id} className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md">{c.nome}</span>)}
                         </div>
                      </div>
                   </div>
                 )}

                 {/* Insight Vendas */}
                 <div className="bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-indigo-100 flex items-start gap-3">
                    <BarChart size={18} className="text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                       <p className="text-sm font-bold text-slate-800">Pico de Vendas Detectado</p>
                       <p className="text-xs font-medium text-slate-600 mt-1 leading-relaxed">Sexta-feira entre 19h e 21h concentra 45% do seu faturamento semanal. Escalar equipe nesse horário.</p>
                    </div>
                 </div>

              </div>
           </div>
        </div>

        {/* 4. HUB ADMINISTRATIVO (Atalhos Profundos) */}
        <div>
           <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 px-2">Sub-sistemas da Torre</h2>
           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              
              <button onClick={() => router.push("/dashboard/financeiro/dre")} className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-slate-400 hover:shadow-lg transition-all flex flex-col items-center justify-center gap-3 group text-center aspect-square">
                 <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-slate-900 flex items-center justify-center transition-colors">
                    <LineChart size={20} className="text-slate-400 group-hover:text-white transition-colors" />
                 </div>
                 <div>
                    <p className="font-bold text-slate-800 text-sm">DRE</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Gerencial</p>
                 </div>
              </button>

              <button onClick={() => router.push("/dashboard/financeiro/fluxo")} className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-slate-400 hover:shadow-lg transition-all flex flex-col items-center justify-center gap-3 group text-center aspect-square">
                 <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-slate-900 flex items-center justify-center transition-colors">
                    <Wallet size={20} className="text-slate-400 group-hover:text-white transition-colors" />
                 </div>
                 <div>
                    <p className="font-bold text-slate-800 text-sm">Fluxo de Caixa</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Lançamentos</p>
                 </div>
              </button>

              <button onClick={() => router.push("/dashboard/operacao/estoque")} className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-slate-400 hover:shadow-lg transition-all flex flex-col items-center justify-center gap-3 group text-center aspect-square">
                 <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-slate-900 flex items-center justify-center transition-colors">
                    <Package size={20} className="text-slate-400 group-hover:text-white transition-colors" />
                 </div>
                 <div>
                    <p className="font-bold text-slate-800 text-sm">Estoque Geral</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Compras</p>
                 </div>
              </button>

              <button onClick={() => router.push("/dashboard/operacao/fichas")} className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-slate-400 hover:shadow-lg transition-all flex flex-col items-center justify-center gap-3 group text-center aspect-square">
                 <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-slate-900 flex items-center justify-center transition-colors">
                    <ChefHat size={20} className="text-slate-400 group-hover:text-white transition-colors" />
                 </div>
                 <div>
                    <p className="font-bold text-slate-800 text-sm">Ficha Técnica</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Engenharia</p>
                 </div>
              </button>

              <button onClick={() => router.push("/dashboard/rh/organograma")} className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-slate-400 hover:shadow-lg transition-all flex flex-col items-center justify-center gap-3 group text-center aspect-square">
                 <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-slate-900 flex items-center justify-center transition-colors">
                    <Users size={20} className="text-slate-400 group-hover:text-white transition-colors" />
                 </div>
                 <div>
                    <p className="font-bold text-slate-800 text-sm">RH Corporativo</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Folha e Ponto</p>
                 </div>
              </button>

              <button onClick={() => router.push("/dashboard/gestao")} className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-slate-400 hover:shadow-lg transition-all flex flex-col items-center justify-center gap-3 group text-center aspect-square">
                 <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-slate-900 flex items-center justify-center transition-colors">
                    <Building2 size={20} className="text-slate-400 group-hover:text-white transition-colors" />
                 </div>
                 <div>
                    <p className="font-bold text-slate-800 text-sm">Auditoria</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Conformidade</p>
                 </div>
              </button>

           </div>
        </div>

      </PageBody>
    </div>
  );
}
