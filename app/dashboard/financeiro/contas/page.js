"use client";

import { useState, useEffect } from "react";
import { useERP } from "../../../../context/ERPContext";
import { fetchContas, salvarConta, pagarConta, CATEGORIAS_CUSTO } from "../../../../lib/financeiro";
import { Plus, Search, CheckCircle2, CircleDashed, Filter, CalendarDays, Wallet } from "lucide-react";
import { fmtBRL } from "../../../../components/ui";

export default function ContasAPagarPage() {
  const { unidadeAtiva } = useERP();
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ descricao: "", valor: "", data_vencimento: "", categoria: CATEGORIAS_CUSTO[0].id });

  const carregar = async () => {
    setLoading(true);
    const { data } = await fetchContas(unidadeAtiva);
    setContas(data);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva]);

  const handleSalvar = async (e) => {
     e.preventDefault();
     const valorNum = parseFloat(form.valor.replace(',', '.'));
     if(isNaN(valorNum)) return alert("Valor inválido");
     
     await salvarConta({
        unidade_id: unidadeAtiva,
        descricao: form.descricao,
        valor: valorNum,
        data_vencimento: form.data_vencimento,
        categoria: form.categoria,
        status: 'pendente'
     });
     
     setModalOpen(false);
     setForm({ descricao: "", valor: "", data_vencimento: "", categoria: CATEGORIAS_CUSTO[0].id });
     carregar();
  };

  const handlePagar = async (id) => {
     if(confirm("Confirmar o pagamento desta conta? Ela será debitada da sua DRE.")) {
        await pagarConta(id);
        carregar();
     }
  };

  const aPagarTotal = contas.filter(c => c.status === 'pendente').reduce((acc, c) => acc + Number(c.valor), 0);
  const pagasTotal = contas.filter(c => c.status === 'pago').reduce((acc, c) => acc + Number(c.valor), 0);

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-slate-50">
      
      <div className="bg-slate-900 pt-8 pb-10 px-8 shadow-lg text-white">
         <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
               <h1 className="text-4xl font-black tracking-tighter">Contas a Pagar</h1>
               <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-1">Gestão de Custos e Despesas</p>
            </div>
            <button onClick={() => setModalOpen(true)} className="px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl flex items-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">
               <Plus size={20}/> Nova Despesa
            </button>
         </div>

         {/* CARDS DE RESUMO */}
         <div className="max-w-5xl mx-auto mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-800 p-6 rounded-[24px] border border-slate-700/50 flex items-center gap-4">
               <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                  <CalendarDays size={28}/>
               </div>
               <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Pendente (A Pagar)</p>
                  <p className="text-3xl font-black text-amber-400">{fmtBRL(aPagarTotal)}</p>
               </div>
            </div>
            <div className="bg-slate-800 p-6 rounded-[24px] border border-slate-700/50 flex items-center gap-4">
               <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                  <Wallet size={28}/>
               </div>
               <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Total Pago</p>
                  <p className="text-3xl font-black text-emerald-400">{fmtBRL(pagasTotal)}</p>
               </div>
            </div>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-8">
         <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-slate-200 shadow-xl shadow-slate-200/50">
            
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
               <div className="flex-1 relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input type="text" placeholder="Buscar despesa..." className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:bg-white focus:border-emerald-500 transition-colors"/>
               </div>
               <button className="p-3 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-100"><Filter size={18}/></button>
            </div>

            {loading ? (
               <div className="text-center py-10 font-bold text-slate-400">Carregando contas...</div>
            ) : contas.length === 0 ? (
               <div className="text-center py-20 text-slate-400">
                  <Wallet size={48} className="mx-auto mb-4 opacity-20"/>
                  <p className="font-bold">Nenhuma conta cadastrada.</p>
               </div>
            ) : (
               <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b-2 border-slate-100">
                           <th className="pb-4 pl-4">Vencimento</th>
                           <th className="pb-4">Descrição</th>
                           <th className="pb-4">Categoria</th>
                           <th className="pb-4">Valor</th>
                           <th className="pb-4 text-center">Status</th>
                           <th className="pb-4 pr-4"></th>
                        </tr>
                     </thead>
                     <tbody className="text-sm font-bold">
                        {contas.map(c => {
                           const cat = CATEGORIAS_CUSTO.find(x => x.id === c.categoria);
                           
                           // Checa se está atrasado (Pendente e Vencimento < Hoje)
                           const hoje = new Date().toISOString().split('T')[0];
                           const isAtrasado = c.status === 'pendente' && c.data_vencimento < hoje;

                           return (
                              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                                 <td className={`py-4 pl-4 ${isAtrasado ? 'text-red-500 font-black' : 'text-slate-500'}`}>
                                    {c.data_vencimento.split('-').reverse().join('/')}
                                    {isAtrasado && <span className="block text-[10px] uppercase">Atrasado</span>}
                                 </td>
                                 <td className="py-4 text-slate-800">{c.descricao}</td>
                                 <td className="py-4">
                                    <span className={`px-2 py-1 rounded text-[10px] uppercase font-black tracking-widest text-white ${cat?.cor || 'bg-slate-500'}`}>
                                       {cat?.label}
                                    </span>
                                 </td>
                                 <td className="py-4 text-slate-900 text-base">{fmtBRL(c.valor)}</td>
                                 <td className="py-4 text-center">
                                    {c.status === 'pago' ? (
                                       <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                          <CheckCircle2 size={14}/> Pago
                                       </span>
                                    ) : (
                                       <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                                          <CircleDashed size={14}/> Pendente
                                       </span>
                                    )}
                                 </td>
                                 <td className="py-4 pr-4 text-right">
                                    {c.status === 'pendente' && (
                                       <button onClick={() => handlePagar(c.id)} className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs rounded-xl shadow-md active:scale-95 transition-all">
                                          Pagar
                                       </button>
                                    )}
                                 </td>
                              </tr>
                           )
                        })}
                     </tbody>
                  </table>
               </div>
            )}
         </div>
      </div>

      {/* MODAL NOVA CONTA */}
      {modalOpen && (
         <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
               <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <h2 className="text-xl font-black text-slate-800">Lançar Despesa</h2>
                  <button onClick={() => setModalOpen(false)} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-500 hover:bg-slate-100">x</button>
               </div>
               <form onSubmit={handleSalvar} className="p-6 space-y-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">O que você está pagando?</label>
                     <input required type="text" placeholder="Ex: Conta de Luz Maio" value={form.descricao} onChange={e=>setForm({...form, descricao: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500 focus:bg-white"/>
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Qual a Categoria? (Centro de Custo)</label>
                     <select required value={form.categoria} onChange={e=>setForm({...form, categoria: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500 focus:bg-white">
                        {CATEGORIAS_CUSTO.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                     </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Valor (R$)</label>
                        <input required type="text" placeholder="150,00" value={form.valor} onChange={e=>setForm({...form, valor: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500 focus:bg-white"/>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Vencimento</label>
                        <input required type="date" value={form.data_vencimento} onChange={e=>setForm({...form, data_vencimento: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500 focus:bg-white"/>
                     </div>
                  </div>
                  <div className="pt-4 mt-2 border-t border-slate-100">
                     <button type="submit" className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-lg rounded-xl shadow-xl shadow-emerald-500/30 active:scale-95 transition-transform">
                        Salvar Despesa
                     </button>
                  </div>
               </form>
            </div>
         </div>
      )}

    </div>
  );
}
