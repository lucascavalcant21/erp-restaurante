"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { Maximize, MonitorPlay, Clock } from "lucide-react";

export default function PainelChamadaTV() {
  const { unidadeId } = useParams();
  const [pedidos, setPedidos] = useState([]);
  const [ultimoChamado, setUltimoChamado] = useState(null);
  const containerRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Carregar os pedidos iniciais
  const carregarPedidos = async () => {
    const { data } = await supabase.from("pedidos")
      .select("id, numero_pedido, cliente_nome, status, updated_at, tipo_pedido")
      .eq("unidade_id", unidadeId)
      .in("tipo_pedido", ["balcao", "ifood", "delivery", "cardapio"])
      .in("status", ["preparando", "preparando_delivery", "aberto", "pronto", "pago"])
      .order("updated_at", { ascending: false });
    
    setPedidos(data || []);
  };

  useEffect(() => {
    carregarPedidos();

    // Inscrever para atualizações em tempo real
    const channel = supabase
      .channel(`tv_chamada_${unidadeId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pedidos",
          filter: `unidade_id=eq.${unidadeId}`
        },
        (payload) => {
          const novo = payload.new;
          
          setPedidos(prev => {
            // Remove se não for mais um status ou tipo válido
            if (!["preparando", "preparando_delivery", "aberto", "pronto", "pago"].includes(novo.status) || !["balcao", "ifood", "delivery", "cardapio"].includes(novo.tipo_pedido)) {
               return prev.filter(p => p.id !== novo.id);
            }
            
            const existe = prev.find(p => p.id === novo.id);
            let lista = prev;
            if (existe) {
               lista = prev.map(p => p.id === novo.id ? novo : p);
            } else {
               lista = [novo, ...prev];
            }
            return lista.sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at));
          });

          // Se mudou para PRONTO, toca som e exibe na tela cheia
          if (novo.status === 'pronto') {
             tocarCampainha();
             setUltimoChamado(novo);
             setTimeout(() => setUltimoChamado(null), 8000); // Exibe por 8 segundos
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [unidadeId]);

  const tocarCampainha = () => {
     try {
        if (!audioCtxRef.current) {
           audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        if(ctx.state === 'suspended') ctx.resume();

        // Acorde Ding-Dong
        const tocarNota = (frequencia, tempoInicio, duracao) => {
           const osc = ctx.createOscillator();
           const gain = ctx.createGain();
           osc.type = 'sine';
           osc.frequency.setValueAtTime(frequencia, ctx.currentTime + tempoInicio);
           
           gain.gain.setValueAtTime(0, ctx.currentTime + tempoInicio);
           gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + tempoInicio + 0.05);
           gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + tempoInicio + duracao);
           
           osc.connect(gain);
           gain.connect(ctx.destination);
           osc.start(ctx.currentTime + tempoInicio);
           osc.stop(ctx.currentTime + tempoInicio + duracao);
        };

        tocarNota(659.25, 0, 1.5); // Mi
        tocarNota(523.25, 0.4, 2.0); // Do
     } catch(e) {}
  };

  const formatarNome = (pedido) => {
     if(pedido.cliente_nome) {
        return pedido.cliente_nome.split(" ")[0].toUpperCase();
     }
     return `#${pedido.numero_pedido || pedido.id.substring(0,4)}`;
  };

  const preparando = pedidos.filter(p => p.status !== 'pronto');
  const prontos = pedidos.filter(p => p.status === 'pronto');

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
       containerRef.current?.requestFullscreen?.();
    } else {
       document.exitFullscreen?.();
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-black text-white font-sans overflow-x-hidden overflow-y-auto md:overflow-hidden flex flex-col relative select-none">
       
       {/* Alerta de Tela Cheia (Quando alguém é chamado) */}
       {ultimoChamado && (
          <div className="absolute inset-0 z-50 bg-emerald-600 flex flex-col items-center justify-center animate-pulse-fast">
             <h1 className="text-[16vw] sm:text-[12vw] font-black tracking-tighter leading-none text-white drop-shadow-2xl text-center break-words max-w-full px-4">
                {formatarNome(ultimoChamado)}
             </h1>
             <p className="text-lg sm:text-[4vw] font-bold mt-4 bg-black/30 px-5 sm:px-12 py-3 sm:py-4 rounded-full uppercase tracking-widest text-center">
                Pronto para Retirar
             </p>
          </div>
       )}

       {/* HEADER */}
       <div className="min-h-20 sm:h-24 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center gap-3 px-4 sm:px-10 py-3 sm:py-0">
          <div className="flex items-center gap-4">
             <div className="w-11 h-11 sm:w-14 sm:h-14 bg-orange-500 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                <MonitorPlay size={28} className="text-white" />
             </div>
             <div>
                <h1 className="text-lg sm:text-2xl lg:text-3xl font-black tracking-tighter leading-tight">PAINEL DE SENHAS</h1>
             </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-6 shrink-0">
             <div className="text-right">
                <p className="text-sm sm:text-xl font-bold text-zinc-400">
                   {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </p>
             </div>
             <button onClick={toggleFullscreen} className="p-3 sm:p-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors">
                <Maximize size={24} className="text-zinc-400" />
             </button>
          </div>
       </div>

       {/* CORPO DO PAINEL */}
       <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800 overflow-y-auto md:overflow-hidden">
          
          {/* COLUNA: PREPARANDO */}
          <div className="flex flex-col bg-zinc-950">
             <div className="py-4 sm:py-6 px-4 sm:px-10 bg-amber-500 text-amber-950 text-center">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-widest flex items-center justify-center gap-3">
                   <Clock size={36} /> Preparando
                </h2>
             </div>
             
             <div className="p-4 sm:p-6 lg:p-10 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 content-start">
                {preparando.length === 0 ? (
                   <p className="sm:col-span-2 text-center text-zinc-600 text-xl sm:text-3xl font-bold my-10 sm:mt-20">Nenhum pedido na fila</p>
                ) : (
                   preparando.map(p => (
                      <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex items-center justify-center text-center shadow-lg min-w-0">
                         <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-amber-500 truncate w-full">
                            {formatarNome(p)}
                         </span>
                      </div>
                   ))
                )}
             </div>
          </div>

          {/* COLUNA: PRONTO */}
          <div className="flex flex-col bg-black">
             <div className="py-4 sm:py-6 px-4 sm:px-10 bg-emerald-500 text-emerald-950 text-center">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-widest">
                   Pronto - Retirar
                </h2>
             </div>
             
             <div className="p-4 sm:p-6 lg:p-10 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 content-start">
                {prontos.length === 0 ? (
                   <p className="sm:col-span-2 text-center text-zinc-700 text-xl sm:text-3xl font-bold my-10 sm:mt-20">Aguardando...</p>
                ) : (
                   prontos.map((p, index) => (
                      <div key={p.id} className={`border-2 rounded-2xl sm:rounded-3xl p-4 sm:p-8 flex items-center justify-center text-center shadow-2xl transition-all min-w-0 ${index === 0 ? 'bg-emerald-950/40 border-emerald-500 shadow-emerald-500/20' : 'bg-zinc-900 border-zinc-800'}`}>
                         <span className={`font-black truncate w-full ${index === 0 ? 'text-4xl sm:text-5xl lg:text-7xl text-emerald-400' : 'text-3xl sm:text-4xl lg:text-5xl text-emerald-600'}`}>
                            {formatarNome(p)}
                         </span>
                      </div>
                   ))
                )}
             </div>
          </div>

       </div>
    </div>
  );
}
