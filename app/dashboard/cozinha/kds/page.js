"use client";
// tempo real: recarrega sozinho a cada 15s e quando o banco muda

import { useState, useEffect, useCallback, useRef } from "react";
import { useTempoReal } from "../../../lib/realtime";
import { Clock, CheckCircle, Check, Flame, LayoutGrid, Volume2, VolumeX, ArrowLeft, TriangleAlert, Printer, RefreshCw, User } from "lucide-react";
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
  const { unidadeAtiva, unidadeInfo, abrirMenu } = useERP();
  const router = useRouter();
  
  const [pedidos, setPedidos] = useState([]);
  // Pedidos esperando em cada setor: aparece nas abas (ex.: "Bar 1").
  const [contagem, setContagem] = useState({ cozinha: 0, bar: 0, todos: 0 });
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [agora, setAgora] = useState(Date.now());
  const [somAtivo, setSomAtivo] = useState(true);
  const [erro, setErro] = useState("");
  // Setor da tela (cozinha, bar ou tudo); lembrado neste aparelho.
  const [setor, setSetor] = useState("cozinha");
  useEffect(() => {
    // O card do Bar abre com ?setor=bar; sem isso, vale o último setor deste aparelho.
    try {
      const daUrl = new URLSearchParams(window.location.search).get("setor");
      const s = daUrl || localStorage.getItem("kds-setor");
      if (["cozinha", "bar", "todos"].includes(s)) setSetor(s);
    } catch { /* segue */ }
  }, []);
  const [painelImpressao, setPainelImpressao] = useState(false);
  const impressao = useImpressaoKds({ unidadeId: unidadeAtiva, setor });
  const { processarFila } = impressao;
  const escolherSetor = (s) => {
    setSetor(s);
    try { localStorage.setItem("kds-setor", s); } catch { /* segue */ }
  };

  const audioRef = useRef(null);
  const lastPedidoDate = useRef(null);

  const carregar = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    const { data, contagem: c, error } = await fetchFilaKDS(unidadeAtiva, setor);
    setErro(error || "");
    if (!error) { if (c) setContagem(c); setAtualizadoEm(new Date()); }
    
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
        setor={setor}
        auto={impressao.cfg.auto}
        mudarAuto={impressao.mudarAuto}
        aviso={impressao.aviso}
        imprimirTeste={() => impressao.imprimir([{ id: "teste", origem: "Teste de impressão", identificacao: null, cliente: null, itens: (setor === "todos" ? ["cozinha", "bar"] : [setor]).map((s) => ({ id: `teste-${s}`, setor: s, nome: "Via de teste", quantidade: 1, observacao: "Se saiu, está tudo certo." })) }], { marcar: false })}
      />

      {/* CABEÇALHO (07/11/2026): compacto no celular e no tablet. Linha 1: voltar,
          título e ações em ícone; linha 2: setores com quantos pedidos esperam. */}
      <div className="bg-hf-surface border-b border-hf-border shadow-sm z-50 px-3 sm:px-5 pb-2.5" style={{ paddingTop: "calc(var(--erp-safe-top, 0px) + 0.5rem)" }}>
         <div className="flex items-center gap-2 lg:gap-4">
            <button onClick={() => abrirMenu()} aria-label="Voltar" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-hf-text-2 hover:bg-hf-elevated hover:text-hf-text active:scale-95">
               <ArrowLeft size={20} />
            </button>
            <div className="min-w-0 flex-1">
               <h1 className="truncate text-lg sm:text-xl font-black text-hf-text leading-tight"><span className="sm:hidden">Produção</span><span className="hidden sm:inline">Painel de produção</span></h1>
               <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-hf-muted">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${erro ? "bg-red-500" : "bg-emerald-500 animate-pulse"}`} />
                  <span className="truncate">{unidadeInfo.nome}{atualizadoEm ? ` · atualizado ${horaStr(atualizadoEm)}` : ""}</span>
               </p>
            </div>
            <div className="hidden lg:block"><AbasDeSetor setor={setor} escolher={escolherSetor} contagem={contagem} /></div>
            <button onClick={() => setSomAtivo(!somAtivo)} aria-label={somAtivo ? "Som ligado: tocar para desligar" : "Som desligado: tocar para ligar"} aria-pressed={somAtivo}
               className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${somAtivo ? "border-hf-border bg-hf-surface text-hf-text" : "border-hf-border bg-hf-elevated text-hf-muted"}`}>
               {somAtivo ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <button onClick={() => setPainelImpressao(true)} aria-label={impressao.cfg.auto ? "Impressão automática ligada" : "Impressão"}
               className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${impressao.cfg.auto ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700" : "border-hf-border bg-hf-surface text-hf-text"}`}>
               <Printer size={20} />
               {impressao.cfg.auto && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-500" />}
            </button>
            <button onClick={() => carregar(false)} disabled={loading} aria-label="Atualizar a fila"
               className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-hf-border bg-hf-surface text-hf-text active:scale-95 disabled:opacity-50">
               <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
            </button>
         </div>
         <div className="mt-2 lg:hidden"><AbasDeSetor setor={setor} escolher={escolherSetor} contagem={contagem} /></div>
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
               <LayoutGrid size={72} className="mb-4 opacity-20" />
               <h2 className="text-2xl sm:text-3xl font-black text-fg tracking-tight">{setor === "bar" ? "Bar sem pedidos" : setor === "todos" ? "Nenhum pedido na fila" : "Cozinha sem pedidos"}</h2>
               {setor !== "todos" && contagem.todos > 0 ? (
                  <button onClick={() => escolherSetor(setor === "bar" ? "cozinha" : "bar")} className="mt-5 min-h-[52px] rounded-2xl bg-amber-100 border-2 border-amber-300 px-5 text-base font-black text-amber-900 active:scale-95">
                     {setor === "bar" ? `${contagem.cozinha} na Cozinha` : `${contagem.bar} no Bar`}: toque para ver
                  </button>
               ) : (
                  <p className="text-sm font-bold mt-3 text-fg max-w-md">Aqui chegam os pedidos do salão, das mesas pelo QR, do delivery e do iFood depois de aceitos.</p>
               )}
            </div>
         ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3 sm:gap-4 lg:gap-6 items-start pb-24">
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

                        {/* Cabeçalho do pedido: mesa em destaque; origem, número e garçom embaixo */}
                        <div className={`p-3 sm:p-4 flex items-start justify-between gap-2 border-b ${isAtrasado ? 'bg-red-50 border-red-200' : 'bg-hf-surface border-hf-border'}`}>
                           <div className="min-w-0 flex-1">
                              <p className="text-xl sm:text-2xl font-black tracking-tight text-hf-text truncate">
                                 {pedido.identificacao || pedido.cliente || `#${pedido.id.slice(0, 4).toUpperCase()}`}
                              </p>
                              <p className="mt-0.5 text-xs font-bold text-hf-text-2 truncate">
                                 {pedido.origem} · #{pedido.id.slice(0, 4).toUpperCase()}{pedido.garcom ? ` · ${pedido.garcom}` : ""}
                              </p>
                              {pedido.cliente && pedido.identificacao && (
                                 <p className="text-sm font-bold text-fg mt-0.5 truncate">{pedido.cliente}</p>
                              )}
                           </div>
                           <div className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-right ${isAtrasado ? 'bg-red-100 border-red-300 text-red-800' : 'bg-hf-elevated border-hf-border text-fg'}`}>
                              <p className={`flex items-center justify-end gap-1 text-lg sm:text-xl font-black ${isAtrasado ? 'animate-pulse' : ''}`}><Clock size={16} /> {minutos}m</p>
                              <p className="text-[11px] font-bold">{horaStr(pedido.created_at)}</p>
                           </div>
                           <button
                              onClick={() => impressao.imprimir([pedido])}
                              aria-label={`Imprimir via: ${pedido.identificacao || pedido.id.slice(0, 4).toUpperCase()}`}
                              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-hf-elevated border border-hf-border text-fg hover:text-hf-text active:scale-95"
                           >
                              <Printer size={18} />
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
                                       <span className="font-black bg-hf-text/10 px-2 py-1 rounded-lg text-sm mr-2">{item.quantidade}x</span>
                                       {item.nome}
                                       {setor === "todos" && <span className="ml-2 text-3xs font-black uppercase tracking-widest text-fg">{item.setor}</span>}
                                       {item.pessoa && (
                                          <span className="mt-1 flex items-center gap-1 text-sm font-bold text-hf-text-2"><User size={14} /> {item.pessoa}</span>
                                       )}
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
                              className={`w-full py-4 sm:py-5 rounded-[20px] font-black text-base sm:text-lg uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${
                                 todosProntos 
                                   ? "bg-emerald-500 hover:bg-accent text-accent-fg shadow-[0_0_30px_rgba(16,185,129,0.4)] animate-pulse" 
                                   : "bg-hf-elevated text-fg hover:bg-hf-border"
                              }`}
                           >
                              <Check size={24} /> Entregar pedido
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

// Setores com quantos pedidos esperam. Aba de outro setor com pedido fica em
// destaque: o pedido só de bebida não "some" para quem está na Cozinha.
function AbasDeSetor({ setor, escolher, contagem }) {
  return (
    <div className="flex rounded-2xl border border-hf-border bg-hf-elevated p-1" role="group" aria-label="Setor">
      {[["cozinha", "Cozinha"], ["bar", "Bar"], ["todos", "Tudo"]].map(([id, rotulo]) => {
        const n = contagem?.[id] || 0;
        const ativo = setor === id;
        const chama = !ativo && id !== "todos" && n > 0;
        return (
          <button key={id} onClick={() => escolher(id)} aria-pressed={ativo}
            className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-3 lg:px-4 text-sm font-bold transition-colors ${ativo ? "bg-hf-menu text-white" : chama ? "text-amber-900" : "text-hf-text-2 hover:text-hf-text"}`}>
            {rotulo}
            {n > 0 && (
              <span className={`min-w-[22px] rounded-full px-1.5 text-xs font-black leading-[22px] ${ativo ? "bg-white/25 text-white" : chama ? "bg-amber-400 text-amber-950 animate-pulse" : "bg-hf-border text-hf-text"}`} aria-label={`${n} pedido(s)`}>{n}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
