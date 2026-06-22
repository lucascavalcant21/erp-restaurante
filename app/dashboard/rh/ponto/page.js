"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, Users, ScanFace, CheckCircle2, ArrowLeft, Fingerprint, Activity } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchFuncionarios, fetchPontoMes, registrarPonto } from "../../../lib/rh";
import { useRouter } from "next/navigation";

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function horaAgora() { return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }

export default function PontoBiometricoPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const router = useRouter();
  
  const [funcs, setFuncs] = useState([]);
  const [pontos, setPontos] = useState({}); // { func_id: { entrada, saida } }
  const [loading, setLoading] = useState(true);
  
  // Relógio Atômico
  const [horaLocal, setHoraLocal] = useState(new Date());

  // Estado do Totem: "espera", "escaneando", "sucesso"
  const [estadoTotem, setEstadoTotem] = useState("espera");
  const [funcSelecionado, setFuncSelecionado] = useState(null);
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data: fs } = await fetchFuncionarios(unidadeAtiva);
    const ativos = (fs || []).filter((f) => f.ativo !== false);
    setFuncs(ativos);
    
    const mes = hojeISO().slice(0, 7);
    const { data: regs } = await fetchPontoMes(mes);
    const hoje = hojeISO();
    
    const mapa = {};
    (regs || []).filter((r) => r.data === hoje).forEach((r) => { 
       mapa[r.func_id] = { entrada: r.entrada, saida: r.saida }; 
    });
    setPontos(mapa);
    setLoading(false);
  }, [unidadeAtiva]);

  useEffect(() => { 
    carregar(); 
    const timer = setInterval(() => setHoraLocal(new Date()), 1000);
    return () => clearInterval(timer);
  }, [carregar]);

  async function simularReconhecimento(func) {
    if (estadoTotem !== "espera") return;
    
    setFuncSelecionado(func);
    setEstadoTotem("escaneando");

    // Simula 2.5 segundos de varredura biométrica intensiva
    setTimeout(async () => {
      const p = pontos[func.id] || {};
      const hora = horaAgora();
      
      let tipo = "entrada";
      let msg = "";
      
      if (!p.entrada) {
         tipo = "entrada";
         msg = `Bom dia, ${func.nome.split(" ")[0]}! Entrada Liberada.`;
      } else if (!p.saida) {
         tipo = "saida";
         msg = `Até logo, ${func.nome.split(" ")[0]}! Saída Confirmada.`;
      } else {
         setMensagemSucesso(`Jornada concluída para ${func.nome.split(" ")[0]}.`);
         setEstadoTotem("sucesso");
         setTimeout(() => { setEstadoTotem("espera"); setFuncSelecionado(null); }, 3000);
         return;
      }

      setPontos((prev) => ({ ...prev, [func.id]: { ...(prev[func.id] || {}), [tipo]: hora } }));
      await registrarPonto(func.id, hojeISO(), tipo, hora);
      
      setMensagemSucesso(`${msg} às ${hora}`);
      setEstadoTotem("sucesso");

      setTimeout(() => {
        setEstadoTotem("espera");
        setFuncSelecionado(null);
      }, 3000);

    }, 2500);
  }

  // ════════════════════════════════════════════════════════════
  // TELA DE SUCESSO (ACESSO AUTORIZADO)
  // ════════════════════════════════════════════════════════════
  if (estadoTotem === "sucesso") {
    return (
      <div className="fixed inset-0 z-[9999] bg-emerald-500 flex flex-col items-center justify-center animate-in fade-in duration-300">
         {/* Background Pulse */}
         <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[500px] h-[500px] bg-emerald-400 rounded-full blur-[100px] animate-pulse opacity-50"></div>
         </div>
         
         <div className="relative z-10 w-40 h-40 bg-white rounded-[40px] flex items-center justify-center mb-10 shadow-[0_20px_60px_rgba(0,0,0,0.3)] animate-bounce" style={{ animationDuration: '2s' }}>
            <CheckCircle2 size={80} className="text-emerald-500" />
         </div>
         
         <h1 className="relative z-10 text-white font-black text-5xl md:text-7xl text-center max-w-4xl px-4 tracking-tighter drop-shadow-xl">
            {mensagemSucesso}
         </h1>
         <p className="relative z-10 text-emerald-100 font-bold uppercase tracking-widest mt-6 text-xl animate-pulse">Acesso Autorizado</p>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // TELA PRINCIPAL (HUD BIOMÉTRICO)
  // ════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex overflow-hidden font-sans select-none">
      
      {/* COLUNA ESQUERDA: CÂMERA HUD FUTURISTA (1/2) */}
      <div className="w-1/2 flex flex-col bg-[#0A0F1C] relative border-r border-blue-900/30 overflow-hidden">
         
         {/* Botão de Saída Gerencial */}
         <button onClick={() => router.push("/dashboard")} className="absolute top-6 left-6 p-4 bg-slate-800/50 hover:bg-red-500 hover:text-white text-slate-500 rounded-2xl backdrop-blur-md transition-colors z-50 group">
            <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
         </button>

         {/* Elementos de Interface HUD (Bordas) */}
         <div className="absolute top-6 right-6 text-blue-500/50 font-mono text-xs text-right">
            <p>SYS.CORE // {unidadeInfo.nome?.toUpperCase()}</p>
            <p>BIO.SCAN_MODULE_v3.4</p>
            <div className="flex items-center justify-end gap-2 mt-2">
               <Activity size={12} className="animate-pulse text-emerald-400" />
               <span className="text-emerald-400">ONLINE</span>
            </div>
         </div>

         <div className="flex-1 flex flex-col items-center justify-center relative">
            
            {/* O SCANNER DE ROSTO */}
            <div className="relative w-80 h-80 md:w-[450px] md:h-[450px]">
               
               {/* Moldura Futurista */}
               <div className={`absolute inset-0 border-2 rounded-[60px] transition-all duration-700 ${estadoTotem === "escaneando" ? "border-blue-500 bg-blue-500/5 shadow-[0_0_100px_rgba(59,130,246,0.2)]" : "border-slate-800 bg-slate-900/50"}`}>
                  
                  {/* Cantos do HUD */}
                  <div className={`absolute -top-1 -left-1 w-16 h-16 border-t-4 border-l-4 rounded-tl-[60px] transition-colors duration-700 ${estadoTotem === "escaneando" ? "border-blue-400" : "border-slate-600"}`}></div>
                  <div className={`absolute -top-1 -right-1 w-16 h-16 border-t-4 border-r-4 rounded-tr-[60px] transition-colors duration-700 ${estadoTotem === "escaneando" ? "border-blue-400" : "border-slate-600"}`}></div>
                  <div className={`absolute -bottom-1 -left-1 w-16 h-16 border-b-4 border-l-4 rounded-bl-[60px] transition-colors duration-700 ${estadoTotem === "escaneando" ? "border-blue-400" : "border-slate-600"}`}></div>
                  <div className={`absolute -bottom-1 -right-1 w-16 h-16 border-b-4 border-r-4 rounded-br-[60px] transition-colors duration-700 ${estadoTotem === "escaneando" ? "border-blue-400" : "border-slate-600"}`}></div>
               </div>

               {/* Central Icon */}
               <div className="absolute inset-0 flex items-center justify-center z-0">
                  {estadoTotem === "escaneando" ? (
                     <Fingerprint size={160} className="text-blue-500 animate-pulse" />
                  ) : (
                     <ScanFace size={120} className="text-slate-700" />
                  )}
               </div>

               {/* Laser de Varredura */}
               {estadoTotem === "escaneando" && (
                 <div className="absolute left-6 right-6 h-1 bg-blue-400 shadow-[0_0_30px_5px_rgba(96,165,250,1)] z-10 opacity-80" 
                      style={{ animation: 'scanWave 2s ease-in-out infinite' }}>
                 </div>
               )}
               <style dangerouslySetInnerHTML={{__html: `
                 @keyframes scanWave { 
                   0% { top: 10%; opacity: 0; }
                   10% { opacity: 1; }
                   90% { opacity: 1; }
                   100% { top: 90%; opacity: 0; } 
                 }
               `}} />

               {/* Badge Flutuante */}
               <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 flex justify-center z-20">
                 <div className={`px-6 py-3 rounded-full font-black text-sm uppercase tracking-widest backdrop-blur-xl border shadow-xl ${
                   estadoTotem === "escaneando" 
                     ? "bg-blue-900/80 text-blue-300 border-blue-500 animate-pulse" 
                     : "bg-slate-900 text-slate-500 border-slate-700"
                 }`}>
                    {estadoTotem === "escaneando" ? "Identificando Padrão..." : "Posicione o Rosto"}
                 </div>
               </div>
            </div>

            {/* RELÓGIO ATÔMICO */}
            <div className="absolute bottom-12 left-0 right-0 text-center">
               <h2 className="text-[100px] leading-none font-black text-white tracking-tighter tabular-nums drop-shadow-2xl">
                 {horaLocal.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
               </h2>
               <div className="flex justify-center items-center gap-3 mt-2">
                  <p className="text-blue-400 font-bold uppercase tracking-widest text-lg">
                    {horaLocal.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                  </p>
                  <span className="text-slate-600 font-mono text-sm">{horaLocal.getSeconds().toString().padStart(2, '0')}s</span>
               </div>
            </div>
         </div>
      </div>

      {/* COLUNA DIREITA: SIMULADOR DE FUNCIONÁRIOS (1/2) */}
      <div className="w-1/2 bg-[#0F172A] flex flex-col">
         
         <div className="p-10 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md">
            <h3 className="text-3xl font-black text-white tracking-tight">Console de Simulação</h3>
            <p className="text-slate-500 text-sm mt-2 font-medium">Toque em um cartão para injetar a face correspondente no scanner biométrico.</p>
         </div>

         <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
            {loading ? (
               <div className="h-full flex items-center justify-center">
                 <Activity size={48} className="text-blue-500 animate-pulse" />
               </div>
            ) : funcs.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-500">
                  <Users size={64} className="mb-4 opacity-20" />
                  <p className="font-bold text-xl uppercase tracking-widest">Base de Dados Vazia</p>
               </div>
            ) : (
               <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                  {funcs.map((f) => {
                     const p = pontos[f.id] || {};
                     const concluido = p.entrada && p.saida;
                     const isScanningThis = funcSelecionado?.id === f.id;
                     
                     return (
                        <button 
                           key={f.id} 
                           onClick={() => simularReconhecimento(f)}
                           disabled={estadoTotem !== "espera" || concluido}
                           className={`relative flex flex-col items-center p-6 rounded-[32px] border-2 transition-all duration-500 group ${
                              concluido 
                                ? "bg-slate-900/50 border-slate-800 opacity-40 cursor-not-allowed" 
                                : isScanningThis
                                  ? "bg-blue-900/40 border-blue-400 scale-105 shadow-[0_0_40px_rgba(59,130,246,0.2)]"
                                  : "bg-slate-800/80 border-slate-700 hover:border-slate-500 hover:-translate-y-2 hover:bg-slate-800"
                           }`}
                        >
                           {/* Avatar Holográfico */}
                           <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 text-3xl font-black border-2 shadow-inner transition-colors duration-500 ${
                              isScanningThis ? "bg-blue-500/20 text-blue-400 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.5)]" : "bg-slate-900 text-slate-500 border-slate-700"
                           }`}>
                              {f.nome[0].toUpperCase()}
                           </div>
                           
                           <h4 className={`font-black text-lg text-center leading-tight mb-4 ${isScanningThis ? 'text-blue-400' : 'text-slate-200'}`}>
                              {f.nome.split(" ")[0]}
                           </h4>
                           
                           {/* Painel de Horários */}
                           <div className="mt-auto w-full flex flex-col gap-1.5">
                              <div className={`flex justify-between items-center px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${p.entrada ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-slate-950 text-slate-600'}`}>
                                 <span>Entrada</span>
                                 <span>{p.entrada || "--:--"}</span>
                              </div>
                              <div className={`flex justify-between items-center px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${p.saida ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-slate-950 text-slate-600'}`}>
                                 <span>Saída</span>
                                 <span>{p.saida || "--:--"}</span>
                              </div>
                           </div>

                           {concluido && (
                              <div className="absolute -top-3 -right-3 w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center border-2 border-emerald-900 shadow-xl">
                                <CheckCircle2 size={20} className="text-emerald-500" />
                              </div>
                           )}
                        </button>
                     )
                  })}
               </div>
            )}
         </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}} />
    </div>
  );
}
