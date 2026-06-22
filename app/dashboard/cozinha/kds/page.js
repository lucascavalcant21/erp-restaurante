"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Clock, CheckCircle, ChefHat, Check, Flame, LayoutGrid, Volume2, VolumeX, ArrowLeft, TriangleAlert } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchPedidosAtivos, atualizarStatusItem, finalizarPedidoTodo } from "../../../lib/kds";
import { useRouter } from "next/navigation";

// SLA de 20 minutos por padrão
const SLA_MINUTOS = 20;

// Formatação de hora
const horaStr = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

// Diferença de tempo em minutos
const diffMinutos = (iso) => {
  const agora = new Date();
  const pedido = new Date(iso);
  return Math.floor((agora - pedido) / 60000);
};

export default function KDSPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const router = useRouter();
  
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [agora, setAgora] = useState(Date.now());
  const [somAtivo, setSomAtivo] = useState(true);

  const audioRef = useRef(null);
  const lastPedidoDate = useRef(null);

  const carregar = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    const { data } = await fetchPedidosAtivos(unidadeAtiva);
    
    if (data && data.length > 0) {
      const maisRecente = new Date(Math.max(...data.map(p => new Date(p.created_at))));
      
      // Toca o sino se for um pedido novo
      if (lastPedidoDate.current && maisRecente > lastPedidoDate.current) {
        if (somAtivo && audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(e => console.log("Áudio bloqueado", e));
        }
      }
      lastPedidoDate.current = maisRecente;
    }

    setPedidos(data || []);
    if (!isSilent) setLoading(false);
  }, [unidadeAtiva, somAtivo]);

  useEffect(() => {
    carregar();
    // Auto-refresh (banco) a cada 10s
    const intervalo = setInterval(() => carregar(true), 10000);
    // Atualiza timers visuais (agora) a cada 15s
    const tick = setInterval(() => setAgora(Date.now()), 15000);
    return () => { clearInterval(intervalo); clearInterval(tick); };
  }, [carregar]);

  async function handleClickStatus(item) {
    let novoStatus = "pendente";
    if (item.status_preparo === "pendente" || !item.status_preparo) novoStatus = "preparando";
    else if (item.status_preparo === "preparando") novoStatus = "pronto";
    else if (item.status_preparo === "pronto") novoStatus = "pendente";

    // Otimista
    setPedidos(prev => prev.map(ped => ({
      ...ped,
      venda_itens: ped.venda_itens.map(i => i.id === item.id ? { ...i, status_preparo: novoStatus } : i)
    })));

    await atualizarStatusItem(item.id, novoStatus);
  }

  async function handleFinalizarPedido(pedido) {
    setPedidos(prev => prev.filter(p => p.id !== pedido.id));
    setToast(`Pedido entregue!`);
    setTimeout(() => setToast(""), 2500);
    await finalizarPedidoTodo(pedido.id);
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col overflow-hidden font-sans">
      
      {/* Audio Escondido */}
      <audio ref={audioRef} src="https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=service-bell-ring-14610.mp3" preload="auto" />

      {toast && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[10000] bg-emerald-500 text-white px-8 py-4 rounded-full shadow-[0_10px_40px_rgba(16,185,129,0.3)] font-black text-lg animate-in slide-in-from-top-4 duration-300">
          {toast}
        </div>
      )}

      {/* HEADER DO KDS */}
      <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shadow-sm z-50">
         <div className="flex items-center gap-6">
            <button onClick={() => router.push("/dashboard")} className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors active:scale-95">
               <ArrowLeft size={24} />
            </button>
            
            <div className="w-12 h-12 rounded-2xl bg-orange-500/20 flex items-center justify-center border border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.15)]">
               <ChefHat size={28} className="text-orange-500" />
            </div>

            <div>
               <h1 className="text-2xl font-black text-white tracking-tight">KDS Produção</h1>
               <p className="text-sm font-bold text-slate-500 flex items-center gap-2 mt-0.5">
                 {unidadeInfo.nome} <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Sync ON
               </p>
            </div>
         </div>

         <div className="flex items-center gap-4">
            <button 
              onClick={() => setSomAtivo(!somAtivo)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-colors ${
                somAtivo 
                  ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30" 
                  : "bg-red-500/20 text-red-500 border border-red-500/30"
              }`}
            >
               {somAtivo ? <Volume2 size={20} /> : <VolumeX size={20} />}
               {somAtivo ? "Som On" : "Som Off"}
            </button>
            <button 
               onClick={() => carregar(false)} 
               disabled={loading}
               className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-colors shadow-md active:scale-95 disabled:opacity-50"
            >
               {loading ? "Sincronizando..." : "Forçar Sync"}
            </button>
         </div>
      </div>

      {/* ÁREA DOS TICKETS */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 hide-scrollbar">
         {pedidos.length === 0 && !loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600">
               <LayoutGrid size={100} className="mb-6 opacity-20" />
               <h2 className="text-4xl font-black text-slate-500 tracking-tight">Cozinha Limpa</h2>
               <p className="text-xl font-bold mt-3 text-slate-600">Nenhum pedido na fila de preparo.</p>
            </div>
         ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-6 items-start pb-24">
               {pedidos.map(pedido => {
                  const minutos = diffMinutos(pedido.created_at);
                  const isAtrasado = minutos >= SLA_MINUTOS; 
                  
                  const pct = Math.min(100, Math.max(0, (minutos / SLA_MINUTOS) * 100));
                  let corSLA = "bg-emerald-500";
                  let corSlaGlow = "shadow-[0_0_15px_rgba(16,185,129,0.5)]";
                  if (pct > 50 && pct < 80) { corSLA = "bg-amber-500"; corSlaGlow = "shadow-[0_0_15px_rgba(245,158,11,0.5)]"; }
                  if (pct >= 80) { corSLA = "bg-red-500"; corSlaGlow = "shadow-[0_0_15px_rgba(239,68,68,0.6)]"; }

                  const todosProntos = pedido.venda_itens.length > 0 && pedido.venda_itens.every(i => i.status_preparo === "pronto");

                  return (
                     <div key={pedido.id} className={`flex flex-col bg-slate-900 rounded-[28px] border-2 overflow-hidden shadow-xl transition-all ${
                        isAtrasado ? "border-red-500/50 shadow-[0_10px_40px_rgba(239,68,68,0.15)]" : "border-slate-800"
                     }`}>
                        
                        {/* Barra SLA (Progresso) */}
                        <div className="w-full h-2.5 bg-slate-800">
                           <div className={`h-full ${corSLA} ${corSlaGlow} transition-all duration-1000 ${isAtrasado ? 'animate-pulse' : ''}`} style={{ width: `${pct}%` }}></div>
                        </div>

                        {/* Cabeçalho Ticket */}
                        <div className={`p-5 flex items-center justify-between border-b ${isAtrasado ? 'bg-red-500/10 border-red-500/20' : 'bg-slate-900 border-slate-800'}`}>
                           <div>
                              <p className={`text-xl font-black tracking-tight ${isAtrasado ? 'text-red-400' : 'text-white'}`}>
                                 #{pedido.id.slice(0, 4).toUpperCase()}
                              </p>
                              <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest">
                                 {pedido.cliente ? `👤 ${pedido.cliente}` : "BALCÃO"}
                              </p>
                           </div>
                           <div className={`px-4 py-2 rounded-xl flex flex-col items-end border ${
                              isAtrasado ? 'bg-red-500/20 border-red-500/30' : 'bg-slate-800/50 border-slate-700'
                           }`}>
                              <p className={`text-2xl font-black flex items-center gap-2 ${isAtrasado ? 'text-red-500 animate-pulse' : 'text-slate-300'}`}>
                                 <Clock size={20} /> {minutos}m
                              </p>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{horaStr(pedido.created_at)}</p>
                           </div>
                        </div>

                        {/* Corpo dos Itens */}
                        <div className="p-4 flex flex-col gap-3">
                           {pedido.venda_itens.map(item => {
                              const st = item.status_preparo || "pendente";
                              
                              // Configs Visuais por Status
                              let stBg = "bg-slate-800";
                              let stBorder = "border-slate-700";
                              let stText = "text-slate-300";
                              let stIcon = <div className="w-6 h-6 rounded-full border-4 border-slate-600" />;
                              
                              if (st === "preparando") {
                                 stBg = "bg-orange-500/20";
                                 stBorder = "border-orange-500/50";
                                 stText = "text-orange-400";
                                 stIcon = <Flame size={24} className="text-orange-500 animate-pulse" />;
                              } else if (st === "pronto") {
                                 stBg = "bg-emerald-500/20";
                                 stBorder = "border-emerald-500/50";
                                 stText = "text-emerald-400";
                                 stIcon = <CheckCircle size={24} className="text-emerald-500" />;
                              }

                              return (
                                 <button
                                    key={item.id}
                                    onClick={() => handleClickStatus(item)}
                                    className={`w-full p-5 rounded-[20px] border-2 flex items-center gap-4 transition-all active:scale-[0.98] text-left ${stBg} ${stBorder}`}
                                 >
                                    <div className="flex-shrink-0">{stIcon}</div>
                                    <div className={`flex-1 text-lg font-bold leading-tight ${stText}`}>
                                       <span className="font-black bg-black/30 px-2 py-1 rounded-lg text-sm mr-2">{item.quantidade}x</span>
                                       {item.nome}
                                    </div>
                                 </button>
                              )
                           })}

                           {/* Observação */}
                           {pedido.observacao && (
                              <div className="mt-2 p-4 bg-amber-500/10 border-2 border-amber-500/30 rounded-[20px]">
                                 <p className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-2 mb-2">
                                    <TriangleAlert size={16} /> Observação do Cliente
                                 </p>
                                 <p className="text-amber-100 font-bold text-sm leading-snug">{pedido.observacao}</p>
                              </div>
                           )}
                        </div>

                        {/* Botão de Finalizar */}
                        <div className="p-4 pt-0 mt-auto">
                           <button
                              onClick={() => handleFinalizarPedido(pedido)}
                              className={`w-full py-5 rounded-[20px] font-black text-lg uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${
                                 todosProntos 
                                   ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_0_30px_rgba(16,185,129,0.4)] animate-pulse" 
                                   : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                              }`}
                           >
                              <Check size={24} /> Entregar Pedido
                           </button>
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
