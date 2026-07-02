"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchFichas } from "../../../lib/operacao";
import { registrarProducao } from "../../../lib/estoque";
import { fetchColaboradores } from "../../../lib/rh";
import { Flame, Droplets, Save, ArrowLeft, X, UtensilsCrossed, Wine, Maximize } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

// Custo total de PRODUZIR uma ficha, resolvendo bases (sub-receitas) em cascata.
// guard evita loop infinito se alguém criar uma referência circular.
function custoTotalDaFicha(f, todasFichas, guard = new Set()) {
  if (!f || guard.has(f.id)) return 0;
  guard.add(f.id);
  let total = 0;
  (f.fichas_ingredientes || []).forEach(fi => {
    if (fi.insumos) {
      total += (fi.insumos.custo_unitario || 0) * (fi.quantidade || 0);
    } else if (fi.subficha_id) {
      const base = todasFichas.find(x => x.id === fi.subficha_id);
      const custoBaseUnit = base ? custoTotalDaFicha(base, todasFichas, guard) / (base.rendimento_porcoes || 1) : 0;
      total += custoBaseUnit * (fi.quantidade || 0);
    }
  });
  return total;
}

function ProducaoRunner() {
  const router = useRouter();
  const { abrirMenu } = useERP();
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept") || "cozinha";
  
  const { unidadeAtiva } = useERP();
  const [fichas, setFichas] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [modalProduzir, setModalProduzir] = useState(false);
  const [fichaAtual, setFichaAtual] = useState(null);
  
  // Form de produção
  const [qtdProd, setQtdProd] = useState("1");
  const [colabSelecionado, setColabSelecionado] = useState("");

  const carregar = async () => {
    setLoading(true);
    const [resFichas, resColab] = await Promise.all([
       fetchFichas(unidadeAtiva, deptUrl),
       fetchColaboradores(unidadeAtiva)
    ]);
    setFichas(resFichas.data || []);
    setColaboradores(resColab.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva, deptUrl]);

  const abrirProduzir = (ficha) => {
    setFichaAtual(ficha);
    setQtdProd("1");
    setColabSelecionado("");
    setModalProduzir(true);
  };

  const handleConfirmar = async () => {
    if(!colabSelecionado) return alert("Selecione quem está produzindo.");
    const numQtd = Number(qtdProd);
    if(numQtd <= 0) return alert("Digite uma quantidade válida.");

    // O pulo do gato: registrarProducao abate do estoque automaticamente!
    const erro = await registrarProducao(unidadeAtiva, fichaAtual, numQtd, colabSelecionado);
    
    if(erro.error) return alert("Falha ao registrar produção: " + erro.error);

    alert("Produção registrada e estoque abatido com sucesso!");
    setModalProduzir(false);
  };

  const containerRef = useRef(null);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
       containerRef.current?.requestFullscreen?.();
    } else {
       document.exitFullscreen?.();
    }
  };

  const isBar = deptUrl === 'bar';

  return (
    <div ref={containerRef} className="min-h-screen pb-24 font-sans text-slate-800 bg-slate-50">
      
      {/* TOPBAR */}
      <div className="bg-white border-b border-slate-200 pt-6 pb-6 px-6 sticky top-0 z-10">
         <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => abrirMenu()} className="p-3 text-slate-500 hover:text-slate-800 bg-slate-50 rounded-full border border-slate-200">
                 <ArrowLeft size={20}/>
              </button>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${isBar ? 'bg-slate-100 text-emerald-600' : 'bg-slate-100 text-emerald-600'}`}>
                 {isBar ? <Droplets size={28} /> : <Flame size={28} />}
              </div>
              <div>
                 <h1 className="text-3xl font-black tracking-tighter text-slate-900">Produção do Dia</h1>
                 <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">Baixa Automática de Estoque</p>
              </div>
            </div>
            <button onClick={toggleFullscreen} className="p-3 text-slate-500 hover:text-slate-800 bg-slate-50 rounded-full border border-slate-200" title="Tela Cheia">
               <Maximize size={20}/>
            </button>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-8">
         <div className="mb-6">
            <h2 className="text-xl font-black text-slate-800 mb-2">O que você vai produzir agora?</h2>
            <p className="text-slate-500 font-medium">Selecione a ficha técnica. O sistema vai calcular e retirar os ingredientes do estoque físico.</p>
         </div>

         {loading ? (
            <p className="font-bold text-slate-500">Carregando fichas...</p>
         ) : fichas.length === 0 ? (
            <div className="text-center p-10 bg-white border border-slate-200 rounded-3xl">
               <h3 className="text-xl font-black text-slate-700">Nenhuma ficha cadastrada</h3>
               <p className="text-slate-500 mt-2 font-medium">Crie suas Fichas Técnicas primeiro para poder produzir.</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
               {fichas.map(f => (
                  <button 
                     key={f.id} 
                     onClick={() => abrirProduzir(f)}
                     className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all relative group text-left flex flex-col"
                  >
                     <div className="flex justify-between items-start mb-4">
                        <span className={`w-12 h-12 rounded-full flex items-center justify-center ${f.departamento === 'bar' ? 'bg-slate-50 text-emerald-600' : 'bg-slate-50 text-emerald-600'}`}>
                           {f.departamento === 'bar' ? <Wine size={20}/> : <UtensilsCrossed size={20}/>}
                        </span>
                     </div>
                     <h3 className="text-2xl font-black text-slate-800 leading-tight mb-2">{f.nome_receita}</h3>
                     <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">{f.fichas_ingredientes?.length || 0} Ingredientes</p>
                     
                     <div className="mt-auto pt-4 border-t border-slate-100">
                        <span className={`inline-flex items-center gap-2 font-bold text-sm ${isBar ? 'text-emerald-600' : 'text-emerald-600'}`}>
                           {isBar ? <Droplets size={16}/> : <Flame size={16}/>} Iniciar Produção
                        </span>
                     </div>
                  </button>
               ))}
            </div>
         )}
      </div>

      {modalProduzir && fichaAtual && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-lg p-8 shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-6">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">Registrar Produção</h2>
                     <p className="text-sm font-bold text-slate-500 mt-1">{fichaAtual.nome_receita}</p>
                  </div>
                  <button onClick={() => setModalProduzir(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="space-y-6">
                  {/* Quem fez? */}
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Quem está preparando?</label>
                     <select value={colabSelecionado} onChange={e=>setColabSelecionado(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-slate-800">
                        <option value="">-- Selecione seu nome --</option>
                        {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.cargo})</option>)}
                     </select>
                  </div>

                  {/* Quantidade */}
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block text-center mb-4">Quantas porções você fez?</label>
                     <div className="flex items-center justify-center gap-4">
                        <button onClick={()=>setQtdProd(p => Math.max(1, Number(p)-1))} className="w-14 h-14 rounded-full bg-white border border-slate-200 flex items-center justify-center text-3xl font-black text-slate-500 hover:text-slate-800">-</button>
                        <input 
                           type="number" 
                           value={qtdProd} 
                           onChange={e=>setQtdProd(e.target.value)} 
                           className="w-24 p-2 text-center text-4xl font-black text-slate-800 bg-transparent outline-none"
                        />
                        <button onClick={()=>setQtdProd(p => Number(p)+1)} className="w-14 h-14 rounded-full bg-white border border-slate-200 flex items-center justify-center text-3xl font-black text-slate-500 hover:text-slate-800">+</button>
                     </div>
                  </div>

                  {/* Valor Total Médio da Produção */}
                  {(() => {
                     const custoPorcao = custoTotalDaFicha(fichaAtual, fichas) / (fichaAtual.rendimento_porcoes || 1);
                     const valorTotalProducao = custoPorcao * Number(qtdProd || 0);
                     return (
                        <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex items-center justify-between">
                           <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Valor Total Médio desta Produção</p>
                              <p className="text-[10px] font-bold text-emerald-700/70 mt-0.5">{fmtBRL(custoPorcao)} / porção × {qtdProd || 0}</p>
                           </div>
                           <p className="text-3xl font-black text-emerald-700">{fmtBRL(valorTotalProducao)}</p>
                        </div>
                     );
                  })()}

                  {/* Preview da Baixa */}
                  <div className="pt-2">
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Previsão de Baixa no Estoque:</p>
                     <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                        {fichaAtual.fichas_ingredientes?.filter(ing => ing.insumos).map(ing => {
                           const consumo = ing.quantidade * Number(qtdProd);
                           return (
                              <div key={ing.insumos.id} className="flex justify-between items-center bg-white p-2 rounded border border-slate-100">
                                 <span className="font-bold text-slate-600 text-sm">{ing.insumos.nome}</span>
                                 <span className="font-black text-slate-600 text-sm">- {consumo.toFixed(3)} {ing.insumos.unidade_medida}</span>
                              </div>
                           )
                        })}
                     </div>
                  </div>
               </div>

               <button onClick={handleConfirmar} className={`w-full mt-8 py-5 text-white font-black text-lg rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 ${isBar ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-orange-500/20'} shadow-xl`}>
                  <Save size={20}/> Confirmar Produção e Baixar Estoque
               </button>
            </div>
         </div>
      )}

    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Carregando Produção...</div>}>
       <ProducaoRunner />
    </Suspense>
  );
}
