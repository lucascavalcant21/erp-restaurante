"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchTreinamentos, inserirTreinamento, removerTreinamento } from "../../../lib/treinamentos";
import { 
  PlaySquare, Plus, Video, Link as LinkIcon, Trash2, ArrowLeft, BookOpen 
} from "lucide-react";

export default function TreinamentoPage() {
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo } = useERP();
  
  const [treinamentos, setTreinamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalNovo, setModalNovo] = useState(false);
  const [form, setForm] = useState({ titulo: "", descricao: "", link_video: "" });

  const carregar = async () => {
    setLoading(true);
    const { data } = await fetchTreinamentos(unidadeAtiva);
    setTreinamentos(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva]);

  const handleSalvar = async () => {
    if(!form.titulo || !form.link_video) return;
    
    // Tenta extrair ID do Youtube pra thumbnail
    let ytId = null;
    try {
      if(form.link_video.includes("youtube.com")) {
         ytId = new URL(form.link_video).searchParams.get("v");
      } else if (form.link_video.includes("youtu.be")) {
         ytId = form.link_video.split("youtu.be/")[1]?.split("?")[0];
      }
    } catch(e) {}

    await inserirTreinamento({
       unidade_id: unidadeAtiva,
       titulo: form.titulo,
       descricao: form.descricao,
       link_video: form.link_video,
       capa_url: ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null
    });
    
    setModalNovo(false);
    setForm({ titulo: "", descricao: "", link_video: "" });
    carregar();
  };

  const handleRemover = async (id) => {
    if(confirm("Remover este treinamento?")) {
       await removerTreinamento(id);
       carregar();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24 text-slate-800">
      
      {/* HEADER */}
      <div className="pt-6 pb-8 px-6 max-w-5xl mx-auto flex items-center justify-between">
         <div className="flex items-center gap-4">
           <button onClick={() => router.back()} className="w-12 h-12 rounded-full bg-white border border-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-100 transition-colors">
              <ArrowLeft size={20} />
           </button>
           <div className="w-16 h-16 rounded-3xl bg-slate-100 text-emerald-600 flex items-center justify-center shadow-inner">
              <PlaySquare size={32} />
           </div>
           <div>
              <h1 className="text-3xl font-black tracking-tighter text-slate-900">Portal de Treinamento</h1>
              <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">{unidadeInfo?.nome}</p>
           </div>
         </div>
         <button onClick={() => setModalNovo(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">
            <Plus size={18} /> Novo Módulo
         </button>
      </div>

      <div className="max-w-5xl mx-auto px-6">
         {loading ? (
            <p className="text-center font-bold text-slate-500 mt-10">Carregando portal...</p>
         ) : treinamentos.length === 0 ? (
            <div className="text-center p-12 bg-white rounded-[32px] border border-slate-200 shadow-sm mt-4">
               <Video size={48} className="mx-auto text-slate-500 mb-4"/>
               <h3 className="text-2xl font-black text-slate-800">Nenhum treinamento cadastrado</h3>
               <p className="text-slate-500 font-medium mt-2">Adicione links do YouTube com instruções para os garçons e recepcionistas.</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {treinamentos.map(t => (
                  <div key={t.id} className="bg-white rounded-[32px] overflow-hidden border border-slate-200 shadow-sm hover:shadow-lg transition-all group flex flex-col">
                     <div className="h-48 bg-slate-100 relative overflow-hidden flex items-center justify-center">
                        {t.capa_url ? (
                           <img src={t.capa_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                           <PlaySquare size={48} className="text-slate-500" />
                        )}
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                           <a href={t.link_video} target="_blank" rel="noreferrer" className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-2xl scale-90 group-hover:scale-100 transition-all">
                              <PlaySquare size={24} className="ml-1"/>
                           </a>
                        </div>
                     </div>
                     <div className="p-6 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-2">
                           <h3 className="font-black text-xl text-slate-800 leading-tight">{t.titulo}</h3>
                           <button onClick={() => handleRemover(t.id)} className="text-slate-500 hover:text-slate-600 transition-colors"><Trash2 size={18}/></button>
                        </div>
                        <p className="text-sm font-medium text-slate-500 line-clamp-3 mb-4 flex-1">{t.descricao}</p>
                        <a href={t.link_video} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-emerald-600 font-bold hover:text-rose-800 transition-colors text-sm bg-slate-50 px-4 py-3 rounded-2xl">
                           <LinkIcon size={16}/> Assistir no YouTube
                        </a>
                     </div>
                  </div>
               ))}
            </div>
         )}
      </div>

      {modalNovo && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95">
               <h2 className="font-black text-2xl text-slate-800 mb-6 flex items-center gap-3"><BookOpen size={24} className="text-slate-600"/> Novo Treinamento</h2>
               
               <div className="space-y-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Título do Módulo</label>
                     <input type="text" value={form.titulo} onChange={e=>setForm({...form, titulo: e.target.value})} placeholder="Ex: Como abrir um vinho" className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Descrição</label>
                     <textarea value={form.descricao} onChange={e=>setForm({...form, descricao: e.target.value})} rows={3} placeholder="Instruções para os garçons..." className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500 resize-none"/>
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Link do YouTube</label>
                     <input type="url" value={form.link_video} onChange={e=>setForm({...form, link_video: e.target.value})} placeholder="https://youtube.com/watch?v=..." className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-emerald-600 outline-none focus:border-emerald-500"/>
                  </div>
               </div>

               <div className="flex gap-3 mt-8">
                  <button onClick={() => setModalNovo(false)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all">Cancelar</button>
                  <button onClick={handleSalvar} disabled={!form.titulo || !form.link_video} className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-600/20">Publicar Módulo</button>
               </div>
            </div>
         </div>
      )}

    </div>
  );
}
