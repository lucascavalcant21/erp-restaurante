"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, Users, ScanFace, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchFuncionarios, fetchPontoMes, registrarPonto } from "../../../lib/rh";
import { useRouter } from "next/navigation";

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function horaAgora() { return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }

export default function PontoTotemPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const router = useRouter();
  
  const [funcs, setFuncs] = useState([]);
  const [pontos, setPontos] = useState({}); // { func_id: { entrada, saida } }
  const [loading, setLoading] = useState(true);
  
  // Relógio
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

    // Simula 2 segundos de reconhecimento facial
    setTimeout(async () => {
      const p = pontos[func.id] || {};
      const hora = horaAgora();
      
      // Inteligência de Bate Ponto
      let tipo = "entrada";
      let msg = "";
      
      if (!p.entrada) {
         tipo = "entrada";
         msg = `Bom dia, ${func.nome.split(" ")[0]}! Entrada registrada.`;
      } else if (!p.saida) {
         tipo = "saida";
         msg = `Até logo, ${func.nome.split(" ")[0]}! Saída registrada.`;
      } else {
         // Já bateu entrada e saída hoje
         setMensagemSucesso(`Ponto do dia já concluído para ${func.nome.split(" ")[0]}.`);
         setEstadoTotem("sucesso");
         setTimeout(() => { setEstadoTotem("espera"); setFuncSelecionado(null); }, 3500);
         return;
      }

      // Salva no banco e local
      setPontos((prev) => ({ ...prev, [func.id]: { ...(prev[func.id] || {}), [tipo]: hora } }));
      await registrarPonto(func.id, hojeISO(), tipo, hora);
      
      setMensagemSucesso(`${msg} às ${hora}`);
      setEstadoTotem("sucesso");

      // Retorna pro estado de espera após 3.5s
      setTimeout(() => {
        setEstadoTotem("espera");
        setFuncSelecionado(null);
      }, 3500);

    }, 2000);
  }

  // Se o Totem estiver em sucesso, mostra uma tela verde gigante
  if (estadoTotem === "sucesso") {
    return (
      <div className="fixed inset-0 z-[9999] bg-emerald-500 flex flex-col items-center justify-center animate-in fade-in duration-300">
         <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mb-8 shadow-2xl animate-bounce">
            <CheckCircle2 size={64} className="text-emerald-500" />
         </div>
         <h1 className="text-white font-black text-4xl md:text-6xl text-center max-w-3xl px-4 drop-shadow-md">
            {mensagemSucesso}
         </h1>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900 flex overflow-hidden font-sans">
      
      {/* COLUNA ESQUERDA: CÂMERA & INSTRUÇÕES */}
      <div className="w-1/2 flex flex-col bg-slate-950 relative border-r border-slate-800">
         {/* Botão de Saída Oculto (Canto superior esquerdo para o gerente sair do Totem) */}
         <button onClick={() => router.push("/dashboard")} className="absolute top-6 left-6 p-4 bg-slate-800/50 hover:bg-slate-700 text-slate-500 hover:text-white rounded-2xl backdrop-blur-sm transition-colors">
            <ArrowLeft size={24} />
         </button>

         <div className="flex-1 flex flex-col items-center justify-center p-12 relative">
            <div className="text-center mb-10 z-10">
               <h1 className="text-4xl font-black text-white tracking-tighter mb-2">Totem de Ponto</h1>
               <p className="text-slate-400 font-medium text-lg">{unidadeInfo.nome}</p>
            </div>

            {/* MOCK DA CÂMERA FACIAL */}
            <div className={`relative w-80 h-80 md:w-96 md:h-96 rounded-[40px] border-4 overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)] transition-colors duration-500 ${estadoTotem === "escaneando" ? "border-blue-500" : "border-slate-800"}`}>
               
               <div className="absolute inset-0 bg-slate-900 flex items-center justify-center z-0">
                  <ScanFace size={100} className={estadoTotem === "escaneando" ? "text-blue-500 animate-pulse" : "text-slate-700"} />
               </div>

               {/* Scanner Laser Animado */}
               {estadoTotem === "escaneando" && (
                 <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 shadow-[0_0_20px_4px_rgba(59,130,246,0.8)] z-10" 
                      style={{ animation: 'scanner 1.5s linear infinite' }}>
                 </div>
               )}
               <style dangerouslySetInnerHTML={{__html: `
                 @keyframes scanner { 
                   0% { transform: translateY(0); } 
                   50% { transform: translateY(380px); } 
                   100% { transform: translateY(0); } 
                 }
               `}} />

               {/* Overlay Status */}
               <div className="absolute bottom-6 left-0 right-0 flex justify-center z-20">
                 <div className={`px-6 py-2 rounded-full font-black text-sm uppercase tracking-widest backdrop-blur-md border ${
                   estadoTotem === "escaneando" 
                     ? "bg-blue-500/20 text-blue-400 border-blue-500/50 animate-pulse" 
                     : "bg-slate-800/50 text-slate-400 border-slate-700"
                 }`}>
                    {estadoTotem === "escaneando" ? "Analisando Biometria..." : "Aguardando Rosto"}
                 </div>
               </div>
            </div>

            {/* RELÓGIO GIGANTE */}
            <div className="absolute bottom-10 left-0 right-0 text-center">
               <h2 className="text-7xl font-black text-white tracking-tighter tabular-nums drop-shadow-xl opacity-90">
                 {horaLocal.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
               </h2>
               <p className="text-xl text-slate-500 font-bold uppercase tracking-widest mt-2">
                 {horaLocal.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
               </p>
            </div>
         </div>
      </div>

      {/* COLUNA DIREITA: SELEÇÃO DE FUNCIONÁRIOS (Simulador) */}
      <div className="w-1/2 bg-slate-900 flex flex-col p-10">
         <div className="mb-8">
            <h3 className="text-2xl font-black text-white">Simulador de Identificação</h3>
            <p className="text-slate-400 text-sm mt-1">Toque na sua foto para emular a leitura facial na câmera.</p>
         </div>

         <div className="flex-1 overflow-y-auto hide-scrollbar">
            {loading ? (
               <div className="h-full flex items-center justify-center">
                 <div className="w-12 h-12 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
               </div>
            ) : funcs.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-500">
                  <Users size={64} className="mb-4 opacity-30" />
                  <p className="font-bold text-xl">Nenhum funcionário cadastrado.</p>
               </div>
            ) : (
               <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                  {funcs.map((f) => {
                     const p = pontos[f.id] || {};
                     const concluido = p.entrada && p.saida;
                     const isScanningThis = funcSelecionado?.id === f.id;
                     
                     return (
                        <button 
                           key={f.id} 
                           onClick={() => simularReconhecimento(f)}
                           disabled={estadoTotem !== "espera" || concluido}
                           className={`relative flex flex-col items-center p-6 rounded-[32px] border-4 transition-all duration-300 ${
                              concluido 
                                ? "bg-slate-800/30 border-slate-800 opacity-50 cursor-not-allowed" 
                                : isScanningThis
                                  ? "bg-blue-900/40 border-blue-500 scale-105 shadow-[0_0_30px_rgba(59,130,246,0.3)]"
                                  : "bg-slate-800 border-slate-700 hover:border-slate-500 hover:-translate-y-2 hover:shadow-2xl"
                           }`}
                        >
                           <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center mb-4 text-3xl font-black text-slate-400 border-2 border-slate-600 shadow-inner overflow-hidden">
                              {f.nome[0].toUpperCase()}
                           </div>
                           <h4 className="font-bold text-white text-lg text-center leading-tight mb-2">{f.nome.split(" ")[0]}</h4>
                           
                           {/* Status Chips */}
                           <div className="mt-auto flex flex-col gap-1 w-full">
                              <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-center ${p.entrada ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-900 text-slate-500'}`}>
                                 IN: {p.entrada || "--:--"}
                              </div>
                              <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-center ${p.saida ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-900 text-slate-500'}`}>
                                 OUT: {p.saida || "--:--"}
                              </div>
                           </div>

                           {concluido && (
                              <div className="absolute -top-3 -right-3 w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center border-4 border-slate-900">
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
    </div>
  );
}
