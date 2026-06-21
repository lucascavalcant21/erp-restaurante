"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Clock, CheckCircle, ChefHat, Check, Flame, LayoutGrid, Volume2, VolumeX } from "lucide-react";
import { PageBody, Btn, Toast } from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchPedidosAtivos, atualizarStatusItem, finalizarPedidoTodo } from "../../../lib/kds";

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
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [agora, setAgora] = useState(Date.now());
  const [somAtivo, setSomAtivo] = useState(true);

  const audioRef = useRef(null);
  const lastPedidoDate = useRef(null);

  // 1. Carrega dados
  const carregar = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    const { data } = await fetchPedidosAtivos(unidadeAtiva);
    
    if (data && data.length > 0) {
      // Pega o pedido mais recente
      const maisRecente = new Date(Math.max(...data.map(p => new Date(p.created_at))));
      
      // Se tivermos um novo pedido recém chegado (não é a montagem inicial)
      if (lastPedidoDate.current && maisRecente > lastPedidoDate.current) {
        if (somAtivo && audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(e => console.log("Áudio bloqueado pelo navegador", e));
        }
      }
      lastPedidoDate.current = maisRecente;
    }

    setPedidos(data || []);
    if (!isSilent) setLoading(false);
  }, [unidadeAtiva, somAtivo]);

  useEffect(() => {
    carregar();
    // Auto-refresh a cada 10 segundos para ver novos pedidos
    const intervalo = setInterval(() => carregar(true), 10000);
    // Atualiza timers a cada 15 segundos para mover as barras
    const tick = setInterval(() => setAgora(Date.now()), 15000);
    return () => { clearInterval(intervalo); clearInterval(tick); };
  }, [carregar]);

  // 2. Ações
  async function handleClickStatus(item) {
    let novoStatus = "pendente";
    if (item.status_preparo === "pendente" || !item.status_preparo) novoStatus = "preparando";
    else if (item.status_preparo === "preparando") novoStatus = "pronto";
    else if (item.status_preparo === "pronto") novoStatus = "pendente"; // Volta para pendente se tocou sem querer

    // Atualiza local imediatamente (Otimista)
    setPedidos(prev => prev.map(ped => ({
      ...ped,
      venda_itens: ped.venda_itens.map(i => i.id === item.id ? { ...i, status_preparo: novoStatus } : i)
    })));

    // Atualiza DB
    await atualizarStatusItem(item.id, novoStatus);
  }

  async function handleFinalizarPedido(pedido) {
    setPedidos(prev => prev.filter(p => p.id !== pedido.id));
    setToast(`Pedido #${pedido.id.slice(0, 4)} finalizado com sucesso!`);
    setTimeout(() => setToast(""), 3000);
    await finalizarPedidoTodo(pedido.id);
  }

  return (
    <div className="min-h-screen" style={{ background: "#020617" }}>
      {/* Audio Element Hidden */}
      <audio ref={audioRef} src="https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=service-bell-ring-14610.mp3" preload="auto" />

      {/* Header específico para KDS */}
      <div style={{
        padding: "16px 24px", background: "#0F172A", borderBottom: "1px solid #1E293B",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        position: "sticky", top: 0, zIndex: 50
      }}>
        <div className="flex items-center gap-4">
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(249,115,22,0.15)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 15px rgba(249,115,22,0.1)" }}>
            <ChefHat size={22} color="#F97316" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight" style={{ color: "#F1F5F9" }}>Painel KDS — Cozinha</h1>
            <p className="text-xs font-bold" style={{ color: "#94A3B8" }}>{unidadeInfo.nome} · Auto-sync ativo</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSomAtivo(!somAtivo)}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
            style={{ background: somAtivo ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: somAtivo ? "#10B981" : "#EF4444" }}
            title={somAtivo ? "Silenciar" : "Ativar Som"}
          >
            {somAtivo ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <Btn variant="primary" onClick={() => carregar(false)} disabled={loading}>
            {loading ? "Sync..." : "Atualizar"}
          </Btn>
        </div>
      </div>

      <PageBody>
        {toast && <Toast show>{toast}</Toast>}

        {pedidos.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-24" style={{ color: "#475569" }}>
            <LayoutGrid size={72} style={{ opacity: 0.2, marginBottom: 20 }} />
            <h2 className="text-2xl font-black tracking-tight" style={{ color: "#94A3B8" }}>Nenhum pedido na fila</h2>
            <p className="text-sm font-semibold mt-2">A cozinha está limpa! Os pedidos aparecerão aqui com notificação sonora.</p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 20, alignItems: "start"
          }}>
            {pedidos.map(pedido => {
              const minutos = diffMinutos(pedido.created_at);
              const isAtrasado = minutos >= SLA_MINUTOS; 
              
              // Cálculo para a barra de progresso do SLA
              const pct = Math.min(100, Math.max(0, (minutos / SLA_MINUTOS) * 100));
              let corBarra = "#10B981"; // Verde (até 50%)
              if (pct > 50 && pct < 80) corBarra = "#F59E0B"; // Amarelo (50% a 80%)
              if (pct >= 80) corBarra = "#EF4444"; // Vermelho (perto do limite)

              return (
                <div key={pedido.id} className="relative group" style={{
                  background: isAtrasado ? "rgba(239,68,68,0.05)" : "#0F172A",
                  border: `2px solid ${isAtrasado ? "#EF4444" : "#1E293B"}`,
                  borderRadius: 20, overflow: "hidden",
                  display: "flex", flexDirection: "column",
                  boxShadow: isAtrasado ? "0 0 20px rgba(239,68,68,0.15)" : "0 4px 20px rgba(0,0,0,0.2)"
                }}>
                  {/* Barra de Progresso SLA */}
                  <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.05)" }}>
                     <div style={{
                       width: `${pct}%`, height: "100%", background: corBarra,
                       transition: "width 1s linear",
                       boxShadow: `0 0 10px ${corBarra}`
                     }} className={isAtrasado ? "animate-pulse" : ""} />
                  </div>

                  {/* Cabeçalho do Ticket */}
                  <div style={{
                    padding: "16px",
                    background: isAtrasado ? "#EF4444" : "#1E293B",
                    color: "#F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <div>
                      <p className="text-[15px] font-black tracking-widest">TICKET #{pedido.id.slice(0, 4).toUpperCase()}</p>
                      {pedido.cliente && <p className="text-[12px] font-bold opacity-90 mt-1 uppercase">👤 {pedido.cliente}</p>}
                    </div>
                    <div className="text-right bg-black/20 px-3 py-1.5 rounded-lg border border-white/10">
                      <p className="text-[15px] font-black flex items-center gap-1.5 justify-end">
                        <Clock size={16} className={isAtrasado ? "animate-bounce" : ""} /> {minutos} min
                      </p>
                      <p className="text-[10px] font-bold opacity-70 mt-0.5 tracking-wider">{horaStr(pedido.created_at)}</p>
                    </div>
                  </div>

                  {/* Itens */}
                  <div style={{ padding: "20px 16px 12px 16px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                    {pedido.venda_itens.map(item => {
                      const status = item.status_preparo || "pendente";
                      let bg = "#1E293B"; let border = "#334155"; let color = "#F1F5F9"; let icon = null;

                      if (status === "preparando") {
                        bg = "rgba(249,115,22,0.15)"; border = "#F97316"; color = "#F97316";
                        icon = <Flame size={18} />;
                      } else if (status === "pronto") {
                        bg = "rgba(16,185,129,0.15)"; border = "#10B981"; color = "#10B981";
                        icon = <CheckCircle size={18} />;
                      } else {
                        icon = <span style={{ width: 18, height: 18, borderRadius: "50%", border: "2.5px solid #64748B" }}></span>;
                      }

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleClickStatus(item)}
                          style={{
                            width: "100%", padding: "14px", borderRadius: 14,
                            background: bg, border: `1.5px solid ${border}`, color: color,
                            display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
                            textAlign: "left", transition: "all 200ms ease",
                            transform: "scale(1)",
                          }}
                          onMouseDown={e => e.currentTarget.style.transform = "scale(0.98)"}
                          onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
                          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                        >
                          <div className="flex-shrink-0">{icon}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[15px] font-bold truncate">
                              <span className="font-black mr-2 bg-white/10 px-2 py-0.5 rounded text-[13px]">{item.quantidade}x</span>
                              {item.nome}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                    {pedido.observacao && (
                      <div style={{ marginTop: 8, padding: 14, background: "rgba(234,179,8,0.1)", borderRadius: 12, border: "1.5px dashed rgba(234,179,8,0.4)" }}>
                        <p style={{ color: "#EAB308", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "1px", display: "flex", alignItems: "center", gap: 6 }}>
                          <span>⚠️</span> Observação
                        </p>
                        <p style={{ color: "#F1F5F9", fontSize: 14, fontWeight: 600, marginTop: 6 }}>{pedido.observacao}</p>
                      </div>
                    )}
                  </div>

                  {/* Footer / Ações */}
                  <div style={{ padding: 16, borderTop: "1px solid #1E293B", marginTop: "auto" }}>
                    <button
                      onClick={() => handleFinalizarPedido(pedido)}
                      style={{
                        width: "100%", height: 52, borderRadius: 14,
                        background: "#10B981", color: "#FFF", fontSize: 15, fontWeight: 900, textTransform: "uppercase", letterSpacing: "1px",
                        border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        boxShadow: "0 4px 15px rgba(16,185,129,0.3)", transition: "transform 100ms"
                      }}
                      onMouseDown={e => e.currentTarget.style.transform = "scale(0.98)"}
                      onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
                      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                    >
                      <Check size={20} /> Entregar Pedido
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageBody>
    </div>
  );
}
