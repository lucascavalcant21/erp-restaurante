"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchPedidosOnlinePendentes, aceitarPedidoOnline, recusarPedidoOnline } from "../../../lib/vendas";
import { Motorbike, Check, X, ArrowLeft, Clock, MapPin, Phone, AlertCircle } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

export default function GestorOnlinePage() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    // Não bota loading = true se já tiver pedido pra não piscar a tela
    if(pedidos.length === 0) setLoading(true);
    const { data } = await fetchPedidosOnlinePendentes(unidadeAtiva);
    setPedidos(data);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) {
       carregar();
       // Polling a cada 10 seg
       const int = setInterval(carregar, 10000);
       return () => clearInterval(int);
    }
  }, [unidadeAtiva]);

  const handleAceitar = async (id) => {
     if(confirm("Confirmar e enviar para a Cozinha?")) {
        // Optimistic Update
        setPedidos(atual => atual.filter(p => p.id !== id));
        await aceitarPedidoOnline(id);
     }
  };

  const handleRecusar = async (id) => {
     if(confirm("Tem certeza que deseja recusar/cancelar este pedido? O cliente não será cobrado.")) {
        setPedidos(atual => atual.filter(p => p.id !== id));
        await recusarPedidoOnline(id);
     }
  };

  const calcTempo = (dataCriacao) => {
     const ms = new Date() - new Date(dataCriacao);
     return Math.floor(ms / 60000); // minutos
  };

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-slate-100">
      
      {/* TOPBAR */}
      <div className="bg-slate-900 pt-8 pb-8 px-8 shadow-lg">
         <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4 text-white">
              <button onClick={() => router.back()} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors">
                 <ArrowLeft size={20}/>
              </button>
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-slate-500 flex items-center justify-center">
                 <Motorbike size={32} />
              </div>
              <div>
                 <h1 className="text-4xl font-black tracking-tighter">Gestor Delivery</h1>
                 <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">Pedidos Online Aguardando Aceite</p>
              </div>
            </div>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 mt-10">
         {loading ? (
            <p className="font-bold text-slate-500">Buscando novos pedidos...</p>
         ) : pedidos.length === 0 ? (
            <div className="text-center p-10 bg-white border border-slate-200 rounded-3xl max-w-lg mx-auto mt-20">
               <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Motorbike size={40} className="text-slate-500"/>
               </div>
               <h3 className="text-2xl font-black text-slate-700">Nenhum pedido novo</h3>
               <p className="text-slate-500 mt-2 font-medium mb-6">Fique de olho. Assim que um cliente enviar um pedido pelo QR Code, ele aparecerá aqui com um alerta.</p>
               <div className="flex items-center justify-center gap-2 text-slate-600 text-sm font-bold bg-slate-50 p-3 rounded-xl w-max mx-auto animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Online e aguardando...
               </div>
            </div>
         ) : (
            <div className="space-y-6">
               <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center gap-3">
                  <AlertCircle className="text-slate-600"/>
                  <p className="text-amber-800 font-bold text-sm">Atenção: Os pedidos abaixo NÃO estão na cozinha ainda. Você precisa Aceitar para que eles sejam impressos/exibidos no KDS.</p>
               </div>

               {pedidos.map(ped => {
                  const min = calcTempo(ped.created_at);
                  const isAtrasado = min > 5;

                  return (
                     <div key={ped.id} className="bg-white rounded-[32px] p-6 sm:p-8 border-2 border-slate-200 shadow-xl flex flex-col md:flex-row gap-8">
                        
                        {/* LADO ESQUERDO: Dados do Cliente e Itens */}
                        <div className="flex-1">
                           <div className="flex items-center gap-4 mb-6">
                              <span className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest ${ped.tipo_pedido === 'delivery' ? 'bg-slate-100 text-emerald-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                 {ped.tipo_pedido}
                              </span>
                              <span className={`flex items-center gap-1 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${isAtrasado ? 'bg-emerald-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500'}`}>
                                 <Clock size={14}/> {min} min aguardando
                              </span>
                           </div>

                           <h2 className="text-3xl font-black text-slate-800 mb-1">{ped.cliente_nome}</h2>
                           <div className="flex flex-col gap-2 mt-4 mb-8">
                              <p className="text-slate-500 font-bold text-sm flex items-center gap-2"><Phone size={16}/> {ped.cliente_telefone}</p>
                              {ped.tipo_pedido === 'delivery' && (
                                 <p className="text-slate-500 font-bold text-sm flex items-start gap-2"><MapPin size={16} className="mt-0.5 flex-shrink-0"/> {ped.endereco_entrega}</p>
                              )}
                           </div>

                           <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Itens do Pedido</h3>
                              <div className="space-y-4">
                                 {ped.pedidos_itens?.map((it, i) => (
                                    <div key={i} className="flex justify-between items-start">
                                       <div className="flex gap-3">
                                          <span className="font-black text-slate-500">{it.quantidade}x</span>
                                          <div>
                                             <p className="font-bold text-slate-800">{it.produtos.nome_produto}</p>
                                             {it.observacao && <p className="text-xs font-bold text-emerald-600 mt-1 bg-slate-50 px-2 py-1 inline-block rounded">Obs: {it.observacao}</p>}
                                          </div>
                                       </div>
                                       <span className="font-black text-emerald-600">{fmtBRL(it.valor_unitario * it.quantidade)}</span>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        </div>

                        {/* LADO DIREITO: Total e Ações */}
                        <div className="w-full md:w-80 flex flex-col justify-between">
                           <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg mb-4">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Total a Receber</p>
                              <p className="text-4xl font-black text-emerald-400 mb-4">{fmtBRL(ped.valor_total)}</p>
                              {ped.troco_para && (
                                 <p className="text-sm font-bold text-slate-500 bg-slate-800 p-3 rounded-xl border border-slate-700">Troco p/: {ped.troco_para}</p>
                              )}
                           </div>

                           <div className="space-y-3">
                              <button onClick={() => handleAceitar(ped.id)} className="w-full py-5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2">
                                 <Check size={24}/> Aceitar Pedido
                              </button>
                              <button onClick={() => handleRecusar(ped.id)} className="w-full py-5 bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 font-black text-lg rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2">
                                 <X size={24}/> Recusar
                              </button>
                           </div>
                        </div>

                     </div>
                  )
               })}
            </div>
         )}
      </div>

    </div>
  );
}
