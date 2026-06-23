"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../context/ERPContext";
import { fetchColaboradores } from "../../lib/rh";
import { fetchPontoHoje, registrarBatida } from "../../lib/ponto";
import { Fingerprint, Search, Clock, CheckCircle2, AlertCircle, Lock, ArrowLeft, Maximize, X } from "lucide-react";

// ─── Modal de PIN ─────────────────────────────────────────────────────────────
function ModalPIN({ onSuccess, onClose, titulo, subtitulo }) {
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const PIN_CORRETO = "1234";

  function handleDigit(d) {
    if (pin.length >= 4) return;
    const novo = pin + d;
    setPin(novo);
    if (novo.length === 4) {
      setTimeout(() => {
        if (novo === PIN_CORRETO) { onSuccess(); }
        else { setErro("PIN incorreto"); setPin(""); }
      }, 200);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.95)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, backdropFilter: "blur(6px)",
    }}>
      <div style={{
        background: "#1E293B", borderRadius: 24, padding: "40px 32px",
        width: "min(360px, 90vw)", textAlign: "center",
        border: "1px solid #334155", boxShadow: "0 32px 64px rgba(0,0,0,0.6)",
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 999,
          background: "rgba(16,185,129,0.15)", display: "flex",
          alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
        }}>
          <Lock size={28} color="#10B981" />
        </div>
        <h2 style={{ color: "#F1F5F9", fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{titulo || "Digite o PIN"}</h2>
        <p style={{ color: "#64748B", fontSize: 14, marginBottom: 28 }}>{subtitulo || "Acesso restrito ao gerente"}</p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 28 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width: 18, height: 18, borderRadius: 999,
              background: i < pin.length ? "#10B981" : "#334155",
              transition: "background 150ms",
              boxShadow: i < pin.length ? "0 0 8px #10B981" : "none",
            }} />
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
          {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((d, i) => (
            <button key={i} onClick={() => d === "⌫" ? setPin(p => p.slice(0,-1)) : d !== "" ? handleDigit(String(d)) : null} disabled={d === ""}
              style={{
                height: 60, borderRadius: 14, fontSize: 22, fontWeight: 700,
                background: d === "" ? "transparent" : d === "⌫" ? "#334155" : "#0F172A",
                color: d === "⌫" ? "#94A3B8" : "#F1F5F9",
                border: "1px solid " + (d === "" ? "transparent" : "#334155"),
                cursor: d === "" ? "default" : "pointer", transition: "background 120ms",
              }}
            >{d}</button>
          ))}
        </div>

        {erro && <p style={{ color: "#EF4444", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{erro}</p>}
        {onClose && <button onClick={onClose} style={{ color: "#64748B", fontSize: 13, fontWeight: 600, background: "none", border: "none", cursor: "pointer", marginTop: 4 }}>Cancelar</button>}
      </div>
    </div>
  );
}

