"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchColaboradores } from "../../../lib/rh";
import { 
  fetchEmbalagens, salvarEmbalagem, apagarEmbalagem, 
  registrarConsumoEmbalagem, fetchListaComprasEmbalagens,
  fetchHistoricoConsumoEmbalagens
} from "../../../lib/embalagens";
import { 
  Package, PackageMinus, ShoppingCart, Plus, CheckCircle, 
  Trash2, Edit2, AlertTriangle, ArrowLeft, Save, Box, Search
} from "lucide-react";
import { fmtBRL } from "../../../components/ui";

export default function EmbalagensPage() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  
  const [aba, setAba] = useState("estoque"); // estoque, saida, compras
  const [loading, setLoading] = useState(true);
  
  const [embalagens, setEmbalagens] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [compras, setCompras] = useState([]);
  const [historico, setHistorico] = useState([]);

  // Modal Estoque
  const [modalEstoque, setModalEstoque] = useState(false);
  const estadoFormEmbalagem = { nome: "", categoria: "Potes", quantidade_atual: "", quantidade_minima: "", preco_unitario: "" };
  const [formEmbalagem, setFormEmbalagem] = useState(estadoFormEmbalagem);

  // Registro Saida
  const estadoFormSaida = { funcionario_id: "", embalagem_id: "", quantidade: "", tipo_movimento: "Uso Normal" };
  const [formSaida, setFormSaida] = useState(estadoFormSaida);

  const carregarTudo = async () => {
    setLoading(true);
    const [resEmb, resColab, resComp, resHist] = await Promise.all([
      fetchEmbalagens(unidadeAtiva),
      fetchColaboradores(unidadeAtiva),
      fetchListaComprasEmbalagens(unidadeAtiva),
      fetchHistoricoConsumoEmbalagens(unidadeAtiva)
    ]);
    setEmbalagens(resEmb.data || []);
    setColaboradores(resColab.data || []);
    setCompras(resComp.data || []);
    setHistorico(resHist.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregarTudo();
  }, [unidadeAtiva]);

  // --- Funções Estoque ---
  const abrirNovoEstoque = () => {
    setFormEmbalagem(estadoFormEmbalagem);
    setModalEstoque(true);
  };
  const abrirEditarEstoque = (emb) => {
    setFormEmbalagem(emb);
    setModalEstoque(true);
  };
  const handleSalvarEstoque = async (e) => {
    e.preventDefault();
    if (!formEmbalagem.nome) return alert("Preencha o nome.");
    
    await salvarEmbalagem(unidadeAtiva, {
      ...formEmbalagem,
      quantidade_atual: Number(formEmbalagem.quantidade_atual),
      quantidade_minima: Number(formEmbalagem.quantidade_minima),
      preco_unitario: Number(formEmbalagem.preco_unitario)
    });
    setModalEstoque(false);
    carregarTudo();
  };
  const handleApagarEstoque = async (id) => {
    if(confirm("Apagar esta embalagem? Histórico será perdido se estiver vinculado via cascade.")) {
      await apagarEmbalagem(unidadeAtiva, id);
      carregarTudo();
    }
  };

  // --- Funções Saída ---
  const handleRegistrarSaida = async (e) => {
    e.preventDefault();
    if (!formSaida.funcionario_id || !formSaida.embalagem_id || !formSaida.quantidade) {
      return alert("Preencha todos os campos corretamente.");
    }
    
    setLoading(true);
    const res = await registrarConsumoEmbalagem(unidadeAtiva, {
      ...formSaida,
      quantidade: Number(formSaida.quantidade)
    });
    
    if (res.error) alert("Erro ao registrar: " + res.error.message);
    else {
      alert("Saída registrada com sucesso! Estoque descontado.");
      setFormSaida(estadoFormSaida);
      carregarTudo();
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-slate-50">
      <div className="bg-slate-900 pt-8 pb-10 px-8 shadow-lg text-white">
         <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors">
                 <ArrowLeft size={20}/>
              </button>
              <div className="w-16 h-16 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
                 <Package size={32} />
              </div>
              <div>
                 <h1 className="text-4xl font-black tracking-tighter">Embalagens</h1>
                 <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-1">Controle de Estoque e Uso</p>
              </div>
            </div>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-8">
        
        {/* Menu TABS */}
        <div className="flex bg-slate-200 p-1.5 rounded-2xl mb-8 w-full md:w-max mx-auto shadow-inner">
           <button onClick={()=>setAba('estoque')} className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 ${aba==='estoque' ? 'bg-white text-slate-800 shadow-sm scale-100' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-300/50'}`}>
              <Box size={16}/> Estoque Físico
           </button>
           <button onClick={()=>setAba('saida')} className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 ${aba==='saida' ? 'bg-white text-slate-800 shadow-sm scale-100' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-300/50'}`}>
              <PackageMinus size={16}/> Registrar Saída
           </button>
           <button onClick={()=>setAba('compras')} className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 ${aba==='compras' ? 'bg-white text-slate-800 shadow-sm scale-100' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-300/50'}`}>
              <ShoppingCart size={16}/> Lista de Compras {compras.length > 0 && <span className="bg-rose-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{compras.length}</span>}
           </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><p className="font-bold text-slate-500 animate-pulse">Carregando Embalagens...</p></div>
        ) : (
          <>
            {/* ABA ESTOQUE */}
            {aba === 'estoque' && (
              <div className="animate-in fade-in slide-in-from-bottom-4">
                <div className="flex justify-between items-center mb-6">
                   <h2 className="text-xl font-black text-slate-800">Catálogo de Embalagens</h2>
                   <button onClick={abrirNovoEstoque} className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-teal-600/20 active:scale-95 transition-all">
                      <Plus size={18}/> Novo Item
                   </button>
                </div>
                
                {embalagens.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-[32px] p-10 text-center text-slate-500 font-bold">Nenhuma embalagem cadastrada.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {embalagens.map(emb => (
                      <div key={emb.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col group relative">
                         <div className="flex justify-between items-start mb-4">
                            <div>
                               <p className="text-[10px] uppercase tracking-widest font-bold text-teal-600 mb-1">{emb.categoria}</p>
                               <h3 className="font-black text-lg text-slate-800 leading-tight pr-4">{emb.nome}</h3>
                            </div>
                         </div>
                         
                         <div className="mt-auto grid grid-cols-2 gap-3 mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            <div>
                               <p className="text-[10px] font-bold text-slate-500 uppercase">Saldo Atual</p>
                               <p className={`font-black text-xl ${Number(emb.quantidade_atual) <= Number(emb.quantidade_minima) ? 'text-rose-500' : 'text-slate-800'}`}>
                                 {emb.quantidade_atual}
                               </p>
                            </div>
                            <div>
                               <p className="text-[10px] font-bold text-slate-500 uppercase">Mínimo</p>
                               <p className="font-black text-xl text-slate-400">{emb.quantidade_minima}</p>
                            </div>
                         </div>
                         
                         <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-slate-500">Custo: {fmtBRL(emb.preco_unitario)}</span>
                            <div className="flex gap-2">
                               <button onClick={()=>abrirEditarEstoque(emb)} className="p-2 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-lg transition-colors"><Edit2 size={16}/></button>
                               <button onClick={()=>handleApagarEstoque(emb.id)} className="p-2 bg-slate-100 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                            </div>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ABA SAIDA */}
            {aba === 'saida' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                
                {/* Lado Esquerdo: Formulário */}
                <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-xl">
                   <h2 className="text-2xl font-black text-slate-800 mb-2 flex items-center gap-2">
                      <PackageMinus size={24} className="text-teal-600"/> Registrar Saída
                   </h2>
                   <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed">
                      Selecione o funcionário e as embalagens retiradas para uso ou perdidas. O saldo no estoque será abatido automaticamente.
                   </p>
                   
                   <form onSubmit={handleRegistrarSaida} className="space-y-5">
                      <div>
                         <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Funcionário</label>
                         <select required value={formSaida.funcionario_id} onChange={e=>setFormSaida({...formSaida, funcionario_id: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none focus:border-teal-500">
                            <option value="">-- Selecione o colaborador --</option>
                            {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.cargo})</option>)}
                         </select>
                      </div>
                      
                      <div>
                         <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Item (Embalagem)</label>
                         <select required value={formSaida.embalagem_id} onChange={e=>setFormSaida({...formSaida, embalagem_id: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none focus:border-teal-500">
                            <option value="">-- Selecione o item --</option>
                            {embalagens.map(emb => <option key={emb.id} value={emb.id}>{emb.nome} (Saldo: {emb.quantidade_atual})</option>)}
                         </select>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Qtd Retirada</label>
                            <input required type="number" step="0.01" min="0" value={formSaida.quantidade} onChange={e=>setFormSaida({...formSaida, quantidade: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-800 outline-none focus:border-teal-500"/>
                         </div>
                         <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Motivo</label>
                            <select required value={formSaida.tipo_movimento} onChange={e=>setFormSaida({...formSaida, tipo_movimento: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none focus:border-teal-500">
                               <option value="Uso Normal">Uso Normal</option>
                               <option value="Desperdício">Quebra/Desperdício</option>
                               <option value="Ajuste">Ajuste de Saldo</option>
                            </select>
                         </div>
                      </div>
                      
                      <button type="submit" className="w-full mt-4 py-5 bg-teal-600 hover:bg-teal-700 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-teal-500/20 active:scale-95 flex items-center justify-center gap-2">
                         <CheckCircle size={20}/> Confirmar Saída
                      </button>
                   </form>
                </div>

                {/* Lado Direito: Histórico */}
                <div className="bg-slate-50 border border-slate-200 rounded-[32px] p-6 h-full flex flex-col">
                   <h2 className="text-xl font-black text-slate-800 mb-4 border-b border-slate-200 pb-4">Extrato de Retiradas</h2>
                   
                   <div className="flex-1 overflow-y-auto max-h-[500px] pr-2 space-y-3 custom-scrollbar">
                      {historico.length === 0 ? (
                         <div className="text-center text-slate-400 font-bold py-10">Nenhuma retirada registrada ainda.</div>
                      ) : (
                         historico.map(h => (
                            <div key={h.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                               <div className="flex justify-between items-start mb-2">
                                  <div>
                                     <p className="font-bold text-slate-800">{h.colaboradores?.nome || 'Desconhecido'}</p>
                                     <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{new Date(h.data_registro).toLocaleString('pt-BR')}</p>
                                  </div>
                                  <div className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${h.tipo_movimento === 'Desperdício' ? 'bg-rose-100 text-rose-600' : 'bg-teal-100 text-teal-700'}`}>
                                     {h.tipo_movimento}
                                  </div>
                               </div>
                               <div className="flex justify-between items-end">
                                  <span className="text-sm font-medium text-slate-600">{h.operacao_embalagens?.nome || 'Item Removido'}</span>
                                  <span className="text-lg font-black text-slate-800">{h.quantidade} un</span>
                               </div>
                            </div>
                         ))
                      )}
                   </div>
                </div>

              </div>
            )}

            {/* ABA LISTA DE COMPRAS */}
            {aba === 'compras' && (
              <div className="animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-amber-50 border border-amber-200 p-6 rounded-[24px] flex items-start gap-4 mb-8">
                   <AlertTriangle className="text-amber-600 flex-shrink-0" size={28}/>
                   <div>
                      <h3 className="font-black text-amber-800 text-lg mb-1">Lista de Compras Inteligente</h3>
                      <p className="text-amber-700 font-medium text-sm leading-relaxed">
                         Baseado nos limites mínimos definidos no Estoque Físico, aqui estão as embalagens que precisam de ressuprimento urgente.
                      </p>
                   </div>
                </div>

                {compras.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-[32px] p-10 text-center text-slate-500 font-bold flex flex-col items-center">
                    <CheckCircle size={48} className="text-emerald-400 mb-4"/>
                    Estoque saudável. Nada a comprar por enquanto!
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                       <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                             <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Item</th>
                             <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Saldo</th>
                             <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Mínimo Ideal</th>
                             <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Faltam</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {compras.map(emb => (
                             <tr key={emb.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-5">
                                   <p className="font-bold text-slate-800 text-lg">{emb.nome}</p>
                                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{emb.categoria}</p>
                                </td>
                                <td className="p-5 text-center">
                                   <span className="font-black text-rose-500 text-xl">{emb.quantidade_atual}</span>
                                </td>
                                <td className="p-5 text-center">
                                   <span className="font-black text-slate-400 text-xl">{emb.quantidade_minima}</span>
                                </td>
                                <td className="p-5 text-right">
                                   <span className="inline-block bg-rose-100 text-rose-600 px-4 py-2 rounded-xl font-black text-lg">
                                      {Math.max(0, Number(emb.quantidade_minima) - Number(emb.quantidade_atual))} un
                                   </span>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Novo/Editar Estoque */}
      {modalEstoque && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95">
               <h2 className="font-black text-2xl text-slate-800 mb-6">{formEmbalagem.id ? 'Editar' : 'Nova'} Embalagem</h2>
               <form onSubmit={handleSalvarEstoque} className="space-y-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Nome (Ex: Tampa 500ml)</label>
                     <input required type="text" value={formEmbalagem.nome} onChange={e=>setFormEmbalagem({...formEmbalagem, nome: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none focus:border-teal-500"/>
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Categoria</label>
                     <input required type="text" placeholder="Potes, Tampas, Talheres" value={formEmbalagem.categoria} onChange={e=>setFormEmbalagem({...formEmbalagem, categoria: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none focus:border-teal-500"/>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Qtd Inicial</label>
                        <input required type="number" step="0.01" value={formEmbalagem.quantidade_atual} onChange={e=>setFormEmbalagem({...formEmbalagem, quantidade_atual: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-800 outline-none focus:border-teal-500"/>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Estoque Mínimo</label>
                        <input required type="number" step="0.01" value={formEmbalagem.quantidade_minima} onChange={e=>setFormEmbalagem({...formEmbalagem, quantidade_minima: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none focus:border-teal-500"/>
                     </div>
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Custo Unitário (R$)</label>
                     <input type="number" step="0.01" value={formEmbalagem.preco_unitario} onChange={e=>setFormEmbalagem({...formEmbalagem, preco_unitario: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none focus:border-teal-500"/>
                  </div>
                  
                  <div className="flex gap-4 mt-8">
                     <button type="button" onClick={()=>setModalEstoque(false)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all">Cancelar</button>
                     <button type="submit" className="flex-1 py-4 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-2xl transition-all shadow-xl shadow-teal-500/20 active:scale-95 flex items-center justify-center gap-2"><Save size={18}/> Salvar</button>
                  </div>
               </form>
            </div>
         </div>
      )}

    </div>
  );
}
