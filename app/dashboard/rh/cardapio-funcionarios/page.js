"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../../../context/ERPContext";
import { fetchFichas } from "../../../../lib/operacao";
import { Utensils, Printer, ArrowLeft, Plus, X, Search } from "lucide-react";

export default function CardapioFuncionarios() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const [fichas, setFichas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  
  // Estrutura do cardápio semanal
  const [semana, setSemana] = useState({
    Segunda: [],
    Terça: [],
    Quarta: [],
    Quinta: [],
    Sexta: [],
    Sábado: [],
    Domingo: []
  });

  const [diaSelecionado, setDiaSelecionado] = useState(null);

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      const { data } = await fetchFichas(unidadeAtiva);
      setFichas(data || []);
      
      // Tentar carregar do localStorage
      const salvo = localStorage.getItem(`cardapio_rh_${unidadeAtiva}`);
      if (salvo) {
        try {
          setSemana(JSON.parse(salvo));
        } catch (e) {}
      }
      setLoading(false);
    }
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva]);

  // Salvar no localstorage sempre que mudar
  useEffect(() => {
    if (!loading && unidadeAtiva) {
      localStorage.setItem(`cardapio_rh_${unidadeAtiva}`, JSON.stringify(semana));
    }
  }, [semana, loading, unidadeAtiva]);

  const addReceita = (ficha, dia) => {
    setSemana(prev => ({
      ...prev,
      [dia]: [...prev[dia], ficha]
    }));
    setDiaSelecionado(null);
    setBusca("");
  };

  const removeReceita = (index, dia) => {
    setSemana(prev => {
      const novo = [...prev[dia]];
      novo.splice(index, 1);
      return { ...prev, [dia]: novo };
    });
  };

  const imprimirCardapio = () => {
    const html = `
      <html>
        <head>
          <title>Cardápio Semanal - Refeitório</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #1e293b; }
            h1 { text-align: center; font-size: 24px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 30px; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 40px; }
            .dia-card { border: 2px solid #e2e8f0; border-radius: 8px; padding: 15px; }
            .dia-titulo { font-weight: bold; font-size: 16px; margin-bottom: 10px; text-transform: uppercase; background: #f8fafc; padding: 5px; text-align: center; }
            .receita-item { margin-bottom: 8px; font-weight: bold; color: #334155; display: flex; align-items: center; gap: 5px; font-size: 14px; }
            .receita-item::before { content: "•"; color: #10b981; font-size: 18px; }
            
            .receitas-detalhes { page-break-before: always; }
            .receita-box { margin-bottom: 30px; border: 1px solid #cbd5e1; padding: 20px; border-radius: 8px; }
            .receita-box h2 { font-size: 18px; margin-top: 0; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px; }
            .ingredientes-lista { column-count: 2; margin-top: 5px; }
            .ingrediente { font-size: 13px; margin-bottom: 5px; }
            .modo-preparo { margin-top: 20px; font-size: 13px; line-height: 1.5; white-space: pre-wrap; background: #f8fafc; padding: 15px; border-radius: 8px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>Cardápio Semanal dos Funcionários</h1>
          <div class="grid">
            ${Object.entries(semana).map(([dia, pratos]) => `
              <div class="dia-card">
                <div class="dia-titulo">${dia}</div>
                ${pratos.length === 0 ? '<div style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 10px;">A definir</div>' : ''}
                ${pratos.map(p => `
                  <div class="receita-item">${p.nome_receita}</div>
                `).join('')}
              </div>
            `).join('')}
          </div>

          <div class="receitas-detalhes">
            <h1>Receitas do Cardápio</h1>
            ${Object.values(semana).flat().filter((v,i,a)=>a.findIndex(t=>(t.id === v.id))===i).map(ficha => `
              <div class="receita-box">
                <h2>${ficha.nome_receita} <span style="font-weight:normal; font-size:14px; color:#64748b; margin-left: 10px;">(Rende ${ficha.rendimento_porcoes} ${ficha.rendimento_unidade})</span></h2>
                <strong>Ingredientes:</strong>
                <div class="ingredientes-lista">
                  ${(ficha.fichas_ingredientes || []).map(ing => {
                     let nome = ing.insumos?.nome || "Sub-receita";
                     return `<div class="ingrediente">- ${ing.quantidade} ${ing.insumos?.unidade_medida || ''} ${nome}</div>`;
                  }).join('')}
                </div>
                ${ficha.modo_preparo ? `
                  <div style="margin-top: 20px;"><strong>Modo de Preparo:</strong></div>
                  <div class="modo-preparo">${ficha.modo_preparo}</div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </body>
      </html>
    `;
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const fichasFiltradas = fichas.filter(f => f.nome_receita.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="min-h-screen font-sans pb-24 text-slate-800">
      {/* HEADER */}
      <div className="pt-6 pb-8 px-6 max-w-5xl mx-auto flex items-center justify-between">
         <div className="flex items-center gap-4">
           <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors shadow-sm"><ArrowLeft size={18}/></button>
           <div className="w-16 h-16 rounded-3xl bg-slate-100 text-emerald-600 flex items-center justify-center shadow-inner">
              <Utensils size={32} />
           </div>
           <div>
              <h1 className="text-4xl font-black tracking-tighter text-slate-900">Cardápio da Equipe</h1>
              <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">Refeitório de Funcionários</p>
           </div>
         </div>
         <button onClick={imprimirCardapio} className="flex items-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-900 transition-colors shadow-lg shadow-slate-800/20">
            <Printer size={18} /> Imprimir Cardápio e Receitas
         </button>
      </div>

      <div className="max-w-5xl mx-auto px-6">
         {loading ? (
           <div className="text-center p-10 font-bold text-slate-500">Carregando fichas técnicas...</div>
         ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {Object.entries(semana).map(([dia, pratos]) => (
               <div key={dia} className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-5 flex flex-col">
                 <div className="flex items-center justify-between mb-4">
                   <h2 className="font-black text-lg text-slate-800">{dia}</h2>
                   <button onClick={() => setDiaSelecionado(dia)} className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors"><Plus size={16}/></button>
                 </div>
                 
                 <div className="flex-1 space-y-2">
                   {pratos.length === 0 ? (
                     <div className="text-center py-6 text-slate-400 font-medium text-sm border-2 border-dashed border-slate-100 rounded-xl">Sem pratos definidos</div>
                   ) : pratos.map((p, idx) => (
                     <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-100 p-3 rounded-xl">
                       <span className="font-bold text-slate-700 text-sm line-clamp-1">{p.nome_receita}</span>
                       <button onClick={() => removeReceita(idx, dia)} className="text-slate-400 hover:text-red-500 p-1"><X size={14}/></button>
                     </div>
                   ))}
                 </div>
               </div>
             ))}
           </div>
         )}
      </div>

      {/* Modal Selecionar Receita */}
      {diaSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[32px] w-full max-w-lg p-6 sm:p-8 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
             <div className="flex items-center justify-between mb-6">
               <h3 className="text-2xl font-black text-slate-800">Prato para {diaSelecionado}</h3>
               <button onClick={() => setDiaSelecionado(null)} className="p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200"><X size={20}/></button>
             </div>
             
             <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center gap-3 mb-4 shrink-0">
               <Search size={18} className="text-slate-400"/>
               <input autoFocus type="text" placeholder="Buscar receita..." value={busca} onChange={e=>setBusca(e.target.value)} className="w-full bg-transparent outline-none font-medium text-slate-700"/>
             </div>

             <div className="flex-1 overflow-y-auto pr-2 space-y-2">
               {fichasFiltradas.length === 0 ? (
                 <div className="text-center p-6 text-slate-500 font-medium text-sm">Nenhuma receita encontrada.</div>
               ) : fichasFiltradas.map(f => (
                 <button key={f.id} onClick={() => addReceita(f, diaSelecionado)} className="w-full text-left bg-white border border-slate-200 p-4 rounded-xl hover:border-emerald-500 hover:shadow-sm transition-all group flex items-center justify-between">
                   <div>
                     <div className="font-bold text-slate-800 group-hover:text-emerald-700">{f.nome_receita}</div>
                     <div className="text-[11px] font-semibold text-slate-500 mt-1">Rende {f.rendimento_porcoes} {f.rendimento_unidade}</div>
                   </div>
                   <Plus size={18} className="text-slate-300 group-hover:text-emerald-500"/>
                 </button>
               ))}
             </div>
          </div>
        </div>
      )}

    </div>
  );
}
