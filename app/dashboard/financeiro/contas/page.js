"use client";

import { useState, useEffect } from "react";
import { useERP } from "../../../context/ERPContext";
import { fetchContas, salvarConta, pagarConta, gerarContasRecorrentes, CATEGORIAS_CUSTO } from "../../../lib/financeiro";
import { Plus, Search, CheckCircle2, CircleDashed, Filter, CalendarDays, Wallet } from "lucide-react";
import { fmtBRL, SkeletonList } from "../../../components/ui";

export default function ContasAPagarPage() {
  const { unidadeAtiva } = useERP();
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ descricao: "", valor: "", data_vencimento: "", categoria: CATEGORIAS_CUSTO[0].id, recorrente: false });
  const [avisoRecorrentes, setAvisoRecorrentes] = useState("");

  const carregar = async () => {
    setLoading(true);
    // Vira o mês: contas recorrentes se recriam sozinhas antes de listar
    const { criadas } = await gerarContasRecorrentes(unidadeAtiva);
    if (criadas > 0) {
      setAvisoRecorrentes(`${criadas} conta(s) recorrente(s) do mês criada(s) automaticamente.`);
      setTimeout(() => setAvisoRecorrentes(""), 5000);
    }
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
        status: 'pendente',
        recorrente: !!form.recorrente
     });

     setModalOpen(false);
     setForm({ descricao: "", valor: "", data_vencimento: "", categoria: CATEGORIAS_CUSTO[0].id, recorrente: false });
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

      {avisoRecorrentes && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-sky-600 text-white font-bold text-sm px-5 py-3 rounded-full shadow-xl animate-in fade-in slide-in-from-bottom-2">
          {avisoRecorrentes}
        </div>
      )}

      <div className="bg-slate-900 pt-6 sm:pt-8 pb-8 sm:pb-10 px-4 sm:px-8 shadow-lg text-white">
         <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
               <h1 className="text-3xl sm:text-4xl font-black tracking-tighter">Contas a Pagar</h1>
               <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">Gestão de Custos e Despesas</p>
            </div>
            <button onClick={() => setModalOpen(true)} className="px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl flex items-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">
               <Plus size={20}/> Nova Despesa
            </button>
         </div>

         {/* CARDS DE RESUMO */}
         <div className="max-w-5xl mx-auto mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-800 p-6 rounded-[24px] border border-slate-700/50 flex items-center gap-4">
               <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-slate-600 flex items-center justify-center">
                  <CalendarDays size={28}/>
               </div>
               <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Pendente (A Pagar)</p>
                  <p className="text-3xl font-black text-slate-500">{fmtBRL(aPagarTotal)}</p>
               </div>
            </div>
            <div className="bg-slate-800 p-6 rounded-[24px] border border-slate-700/50 flex items-center gap-4">
               <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                  <Wallet size={28}/>
               </div>
               <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Total Pago</p>
                  <p className="text-3xl font-black text-emerald-400">{fmtBRL(pagasTotal)}</p>
               </div>
            </div>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6 sm:mt-8">
         <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-slate-200 shadow-xl shadow-slate-200/50">
            
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
               <div className="flex-1 relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"/>
                  <input type="text" placeholder="Buscar despesa..." className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:bg-white focus:border-emerald-500 transition-colors"/>
               </div>
               <button className="p-3 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-100"><Filter size={18}/></button>
            </div>

            {loading ? (
               <SkeletonList />
            ) : contas.length === 0 ? (
               <div className="text-center py-20 text-slate-500">
                  <Wallet size={48} className="mx-auto mb-4 opacity-20"/>
                  <p className="font-bold">Nenhuma conta cadastrada.</p>
               </div>
            ) : (
               <div className="rounded-2xl overflow-hidden shadow-md border border-slate-200">
                  {/* Cabeçalho */}
                  <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 grid grid-cols-[160px_1fr_180px_120px_140px_100px] gap-4 items-center">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">Vencimento</span>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">Descrição</span>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">Categoria</span>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">Valor</span>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-center">Status</span>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-300"></span>
                  </div>
                  {/* Linhas */}
                  <div className="bg-white divide-y divide-slate-100">
                    {contas.map(c => {
                      const cat = CATEGORIAS_CUSTO.find(x => x.id === c.categoria);
                      const hoje = new Date().toISOString().split('T')[0];
                      const isAtrasado = c.status === 'pendente' && c.data_vencimento < hoje;
                      return (
                        <div key={c.id} className="px-5 py-4 grid grid-cols-[160px_1fr_180px_120px_140px_100px] gap-4 items-center hover:bg-amber-50/40 transition-all duration-150">
                          <div className="flex items-center gap-3">
                            <div className={`w-1 h-10 rounded-full shrink-0 ${isAtrasado ? 'bg-rose-500' : c.status === 'pago' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                            <div>
                              <span className={`font-bold text-sm ${isAtrasado ? 'text-rose-700' : 'text-slate-600'}`}>
                                {c.data_vencimento.split('-').reverse().join('/')}
                              </span>
                              {isAtrasado && <span className="block text-[10px] font-black text-rose-500 uppercase">Atrasado</span>}
                            </div>
                          </div>
                          <span className="font-bold text-slate-800">{c.descricao}</span>
                          <div>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-white ${cat?.cor || 'bg-slate-500'}`}>
                              {cat?.label}
                            </span>
                          </div>
                          <span className="font-black text-slate-900">{fmtBRL(c.valor)}</span>
                          <div className="text-center">
                            {c.status === 'pago' ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg font-bold">
                                <CheckCircle2 size={14} /> Pago
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg font-bold">
                                <CircleDashed size={14} /> Pendente
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            {c.status === 'pendente' && (
                              <button onClick={() => handlePagar(c.id)} className="px-3 py-2 bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded-lg transition-all text-xs font-black">
                                Pagar
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
               </div>
            )}
         </div>
      </div>

      {/* MODAL NOVA CONTA */}
      {modalOpen && (
         <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl sm:rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-3 sm:my-0">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Valor (R$)</label>
                        <input required type="text" placeholder="150,00" value={form.valor} onChange={e=>setForm({...form, valor: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500 focus:bg-white"/>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Vencimento</label>
                        <input required type="date" value={form.data_vencimento} onChange={e=>setForm({...form, data_vencimento: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500 focus:bg-white"/>
                     </div>
                  </div>
                  <label className="flex items-start gap-3 bg-sky-50 border border-sky-200 rounded-xl p-3.5 cursor-pointer">
                     <input type="checkbox" checked={!!form.recorrente} onChange={e=>setForm({...form, recorrente: e.target.checked})} className="w-4 h-4 accent-sky-600 mt-0.5"/>
                     <span>
                        <span className="text-xs font-black text-sky-700 uppercase tracking-widest block">Conta recorrente (todo mês)</span>
                        <span className="text-[11px] font-medium text-sky-700/70">Aluguel, luz, internet... Na virada do mês ela se recria sozinha, com o mesmo dia de vencimento e valor (que você pode ajustar).</span>
                     </span>
                  </label>
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
