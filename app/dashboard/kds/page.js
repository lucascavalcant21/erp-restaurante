"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchItensKDS, atualizarStatusKDS } from "../../../lib/vendas";
import { MonitorPlay, ArrowLeft, Clock, CheckCircle2, Play } from "lucide-react";

function KDSRunner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept") || "todos"; // 'cozinha', 'bar', ou 'todos'
  
  const { unidadeAtiva } = useERP();
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    // Evita tela piscando ao recarregar (polling)
    if(itens.length === 0) setLoading(true);
    
    const { data } = await fetchItensKDS(unidadeAtiva, deptUrl);
    setItens(data);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) {
       carregar();
       // Polling a cada 5 segundos pra simular realtime (no MVP)
       const intervalo = setInterval(carregar, 5000);
       return () => clearInterval(intervalo);
    }
  }, [unidadeAtiva, deptUrl]);

  const avancarStatus = async (item) => {
    let novo = "";
    if(item.status_kds === 'pendente') novo = 'preparando';
    else if(item.status_kds === 'preparando') novo = 'pronto';
    else if(item.status_kds === 'pronto') novo = 'entregue';
    else return;

    // Atualiza localmente rápido pra parecer real-time (Optimistic UI)
    setItens(atual => atual.map(i => i.id === item.id ? { ...i, status_kds: novo } : i));
    
    await atualizarStatusKDS(item.id, novo);
  };

  const calcTempo = (dataCriacao) => {
     const ms = new Date() - new Date(dataCriacao);
     const min = Math.floor(ms / 60000);
     return min;
  };

  return (
    <div className="min-h-screen font-sans text-slate-100 bg-slate-900 overflow-x-hidden">
      
      {/* TOPBAR KDS (Escuro) */}
      <div className="bg-black/40 border-b border-slate-800 p-4 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
         <div className="flex items-center gap-4">
           <button onClick={() => router.back()} className="p-3 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-colors">
              <ArrowLeft size={20}/>
           </button>
           <div>
              <h1 className="text-2xl font-black tracking-tighter text-white flex items-center gap-2">
                 <MonitorPlay size={24} className="text-emerald-500"/> KDS - {deptUrl.toUpperCase()}
              </h1>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">Kitchen Display System • Atualização em Tempo Real</p>
           </div>
         </div>
      </div>

      <div className="p-6">
         {loading ? (
            <p className="font-bold text-slate-500 text-center mt-20">Conectando ao Salão...</p>
         ) : itens.length === 0 ? (
            <div className="text-center mt-32 opacity-30">
               <CheckCircle2 size={80} className="mx-auto mb-6"/>
               <h2 className="text-3xl font-black">Tudo Limpo!</h2>
               <p className="font-medium mt-2 uppercase tracking-widest">Nenhum pedido pendente na fila.</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
               {itens.filter(i => i.status_kds !== 'entregue').map((it) => {
                  const min = calcTempo(it.created_at);
                  const isAtrasado = min >= 15;
                  
                  return (
                     <button 
                        key={it.id} 
                        onClick={() => avancarStatus(it)}
                        className={`text-left rounded-[32px] p-6 flex flex-col justify-between transition-all duration-300 shadow-2xl active:scale-95 border-2
                           ${it.status_kds === 'pendente' ? 'bg-slate-800 border-slate-700 hover:border-slate-500' : 
                             it.status_kds === 'preparando' ? 'bg-amber-500 border-amber-400 text-amber-950' : 
                             'bg-emerald-500 border-emerald-400 text-emerald-950 animate-pulse'}
                        `}
                     >
                        <div className="flex justify-between items-start mb-6">
                           <span className={`px-4 py-2 rounded-xl text-3xl font-black ${it.status_kds === 'pendente' ? 'bg-slate-700 text-white' : 'bg-black/20'}`}>
                              {it.quantidade}x
                           </span>
                           <span className={`flex items-center gap-1 font-black px-3 py-1 rounded-full text-[10px] uppercase tracking-widest
                              ${isAtrasado && it.status_kds === 'pendente' ? 'bg-red-500 text-white animate-bounce' : 'bg-black/10'}
                           `}>
                              <Clock size={12}/> {min} MIN
                           </span>
                        </div>
                        
                        <div className="mb-8">
                           <p className="text-3xl font-black leading-tight tracking-tight mb-2">{it.produtos.nome_produto}</p>
                           {it.observacao && (
                              <p className={`font-bold text-sm px-3 py-2 rounded-lg inline-block
                                 ${it.status_kds === 'pendente' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-black/20'}
                              `}>
                                 ⚠️ {it.observacao}
                              </p>
                           )}
                        </div>

                        <div className="mt-auto border-t border-black/10 pt-4 flex justify-between items-end">
                           <div>
                              <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">Mesa</p>
                              <p className="text-2xl font-black">{it.pedidos.mesas.numero_mesa}</p>
                           </div>
                           
                           <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-widest opacity-50">
                                 {it.status_kds === 'pendente' ? 'Iniciar' : it.status_kds === 'preparando' ? 'Pronto' : 'Entregar'}
                              </span>
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${it.status_kds === 'pendente' ? 'bg-slate-700 text-white' : 'bg-black/20'}`}>
                                 {it.status_kds === 'pendente' ? <Play size={16} className="ml-1"/> : <CheckCircle2 size={20}/>}
                              </div>
                           </div>
                        </div>
                     </button>
                  )
               })}
            </div>
         )}
      </div>

    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-400">Iniciando KDS...</div>}>
       <KDSRunner />
    </Suspense>
  );
}
