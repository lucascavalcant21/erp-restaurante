"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchFichas, salvarFicha, removerFicha, fetchInsumos } from "../../../lib/operacao";
import { LayoutList, Plus, Search, Trash2, Edit3, X, Save, ArrowLeft, UtensilsCrossed, Wine, ChevronRight } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

function FichasRunner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept") || "cozinha"; // 'cozinha' ou 'bar'
  
  const { unidadeAtiva } = useERP();
  const [fichas, setFichas] = useState([]);
  const [insumosAtivos, setInsumosAtivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  
  const [modalNovo, setModalNovo] = useState(false);
  
  // Estado do formulário da Ficha
  const [form, setForm] = useState({ 
    id: null, 
    departamento: deptUrl, 
    nome_receita: "", 
    rendimento_porcoes: "1", 
    modo_preparo: "" 
  });
  
  // Estado dos ingredientes selecionados na ficha
  const [ingFicha, setIngFicha] = useState([]); // [{ insumo_id, nome, unidade, custo_unitario, quantidade }]

  const carregar = async () => {
    setLoading(true);
    const [resFichas, resInsumos] = await Promise.all([
       fetchFichas(unidadeAtiva, deptUrl),
       fetchInsumos(unidadeAtiva, deptUrl)
    ]);
    setFichas(resFichas.data || []);
    setInsumosAtivos(resInsumos.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva, deptUrl]);

  const filtradas = fichas.filter(f => f.nome_receita.toLowerCase().includes(busca.toLowerCase()));

  const abrirNova = () => {
    setForm({ id: null, departamento: deptUrl, nome_receita: "", rendimento_porcoes: "1", modo_preparo: "" });
    setIngFicha([]);
    setModalNovo(true);
  };

  const abrirEditar = (ficha) => {
    setForm({ 
       id: ficha.id, 
       departamento: ficha.departamento, 
       nome_receita: ficha.nome_receita, 
       rendimento_porcoes: ficha.rendimento_porcoes, 
       modo_preparo: ficha.modo_preparo || "" 
    });
    // Mapeando a estrutura do banco pro estado local
    const mapIng = (ficha.fichas_ingredientes || []).map(fi => ({
       insumo_id: fi.insumos.id,
       nome: fi.insumos.nome,
       unidade: fi.insumos.unidade_medida,
       custo_unitario: fi.insumos.custo_unitario,
       quantidade: fi.quantidade
    }));
    setIngFicha(mapIng);
    setModalNovo(true);
  };

  const calcularCustoTotal = (ingredientesLista) => {
    return ingredientesLista.reduce((acc, ing) => acc + (ing.custo_unitario * ing.quantidade), 0);
  };

  const addIngrediente = (insumoId) => {
    if(!insumoId) return;
    if(ingFicha.find(i => i.insumo_id === insumoId)) return; // Já existe
    
    const insumoDb = insumosAtivos.find(i => i.id === insumoId);
    setIngFicha([...ingFicha, {
       insumo_id: insumoDb.id,
       nome: insumoDb.nome,
       unidade: insumoDb.unidade_medida,
       custo_unitario: insumoDb.custo_unitario,
       quantidade: 0
    }]);
  };

  const updateQtd = (insumoId, qtd) => {
    setIngFicha(lista => lista.map(i => i.insumo_id === insumoId ? { ...i, quantidade: Number(qtd) || 0 } : i));
  };

  const removeIngrediente = (insumoId) => {
    setIngFicha(lista => lista.filter(i => i.insumo_id !== insumoId));
  };

  const handleSalvar = async () => {
    if(!form.nome_receita.trim()) return alert("Digite o nome da receita");
    if(!form.rendimento_porcoes) return alert("Digite o rendimento");
    
    // Filtra ingredientes que estão com qtd = 0
    const ingValidos = ingFicha.filter(i => i.quantidade > 0);
    if(ingValidos.length === 0) return alert("Adicione pelo menos um ingrediente com quantidade válida.");

    const erro = await salvarFicha(
       {
          id: form.id,
          unidade_id: unidadeAtiva,
          departamento: form.departamento,
          nome_receita: form.nome_receita,
          rendimento_porcoes: Number(form.rendimento_porcoes),
          modo_preparo: form.modo_preparo
       },
       ingValidos.map(i => ({ insumo_id: i.insumo_id, quantidade: i.quantidade }))
    );

    if(erro.error) return alert("Erro ao salvar: " + erro.error);
    
    setModalNovo(false);
    carregar();
  };

  const handleRemover = async (id) => {
    if(confirm("Deseja excluir esta ficha técnica permanentemente?")) {
       await removerFicha(id);
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
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${deptUrl === 'bar' ? 'bg-purple-100 text-purple-600' : 'bg-emerald-100 text-emerald-600'}`}>
                 <LayoutList size={28} />
              </div>
              <div>
                 <h1 className="text-3xl font-black tracking-tighter text-slate-900">Fichas Técnicas</h1>
                 <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">Receituário e Custos - {deptUrl}</p>
              </div>
            </div>
            <button onClick={abrirNova} className={`flex items-center gap-2 text-white px-5 py-3 rounded-xl font-bold transition-colors shadow-lg ${deptUrl === 'bar' ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'}`}>
               <Plus size={18} /> Nova Ficha
            </button>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-8">
         <div className="bg-white p-3 rounded-2xl border border-slate-200 mb-6 flex items-center gap-3 shadow-sm">
            <Search size={20} className="text-slate-500 ml-2" />
            <input type="text" placeholder="Buscar receita..." value={busca} onChange={e=>setBusca(e.target.value)} className="flex-1 outline-none font-bold text-slate-700 p-2" />
         </div>

         {loading ? (
            <p className="font-bold text-slate-500">Buscando receitas...</p>
         ) : filtradas.length === 0 ? (
            <div className="text-center p-10 bg-white border border-slate-200 rounded-3xl">
               <LayoutList size={40} className="mx-auto text-slate-500 mb-4"/>
               <h3 className="text-xl font-black text-slate-700">Nenhuma ficha encontrada</h3>
               <p className="text-slate-500 mt-2 font-medium">Cadastre suas receitas para calcular automaticamente o custo do prato.</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {filtradas.map(f => {
                  // Mapeia e calcula custo na hora pra exibir o card
                  const mapIng = (f.fichas_ingredientes || []).map(fi => ({
                     custo_unitario: fi.insumos?.custo_unitario || 0,
                     quantidade: fi.quantidade
                  }));
                  const custoFicha = calcularCustoTotal(mapIng);
                  const custoPorcao = custoFicha / (f.rendimento_porcoes || 1);

                  return (
                     <div key={f.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                           <span className={`w-10 h-10 rounded-full flex items-center justify-center ${f.departamento === 'bar' ? 'bg-purple-50 text-purple-600' : 'bg-orange-50 text-orange-600'}`}>
                              {f.departamento === 'bar' ? <Wine size={18}/> : <UtensilsCrossed size={18}/>}
                           </span>
                           <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => abrirEditar(f)} className="p-2 bg-slate-50 rounded-lg text-slate-500 hover:text-emerald-600"><Edit3 size={16}/></button>
                              <button onClick={() => handleRemover(f.id)} className="p-2 bg-slate-50 rounded-lg text-slate-500 hover:text-red-600"><Trash2 size={16}/></button>
                           </div>
                        </div>
                        <h3 className="text-xl font-black text-slate-800 leading-tight mb-1">{f.nome_receita}</h3>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Rende: {f.rendimento_porcoes} Porções</p>
                        
                        <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-end">
                           <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Custo / Porção</p>
                              <p className="text-2xl font-black text-emerald-600">{fmtBRL(custoPorcao)}</p>
                           </div>
                           <p className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-md">Total: {fmtBRL(custoFicha)}</p>
                        </div>
                     </div>
                  );
               })}
            </div>
         )}
      </div>

      {/* MODAL DE CRIAÇÃO DA FICHA TÉCNICA */}
      {modalNovo && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col">
               
               {/* HEADER DO MODAL */}
               <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">{form.id ? "Editar Receita" : "Nova Receita"}</h2>
                     <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">Custo Total Atual: <span className="text-emerald-600 font-black">{fmtBRL(calcularCustoTotal(ingFicha))}</span></p>
                  </div>
                  <button onClick={() => setModalNovo(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               {/* BODY DO MODAL COM SCROLL */}
               <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-8">
                  
                  {/* COLUNA ESQUERDA: Dados Básicos */}
                  <div className="space-y-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome da Receita</label>
                        <input type="text" placeholder="Ex: Caipirinha de Morango" value={form.nome_receita} onChange={e=>setForm({...form, nome_receita: e.target.value})} className="w-full p-4 mt-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500 shadow-sm"/>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Rendimento (Nº de Porções)</label>
                        <input type="number" placeholder="1" value={form.rendimento_porcoes} onChange={e=>setForm({...form, rendimento_porcoes: e.target.value})} className="w-full p-4 mt-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500 shadow-sm"/>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Modo de Preparo</label>
                        <textarea placeholder="Passo a passo da execução..." value={form.modo_preparo} onChange={e=>setForm({...form, modo_preparo: e.target.value})} className="w-full h-40 p-4 mt-1 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:border-emerald-500 shadow-sm resize-none"></textarea>
                     </div>
                  </div>

                  {/* COLUNA DIREITA: Ingredientes da Ficha */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full max-h-[500px]">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Composição (Ingredientes)</label>
                     
                     {/* ADD INGREDIENTE */}
                     <div className="flex gap-2 mb-4">
                        <select onChange={e => { addIngrediente(e.target.value); e.target.value=""; }} className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-600 outline-none focus:border-emerald-500 text-sm">
                           <option value="">+ Pesquisar Insumo...</option>
                           {insumosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome} ({i.unidade_medida})</option>)}
                        </select>
                     </div>

                     {/* LISTA DE INGREDIENTES */}
                     <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                        {ingFicha.length === 0 && (
                           <div className="text-center p-6 text-slate-500 font-medium text-sm">
                              Selecione ingredientes acima para montar a ficha técnica e calcular o custo.
                           </div>
                        )}
                        {ingFicha.map(ing => (
                           <div key={ing.insumo_id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3 group">
                              <div className="flex-1 min-w-0">
                                 <p className="font-bold text-slate-800 text-sm truncate">{ing.nome}</p>
                                 <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">Custo: {fmtBRL(ing.custo_unitario * ing.quantidade)}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                 <input 
                                    type="number" 
                                    step="0.001"
                                    placeholder="0"
                                    value={ing.quantidade || ""}
                                    onChange={e => updateQtd(ing.insumo_id, e.target.value)}
                                    className="w-20 p-2 text-center bg-white border border-slate-200 rounded-lg font-black text-slate-700 outline-none focus:border-emerald-500"
                                 />
                                 <span className="text-[10px] font-black text-slate-500 uppercase w-6">{ing.unidade}</span>
                              </div>
                              <button onClick={() => removeIngrediente(ing.insumo_id)} className="p-2 text-slate-500 hover:text-red-500 transition-colors bg-white rounded-lg border border-slate-200">
                                 <Trash2 size={14}/>
                              </button>
                           </div>
                        ))}
                     </div>

                  </div>

               </div>

               {/* FOOTER DO MODAL */}
               <div className="p-6 border-t border-slate-100 bg-white">
                  <button onClick={handleSalvar} className="w-full py-5 bg-slate-900 hover:bg-slate-800 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-slate-900/20 active:scale-95 flex items-center justify-center gap-2">
                     <Save size={20}/> Salvar Receita ({fmtBRL(calcularCustoTotal(ingFicha))})
                  </button>
               </div>
            </div>
         </div>
      )}

    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Carregando módulo...</div>}>
       <FichasRunner />
    </Suspense>
  );
}
