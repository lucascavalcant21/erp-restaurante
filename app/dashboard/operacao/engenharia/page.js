"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../../../context/ERPContext";
import { fetchEngenharia } from "../../../../lib/engenharia";
import { BarChart, ArrowLeft, Star, Heart, Puzzle, Ghost, TrendingUp, AlertTriangle } from "lucide-react";
import { PageHeader, PageBody, Card, EmptyState, fmtBRL } from "../../../../components/ui";

// Matriz de classificação para estilos
const MATRIZ = {
  "Estrela": { icon: Star, cor: "#F59E0B", bg: "#FEF3C7", desc: "Vende muito, Lucra muito. Mantenha a qualidade." },
  "Burro de Carga": { icon: Heart, cor: "#10B981", bg: "#D1FAE5", desc: "Vende muito, Lucra pouco. Suba o preço ou reduza custo." },
  "Quebra-Cabeça": { icon: Puzzle, cor: "#3B82F6", bg: "#DBEAFE", desc: "Lucra muito, Vende pouco. Destaque no cardápio/promoção." },
  "Cachorro": { icon: Ghost, cor: "#EF4444", bg: "#FEE2E2", desc: "Vende pouco, Lucra pouco. Considere remover do menu." }
};

export default function EngenhariaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dept = searchParams.get("dept") || "cozinha";
  
  const { unidadeAtiva, unidadeInfo } = useERP();
  
  const [itens, setItens] = useState([]);
  const [medias, setMedias] = useState({ avgMargem: 0, avgVolume: 0 });
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    setLoading(true);
    const { data, medias } = await fetchEngenharia(unidadeAtiva, dept);
    setItens(data || []);
    if(medias) setMedias(medias);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva, dept]);

  // Agrupa os itens pela classificação
  const grupos = useMemo(() => {
    const res = { "Estrela": [], "Burro de Carga": [], "Quebra-Cabeça": [], "Cachorro": [] };
    itens.forEach(i => res[i.classificacao].push(i));
    return res;
  }, [itens]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      {/* HEADER */}
      <div className="pt-6 pb-8 px-6 max-w-5xl mx-auto flex items-center gap-4">
         <button onClick={() => router.back()} className="w-12 h-12 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:bg-slate-100 transition-colors">
            <ArrowLeft size={20} />
         </button>
         <div className="w-16 h-16 rounded-3xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-inner">
            <BarChart size={32} />
         </div>
         <div>
            <h1 className="text-3xl font-black tracking-tighter text-slate-900">Engenharia de Cardápio</h1>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">Matriz de Lucratividade • {unidadeInfo?.nome}</p>
         </div>
      </div>

      <PageBody className="max-w-5xl">
        {loading ? (
           <div className="text-center p-10"><p className="font-bold text-slate-400">Calculando matriz...</p></div>
        ) : itens.length === 0 ? (
           <EmptyState icon={BarChart} title="Sem dados suficientes" hint="Você precisa ter produtos no cardápio e histórico de pedidos para que a inteligência calcule a rentabilidade." />
        ) : (
           <div className="space-y-6">
              
              {/* KPIs de Referência */}
              <div className="grid grid-cols-2 gap-4">
                 <Card className="flex items-center gap-4 border-l-4 border-l-indigo-500">
                    <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600"><TrendingUp size={24}/></div>
                    <div>
                       <p className="text-xs font-bold text-slate-400 uppercase">Média de Volume Vendido</p>
                       <p className="text-2xl font-black text-slate-800">{medias.avgVolume.toFixed(1)} un / prato</p>
                    </div>
                 </Card>
                 <Card className="flex items-center gap-4 border-l-4 border-l-emerald-500">
                    <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600"><TrendingUp size={24}/></div>
                    <div>
                       <p className="text-xs font-bold text-slate-400 uppercase">Média de Margem Bruta</p>
                       <p className="text-2xl font-black text-slate-800">{fmtBRL(medias.avgMargem)} / prato</p>
                    </div>
                 </Card>
              </div>

              {/* Matriz 2x2 UI */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {["Estrela", "Burro de Carga", "Quebra-Cabeça", "Cachorro"].map(tipo => {
                    const grupo = grupos[tipo];
                    const cfg = MATRIZ[tipo];
                    const Icon = cfg.icon;

                    return (
                       <div key={tipo} className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-sm flex flex-col h-[400px]">
                          <div className="flex items-start justify-between mb-4">
                             <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner" style={{backgroundColor: cfg.bg, color: cfg.cor}}>
                                   <Icon size={24} />
                                </div>
                                <div>
                                   <h2 className="text-xl font-black text-slate-900">{tipo}</h2>
                                   <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{grupo.length} ITENS</p>
                                </div>
                             </div>
                             <span className="text-xs font-bold px-2 py-1 rounded-md" style={{backgroundColor: cfg.bg, color: cfg.cor}}>
                                {tipo === "Estrela" ? "++ Volume / ++ Margem" : tipo === "Burro de Carga" ? "++ Volume / -- Margem" : tipo === "Quebra-Cabeça" ? "-- Volume / ++ Margem" : "-- Volume / -- Margem"}
                             </span>
                          </div>
                          <p className="text-sm font-medium text-slate-600 mb-4 px-1">{cfg.desc}</p>
                          
                          <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                             {grupo.length === 0 ? (
                                <p className="text-center text-slate-400 font-medium text-sm mt-10">Nenhum prato nesta categoria.</p>
                             ) : (
                                grupo.map(it => (
                                   <div key={it.id} className="flex justify-between items-center p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                                      <div>
                                         <p className="font-bold text-slate-800 text-sm">{it.nome}</p>
                                         <p className="text-[11px] font-medium text-slate-500">Custo: {fmtBRL(it.custo)} • Preço: {fmtBRL(it.preco)}</p>
                                      </div>
                                      <div className="text-right">
                                         <p className="text-sm font-black text-slate-900" style={{color: cfg.cor}}>{it.volume} un</p>
                                         <p className="text-[11px] font-bold text-slate-400 uppercase mt-0.5">+{fmtBRL(it.margem)} l.b.</p>
                                      </div>
                                   </div>
                                ))
                             )}
                          </div>
                       </div>
                    );
                 })}
              </div>

           </div>
        )}
      </PageBody>
    </div>
  );
}
