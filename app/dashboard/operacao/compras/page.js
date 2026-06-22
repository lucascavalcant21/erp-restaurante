"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../../../context/ERPContext";
import { fetchEstoque, registrarCompra } from "../../../../lib/estoque";
import { ShoppingCart, PackagePlus, Plus, ArrowLeft, TrendingUp, AlertCircle } from "lucide-react";
import { fmtBRL } from "../../../../components/ui";

export default function ComprasPage() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ insumoId: "", quantidade: 1, valorPago: "" });

  const carregar = async () => {
    setLoading(true);
    const { data } = await fetchEstoque(unidadeAtiva);
    setInsumos(data);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva]);

  const handleComprar = async (e) => {
     e.preventDefault();
     const ins = insumos.find(i => i.insumo_id === form.insumoId);
     if(!ins) return alert("Selecione um insumo.");
     
     const valorNum = parseFloat(form.valorPago.replace(',', '.'));
     if(isNaN(valorNum)) return alert("Valor inválido.");

     await registrarCompra(unidadeAtiva, ins.insumo_id, ins.nome, ins.departamento, Number(form.quantidade), valorNum);
     
     alert(`Compra registrada! ${form.quantidade} ${ins.unidade_medida} adicionado ao estoque e R$ ${valorNum} enviado para o Contas a Pagar (Financeiro).`);
     
     setModalOpen(false);
     setForm({ insumoId: "", quantidade: 1, valorPago: "" });
     carregar();
  };

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-slate-50">
      
      <div className="bg-slate-900 pt-8 pb-10 px-8 shadow-lg text-white">
         <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors">
                 <ArrowLeft size={20}/>
              </button>
              <div className="w-16 h-16 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                 <ShoppingCart size={32} />
              </div>
              <div>
                 <h1 className="text-4xl font-black tracking-tighter">Entrada de Compras</h1>
                 <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">Integração: Estoque e Financeiro</p>
              </div>
            </div>
            <button onClick={() => setModalOpen(true)} className="px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl flex items-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">
               <PackagePlus size={20}/> Lançar Nota de Compra
            </button>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-8">
         <div className="bg-amber-50 border border-amber-200 p-6 rounded-[24px] flex items-start gap-4 mb-8">
            <AlertCircle className="text-amber-500 flex-shrink-0" size={28}/>
            <div>
               <h3 className="font-black text-amber-800 text-lg mb-1">Como funciona a Hiper-Automação?</h3>
               <p className="text-amber-700 font-medium text-sm leading-relaxed">
                  Ao registrar uma compra de insumo (como Tomate ou Vodka) aqui, o sistema automaticamente: <br/>
                  1. Adiciona a quantidade comprada no <strong>Estoque Físico</strong> da Cozinha/Bar. <br/>
                  2. Gera uma conta pendente em <strong>Contas a Pagar</strong> no módulo Financeiro (como CMV).
               </p>
            </div>
         </div>

         {loading ? (
            <p className="text-center font-bold text-slate-500">Carregando insumos...</p>
         ) : (
            <div className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-xl shadow-slate-200/50">
               <h2 className="text-xl font-black text-slate-800 mb-6 px-2">Status do Estoque de Insumos</h2>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {insumos.map(ins => (
                     <div key={ins.insumo_id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                        <p className="font-bold text-slate-700 leading-tight mb-2">{ins.nome}</p>
                        <div className="flex justify-between items-end mt-auto">
                           <span className="text-[10px] uppercase font-black text-slate-500">{ins.departamento}</span>
                           <span className="text-lg font-black text-indigo-600">{ins.quantidade_atual} {ins.unidade_medida}</span>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         )}
      </div>

      {modalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95">
               <h2 className="font-black text-2xl text-slate-800 mb-6">Registrar Compra</h2>
               <form onSubmit={handleComprar} className="space-y-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">O que você comprou?</label>
                     <select required value={form.insumoId} onChange={e=>setForm({...form, insumoId: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none focus:border-emerald-500">
                        <option value="">-- Selecione o Insumo --</option>
                        {insumos.map(i => <option key={i.insumo_id} value={i.insumo_id}>{i.nome}</option>)}
                     </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Qtd (Em {insumos.find(i=>i.insumo_id===form.insumoId)?.unidade_medida || 'un'})</label>
                        <input required type="number" step="0.01" min="0" value={form.quantidade} onChange={e=>setForm({...form, quantidade: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none focus:border-emerald-500"/>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Valor Total Pago (R$)</label>
                        <input required type="text" placeholder="50,00" value={form.valorPago} onChange={e=>setForm({...form, valorPago: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-emerald-600 outline-none focus:border-emerald-500"/>
                     </div>
                  </div>
                  <button type="submit" className="w-full mt-8 py-5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2">
                     <TrendingUp size={20}/> Confirmar Compra
                  </button>
               </form>
            </div>
         </div>
      )}

    </div>
  );
}
