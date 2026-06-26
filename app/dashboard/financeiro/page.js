"use client";

import React, { useState, useEffect } from "react";
import { useERP } from "../../context/ERPContext";
import { fetchDRE, fetchContas, salvarConta, pagarConta, CATEGORIAS_CUSTO } from "../../lib/financeiro";
import { DollarSign, TrendingUp, TrendingDown, Wallet, Plus, CheckCircle, Search, Edit2, Loader2, Target, CalendarDays, X } from "lucide-react";
import { fmtBRL } from "../../components/ui";

export default function FinanceiroDREPage() {
  const { unidadeAtiva } = useERP();
  
  const [loading, setLoading] = useState(true);
  const [dre, setDre] = useState(null);
  const [contas, setContas] = useState([]);
  
  // MODAL NOVA CONTA
  const [modalConta, setModalConta] = useState(false);
  const [formConta, setFormConta] = useState({ descricao: "", valor: "", categoria: "custo_fixo", data_vencimento: new Date().toISOString().split('T')[0], status: "pendente" });
  const [processando, setProcessando] = useState(false);

  // FILTRO
  const [filtroStatus, setFiltroStatus] = useState("todas");

  const carregarDados = async () => {
    setLoading(true);
    const { data: dreData } = await fetchDRE(unidadeAtiva);
    const { data: contasData } = await fetchContas(unidadeAtiva);
    setDre(dreData);
    setContas(contasData || []);
    setLoading(false);
  };

  useEffect(() => {
    if(unidadeAtiva) carregarDados();
  }, [unidadeAtiva]);

  const handleSalvarConta = async (e) => {
    e.preventDefault();
    setProcessando(true);
    
    await salvarConta({ 
       ...formConta, 
       unidade_id: unidadeAtiva,
       valor: Number(formConta.valor)
    });
    
    setModalConta(false);
    setFormConta({ descricao: "", valor: "", categoria: "custo_fixo", data_vencimento: new Date().toISOString().split('T')[0], status: "pendente" });
    await carregarDados();
    setProcessando(false);
  };

  const handlePagarConta = async (contaId) => {
     if(confirm("Confirmar pagamento desta conta?")) {
        await pagarConta(contaId);
        carregarDados();
     }
  };

  const contasFiltradas = contas.filter(c => {
     if (filtroStatus === "todas") return true;
     return c.status === filtroStatus;
  });

  if (loading) return (
     <div className="flex flex-col items-center justify-center h-[80vh] text-slate-400">
        <Loader2 size={48} className="animate-spin mb-4 text-[#10B981]" />
        <p className="font-bold uppercase tracking-widest text-sm">Calculando DRE...</p>
     </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-8 animate-in fade-in">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
         <div>
            <h1 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
               <Wallet className="text-[#10B981]" size={36}/> DRE & Financeiro
            </h1>
            <p className="text-slate-500 font-medium mt-1">Gestão de Contas a Pagar e Lucratividade (DRE)</p>
         </div>

         <button onClick={() => setModalConta(true)} className="px-6 py-3 bg-slate-900 text-white font-black rounded-xl shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-colors flex items-center gap-2">
            <Plus size={20}/> Nova Despesa
         </button>
      </div>

      {/* DASHBOARD DRE */}
      {dre && (
         <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            {/* FATURAMENTO */}
            <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm flex flex-col justify-between">
               <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-500 text-sm uppercase tracking-widest">Receitas (Faturamento)</h3>
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><TrendingUp size={16}/></div>
               </div>
               <p className="text-3xl font-black text-slate-800">{fmtBRL(dre.faturamentoTotal)}</p>
            </div>

            {/* CUSTOS/DESPESAS */}
            <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm flex flex-col justify-between">
               <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-500 text-sm uppercase tracking-widest">Custos & Despesas</h3>
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600"><TrendingDown size={16}/></div>
               </div>
               <p className="text-3xl font-black text-slate-800">{fmtBRL(dre.totalCustos)}</p>
            </div>

            {/* LUCRO LÍQUIDO */}
            <div className="bg-gradient-to-br from-[#10B981] to-[#047857] rounded-[24px] p-6 shadow-xl shadow-emerald-500/30 text-white flex flex-col justify-between md:col-span-2 relative overflow-hidden group">
               <div className="absolute -right-10 -top-10 bg-white/10 w-40 h-40 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
               <div className="relative z-10 flex justify-between items-start">
                  <div>
                     <h3 className="font-bold text-emerald-100 text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Target size={18}/> Lucro Líquido Real
                     </h3>
                     <p className="text-5xl font-black">{fmtBRL(dre.lucroLiquido)}</p>
                  </div>
                  <div className="text-right">
                     <p className="text-emerald-100 text-sm font-bold uppercase tracking-widest mb-1">Margem Líquida</p>
                     <div className="inline-block bg-white text-emerald-700 font-black text-2xl px-4 py-2 rounded-xl shadow-sm">
                        {dre.margem}%
                     </div>
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* ÁREA DE CONTAS A PAGAR */}
      <div className="bg-white border border-slate-200 rounded-[24px] overflow-hidden shadow-sm">
         <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <h2 className="text-xl font-black text-slate-800">Contas a Pagar & Despesas</h2>
            
            <div className="flex bg-slate-100 p-1 rounded-xl">
               <button onClick={()=>setFiltroStatus("todas")} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${filtroStatus==='todas' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Todas</button>
               <button onClick={()=>setFiltroStatus("pendente")} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${filtroStatus==='pendente' ? 'bg-amber-100 text-amber-700 shadow-sm' : 'text-slate-500'}`}>Pendentes</button>
               <button onClick={()=>setFiltroStatus("pago")} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${filtroStatus==='pago' ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 'text-slate-500'}`}>Pagas</button>
            </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-slate-50/50">
                     <th className="p-4 text-xs font-bold uppercase tracking-widest text-slate-400">Descrição / Despesa</th>
                     <th className="p-4 text-xs font-bold uppercase tracking-widest text-slate-400">Categoria</th>
                     <th className="p-4 text-xs font-bold uppercase tracking-widest text-slate-400">Vencimento</th>
                     <th className="p-4 text-xs font-bold uppercase tracking-widest text-slate-400">Valor</th>
                     <th className="p-4 text-xs font-bold uppercase tracking-widest text-slate-400 text-right">Status</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {contasFiltradas.length === 0 && (
                     <tr><td colSpan={5} className="p-10 text-center font-bold text-slate-400">Nenhuma conta encontrada.</td></tr>
                  )}
                  {contasFiltradas.map(conta => {
                     const cat = CATEGORIAS_CUSTO.find(c => c.id === conta.categoria) || CATEGORIAS_CUSTO[2];
                     const isPendente = conta.status === 'pendente';
                     
                     return (
                        <tr key={conta.id} className="hover:bg-slate-50 transition-colors group">
                           <td className="p-4">
                              <span className="font-bold text-slate-700 block">{conta.descricao}</span>
                           </td>
                           <td className="p-4">
                              <span className={`inline-block px-3 py-1 rounded-md text-xs font-bold text-white ${cat.cor}`}>
                                 {cat.label.split('(')[0].trim()}
                              </span>
                           </td>
                           <td className="p-4">
                              <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                                 <CalendarDays size={16}/> 
                                 {new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}
                              </div>
                           </td>
                           <td className="p-4 font-black text-slate-800">
                              {fmtBRL(conta.valor)}
                           </td>
                           <td className="p-4 text-right">
                              {isPendente ? (
                                 <button onClick={() => handlePagarConta(conta.id)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black text-sm rounded-xl transition-colors shadow-sm">
                                    Pagar Agora
                                 </button>
                              ) : (
                                 <span className="inline-flex items-center gap-1 text-emerald-600 font-black bg-emerald-50 px-3 py-1.5 rounded-lg text-sm">
                                    <CheckCircle size={16}/> Pago
                                 </span>
                              )}
                           </td>
                        </tr>
                     );
                  })}
               </tbody>
            </table>
         </div>
      </div>

      {/* MODAL NOVA CONTA */}
      {modalConta && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
               <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
                  <h2 className="font-black text-xl">Registrar Nova Despesa</h2>
                  <button onClick={() => setModalConta(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
               </div>
               
               <form onSubmit={handleSalvarConta} className="p-6 flex flex-col gap-5">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Descrição da Conta</label>
                     <input type="text" placeholder="Ex: Conta de Luz (Maio), Salário João..." required value={formConta.descricao} onChange={e=>setFormConta({...formConta, descricao: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-5">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Valor (R$)</label>
                        <input type="number" step="0.01" placeholder="0.00" required value={formConta.valor} onChange={e=>setFormConta({...formConta, valor: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-700 outline-none focus:border-indigo-500 focus:bg-white" />
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Vencimento</label>
                        <input type="date" required value={formConta.data_vencimento} onChange={e=>setFormConta({...formConta, data_vencimento: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white" />
                     </div>
                  </div>

                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Categoria da Despesa (DRE)</label>
                     <select required value={formConta.categoria} onChange={e=>setFormConta({...formConta, categoria: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white">
                        {CATEGORIAS_CUSTO.filter(c => c.id !== 'cmv').map(c => (
                           <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                     </select>
                     <p className="text-xs text-slate-400 mt-2 font-medium">* O custo CMV é gerado automaticamente pelas Fichas Técnicas dos Pratos.</p>
                  </div>

                  <div className="flex gap-3 mt-4">
                     <button type="button" onClick={() => setModalConta(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl">Cancelar</button>
                     <button type="submit" disabled={processando} className="flex-1 py-4 bg-slate-900 text-white font-black rounded-xl shadow-lg shadow-slate-900/30 disabled:opacity-50">
                        {processando ? 'Salvando...' : 'Salvar Despesa'}
                     </button>
                  </div>
               </form>
            </div>
         </div>
      )}

    </div>
  );
}