export default function PontoPage() {
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo } = useERP();
  
  const [funcionarios, setFuncionarios] = useState([]);
  const [pontos, setPontos] = useState([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [colabAtivo, setColabAtivo] = useState(null);
  
  // Controle de Trava e Tela Cheia
  const [pinOk, setPinOk] = useState(false);
  const [pedindoSaida, setPedindoSaida] = useState(false);
  const containerRef = useRef(null);

  const carregar = async () => {
    setLoading(true);
    const [resRh, resPonto] = await Promise.all([
      fetchColaboradores(unidadeAtiva),
      fetchPontoHoje(unidadeAtiva)
    ]);
    setFuncionarios(resRh.data || []);
    setPontos(resPonto.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if(unidadeAtiva && pinOk) carregar();
  }, [unidadeAtiva, pinOk]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const filtrados = funcionarios.filter(f => 
    f.nome.toLowerCase().includes(busca.toLowerCase()) || 
    f.cargo.toLowerCase().includes(busca.toLowerCase())
  );

  const getStatus = (colabId) => {
    const p = pontos.find(pt => pt.colaborador_id === colabId);
    return p ? p.status_jornada : 0;
  };

  const handleBaterPonto = async (tipo) => {
     if(!colabAtivo) return;
     const { error } = await registrarBatida(colabAtivo.id, unidadeAtiva, tipo);
     if(error) return alert(error);
     
     // Recarrega os dados para mostrar o checkmark verde
     await carregar();
     
     // Dá um feedback visual para o usuário
     alert("Ponto registrado com sucesso!");
  };

  if(!unidadeAtiva) return <div className="p-10 font-bold text-slate-500">Selecione uma loja no topo.</div>;

  // Tela de Bloqueio Inicial
  if(!pinOk) {
    return (
       <ModalPIN 
         titulo="Modo Ponto" 
         subtitulo="Digite o PIN do Gerente para abrir o relógio"
         onSuccess={() => setPinOk(true)} 
         onClose={() => router.push("/dashboard")} 
       />
    );
  }

  return (
    <div ref={containerRef} className="h-screen bg-slate-100 p-4 font-sans flex flex-col overflow-hidden">
      
      {/* Modal de Saída do Modo Ponto */}
      {pedindoSaida && (
         <ModalPIN 
           titulo="Sair do Relógio" 
           subtitulo="Digite o PIN do Gerente para voltar ao ERP"
           onSuccess={() => router.push("/dashboard")} 
           onClose={() => setPedindoSaida(false)} 
         />
      )}

      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col min-h-0">
        <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4 bg-white p-4 rounded-[24px] shadow-sm border border-slate-200 shrink-0">
           <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20">
                 <Fingerprint size={28} />
              </div>
              <div>
                 <h1 className="text-2xl font-black text-slate-900 tracking-tight">Relógio de Ponto</h1>
                 <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-0.5">Unidade: {unidadeInfo?.nome}</p>
              </div>
           </div>
           
           <div className="flex items-center gap-3">
              <button onClick={toggleFullscreen} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all text-sm">
                 <Maximize size={16}/> Tela Cheia
              </button>
              <button onClick={() => setPedindoSaida(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-rose-100 text-rose-700 hover:bg-rose-200 transition-all text-sm">
                 <Lock size={16}/> Sair
              </button>
           </div>
        </div>

        <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col md:flex-row min-h-0">
           
           {/* Lado Esquerdo: Lista de Funcionários */}
           <div className="w-full md:w-1/2 border-r border-slate-100 flex flex-col bg-slate-50">
              <div className="p-4 border-b border-slate-200 shrink-0">
                 <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-3 shadow-sm">
                    <Search size={18} className="text-slate-400" />
                    <input type="text" placeholder="Buscar funcionário..." value={busca} onChange={e=>setBusca(e.target.value)} className="flex-1 outline-none font-bold text-slate-700 bg-transparent" />
                 </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                 {loading && <p className="text-center font-bold text-slate-500 mt-10">Carregando...</p>}
                 {!loading && filtrados.map(f => {
                    const status = getStatus(f.id);
                    const isSelected = colabAtivo?.id === f.id;
                    
                    return (
                       <button key={f.id} onClick={() => setColabAtivo(f)} className={`p-4 rounded-xl text-left border transition-all ${isSelected ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20 scale-[1.02]' : 'bg-white border-slate-200 hover:border-emerald-300'}`}>
                          <div className="flex justify-between items-center">
                             <div>
                                <p className={`font-black text-lg leading-tight ${isSelected ? 'text-white' : 'text-slate-800'}`}>{f.nome}</p>
                                <p className={`text-xs font-bold uppercase tracking-widest mt-0.5 ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>{f.cargo}</p>
                             </div>
                             {status === 4 && <CheckCircle2 className={isSelected ? 'text-white' : 'text-emerald-500'} size={24} />}
                          </div>
                       </button>
                    );
                 })}
                 {!loading && filtrados.length === 0 && <p className="text-center font-bold text-slate-500 mt-10">Nenhum colaborador encontrado.</p>}
              </div>
           </div>

           {/* Lado Direito: Batida de Ponto Sequencial */}
           <div className="w-full md:w-1/2 p-6 flex flex-col items-center justify-start pt-10 bg-white relative overflow-y-auto">
              {!colabAtivo ? (
                 <div className="text-center text-slate-400 flex flex-col items-center gap-4 mt-20">
                    <Fingerprint size={80} strokeWidth={1} />
                    <p className="font-bold text-lg max-w-xs">Selecione seu nome na lista para bater o ponto.</p>
                 </div>
              ) : (() => {
                 const st = getStatus(colabAtivo.id);
                 const pontoDoDia = pontos.find(pt => pt.colaborador_id === colabAtivo.id);
                 
                 return (
                    <div className="w-full max-w-md flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300">
                       <div className="flex items-center gap-4 mb-6 w-full justify-center">
                          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-emerald-600 shadow-inner shrink-0">
                             <Clock size={32} />
                          </div>
                          <div className="text-left">
                             <h2 className="text-2xl font-black text-slate-900 leading-tight">{colabAtivo.nome}</h2>
                             <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{colabAtivo.cargo}</p>
                          </div>
                       </div>
                       
                       {st === 4 ? (
                          <div className="bg-emerald-50 text-emerald-600 p-6 rounded-2xl w-full flex flex-col items-center gap-2 border border-emerald-100">
                             <CheckCircle2 size={32}/>
                             <p className="font-black text-xl tracking-tight">Jornada Concluída</p>
                             <p className="font-bold text-emerald-700 text-sm">Você já bateu todos os pontos de hoje.</p>
                          </div>
                       ) : (
                          <div className="w-full text-left">
                             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-2 mb-3">Registro do Dia:</p>
                             
                             <div className="grid grid-cols-2 gap-3 w-full">
                                {/* Botão 1 */}
                                <button onClick={() => handleBaterPonto('entrada')} disabled={st !== 0} className={`relative w-full p-4 rounded-2xl transition-all flex flex-col items-center justify-center gap-1 ${st === 0 ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 scale-105' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                                   <div className="flex items-center gap-2">
                                      <span className="font-black text-[15px]">1. Entrada</span>
                                      {st > 0 && <CheckCircle2 size={16} className="text-emerald-500" />}
                                   </div>
                                   {pontoDoDia?.hora_entrada ? (
                                      <span className="text-sm font-black opacity-90">{new Date(pontoDoDia.hora_entrada).toLocaleTimeString('pt-BR')}</span>
                                   ) : (
                                      <span className="text-xs font-bold opacity-50">--:--</span>
                                   )}
                                </button>

                                {/* Botão 2 */}
                                <button onClick={() => handleBaterPonto('saida_intervalo')} disabled={st !== 1} className={`relative w-full p-4 rounded-2xl transition-all flex flex-col items-center justify-center gap-1 ${st === 1 ? 'bg-amber-500 text-white shadow-xl shadow-amber-500/20 hover:bg-amber-600 scale-105' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                                   <div className="flex items-center gap-2">
                                      <span className="font-black text-[15px]">2. Saída Int.</span>
                                      {st > 1 && <CheckCircle2 size={16} className="text-amber-500" />}
                                   </div>
                                   {pontoDoDia?.hora_saida_intervalo ? (
                                      <span className="text-sm font-black opacity-90">{new Date(pontoDoDia.hora_saida_intervalo).toLocaleTimeString('pt-BR')}</span>
                                   ) : (
                                      <span className="text-xs font-bold opacity-50">--:--</span>
                                   )}
                                </button>

                                {/* Botão 3 */}
                                <button onClick={() => handleBaterPonto('retorno_intervalo')} disabled={st !== 2} className={`relative w-full p-4 rounded-2xl transition-all flex flex-col items-center justify-center gap-1 ${st === 2 ? 'bg-blue-500 text-white shadow-xl shadow-blue-500/20 hover:bg-blue-600 scale-105' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                                   <div className="flex items-center gap-2">
                                      <span className="font-black text-[15px]">3. Volta Int.</span>
                                      {st > 2 && <CheckCircle2 size={16} className="text-blue-500" />}
                                   </div>
                                   {pontoDoDia?.hora_retorno_intervalo ? (
                                      <span className="text-sm font-black opacity-90">{new Date(pontoDoDia.hora_retorno_intervalo).toLocaleTimeString('pt-BR')}</span>
                                   ) : (
                                      <span className="text-xs font-bold opacity-50">--:--</span>
                                   )}
                                </button>

                                {/* Botão 4 */}
                                <button onClick={() => handleBaterPonto('saida_trabalho')} disabled={st !== 3} className={`relative w-full p-4 rounded-2xl transition-all flex flex-col items-center justify-center gap-1 ${st === 3 ? 'bg-rose-500 text-white shadow-xl shadow-rose-500/20 hover:bg-rose-600 scale-105' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                                   <div className="flex items-center gap-2">
                                      <span className="font-black text-[15px]">4. Saída Final</span>
                                   </div>
                                   {pontoDoDia?.hora_saida ? (
                                      <span className="text-sm font-black opacity-90">{new Date(pontoDoDia.hora_saida).toLocaleTimeString('pt-BR')}</span>
                                   ) : (
                                      <span className="text-xs font-bold opacity-50">--:--</span>
                                   )}
                                </button>
                             </div>
                          </div>
                       )}
                    </div>
                 );
              })()}
           </div>
        </div>
      </div>
    </div>
  );
}
