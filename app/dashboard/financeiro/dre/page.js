"use client";

import { useState, useEffect, useMemo } from "react";
import { BarChart3, TrendingUp, TrendingDown, Info, Calculator, FileText, ArrowRight } from "lucide-react";
import {
  PageBody, Card, EmptyState, fmtBRL, fmtPct,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchLancamentos } from "../../../lib/financeiro";

export default function DreGerencialPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [lanc, setLanc] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodoLetra, setPeriodoLetra] = useState("Mensal");

  useEffect(() => {
    setLoading(true);
    fetchLancamentos(unidadeAtiva).then(({ data }) => { setLanc(data || []); setLoading(false); });
  }, [unidadeAtiva]);

  // Cálculos contábeis do DRE
  const dre = useMemo(() => {
    const receitaBruta = lanc.filter((l) => l.tipo === "entrada").reduce((a, l) => a + (Number(l.valor) || 0), 0);
    
    // Categorizar despesas
    const categorias = {};
    lanc.filter((l) => l.tipo === "saida").forEach((l) => {
      categorias[l.categoria || "Outras despesas"] = (categorias[l.categoria || "Outras despesas"] || 0) + (Number(l.valor) || 0);
    });
    
    // Total de Custos Fixos + Variáveis
    const despesaTotal = Object.values(categorias).reduce((a, v) => a + v, 0);
    
    // Resultado Operacional Bruto (EBITDA Simulado)
    const ebitda = receitaBruta - despesaTotal;
    
    // Resultado Líquido
    const margem = receitaBruta > 0 ? (ebitda / receitaBruta) * 100 : 0;
    
    return { receitaBruta, categorias, despesaTotal, ebitda, margem };
  }, [lanc]);

  const temDados = lanc.length > 0;
  const isLucro = dre.ebitda >= 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      {/* HEADER EXECUTIVO */}
      <div className="bg-slate-900 text-white px-6 py-10 md:py-14 rounded-b-[40px] shadow-xl relative overflow-hidden">
         <div className="absolute top-0 right-0 p-8 opacity-5"><FileText size={200} /></div>
         
         <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10 max-w-5xl mx-auto">
            <div>
               <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                  <BarChart3 size={14}/> Engenharia Financeira
               </p>
               <h1 className="text-3xl md:text-5xl font-black tracking-tighter">DRE Gerencial.</h1>
               <p className="text-sm font-medium text-slate-500 mt-2">Demonstrativo de Resultados do Exercício da {unidadeInfo.nome}</p>
            </div>
            
            <div className="flex bg-slate-800 p-1 rounded-xl shadow-inner border border-slate-700">
               {["Semanal", "Mensal", "Anual"].map(p => (
                  <button 
                    key={p} onClick={() => setPeriodoLetra(p)}
                    className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${periodoLetra === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-white'}`}
                  >
                    {p}
                  </button>
               ))}
            </div>
         </div>
      </div>

      <PageBody className="max-w-5xl mx-auto -mt-8 relative z-20">
        {loading ? (
          <EmptyState icon={Calculator} title="Processando balanço..." />
        ) : !temDados ? (
          <EmptyState icon={BarChart3} title="Extrato Limpo" hint="Registre entradas e saídas no Fluxo de Caixa para o motor financeiro montar seu DRE." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             
             {/* COLUNA ESQUERDA: RESULTADO (1/3) */}
             <div className="lg:col-span-1 space-y-6">
                
                {/* O Grande Termômetro de Lucratividade */}
                <div className={`p-8 rounded-[32px] shadow-lg border relative overflow-hidden text-white ${isLucro ? 'bg-emerald-600 border-emerald-500' : 'bg-red-600 border-red-500'}`}>
                   <div className="absolute top-0 right-0 p-6 opacity-10">
                      {isLucro ? <TrendingUp size={120} /> : <TrendingDown size={120} />}
                   </div>
                   
                   <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-4">Resultado Líquido ({periodoLetra})</p>
                   
                   <h2 className="text-4xl font-black tracking-tighter drop-shadow-sm mb-2">{fmtBRL(dre.ebitda)}</h2>
                   
                   <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/20 backdrop-blur-md mt-2">
                      <span className="font-bold text-sm">Margem Líquida</span>
                      <span className="font-black text-lg bg-white text-slate-900 px-2 py-0.5 rounded-lg ml-1 shadow-sm">{fmtPct(dre.margem)}</span>
                   </div>
                   
                   <p className="text-xs font-medium text-white/80 mt-6 leading-relaxed">
                      {isLucro 
                        ? "Excelente! A operação está saudável e gerando caixa livre." 
                        : "Atenção Crítica: A operação consumiu mais caixa do que gerou."}
                   </p>
                </div>

                {/* Resumo Rápido */}
                <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-200">
                   <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-4 flex items-center gap-2"><Info size={16}/> Resumo do Período</h3>
                   
                   <div className="space-y-4">
                      <div>
                         <p className="text-[11px] font-bold text-slate-500 uppercase">Receitas Geradas</p>
                         <p className="text-xl font-black text-slate-900">{fmtBRL(dre.receitaBruta)}</p>
                      </div>
                      <div className="w-full h-px bg-slate-100"></div>
                      <div>
                         <p className="text-[11px] font-bold text-slate-500 uppercase">Custos Consumidos</p>
                         <p className="text-xl font-black text-slate-900">{fmtBRL(dre.despesaTotal)}</p>
                      </div>
                   </div>
                </div>

             </div>

             {/* COLUNA DIREITA: TABELA DRE NÍVEL WALL STREET (2/3) */}
             <div className="lg:col-span-2">
                <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
                   
                   {/* Cabeçalho Tabela */}
                   <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-500">Descrição da Conta</span>
                      <span className="text-xs font-black uppercase tracking-widest text-slate-500">Valor Acumulado</span>
                   </div>

                   {/* Linha: Receita Operacional Bruta */}
                   <LinhaTotal 
                     codigo="1" 
                     label="(=) Receita Operacional Bruta" 
                     valor={dre.receitaBruta} 
                     cor="text-slate-900" 
                     bg="bg-slate-100/50" 
                   />

                   <div className="h-4"></div>

                   {/* Cabeçalho de Despesas */}
                   <div className="px-6 py-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-50 px-2 py-1 rounded-md">
                         (-) Custos & Despesas Operacionais
                      </span>
                   </div>

                   {/* Listagem de Despesas Indentada */}
                   <div className="pb-4">
                      {Object.entries(dre.categorias).sort((a, b) => b[1] - a[1]).map(([cat, val], idx) => (
                         <div key={cat} className="flex justify-between items-center px-6 py-2.5 hover:bg-slate-50 transition-colors group">
                            <div className="flex items-center gap-3">
                               <span className="text-[10px] font-bold text-slate-500 w-4">{idx + 1}</span>
                               <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors">{cat}</span>
                            </div>
                            <span className="text-sm font-medium text-slate-500 font-mono">
                               - {fmtBRL(val)}
                            </span>
                         </div>
                      ))}
                      {Object.keys(dre.categorias).length === 0 && (
                         <div className="px-6 py-4 text-sm text-slate-500 font-medium">Nenhuma despesa registrada.</div>
                      )}
                   </div>

                   {/* Linha: Total de Despesas */}
                   <LinhaTotal 
                     codigo="2" 
                     label="(=) Custo Operacional Total" 
                     valor={-dre.despesaTotal} 
                     cor="text-red-600" 
                     bg="bg-red-50" 
                   />

                   <div className="h-4"></div>

                   {/* Linha Mestra: Resultado Líquido */}
                   <div className={`px-6 py-6 border-t-2 border-slate-900 flex justify-between items-center ${isLucro ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      <div className="flex items-center gap-3">
                         <span className="w-6 h-6 rounded-md bg-slate-900 text-white flex items-center justify-center text-xs font-black">3</span>
                         <div>
                            <span className={`text-lg font-black uppercase tracking-widest ${isLucro ? 'text-emerald-900' : 'text-red-900'}`}>(=) Resultado Líquido</span>
                            <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${isLucro ? 'text-emerald-600' : 'text-red-600'}`}>Lucro ou Prejuízo do Exercício</p>
                         </div>
                      </div>
                      <span className={`text-2xl font-black font-mono ${isLucro ? 'text-emerald-600' : 'text-red-600'}`}>
                         {fmtBRL(dre.ebitda)}
                      </span>
                   </div>

                </div>
             </div>

          </div>
        )}
      </PageBody>
    </div>
  );
}

function LinhaTotal({ codigo, label, valor, cor, bg }) {
  return (
    <div className={`flex justify-between items-center px-6 py-4 border-b border-slate-200 ${bg}`}>
      <div className="flex items-center gap-3">
         <span className="text-[10px] font-black text-slate-500 border border-slate-300 w-5 h-5 rounded-md flex items-center justify-center bg-white">{codigo}</span>
         <span className={`text-sm font-black uppercase tracking-widest ${cor}`}>{label}</span>
      </div>
      <span className={`text-lg font-black font-mono ${cor}`}>{fmtBRL(valor)}</span>
    </div>
  );
}
