"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchInsumos, salvarInsumo, removerInsumo } from "../../../lib/operacao";
import { FlaskConical, Plus, Search, Trash2, Edit3, X, Save, ArrowLeft } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

function IngredientesRunner() {
  const router = useRouter();
  const { abrirMenu } = useERP();
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept"); // 'cozinha' ou 'bar'
  
  const { unidadeAtiva } = useERP();
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  
  const [modalNovo, setModalNovo] = useState(false);
  const [form, setForm] = useState({ id: null, departamento: deptUrl || "cozinha", nome: "", unidade_medida: "kg", custo_unitario: "" });

  const carregar = async () => {
    setLoading(true);
    // Se não tiver dept na URL, traz todos da unidade. Senão, filtra pelo dept.
    const { data } = await fetchInsumos(unidadeAtiva, deptUrl);
    setInsumos(data);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva, deptUrl]);

  const filtrados = insumos.filter(i => i.nome.toLowerCase().includes(busca.toLowerCase()));

  const abrirNovo = () => {
    setForm({ id: null, departamento: deptUrl || "cozinha", nome: "", unidade_medida: "kg", custo_unitario: "" });
    setModalNovo(true);
  };

  const abrirEditar = (ins) => {
    setForm({ ...ins });
    setModalNovo(true);
  };

  const handleSalvar = async () => {
    if(!form.nome.trim()) return alert("Digite o nome do ingrediente");
    if(!form.custo_unitario) return alert("Digite o custo");

    const erro = await salvarInsumo({
       ...form,
       unidade_id: unidadeAtiva,
       custo_unitario: Number(form.custo_unitario)
    });

    if(erro.error) return alert("Erro ao salvar: " + erro.error);
    
    setModalNovo(false);
    carregar();
  };

  const handleRemover = async (id) => {
    if(confirm("Deseja apagar este insumo? (Pode falhar se estiver em uso numa Ficha Técnica)")) {
       const { error } = await removerInsumo(id);
       if(error) alert("Não é possível apagar pois este ingrediente faz parte de uma Ficha Técnica.");
       carregar();
    }
  };

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-slate-50">
      
      {/* TOPBAR */}
      <div className="bg-white border-b border-slate-200 pt-6 pb-6 px-6 sticky top-0 z-10">
         <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => abrirMenu()} className="p-3 text-slate-500 hover:text-slate-800 bg-slate-50 rounded-full border border-slate-200">
                 <ArrowLeft size={20}/>
              </button>
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-emerald-600 flex items-center justify-center shadow-inner">
                 <FlaskConical size={28} />
              </div>
              <div>
                 <h1 className="text-3xl font-black tracking-tighter text-slate-900">Banco de Ingredientes</h1>
                 <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">Custo Base de Insumos {deptUrl ? `- ${deptUrl}` : ''}</p>
              </div>
            </div>
            <button onClick={abrirNovo} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">
               <Plus size={18} /> Cadastrar Insumo
            </button>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-8">
         <div className="bg-white p-3 rounded-2xl border border-slate-200 mb-6 flex items-center gap-3 shadow-sm">
            <Search size={20} className="text-slate-500 ml-2" />
            <input type="text" placeholder="Buscar ingrediente..." value={busca} onChange={e=>setBusca(e.target.value)} className="flex-1 outline-none font-bold text-slate-700 p-2" />
         </div>

         <div className="rounded-2xl overflow-hidden shadow-md border border-slate-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">Ingrediente</span>
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-center w-20">Unid.</span>
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-center w-32">Custo / Base</span>
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-right w-24">Ações</span>
            </div>
            {/* Linhas */}
            <div className="bg-white divide-y divide-slate-100">
               {loading && (
                 <div className="p-12 text-center">
                   <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
                   <p className="text-slate-400 font-bold text-sm">Buscando insumos...</p>
                 </div>
               )}
               {!loading && filtrados.map(ins => {
                 const dept = ins.departamento?.toLowerCase();
                 const deptColor = dept === 'bar' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700';
                 return (
                   <div key={ins.id} className="px-6 py-4 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center group hover:bg-emerald-50/40 transition-all duration-150">
                     {/* Nome + Dept */}
                     <div className="flex items-center gap-3 min-w-0">
                       <div className="w-1 h-10 rounded-full bg-emerald-400 shrink-0" />
                       <div className="min-w-0">
                         <p className="font-bold text-slate-800 text-[15px] leading-tight truncate">{ins.nome}</p>
                         <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 ${deptColor}`}>{ins.departamento}</span>
                       </div>
                     </div>
                     {/* Unidade */}
                     <div className="w-20 flex justify-center">
                       <span className="bg-slate-800 text-white px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-wider shadow-sm">{ins.unidade_medida}</span>
                     </div>
                     {/* Custo */}
                     <div className="w-32 text-center">
                       <span className="font-black text-xl text-emerald-600">{fmtBRL(ins.custo_unitario)}</span>
                     </div>
                     {/* Ações */}
                     <div className="w-24 flex justify-end gap-1">
                       <button onClick={() => abrirEditar(ins)} className="p-2 bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded-lg transition-all" title="Editar">
                         <Edit3 size={16}/>
                       </button>
                       <button onClick={() => handleRemover(ins.id)} className="p-2 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-500 rounded-lg transition-all" title="Remover">
                         <Trash2 size={16}/>
                       </button>
                     </div>
                   </div>
                 );
               })}
               {!loading && filtrados.length === 0 && (
                 <div className="p-16 text-center">
                   <p className="text-slate-400 font-bold">Nenhum ingrediente encontrado.</p>
                 </div>
               )}
            </div>
         </div>
      </div>

      {modalNovo && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="font-black text-2xl text-slate-800">{form.id ? "Editar Insumo" : "Novo Insumo"}</h2>
                  <button onClick={() => setModalNovo(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="space-y-4">
                  {!deptUrl && (
                    <div>
                       <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Departamento</label>
                       <select value={form.departamento} onChange={e=>setForm({...form, departamento: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                          <option value="cozinha">Cozinha</option>
                          <option value="bar">Bar</option>
                       </select>
                    </div>
                  )}

                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome do Ingrediente</label>
                     <input type="text" placeholder="Ex: Tomate Carmem" value={form.nome} onChange={e=>setForm({...form, nome: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Unidade Base</label>
                        <select value={form.unidade_medida} onChange={e=>setForm({...form, unidade_medida: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                           <option value="kg">Kilo (KG)</option>
                           <option value="l">Litro (L)</option>
                           <option value="un">Unidade (UN)</option>
                           <option value="g">Grama (G)</option>
                           <option value="ml">Mililitro (ML)</option>
                        </select>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Custo da Unid. Base</label>
                        <input type="number" placeholder="0.00" value={form.custo_unitario} onChange={e=>setForm({...form, custo_unitario: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-black text-emerald-600 outline-none focus:border-emerald-500"/>
                     </div>
                  </div>
                  <p className="text-[11px] font-medium text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                     Dica: Se você compra a garrafa de Vodka de 1 Litro por R$ 60,00, a Unidade Base é "L" e o Custo é "60". O sistema vai calcular os MLs sozinho nas fichas!
                  </p>
               </div>

               <button onClick={handleSalvar} className="w-full mt-8 py-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2">
                  <Save size={20}/> Salvar Ingrediente
               </button>
            </div>
         </div>
      )}

    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Carregando módulo...</div>}>
       <IngredientesRunner />
    </Suspense>
  );
}
