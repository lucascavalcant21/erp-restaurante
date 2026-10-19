"use client";
// tempo real: recarrega sozinho a cada 15s e quando o banco muda

import { useState, useEffect, useCallback, useRef } from "react";
import { useTempoReal } from "../../../lib/realtime";
import { Clock, CheckCircle, ChefHat, Check, Flame, LayoutGrid, Volume2, VolumeX, ArrowLeft, TriangleAlert, Printer } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchFilaKDS, atualizarItemKDS, entregarTicketKDS } from "../../../lib/kds";
import { proximoStatusKDS } from "../../../lib/kds-fila.mjs";
import { useImpressaoKds, PainelImpressaoKds } from "../../../components/kds/ImpressaoKds";
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
  const [erro, setErro] = useState("");
  // Setor da tela (cozinha, bar ou tudo); lembrado neste aparelho.
  const [setor, setSetor] = useState("cozinha");
  useEffect(() => {
    try { const s = localStorage.getItem("kds-setor"); if (["cozinha", "bar", "todos"].includes(s)) setSetor(s); } catch { /* segue */ }
  }, []);
  const [painelImpressao, setPainelImpressao] = useState(false);
  const impressao = useImpressaoKds({ unidadeId: unidadeAtiva, setor, unidadeNome: unidadeInfo?.nome || "" });
  const { processarFila } = impressao;
  const escolherSetor = (s) => {
    setSetor(s);
    try { localStorage.setItem("kds-setor", s); } catch { /* segue */ }
  };

  const audioRef = useRef(null);
  const lastPedidoDate = useRef(null);

  const carregar = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    const { data, error } = await fetchFilaKDS(unidadeAtiva, setor);
    setErro(error || "");
    
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
    if (!error) processarFila(data || []);
  }, [unidadeAtiva, somAtivo, setor, processarFila]);

  useEffect(() => {
    carregar();
    // Auto-refresh (banco) a cada 10s
    const intervalo = setInterval(() => carregar(true), 10000);
    // Atualiza timers visuais (agora) a cada 15s
    const tick = setInterval(() => setAgora(Date.now()), 15000);
    return () => { clearInterval(intervalo); clearInterval(tick); };
  }, [carregar]);
  useTempoReal(null, () => carregar(true)); // pedido novo aparece na hora

  async function handleClickStatus(item) {
    const novoStatus = proximoStatusKDS(item.status);

    // Otimista
    setPedidos(prev => prev.map(ped => ({
      ...ped,
      itens: ped.itens.map(i => i.id === item.id ? { ...i, status: novoStatus } : i)
    })));

    const { error } = await atualizarItemKDS(item.id, novoStatus);
    if (error) {
      setToast("Não foi possível salvar. Tente de novo.");
      setTimeout(() => setToast(""), 2500);
      carregar(true);
    }
  }

  async function handleFinalizarPedido(pedido) {
    setPedidos(prev => prev.filter(p => p.id !== pedido.id));
    const { error } = await entregarTicketKDS(pedido, pedido.itens.map(i => i.id));
    setToast(error ? "Não foi possível entregar. Tente de novo." : "Pedido entregue!");
    setTimeout(() => setToast(""), 2500);
    if (error) carregar(true);
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-hf-bg flex flex-col overflow-hidden font-sans">
      
      {/* Audio Escondido */}
      <audio ref={audioRef} src="https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=service-bell-ring-14610.mp3" preload="auto" />

      {toast && (
        <div className="absolute left-1/2 -translate-x-1/2 z-[10000] max-w-[calc(100%-2rem)] bg-emerald-500 text-white px-4 sm:px-8 py-3 sm:py-4 rounded-full shadow-[0_10px_40px_rgba(16,185,129,0.3)] font-black text-sm sm:text-lg text-center animate-in slide-in-from-top-4 duration-300" style={{ top: "calc(var(--erp-safe-top, 0px) + 0.75rem)" }}>
          {toast}
        </div>
      )}

      <PainelImpressaoKds
        aberto={painelImpressao}
        fechar={() => setPainelImpressao(false)}
        cfg={impressao.cfg}
        mudar={impressao.mudar}
        aviso={impressao.aviso}
        imprimirTeste={() => impressao.imprimir([{ id: "teste", origem: "Teste de impressão", identificacao: null, cliente: null, itens: [{ id: "teste-1", nome: "Via de teste", quantidade: 1, observacao: "Se saiu, está tudo certo." }] }], { marcar: false })}
      />

      {/* HEADER DO KDS */}
      <div className="px-3 sm:px-6 pb-3 sm:pb-4 bg-hf-surface border-b border-hf-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm z-50" style={{ paddingTop: "calc(var(--erp-safe-top, 0px) + 0.75rem)" }}>
         <div className="flex items-center gap-2 sm:gap-6 min-w-0">
            <button onClick={() => router.push("/dashboard")} className="p-2.5 sm:p-3 shrink-0 bg-hf-elevated hover:bg-hf-border text-fg hover:text-hf-text rounded-xl transition-colors active:scale-95">
               <ArrowLeft size={24} />
            </button>
            
            <div className="hidden sm:flex w-12 h-12 shrink-0 rounded-2xl bg-emerald-500/20 items-center justify-center border border-emerald-500/30 shadow-[0_0_20px_rgba(249,115,22,0.15)]">
               <ChefHat size={28} className="text-slate-900" />
            </div>

            <div>
               <h1 className="text-xl sm:text-2xl font-black text-hf-text tracking-tight truncate">KDS Produção</h1>
               <p className="text-xs sm:text-sm font-bold text-fg flex items-center gap-2 mt-0.5 truncate">
                 {unidadeInfo.nome} <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Sync ON
               </p>
            </div>
         </div>

         <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-4">
            <div className="col-span-2 sm:col-span-1 flex rounded-xl border border-hf-border bg-hf-elevated p-1" role="group" aria-label="Setor">
               {[["cozinha", "Cozinha"], ["bar", "Bar"], ["todos", "Tudo"]].map(([id, rotulo]) => (
                  <button
                     key={id}
                     onClick={() => escolherSetor(id)}
                     aria-pressed={setor === id}
                     className={`flex-1 px-3 sm:px-4 py-2 rounded-lg font-bold text-xs sm:text-sm uppercase tracking-wide transition-colors ${setor === id ? "bg-emerald-500 text-white" : "text-fg hover:text-hf-text"}`}
                  >
                     {rotulo}
                  </button>
               ))}
            </div>
            <button 
              onClick={() => setSomAtivo(!somAtivo)}
              className={`flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-widest transition-colors ${
                somAtivo 
                  ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30" 
                  : "bg-emerald-500/20 text-slate-900 border border-emerald-500/30"
              }`}
            >
               {somAtivo ? <Volume2 size={20} /> : <VolumeX size={20} />}
               {somAtivo ? "Som On" : "Som Off"}
            </button>
            <button
               onClick={() => setPainelImpressao(true)}
               className={`flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-widest transition-colors border ${impressao.cfg.auto ? "bg-emerald-500/20 text-emerald-700 border-emerald-500/30" : "bg-hf-elevated text-fg border-hf-border"}`}
            >
               <Printer size={20} /> {impressao.cfg.auto ? "Impressão on" : "Impressão"}
            </button>
            <button 
               onClick={() => carregar(false)} 
               disabled={loading}
               className="col-span-2 sm:col-span-1 px-3 sm:px-6 py-2.5 sm:py-3 bg-hf-elevated hover:bg-hf-border text-hf-text font-bold text-xs sm:text-sm uppercase tracking-wide sm:tracking-widest rounded-xl transition-colors shadow-md active:scale-95 disabled:opacity-50"
            >
               {loading ? "Sincronizando..." : "Forçar Sync"}
            </button>
         </div>
      </div>

      {/* ÁREA DOS TICKETS */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 hide-scrollbar">
         {impressao.cfg.auto && impressao.aviso?.tipo === "erro" && (
            <button onClick={() => setPainelImpressao(true)} className="mb-4 w-full text-left rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 flex items-center gap-2">
               <Printer size={16} /> A via não saiu: {impressao.aviso.texto} Toque para ver a impressão.
            </button>
         )}
         {erro && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
               Não foi possível ler a fila agora ({erro}). A tela tenta de novo sozinha.
            </div>
         )}
         {pedidos.length === 0 && !loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-900 px-4 text-center">
               <LayoutGrid size={100} className="mb-6 opacity-20" />
               <h2 className="text-2xl sm:text-4xl font-black text-fg tracking-tight">Cozinha Limpa</h2>
               <p className="text-base sm:text-xl font-bold mt-3 text-slate-900">Nenhum pedido na fila de preparo.</p>
               <p className="text-sm font-bold mt-2 text-fg">Aqui chegam os pedidos do salão, das mesas pelo QR, do delivery e do iFood depois de aceitos.</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3 sm:gap-6 items-start pb-24">
               {pedidos.map(pedido => {
                  const minutos = diffMinutos(pedido.created_at);
                  const isAtrasado = minutos >= SLA_MINUTOS; 
                  
                  const pct = Math.min(100, Math.max(0, (minutos / SLA_MINUTOS) * 100));
                  let corSLA = "bg-emerald-500";
                  let corSlaGlow = "shadow-[0_0_15px_rgba(16,185,129,0.5)]";
                  if (pct > 50 && pct < 80) { corSLA = "bg-emerald-500"; corSlaGlow = "shadow-[0_0_15px_rgba(245,158,11,0.5)]"; }
                  if (pct >= 80) { corSLA = "bg-emerald-500"; corSlaGlow = "shadow-[0_0_15px_rgba(239,68,68,0.6)]"; }

                  const todosProntos = pedido.itens.length > 0 && pedido.itens.every(i => i.status === "pronto");

                  return (
                     <div key={pedido.id} className={`flex flex-col bg-hf-surface rounded-[28px] border-2 overflow-hidden shadow-xl transition-all ${
                        isAtrasado ? "border-emerald-500/50 shadow-[0_10px_40px_rgba(239,68,68,0.15)]" : "border-hf-border"
                     }`}>
                        
                        {/* Barra SLA (Progresso) */}
                        <div className="w-full h-2.5 bg-hf-elevated">
                           <div className={`h-full ${corSLA} ${corSlaGlow} transition-all duration-1000 ${isAtrasado ? 'animate-pulse' : ''}`} style={{ width: `${pct}%` }}></div>
                        </div>

                        {/* Cabeçalho Ticket */}
                         <div className={`p-3 sm:p-5 flex items-center justify-between gap-3 border-b ${isAtrasado ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-hf-surface border-hf-border'}`}>
                           <div className="min-w-0 flex-1">
                              <p className={`text-xl font-black tracking-tight ${isAtrasado ? 'text-fg' : 'text-hf-text'}`}>
                                 #{pedido.id.slice(0, 4).toUpperCase()}
                              </p>
                              <p className="text-xs font-black text-emerald-700 mt-1 uppercase tracking-widest">
                                 {pedido.origem}{pedido.identificacao ? ` · ${pedido.identificacao}` : ""}
                              </p>
                              {pedido.cliente && (
                                 <p className="text-sm font-bold text-fg mt-0.5 truncate max-w-[14rem]">{pedido.cliente}</p>
                              )}
                           </div>
                           <div className={`px-4 py-2 rounded-xl flex flex-col items-end border ${
                              isAtrasado ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-hf-elevated border-hf-border'
                           }`}>
                              <p className={`text-2xl font-black flex items-center gap-2 ${isAtrasado ? 'text-slate-900 animate-pulse' : 'text-fg'}`}>
                                 <Clock size={20} /> {minutos}m
                              </p>
                              <p className="text-3xs font-bold text-fg uppercase tracking-widest mt-0.5">{horaStr(pedido.created_at)}</p>
                           </div>
                           <button
                              onClick={() => impressao.imprimir([pedido])}
                              aria-label={`Imprimir via do pedido ${pedido.id.slice(0, 4).toUpperCase()}`}
                              className="p-3 rounded-xl bg-hf-elevated border border-hf-border text-fg hover:text-hf-text active:scale-95"
                           >
                              <Printer size={20} />
                           </button>
                        </div>

                        {/* Corpo dos Itens */}
                        <div className="p-3 sm:p-4 flex flex-col gap-3">
                           {pedido.itens.map(item => {
                              const st = item.status || "pendente";
                              
                              // Configs Visuais por Status
                              let stBg = "bg-hf-elevated";
                              let stBorder = "border-hf-border";
                              let stText = "text-fg";
                              let stIcon = <div className="w-6 h-6 rounded-full border-4 border-hf-border-strong" />;
                              
                              if (st === "preparando") {
                                 stBg = "bg-emerald-500/20";
                                 stBorder = "border-emerald-500/50";
                                 stText = "text-fg";
                                 stIcon = <Flame size={24} className="text-slate-900 animate-pulse" />;
                              } else if (st === "pronto") {
                                 stBg = "bg-emerald-500/20";
                                 stBorder = "border-emerald-500/50";
                                 stText = "text-emerald-700";
                                 stIcon = <CheckCircle size={24} className="text-emerald-500" />;
                              }

                              return (
                                 <button
                                    key={item.id}
                                    onClick={() => handleClickStatus(item)}
                                    className={`w-full p-3 sm:p-5 rounded-[20px] border-2 flex items-center gap-3 sm:gap-4 transition-all active:scale-[0.98] text-left ${stBg} ${stBorder}`}
                                 >
                                    <div className="flex-shrink-0">{stIcon}</div>
                                    <div className={`flex-1 text-base sm:text-lg font-bold leading-tight ${stText}`}>
                                       <span className="font-black bg-black/30 px-2 py-1 rounded-lg text-sm mr-2">{item.quantidade}x</span>
                                       {item.nome}
                                       {setor === "todos" && <span className="ml-2 text-3xs font-black uppercase tracking-widest text-fg">{item.setor}</span>}
                                       {item.observacao && (
                                          <span className="mt-1 flex items-center gap-1 text-sm font-bold text-amber-700"><TriangleAlert size={14} /> {item.observacao}</span>
                                       )}
                                    </div>
                                 </button>
                              )
                           })}

                           {/* Observação */}
                           {pedido.observacao && (
                              <div className="mt-2 p-4 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-[20px]">
                                 <p className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-2">
                                    <TriangleAlert size={16} /> Observação do Cliente
                                 </p>
                                 <p className="text-amber-700 font-bold text-sm leading-snug">{pedido.observacao}</p>
                              </div>
                           )}
                        </div>

                        {/* Botão de Finalizar */}
                        <div className="p-4 pt-0 mt-auto">
                           <button
                              onClick={() => handleFinalizarPedido(pedido)}
                              className={`w-full py-5 rounded-[20px] font-black text-lg uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${
                                 todosProntos 
                                   ? "bg-emerald-500 hover:bg-accent text-accent-fg shadow-[0_0_30px_rgba(16,185,129,0.4)] animate-pulse" 
                                   : "bg-hf-elevated text-fg hover:bg-hf-border"
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
