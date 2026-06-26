"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../context/ERPContext";
import { fetchItensKDS, atualizarStatusKDS } from "../../lib/vendas";
import { MonitorPlay, ArrowLeft, Clock, CheckCircle2, Play, Maximize } from "lucide-react";

function KDSRunner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept") || "todos"; // 'cozinha', 'bar', ou 'todos'
  
  const { unidadeAtiva } = useERP();
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);

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
    else if(item.status_kds === 'cancelado') novo = 'entregue'; // Dispensar cancelado
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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
       containerRef.current?.requestFullscreen?.();
    } else {
       document.exitFullscreen?.();
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen font-sans text-slate-100 bg-slate-900 overflow-x-hidden">
      
      {/* TOPBAR KDS (Escuro) */}
      <div className="bg-black/40 border-b border-slate-800 p-4 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
         <div className="flex items-center gap-4">
           <button onClick={() => router.back()} className="p-3 text-slate-500 hover:text-white bg-slate-800 rounded-xl transition-colors">
              <ArrowLeft size={20}/>
           </button>
           <div>
              <h1 className="text-2xl font-black tracking-tighter text-white flex items-center gap-2">
                 <MonitorPlay size={24} className="text-emerald-500"/> KDS - {deptUrl.toUpperCase()}
              </h1>
              <p className="text-slate-700 font-bold uppercase tracking-widest text-[10px] mt-1">Kitchen Display System • Atualização em Tempo Real</p>
           </div>
         </div>
         <button onClick={toggleFullscreen} className="p-3 text-slate-500 hover:text-white bg-slate-800 rounded-xl transition-colors" title="Tela Cheia">
            <Maximize size={20}/>
         </button>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
               {Object.values(itens.reduce((acc, it) => {
                  if(it.status_kds === 'entregue') return acc;
                  const pId = it.pedidos.id;
                  if(!acc[pId]) {
                     acc[pId] = {
                        pedidoId: pId,
                        tipo_pedido: it.pedidos.tipo_pedido,
                        cliente_nome: it.pedidos.cliente_nome,
                        numero_mesa: it.pedidos.mesas?.numero_mesa,
                        created_at: it.pedidos.created_at || it.created_at,
                        itens: []
                     };
                  }
                  acc[pId].itens.push(it);
                  return acc;
               }, {})).sort((a,b) => new Date(a.created_at) - new Date(b.created_at)).map((pedido) => {
                  
                  const msPedido = new Date() - new Date(pedido.created_at);
                  const minPedido = Math.floor(msPedido / 60000);
                  
                  return (
                     <div key={pedido.pedidoId} className="bg-slate-800 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col">
                        
                        {/* Header da Comanda */}
                        <div className="bg-slate-900 p-4 border-b border-slate-700 flex justify-between items-center">
                           <div>
                              <p className={`text-[10px] font-black uppercase tracking-widest ${
                                 pedido.tipo_pedido === 'ifood' ? 'text-red-400' :
                                 pedido.tipo_pedido === 'balcao' ? 'text-blue-400' :
                                 pedido.tipo_pedido === 'cardapio' || pedido.tipo_pedido === 'delivery' ? 'text-purple-400' : 'text-emerald-400'
                              }`}>
                                 {pedido.tipo_pedido === 'ifood' ? 'IFOOD' :
                                  pedido.tipo_pedido === 'balcao' ? 'BALCÃO' :
                                  pedido.tipo_pedido === 'cardapio' || pedido.tipo_pedido === 'delivery' ? 'ONLINE' : 'MESA'}
                              </p>
                              <p className="text-xl font-black text-white leading-none mt-1 truncate max-w-[200px]">
                                 {pedido.tipo_pedido === 'ifood' || pedido.tipo_pedido === 'cardapio' || pedido.tipo_pedido === 'delivery'
                                    ? (pedido.cliente_nome ? pedido.cliente_nome.split(' ')[0] : `#${pedido.pedidoId.substring(0,4)}`)
                                    : pedido.tipo_pedido === 'balcao' ? `#${pedido.pedidoId.substring(0,4)}` 
                                    : `Mesa ${pedido.numero_mesa || 'N/A'}`}
                              </p>
                           </div>
                           <div className="bg-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-slate-300">
                              <Clock size={14}/>
                              <span className="font-black text-sm">{minPedido} MIN</span>
                           </div>
                        </div>

                        {/* Lista de Itens do Pedido */}
                        {/* Lista de Itens do Pedido Agrupada por Categoria */}
                        <div className="p-2">
                           {[...new Set(pedido.itens.map(it => it.produtos.categoria || 'Outros'))].map(cat => {
                              const itensCat = pedido.itens.filter(i => (i.produtos.categoria || 'Outros') === cat);
                              return (
                                 <div key={cat} className="mb-4 last:mb-0">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 border-b border-slate-700/50 pb-1">{cat}</h4>
                                    <div className="space-y-2">
                                       {itensCat.map(it => {
                                          const tempoBase = it.produtos.tempo_preparo_base || 15;
                                          const minItem = Math.floor((new Date() - new Date(it.created_at)) / 60000);
                                          const atrasado = minItem >= tempoBase;
                                          const critico = minItem >= tempoBase + 10;
                                          
                                          return (
                                             <button 
                                                key={it.id} 
                                                onClick={() => avancarStatus(it)}
                                                className={`w-full text-left rounded-xl p-4 transition-all duration-300 shadow-md active:scale-95 border-2 relative overflow-hidden
                                                   ${it.status_kds === 'cancelado' ? 'bg-[#EA1D2C] border-red-500 text-white animate-pulse' : 
                                                     it.status_kds === 'pendente' ? 'bg-slate-700 border-slate-600 text-slate-200 hover:border-slate-500' : 
                                                     it.status_kds === 'preparando' ? (
                                                        critico ? 'bg-red-500 border-red-400 text-white animate-pulse-fast' : 
                                                        atrasado ? 'bg-amber-500 border-amber-400 text-amber-950 animate-pulse' : 
                                                        'bg-amber-300 border-amber-200 text-amber-950'
                                                     ) : 
                                                     'bg-emerald-500 border-emerald-400 text-emerald-950'}
                                                `}
                                             >
                                                <div className="flex justify-between items-start gap-2 relative z-10">
                                                   <span className="text-lg font-black leading-tight">
                                                      {it.status_kds === 'cancelado' ? '❌ CANCELADO' : `${it.quantidade}x ${it.produtos.nome_produto}`}
                                                   </span>
                                                   
                                                   <div className="flex flex-col items-end gap-1 shrink-0">
                                                      <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                                         it.status_kds === 'pendente' ? 'bg-black/20' : 
                                                         it.status_kds === 'cancelado' ? 'bg-black/20' :
                                                         critico || atrasado ? 'bg-black/20' : 'bg-black/10'
                                                      }`}>
                                                         {minItem}M / {tempoBase}M
                                                      </div>
                                                      
                                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${it.status_kds === 'pendente' || it.status_kds === 'cancelado' ? 'bg-slate-900/40 text-white' : 'bg-black/20'}`}>
                                                         {it.status_kds === 'pendente' ? <Play size={12} className="ml-0.5"/> : <CheckCircle2 size={14}/>}
                                                      </div>
                                                   </div>
                                                </div>
                                                
                                                {it.status_kds !== 'cancelado' && it.observacao && (
                                                   <div className="mt-3 relative z-10">
                                                      <p className="font-black text-sm text-[#EA1D2C] bg-red-100 p-2.5 rounded-lg border border-red-200 uppercase tracking-wide text-center">
                                                         ⚠️ {it.observacao}
                                                      </p>
                                                   </div>
                                                )}
                                                
                                                {/* Barra de progresso visual de tempo */}
                                                {it.status_kds === 'preparando' && (
                                                   <div className="absolute bottom-0 left-0 h-1 bg-black/20 w-full">
                                                      <div className={`h-full ${critico ? 'bg-red-900' : atrasado ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${Math.min((minItem / tempoBase) * 100, 100)}%`}}></div>
                                                   </div>
                                                )}
                                             </button>
                                          );
                                       })}
                                    </div>
                                 </div>
                              );
                           })}
                        </div>
                     </div>
                  );
               })}
            </div>
         )}
      </div>

    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Iniciando KDS...</div>}>
       <KDSRunner />
    </Suspense>
  );
}
