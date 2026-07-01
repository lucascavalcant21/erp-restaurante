"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchPedidosOnlinePendentes, aceitarPedidoOnline, recusarPedidoOnline, despacharPedidoOnline, fecharPedidoOnline } from "../../../lib/vendas";
import { Bike, Check, X, ArrowLeft, Clock, MapPin, Phone, AlertCircle, Maximize, Printer } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

export default function GestorOnlinePage() {
  const router = useRouter();
  const { abrirMenu } = useERP();
  const { unidadeAtiva } = useERP();
  
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState('DELIVERY');
  const [detalhe, setDetalhe] = useState(null); // pedido aberto no painel de detalhe

  const imprimirVia = (p) => {
    const win = window.open('', '_blank', 'width=320,height=600');
    if (!win) return alert("Habilite os popups para imprimir.");
    const agora = new Date().toLocaleString('pt-BR');
    const itensHtml = (p.pedidos_itens || []).map(it => `
       <div class="item"><span class="q">${it.quantidade}x</span> ${it.produtos?.nome_produto || 'Item'}${it.observacao ? `<div class="obs">OBS: ${it.observacao}</div>` : ''}</div>`).join('');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Via</title><style>
       *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;width:80mm;padding:4mm;color:#000}
       .center{text-align:center}.big{font-size:18px;font-weight:bold}.sep{border-top:1px dashed #000;margin:8px 0}
       .item{font-size:15px;font-weight:bold;margin:7px 0}.item .q{font-size:18px}.obs{font-size:12px;font-weight:normal;margin:2px 0 0 6px}
       .l{font-size:12px;margin:2px 0}
       @media print{@page{margin:0;size:80mm auto}}
    </style></head><body>
       <div class="center big">PEDIDO #${p.id.substring(0,4).toUpperCase()}</div>
       <div class="center l">${p.cliente_nome || 'Cliente'}</div>
       ${p.cliente_telefone ? `<div class="center l">${p.cliente_telefone}</div>` : ''}
       ${p.endereco_entrega ? `<div class="l">${p.endereco_entrega}</div>` : ''}
       <div class="center l">${agora}</div><div class="sep"></div>${itensHtml}<div class="sep"></div>
       <div class="l" style="text-align:right;font-weight:bold">TOTAL: R$ ${Number(p.valor_total||0).toFixed(2)}</div>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

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

  const handleDespachar = async (id) => {
     if(confirm("Deseja despachar este pedido? O Motoboy será notificado.")) {
        setPedidos(atual => atual.map(p => p.id === id ? { ...p, status: 'saiu' } : p));
        await despacharPedidoOnline(id);
     }
  };

  const handleEntregue = async (id) => {
     if(confirm("Confirmar entrega? Isso dará baixa no estoque e no financeiro.")) {
        setPedidos(atual => atual.filter(p => p.id !== id));
        await fecharPedidoOnline(id, unidadeAtiva);
     }
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
         <button onClick={() => abrirMenu()} className="text-white hover:text-red-200 mb-8 transition-colors"><ArrowLeft size={20}/></button>
         <div className="text-white font-black text-xl flex flex-col items-center tracking-widest" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
            SIGA
         </div>
      </div>

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 flex flex-col overflow-hidden">
         
         {/* TOPBAR */}
         <div className="bg-[#2D2D2D] h-14 flex items-center px-4 justify-between shrink-0 shadow-md z-10 text-white">
            <div className="flex items-center h-full">
               <button onClick={() => setAba('DELIVERY')} className={`h-full px-6 font-bold text-xs transition-colors ${aba === 'DELIVERY' ? 'bg-black/20 border-b-4 border-red-500 text-white' : 'text-slate-400 hover:text-white'}`}>DELIVERY</button>
               <button onClick={() => setAba('IFOOD')} className={`h-full px-6 font-bold text-xs transition-colors ${aba === 'IFOOD' ? 'bg-black/20 border-b-4 border-red-500 text-white' : 'text-slate-400 hover:text-white'}`}>IFOOD</button>
               <button onClick={() => setAba('CARDAPIO')} className={`h-full px-6 font-bold text-xs transition-colors flex items-center gap-2 ${aba === 'CARDAPIO' ? 'bg-black/20 border-b-4 border-red-500 text-white' : 'text-slate-400 hover:text-white'}`}>CARDÁPIO DIGITAL</button>
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
            
            {(() => {
               const pedidosFiltrados = pedidos.filter(p => {
                  if (aba === 'IFOOD') return p.origem === 'ifood';
                  if (aba === 'CARDAPIO') return p.origem === 'cardapio';
                  // DEFAULT: DELIVERY (whatsapp, telefone, manual, etc)
                  return !p.origem || p.origem === 'whatsapp' || p.origem === 'telefone' || p.origem === 'delivery' || p.origem === 'manual';
               });

               return (
                  <>
                     {/* COLUNA 1: NOVOS */}
            <div className="flex-1 min-w-[280px] flex flex-col bg-[#F3F3F3] rounded shadow-sm border border-slate-300">
               <div className="bg-[#D12B2B] text-white p-2 text-center font-black text-xs uppercase tracking-widest rounded-t">
                  Novos
               </div>
               <div className="flex-1 overflow-y-auto p-2">
                  {pedidosFiltrados.filter(p => !p.status || p.status === 'aberto' || p.status === 'pendente' || p.status === 'aguardando_aceite').length === 0 ? (
                     <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm uppercase">Nenhum pedido</div>
                  ) : (
                     pedidosFiltrados.filter(p => !p.status || p.status === 'aberto' || p.status === 'pendente' || p.status === 'aguardando_aceite').map(p => (
                        <div key={p.id} onClick={() => setDetalhe(p)} className="bg-white p-3 rounded-xl shadow-sm border-l-4 border-l-red-500 mb-2 cursor-pointer hover:shadow-md transition-shadow">
                           <div className="flex justify-between items-start mb-2">
                              <span className="font-black text-slate-800">#{p.id.substring(0,4).toUpperCase()}</span>
                              <span className="text-xs font-bold text-red-500 flex items-center gap-1"><Clock size={12}/> {calcTempo(p.created_at)} min</span>
                           </div>
                           <p className="font-bold text-slate-600 text-xs">{p.cliente_nome || "Cliente Não Informado"}</p>
                           <p className="text-xs text-slate-500 mt-1 truncate"><MapPin size={10} className="inline mr-1"/>{p.bairro || p.endereco_entrega || "Balcão / Retirada"}</p>
                           <div className="mt-3 flex gap-2">
                              <button onClick={(e) => { e.stopPropagation(); handleRecusar(p.id); }} className="py-1.5 px-3 bg-[#E0E0E0] text-slate-600 font-bold text-xs rounded hover:bg-slate-300"><X size={14}/></button>
                              <button onClick={(e) => { e.stopPropagation(); handleAceitar(p.id); }} className="flex-1 py-1.5 bg-[#4CAF50] hover:bg-green-600 text-white font-bold text-xs rounded flex justify-center items-center gap-1"><Check size={14}/> ACEITAR</button>
                           </div>
                        </div>
                     ))
                  )}
               </div>
            </div>

            {/* COLUNA 2: EM PREPARO */}
            <div className="flex-1 min-w-[280px] flex flex-col bg-[#F3F3F3] rounded shadow-sm border border-slate-300">
               <div className="bg-[#F39C12] text-white p-2 text-center font-black text-xs uppercase tracking-widest rounded-t">
                  Em Preparo
               </div>
               <div className="flex-1 overflow-y-auto p-2">
                  {pedidosFiltrados.filter(p => p.status === 'preparando_delivery' || p.status === 'preparando').length === 0 ? (
                     <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm uppercase">Nenhum pedido</div>
                  ) : (
                     pedidosFiltrados.filter(p => p.status === 'preparando_delivery' || p.status === 'preparando').map(p => (
                        <div key={p.id} onClick={() => setDetalhe(p)} className="bg-white p-3 rounded-xl shadow-sm border-l-4 border-l-orange-400 mb-2 cursor-pointer hover:shadow-md transition-shadow">
                           <div className="flex justify-between items-start mb-2">
                              <span className="font-black text-slate-800">#{p.id.substring(0,4).toUpperCase()}</span>
                              <span className="text-xs font-bold text-orange-500 flex items-center gap-1"><Clock size={12}/> {calcTempo(p.created_at)} min</span>
                           </div>
                           <p className="font-bold text-slate-600 text-xs">{p.cliente_nome || "Cliente"}</p>
                           <p className="text-[10px] text-orange-600 font-bold mt-2 uppercase bg-orange-50 p-1 rounded inline-block">Sendo preparado pela Cozinha...</p>
                        </div>
                     ))
                  )}
               </div>
            </div>

            {/* COLUNA 3: PRONTOS */}
            <div className="flex-1 min-w-[280px] flex flex-col bg-[#F3F3F3] rounded shadow-sm border border-slate-300">
               <div className="bg-[#27AE60] text-white p-2 text-center font-black text-xs uppercase tracking-widest rounded-t">
                  Prontos p/ Despacho
               </div>
               <div className="flex-1 overflow-y-auto p-2">
                  {pedidosFiltrados.filter(p => p.status === 'pronto').length === 0 ? (
                     <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm uppercase">Nenhum pedido</div>
                  ) : (
                     pedidosFiltrados.filter(p => p.status === 'pronto').map(p => (
                        <div key={p.id} onClick={() => setDetalhe(p)} className="bg-white p-3 rounded-xl shadow-sm border-l-4 border-l-green-500 mb-2 cursor-pointer hover:shadow-md transition-shadow">
                           <div className="flex justify-between items-start mb-2">
                              <span className="font-black text-slate-800">#{p.id.substring(0,4).toUpperCase()}</span>
                           </div>
                           <p className="font-bold text-slate-600 text-xs">{p.cliente_nome || "Cliente"}</p>
                           <div className="mt-3">
                              <button onClick={(e) => { e.stopPropagation(); handleDespachar(p.id); }} className="w-full py-1.5 bg-[#4CAF50] hover:bg-green-600 text-white font-bold text-xs rounded flex justify-center items-center gap-1"><Bike size={14}/> CHAMAR MOTOBOY</button>
                           </div>
                        </div>
                     ))
                  )}
               </div>
            </div>

            {/* COLUNA 4: EM ROTA (SAIU) */}
            <div className="flex-1 min-w-[280px] flex flex-col bg-[#F3F3F3] rounded shadow-sm border border-slate-300">
               <div className="bg-[#7F8C8D] text-white p-2 text-center font-black text-xs uppercase tracking-widest rounded-t">
                  Em Rota (Saiu)
               </div>
               <div className="flex-1 overflow-y-auto p-2">
                  {pedidosFiltrados.filter(p => p.status === 'saiu').length === 0 ? (
                     <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm uppercase">Nenhum pedido</div>
                  ) : (
                     pedidosFiltrados.filter(p => p.status === 'saiu').map(p => (
                        <div key={p.id} onClick={() => setDetalhe(p)} className="bg-white p-3 rounded-xl shadow-sm border-l-4 border-l-slate-400 mb-2 cursor-pointer hover:shadow-md transition-shadow">
                           <div className="flex justify-between items-start mb-2">
                              <span className="font-black text-slate-800">#{p.id.substring(0,4).toUpperCase()}</span>
                           </div>
                           <p className="font-bold text-slate-600 text-xs">{p.cliente_nome || "Cliente"}</p>
                           <div className="mt-3">
                              <button onClick={(e) => { e.stopPropagation(); handleEntregue(p.id); }} className="w-full py-1.5 bg-[#4A4A4A] hover:bg-slate-700 text-white font-bold text-xs rounded">MARCAR COMO ENTREGUE</button>
                           </div>
                        </div>
                     ))
                  )}
               </div>
            </div>

                  </>
               );
            })()}

         </div>

      </div>

      {/* Painel de detalhe do pedido (clique no card) */}
      {detalhe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setDetalhe(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900 text-xl">#{detalhe.id.substring(0, 4).toUpperCase()}</span>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-red-100 text-red-700">{detalhe.origem || 'Delivery'}</span>
                </div>
                <p className="text-sm font-bold text-slate-700 mt-1">{detalhe.cliente_nome || 'Cliente não informado'}</p>
                <p className="text-xs font-bold text-slate-400">Feito às {new Date(detalhe.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <button onClick={() => setDetalhe(null)} className="w-9 h-9 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-500 shrink-0"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-2">
                {detalhe.cliente_telefone && <p className="text-sm font-bold text-slate-700 flex items-center gap-2"><Phone size={15} className="text-slate-400" /> {detalhe.cliente_telefone}</p>}
                {detalhe.endereco_entrega && <p className="text-sm font-bold text-slate-700 flex items-start gap-2"><MapPin size={15} className="text-slate-400 mt-0.5 shrink-0" /> {detalhe.endereco_entrega}</p>}
              </div>
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Itens</p>
                <div className="space-y-1.5">
                  {(detalhe.pedidos_itens || []).map(it => (
                    <div key={it.id} className="flex justify-between items-start bg-slate-50 rounded-lg px-3 py-2">
                      <span className="font-bold text-slate-800 text-sm">{it.quantidade}x {it.produtos?.nome_produto}{it.observacao ? <span className="block text-[11px] font-bold text-amber-700">Obs: {it.observacao}</span> : null}</span>
                      <span className="font-black text-slate-700 text-sm shrink-0 ml-2">{fmtBRL(it.quantidade * it.valor_unitario)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total</span>
                <span className="text-2xl font-black text-emerald-600">{fmtBRL(detalhe.valor_total || 0)}</span>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100">
              <button onClick={() => imprimirVia(detalhe)} className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-xl transition-colors flex items-center justify-center gap-2"><Printer size={16} /> Imprimir via</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
