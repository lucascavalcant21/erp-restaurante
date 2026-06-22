"use client";

import { useState, useEffect } from "react";
import { useERP } from "../../../context/ERPContext";
import { fetchTemplates, salvarTemplate, desativarTemplate } from "../../../lib/checklists";
import { CheckSquare, Plus, Trash2, Edit3, X, Save } from "lucide-react";

export default function GerenciarChecklistsPage() {
  const { unidadeAtiva } = useERP();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [modalNovo, setModalNovo] = useState(false);
  const [form, setForm] = useState({ id: null, departamento: "cozinha", tipo: "operacional", titulo: "", itens: [{ id: 1, texto: "" }] });

  const carregar = async () => {
    setLoading(true);
    const { data } = await fetchTemplates(unidadeAtiva);
    setTemplates(data);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva]);

  const abrirNovo = () => {
    setForm({ id: null, departamento: "cozinha", tipo: "operacional", titulo: "", itens: [{ id: 1, texto: "" }] });
    setModalNovo(true);
  };

  const abrirEditar = (t) => {
    setForm({ ...t, itens: t.itens?.length ? t.itens : [{ id: 1, texto: "" }] });
    setModalNovo(true);
  };

  const addTarefa = () => {
    setForm(f => ({ ...f, itens: [...f.itens, { id: Date.now(), texto: "" }] }));
  };

  const mudaTarefa = (id, txt) => {
    setForm(f => ({ ...f, itens: f.itens.map(i => i.id === id ? { ...i, texto: txt } : i) }));
  };

  const removeTarefa = (id) => {
    setForm(f => ({ ...f, itens: f.itens.filter(i => i.id !== id) }));
  };

  const handleSalvar = async () => {
    if(!form.titulo.trim()) return alert("Digite um título");
    // Filtra tarefas vazias
    const itensValidos = form.itens.filter(i => i.texto.trim() !== "");
    if(itensValidos.length === 0) return alert("Adicione pelo menos uma tarefa");

    await salvarTemplate({
       id: form.id,
       unidade_id: unidadeAtiva,
       departamento: form.departamento,
       tipo: form.tipo,
       titulo: form.titulo,
       itens: itensValidos
    });

    setModalNovo(false);
    carregar();
  };

  const handleDesativar = async (id) => {
    if(confirm("Deseja apagar este checklist?")) {
       await desativarTemplate(id);
       carregar();
    }
  };

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800">
      
      {/* HEADER */}
      <div className="pt-6 pb-8 px-6 max-w-5xl mx-auto flex items-center justify-between">
         <div className="flex items-center gap-4">
           <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
              <CheckSquare size={32} />
           </div>
           <div>
              <h1 className="text-4xl font-black tracking-tighter text-slate-900">Gerenciar Checklists</h1>
              <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">Crie as listas de tarefas</p>
           </div>
         </div>
         <button onClick={abrirNovo} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">
            <Plus size={18} /> Novo Modelo
         </button>
      </div>

      <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {loading ? (
           <p className="font-bold text-slate-500">Carregando checklists...</p>
         ) : templates.length === 0 ? (
           <p className="col-span-full font-bold text-slate-500">Nenhum checklist criado para esta unidade ainda.</p>
         ) : (
           templates.map(t => (
             <div key={t.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group">
                <div className="flex justify-between items-start mb-4">
                   <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      t.departamento === 'cozinha' ? 'bg-orange-100 text-orange-600' :
                      t.departamento === 'bar' ? 'bg-indigo-100 text-indigo-600' : 'bg-pink-100 text-pink-600'
                   }`}>
                      {t.departamento} • {t.tipo}
                   </span>
                   <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => abrirEditar(t)} className="text-slate-500 hover:text-emerald-600"><Edit3 size={16}/></button>
                      <button onClick={() => handleDesativar(t.id)} className="text-slate-500 hover:text-red-600"><Trash2 size={16}/></button>
                   </div>
                </div>
                <h3 className="text-xl font-black text-slate-800 leading-tight">{t.titulo}</h3>
                <p className="text-sm font-medium text-slate-500 mt-2">{t.itens?.length || 0} tarefas configuradas</p>
             </div>
           ))
         )}
      </div>

      {modalNovo && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar p-8 shadow-2xl animate-in zoom-in-95">
               
               <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 pb-4 border-b border-slate-100">
                  <h2 className="font-black text-2xl text-slate-800">{form.id ? "Editar Checklist" : "Novo Checklist"}</h2>
                  <button onClick={() => setModalNovo(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Departamento</label>
                        <select value={form.departamento} onChange={e=>setForm({...form, departamento: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                           <option value="cozinha">Cozinha</option>
                           <option value="bar">Bar</option>
                           <option value="salao">Salão</option>
                        </select>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tipo</label>
                        <select value={form.tipo} onChange={e=>setForm({...form, tipo: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                           <option value="operacional">Operacional (Abert/Fechamento)</option>
                           <option value="limpeza">Limpeza Padrão</option>
                        </select>
                     </div>
                  </div>

                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Título do Checklist</label>
                     <input type="text" placeholder="Ex: Limpeza das Geladeiras" value={form.titulo} onChange={e=>setForm({...form, titulo: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-3">Lista de Tarefas</label>
                     <div className="space-y-3">
                        {form.itens.map((it, i) => (
                           <div key={it.id} className="flex items-center gap-2">
                              <span className="w-6 text-center font-black text-slate-500 text-sm">{i+1}.</span>
                              <input 
                                 type="text" 
                                 placeholder="O que deve ser feito?"
                                 value={it.texto}
                                 onChange={e => mudaTarefa(it.id, e.target.value)}
                                 className="flex-1 p-3 bg-white border border-slate-200 rounded-lg font-medium outline-none focus:border-emerald-500"
                              />
                              <button onClick={() => removeTarefa(it.id)} className="p-3 text-slate-500 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                           </div>
                        ))}
                     </div>
                     <button onClick={addTarefa} className="mt-4 text-emerald-600 font-bold text-sm flex items-center gap-1 hover:text-emerald-800">
                        <Plus size={16}/> Adicionar Tarefa
                     </button>
                  </div>
               </div>

               <div className="mt-8 sticky bottom-0 bg-white pt-4 border-t border-slate-100">
                  <button onClick={handleSalvar} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2">
                     <Save size={20}/> {form.id ? "Salvar Alterações" : "Criar Checklist"}
                  </button>
               </div>

            </div>
         </div>
      )}

    </div>
  );
}
