"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchEstoque, ajustarEstoque } from "../../../lib/estoque";
import { PackageSearch, Edit3, X, Save, ArrowLeft, RefreshCw, AlertCircle, Search } from "lucide-react";

function EstoqueRunner() {
  const router = useRouter();
  const { abrirMenu } = useERP();
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept"); // 'cozinha' ou 'bar'
  
  const { unidadeAtiva } = useERP();
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  
  const [modalAjuste, setModalAjuste] = useState(false);
  const [itemAtual, setItemAtual] = useState(null);
  const [novoSaldo, setNovoSaldo] = useState("");

  const carregar = async () => {
    setLoading(true);
    const { data } = await fetchEstoque(unidadeAtiva, deptUrl);
    setItens(data);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva, deptUrl]);

  const filtrados = itens.filter(i => i.nome.toLowerCase().includes(busca.toLowerCase()));

  const abrirAjuste = (item) => {
    setItemAtual(item);
    setNovoSaldo(item.quantidade_atual === 0 ? "" : item.quantidade_atual);
    setModalAjuste(true);
  };

  const handleSalvarAjuste = async () => {
    if(novoSaldo === "") return alert("Digite o saldo atual");
    
    await ajustarEstoque(unidadeAtiva, itemAtual.insumo_id, Number(novoSaldo));
    
    setModalAjuste(false);
    carregar();
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
                 <PackageSearch size={28} />
              </div>
              <div>
                 <h1 className="text-3xl font-black tracking-tighter text-slate-900">Estoque Físico</h1>
                 <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">Saldos e Entradas {deptUrl ? `- ${deptUrl}` : ''}</p>
              </div>
            </div>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-8">
         <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 flex items-start gap-4">
            <AlertCircle className="text-slate-600 flex-shrink-0 mt-0.5" />
            <div>
               <h3 className="font-bold text-amber-800">Atenção ao Saldo Base</h3>
               <p className="text-emerald-700 text-sm mt-1">Para que a <strong>Produção do Dia</strong> funcione perfeitamente descontando insumos, certifique-se de que os ingredientes possuem saldo positivo aqui nesta tela.</p>
            </div>
         </div>

         <div className="bg-white p-3 rounded-2xl border border-slate-200 mb-6 flex items-center gap-3 shadow-sm">
            <Search size={20} className="text-slate-500 ml-2" />
            <input type="text" placeholder="Buscar ingrediente..." value={busca} onChange={e=>setBusca(e.target.value)} className="flex-1 outline-none font-bold text-slate-700 p-2" />
         </div>

         <div className="rounded-2xl overflow-hidden shadow-md border border-slate-200">
            {/* Header da tabela */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">Ingrediente</span>
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-center w-20">Unid.</span>
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-center w-32">Saldo Atual</span>
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-right w-28">Ação</span>
            </div>

            {/* Linhas */}
            <div className="bg-white divide-y divide-slate-100">
               {loading && (
                 <div className="p-12 text-center">
                   <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
                   <p className="text-slate-400 font-bold text-sm">Buscando saldos...</p>
                 </div>
               )}
               {!loading && filtrados.map((ins, idx) => {
                 const zerado = ins.quantidade_atual <= 0;
                 const critico = !zerado && ins.quantidade_atual < 5;
                 const dept = ins.departamento?.toLowerCase();
                 const deptColor = dept === 'bar' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700';
                 return (
                   <div key={ins.insumo_id} className={`px-6 py-4 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center group transition-all duration-150 ${zerado ? 'bg-red-50/40 hover:bg-red-50' : 'hover:bg-emerald-50/40'}`}>
                     {/* Nome + Dept */}
                     <div className="flex items-center gap-3 min-w-0">
                       <div className={`w-1 h-10 rounded-full shrink-0 ${zerado ? 'bg-red-400' : critico ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                       <div className="min-w-0">
                         <p className="font-bold text-slate-800 text-[15px] leading-tight truncate">{ins.nome}</p>
                         <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 ${deptColor}`}>{ins.departamento}</span>
                       </div>
                     </div>
                     {/* Unidade */}
                     <div className="w-20 flex justify-center">
                       <span className="bg-slate-800 text-white px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-wider shadow-sm">{ins.unidade_medida}</span>
                     </div>
                     {/* Saldo */}
                     <div className="w-32 flex flex-col items-center">
                       <span className={`font-black text-2xl leading-none ${zerado ? 'text-red-500' : critico ? 'text-amber-500' : 'text-emerald-600'}`}>
                         {Number(ins.quantidade_atual).toFixed(2)}
                       </span>
                       {zerado && <span className="text-[9px] font-black uppercase tracking-widest text-red-400 mt-1">● Zerado</span>}
                       {critico && <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 mt-1">⚠ Crítico</span>}
                       {!zerado && !critico && <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mt-1">✓ Normal</span>}
                     </div>
                     {/* Ação */}
                     <div className="w-28 flex justify-end">
                       <button
                         onClick={() => abrirAjuste(ins)}
                         className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm shadow-emerald-600/20 hover:shadow-emerald-600/40 hover:-translate-y-px active:scale-95"
                       >
                         <RefreshCw size={13}/> Ajustar
                       </button>
                     </div>
                   </div>
                 );
               })}
               {!loading && filtrados.length === 0 && (
                 <div className="p-16 text-center">
                   <PackageSearch size={40} className="text-slate-200 mx-auto mb-3" />
                   <p className="text-slate-400 font-bold">Nenhum ingrediente cadastrado ainda.</p>
                 </div>
               )}
            </div>
         </div>
      </div>

      {modalAjuste && itemAtual && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="font-black text-2xl text-slate-800">Ajuste de Saldo</h2>
                  <button onClick={() => setModalAjuste(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                     <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">{itemAtual.nome}</p>
                     <p className="text-3xl font-black text-slate-800">{Number(itemAtual.quantidade_atual).toFixed(2)} <span className="text-lg text-slate-500">{itemAtual.unidade_medida}</span></p>
                  </div>

                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Novo Saldo Real (Balanço)</label>
                     <div className="relative">
                        <input 
                           type="number" 
                           step="0.001" 
                           placeholder="0.00" 
                           value={novoSaldo} 
                           onChange={e=>setNovoSaldo(e.target.value)} 
                           className="w-full p-5 text-2xl bg-white border-2 border-slate-200 rounded-2xl font-black text-slate-800 outline-none focus:border-emerald-500"
                        />
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-500">{itemAtual.unidade_medida}</span>
                     </div>
                  </div>
               </div>

               <button onClick={handleSalvarAjuste} className="w-full mt-8 py-5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-amber-500/20 active:scale-95 flex items-center justify-center gap-2">
                  <Save size={20}/> Confirmar Ajuste
               </button>
            </div>
         </div>
      )}

    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Carregando Estoque...</div>}>
       <EstoqueRunner />
    </Suspense>
  );
}
