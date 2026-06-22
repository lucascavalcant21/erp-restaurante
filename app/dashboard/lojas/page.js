"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchUnidades, inserirUnidade, atualizarUnidade, removerUnidade } from "../../lib/unidades";
import { Plus, Edit2, Trash2, Building2, Store, Save, X } from "lucide-react";

export default function LojasPage() {
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editNome, setEditNome] = useState("");
  const [novoNome, setNovoNome] = useState("");

  const carregar = async () => {
    setLoading(true);
    const { data } = await fetchUnidades();
    setUnidades(data || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const handleCriar = async () => {
    if(!novoNome.trim()) return;
    const cor = "#" + Math.floor(Math.random()*16777215).toString(16);
    await inserirUnidade({ nome: novoNome, cor });
    setNovoNome("");
    carregar();
  };

  const handleSalvarEdicao = async () => {
    if(!editNome.trim()) return;
    await atualizarUnidade(editId, { nome: editNome });
    setEditId(null);
    setEditNome("");
    carregar();
  };

  const handleRemover = async (id) => {
    if(confirm("Tem certeza? Esta unidade e todos os dados atrelados ficarão inacessíveis.")) {
      await removerUnidade(id);
      carregar();
    }
  };

  if (loading) return <div className="p-10 font-bold text-slate-500">Carregando lojas...</div>;

  return (
    <div className="max-w-4xl mx-auto py-10">
      <div className="flex items-center gap-3 mb-2">
         <Building2 size={28} className="text-slate-600" />
         <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Suas Lojas</h1>
      </div>
      <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-10">Gerenciador de Unidades Físicas</p>

      {/* Criar Nova */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row items-center gap-4">
         <div className="flex-1 w-full">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Nova Unidade</label>
            <input 
              type="text" 
              value={novoNome} 
              onChange={e => setNovoNome(e.target.value)}
              placeholder="Ex: Unidade Centro"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-bold text-slate-700"
            />
         </div>
         <button onClick={handleCriar} disabled={!novoNome.trim()} className="md:mt-5 w-full md:w-auto px-8 py-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-black rounded-xl transition-colors flex items-center justify-center gap-2">
            <Plus size={20} /> Adicionar
         </button>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
         {unidades.map((u, i) => (
            <div key={u.id} className={`p-6 flex items-center justify-between ${i !== unidades.length -1 ? 'border-b border-slate-100' : ''}`}>
               {editId === u.id ? (
                 <div className="flex items-center gap-4 flex-1 mr-4">
                    <input 
                      type="text" 
                      value={editNome} 
                      onChange={e => setEditNome(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 font-bold"
                    />
                    <button onClick={handleSalvarEdicao} className="p-3 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100"><Save size={20}/></button>
                    <button onClick={() => setEditId(null)} className="p-3 bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-200"><X size={20}/></button>
                 </div>
               ) : (
                 <>
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50 border border-slate-100">
                         <div className="w-4 h-4 rounded-full" style={{background: u.cor}}></div>
                      </div>
                      <div>
                         <p className="font-bold text-slate-800 text-lg">{u.nome}</p>
                         <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">ID: {u.id.substring(0,8)}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-2">
                      <button onClick={() => { setEditId(u.id); setEditNome(u.nome); }} className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"><Edit2 size={18}/></button>
                      <button onClick={() => handleRemover(u.id)} className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                   </div>
                 </>
               )}
            </div>
         ))}
         {unidades.length === 0 && (
            <div className="p-10 text-center flex flex-col items-center">
               <Store size={48} className="text-slate-500 mb-4" />
               <p className="font-bold text-slate-500">Nenhuma unidade cadastrada. Crie a primeira acima.</p>
            </div>
         )}
      </div>
    </div>
  );
}
