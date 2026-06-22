"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../context/ERPContext";
import { fetchTemplates, salvarExecucao } from "../../lib/checklists";
import { fetchColaboradores } from "../../lib/rh";
import { CheckSquare, ArrowLeft, Check, ChevronRight } from "lucide-react";

function ChecklistRunner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dept = searchParams.get("dept") || "cozinha";
  const tipo = searchParams.get("tipo") || "operacional";

  const { unidadeAtiva } = useERP();
  
  const [templates, setTemplates] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de Execução
  const [checklistAtual, setChecklistAtual] = useState(null);
  const [colabSelecionado, setColabSelecionado] = useState("");
  const [respostas, setRespostas] = useState({});

  const carregar = async () => {
    setLoading(true);
    const [resTemp, resColab] = await Promise.all([
      fetchTemplates(unidadeAtiva, dept, tipo),
      fetchColaboradores(unidadeAtiva)
    ]);
    setTemplates(resTemp.data || []);
    setColaboradores(resColab.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva, dept, tipo]);

  const iniciarChecklist = (t) => {
    setChecklistAtual(t);
    const iniResp = {};
    t.itens.forEach(i => iniResp[i.id] = { marcado: false, obs: "" });
    setRespostas(iniResp);
    setColabSelecionado("");
  };

  const toggleItem = (id) => {
    setRespostas(r => ({ ...r, [id]: { ...r[id], marcado: !r[id].marcado } }));
  };

  const mudaObs = (id, txt) => {
    setRespostas(r => ({ ...r, [id]: { ...r[id], obs: txt } }));
  };

  const progresso = checklistAtual ? Math.round((Object.values(respostas).filter(r => r.marcado).length / checklistAtual.itens.length) * 100) : 0;

  const handleFinalizar = async () => {
    if(!colabSelecionado) return alert("Selecione quem está preenchendo o checklist.");
    
    // Converte o objeto de respostas num array pro banco
    const arrRespostas = Object.keys(respostas).map(k => ({
       id_tarefa: k,
       texto_tarefa: checklistAtual.itens.find(i => i.id.toString() === k.toString())?.texto,
       marcado: respostas[k].marcado,
       obs: respostas[k].obs
    }));

    await salvarExecucao({
       template_id: checklistAtual.id,
       unidade_id: unidadeAtiva,
       colaborador_id: colabSelecionado,
       data_referencia: new Date().toISOString().split("T")[0],
       respostas: arrRespostas
    });

    alert("Checklist finalizado com sucesso!");
    setChecklistAtual(null);
  };

  if (checklistAtual) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans pb-32">
         {/* Topbar Fixo */}
         <div className="sticky top-0 bg-white border-b border-slate-200 z-10 px-4 py-4 flex items-center gap-4">
            <button onClick={() => setChecklistAtual(null)} className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-full">
               <ArrowLeft size={20}/>
            </button>
            <div className="flex-1">
               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{checklistAtual.tipo} • {checklistAtual.departamento}</p>
               <h1 className="text-xl font-black text-slate-800 leading-tight">{checklistAtual.titulo}</h1>
            </div>
            <div className="text-right">
               <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Progresso</p>
               <p className="text-xl font-black text-emerald-600">{progresso}%</p>
            </div>
         </div>
         {/* Barra de progresso */}
         <div className="h-1 bg-slate-200 w-full"><div className="h-full bg-emerald-500 transition-all duration-500" style={{width: `${progresso}%`}}></div></div>

         <div className="max-w-3xl mx-auto px-4 mt-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6">
               <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Quem está preenchendo?</label>
               <select value={colabSelecionado} onChange={e=>setColabSelecionado(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                  <option value="">-- Selecione seu nome --</option>
                  {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.cargo})</option>)}
               </select>
            </div>

            <div className="space-y-3">
               {checklistAtual.itens.map((it, i) => {
                  const m = respostas[it.id]?.marcado;
                  return (
                     <div key={it.id} className={`bg-white p-5 rounded-2xl border transition-all ${m ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'border-slate-200 shadow-sm'}`}>
                        <div className="flex items-start gap-4 cursor-pointer" onClick={() => toggleItem(it.id)}>
                           <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center mt-1 transition-colors ${m ? 'bg-emerald-500 text-white' : 'bg-slate-100 border border-slate-300'}`}>
                              {m && <Check size={18}/>}
                           </div>
                           <div className="flex-1">
                              <p className={`font-bold text-lg transition-colors ${m ? 'text-emerald-700' : 'text-slate-700'}`}>{it.texto}</p>
                              {m && (
                                 <input 
                                    type="text" 
                                    placeholder="Alguma observação? (Opcional)"
                                    value={respostas[it.id].obs}
                                    onChange={e => mudaObs(it.id, e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                    className="w-full mt-3 p-3 bg-slate-50 border border-emerald-100 rounded-lg text-sm font-medium outline-none focus:border-emerald-400 placeholder:text-emerald-300 text-emerald-800"
                                 />
                              )}
                           </div>
                        </div>
                     </div>
                  );
               })}
            </div>
         </div>

         {/* Botão Finalizar */}
         <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200">
            <div className="max-w-3xl mx-auto">
               <button 
                  onClick={handleFinalizar}
                  disabled={progresso < 100 || !colabSelecionado}
                  className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black text-xl rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95"
               >
                  {progresso < 100 ? `Conclua todas as tarefas (${progresso}%)` : "Finalizar Checklist"}
               </button>
            </div>
         </div>
      </div>
    );
  }

  // Lista de Checklists Disponíveis
  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24 text-slate-800">
      <div className="pt-6 pb-8 px-6 max-w-3xl mx-auto flex items-center justify-between">
         <div className="flex items-center gap-4">
           <button onClick={() => router.back()} className="p-3 text-slate-500 hover:text-slate-800 bg-white shadow-sm border border-slate-200 rounded-full">
              <ArrowLeft size={20}/>
           </button>
           <div>
              <h1 className="text-3xl font-black tracking-tighter text-slate-900 capitalize">Checklists {dept}</h1>
              <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1 capitalize">Tipo: {tipo}</p>
           </div>
         </div>
         <button onClick={() => router.push("/dashboard/checklists/gerenciar")} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-slate-800 transition-colors">
            Gerenciar
         </button>
      </div>

      <div className="max-w-3xl mx-auto px-6">
         {loading ? (
            <p className="font-bold text-slate-500">Buscando formulários...</p>
         ) : templates.length === 0 ? (
            <div className="text-center p-10 bg-white border border-slate-200 rounded-3xl">
               <CheckSquare size={40} className="mx-auto text-slate-500 mb-4"/>
               <h3 className="text-xl font-black text-slate-700">Nenhum checklist disponível</h3>
               <p className="text-slate-500 mt-2 font-medium">Peça ao gestor para criar modelos no Gerenciador de Checklists.</p>
            </div>
         ) : (
            <div className="space-y-4">
               {templates.map(t => (
                  <button 
                     key={t.id} 
                     onClick={() => iniciarChecklist(t)}
                     className="w-full bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all text-left flex items-center justify-between group"
                  >
                     <div>
                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-800 mb-3 inline-block">
                           {t.itens.length} Tarefas
                        </span>
                        <h3 className="text-2xl font-black text-slate-800">{t.titulo}</h3>
                     </div>
                     <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                        <ChevronRight size={24}/>
                     </div>
                  </button>
               ))}
            </div>
         )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 font-bold text-slate-500">Carregando módulo...</div>}>
      <ChecklistRunner />
    </Suspense>
  );
}
