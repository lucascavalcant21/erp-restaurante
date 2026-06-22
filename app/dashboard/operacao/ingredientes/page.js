"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchInsumos, salvarInsumo, removerInsumo } from "../../../lib/operacao";
import { FlaskConical, Plus, Search, Trash2, Edit3, X, Save, ArrowLeft } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

function IngredientesRunner() {
  const router = useRouter();
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
              <button onClick={() => router.back()} className="p-3 text-slate-500 hover:text-slate-800 bg-slate-50 rounded-full border border-slate-200">
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

         <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                     <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Ingrediente</th>
                     <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Unid. Base</th>
                     <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Custo / Base</th>
                     <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Ações</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {loading && <tr><td colSpan={4} className="p-10 text-center text-slate-500 font-bold">Buscando insumos...</td></tr>}
                  {!loading && filtrados.map(ins => (
                     <tr key={ins.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-5">
                           <p className="font-bold text-slate-800 text-lg">{ins.nome}</p>
                           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Dept: {ins.departamento}</p>
                        </td>
                        <td className="p-5">
                           <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg font-bold text-xs uppercase tracking-widest">{ins.unidade_medida}</span>
                        </td>
                        <td className="p-5">
                           <p className="font-black text-emerald-600 text-lg">{fmtBRL(ins.custo_unitario)}</p>
                        </td>
                        <td className="p-5 text-right">
                           <button onClick={() => abrirEditar(ins)} className="p-2 text-slate-500 hover:text-emerald-600 transition-colors"><Edit3 size={18}/></button>
                           <button onClick={() => handleRemover(ins.id)} className="p-2 text-slate-500 hover:text-slate-600 transition-colors"><Trash2 size={18}/></button>
                        </td>
                     </tr>
                  ))}
                  {!loading && filtrados.length === 0 && (
                     <tr><td colSpan={4} className="p-10 text-center text-slate-500 font-bold">Nenhum ingrediente encontrado.</td></tr>
                  )}
               </tbody>
            </table>
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
