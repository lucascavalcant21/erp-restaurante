"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchPedidosOnlinePendentes, aceitarPedidoOnline, recusarPedidoOnline } from "../../../lib/vendas";
import { Bike, Check, X, ArrowLeft, Clock, MapPin, Phone, AlertCircle, Maximize } from "lucide-react";
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

  const containerRef = useRef(null);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
       containerRef.current?.requestFullscreen?.();
    } else {
       document.exitFullscreen?.();
    }
  };

  return (
    <div ref={containerRef} className="h-screen w-full flex font-sans overflow-hidden bg-[#EAEAEA]">
      
      {/* SIDEBAR ESQUERDA (TIRINHA VERMELHA) */}
      <div className="w-12 bg-[#D12B2B] flex flex-col items-center py-4 z-20 shrink-0 border-r border-red-800">
         <button onClick={() => router.back()} className="text-white hover:text-red-200 mb-8 transition-colors"><ArrowLeft size={20}/></button>
         <div className="text-white font-black text-xl flex flex-col items-center tracking-widest" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
            SIGA
         </div>
      </div>

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 flex flex-col overflow-hidden">
         
         {/* TOPBAR */}
         <div className="bg-[#2D2D2D] h-14 flex items-center px-4 justify-between shrink-0 shadow-md z-10 text-white">
            <div className="flex items-center h-full">
               <button className="h-full px-6 font-bold text-xs bg-black/20 border-b-4 border-red-500">DELIVERY</button>
               <button className="h-full px-6 font-bold text-xs text-slate-400 hover:text-white transition-colors">IFOOD</button>
            </div>
            
            <div className="flex items-center gap-6">
               <div className="flex items-center gap-2 bg-[#1A1A1A] rounded px-3 py-1.5 border border-slate-700 w-64">
                  <input type="text" placeholder="Nome, telefone, ID, bairro..." className="bg-transparent border-none outline-none text-xs w-full placeholder-slate-500 text-white" />
               </div>

               <div className="flex items-center gap-1 text-slate-400">
                  <span className="font-bold text-xs text-slate-300 mr-2">
                     {pedidos.length === 0 ? "Nenhum pedido novo" : `${pedidos.length} Pedido(s) online`}
                  </span>
               </div>
            </div>

            <div className="flex items-center gap-2">
               <button className="px-3 py-1.5 flex items-center gap-1.5 bg-[#4A4A4A] hover:bg-[#5A5A5A] rounded text-[10px] font-bold uppercase transition-colors">
                  <Bike size={14}/> Entregadores
               </button>
               <button onClick={toggleFullscreen} className="px-3 py-1.5 flex items-center gap-1.5 bg-[#4A4A4A] hover:bg-[#5A5A5A] rounded text-[10px] font-bold uppercase transition-colors">
                  <Maximize size={14}/>
               </button>
            </div>
         </div>

         {/* KANBAN BOARD */}
         <div className="flex-1 flex p-2 gap-2 overflow-x-auto">
            
            {/* COLUNA: COZINHA */}
            <div className="flex-1 min-w-[300px] flex flex-col bg-[#F3F3F3] rounded shadow-sm border border-slate-300">
               <div className="bg-[#D12B2B] text-white p-2 text-center font-black text-xs uppercase tracking-widest rounded-t">
                  Cozinha
               </div>
               <div className="flex-1 overflow-y-auto p-2">
                  {pedidos.filter(p => !p.status || p.status === 'aberto' || p.status === 'preparando' || p.status === 'pendente').length === 0 ? (
                     <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm uppercase">Nenhum pedido</div>
                  ) : (
                     pedidos.filter(p => !p.status || p.status === 'aberto' || p.status === 'preparando' || p.status === 'pendente').map(p => (
                        <div key={p.id} className="bg-white p-3 rounded shadow-sm border border-slate-200 mb-2">
                           <div className="flex justify-between items-start mb-2">
                              <span className="font-black text-slate-800">#{p.id.substring(0,4).toUpperCase()}</span>
                              <span className="text-xs font-bold text-red-500">{calcTempo(p.created_at)} min</span>
                           </div>
                           <p className="font-bold text-slate-600 text-xs">{p.cliente_nome || "Cliente Não Informado"}</p>
                           <p className="text-xs text-slate-500 mt-1">{p.bairro || p.endereco_entrega}</p>
                           <div className="mt-3 flex gap-2">
                              <button onClick={() => handleRecusar(p.id)} className="py-1.5 px-3 bg-[#E0E0E0] text-slate-600 font-bold text-xs rounded hover:bg-slate-300"><X size={14}/></button>
                              <button onClick={() => handleAceitar(p.id)} className="flex-1 py-1.5 bg-[#4CAF50] hover:bg-green-600 text-white font-bold text-xs rounded">ACEITAR / IMPRIMIR</button>
                           </div>
                        </div>
                     ))
                  )}
               </div>
            </div>

            {/* COLUNA: SAIU */}
            <div className="flex-1 min-w-[300px] flex flex-col bg-[#F3F3F3] rounded shadow-sm border border-slate-300">
               <div className="bg-[#7F8C8D] text-white p-2 text-center font-black text-xs uppercase tracking-widest rounded-t">
                  Saiu
               </div>
               <div className="flex-1 overflow-y-auto p-2">
                  {pedidos.filter(p => p.status === 'saiu').length === 0 ? (
                     <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm uppercase">Nenhum pedido</div>
                  ) : (
                     pedidos.filter(p => p.status === 'saiu').map(p => (
                        <div key={p.id} className="bg-white p-3 rounded shadow-sm border border-slate-200 mb-2">
                           <div className="flex justify-between items-start mb-2">
                              <span className="font-black text-slate-800">#{p.id.substring(0,4).toUpperCase()}</span>
                              <span className="text-xs font-bold text-slate-500">{calcTempo(p.created_at)} min</span>
                           </div>
                           <p className="font-bold text-slate-600 text-xs">{p.cliente_nome || "Cliente"}</p>
                           <div className="mt-3">
                              <button className="w-full py-1.5 bg-[#4CAF50] hover:bg-green-600 text-white font-bold text-xs rounded">MARCAR ENTREGUE</button>
                           </div>
                        </div>
                     ))
                  )}
               </div>
            </div>

            {/* COLUNA: ENTREGUE */}
            <div className="flex-1 min-w-[300px] flex flex-col bg-[#F3F3F3] rounded shadow-sm border border-slate-300">
               <div className="bg-[#27AE60] text-white p-2 text-center font-black text-xs uppercase tracking-widest rounded-t">
                  Entregue
               </div>
               <div className="flex-1 overflow-y-auto p-2">
                  {pedidos.filter(p => p.status === 'entregue').length === 0 ? (
                     <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm uppercase">Nenhum pedido</div>
                  ) : (
                     pedidos.filter(p => p.status === 'entregue').map(p => (
                        <div key={p.id} className="bg-white p-3 rounded shadow-sm border border-slate-200 mb-2 opacity-60">
                           <div className="flex justify-between items-start mb-2">
                              <span className="font-black text-slate-800">#{p.id.substring(0,4).toUpperCase()}</span>
                              <span className="text-xs font-bold text-green-600">Concluído</span>
                           </div>
                           <p className="font-bold text-slate-600 text-xs">{p.cliente_nome || "Cliente"}</p>
                        </div>
                     ))
                  )}
               </div>
            </div>

         </div>

      </div>
    </div>
  );
}
