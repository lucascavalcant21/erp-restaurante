"use client";

import { useState, useEffect } from "react";
import { useERP } from "../../context/ERPContext";
import { fetchColaboradores } from "../../lib/rh";
import { fetchPontoHoje, registrarBatida } from "../../lib/ponto";
import { Fingerprint, Search, Clock, CheckCircle2, AlertCircle } from "lucide-react";

export default function PontoPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  
  const [funcionarios, setFuncionarios] = useState([]);
  const [pontos, setPontos] = useState([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [colabAtivo, setColabAtivo] = useState(null);

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
    if(unidadeAtiva) carregar();
  }, [unidadeAtiva]);

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
     const { error, novoStatus } = await registrarBatida(colabAtivo.id, unidadeAtiva, tipo);
     
     if(error) {
        alert(error);
        return;
     }

     alert("Ponto registrado com sucesso!");
     setColabAtivo(null); // Fecha a tela do colaborador
     carregar(); // Recarrega os dados
  };

  if(!unidadeAtiva) return <div className="p-10 font-bold text-slate-500">Selecione uma loja no topo.</div>;

  return (
    <div className="max-w-4xl mx-auto py-10 font-sans">
      
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
         <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
               <Fingerprint size={32} />
            </div>
            <div>
               <h1 className="text-3xl font-black text-slate-900 tracking-tight">Sistema de Ponto</h1>
               <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">Unidade: {unidadeInfo?.nome}</p>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col md:flex-row">
         
         {/* Lado Esquerdo: Lista de Funcionários */}
         <div className="w-full md:w-1/2 border-r border-slate-100 flex flex-col bg-slate-50">
            <div className="p-6 border-b border-slate-200">
               <div className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center gap-2">
                  <Search size={18} className="text-slate-500" />
                  <input type="text" placeholder="Buscar por nome ou cargo..." value={busca} onChange={e=>setBusca(e.target.value)} className="flex-1 outline-none font-bold text-slate-700 bg-transparent" />
               </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
               {loading && <p className="text-center font-bold text-slate-500 mt-10">Carregando...</p>}
               {!loading && filtrados.map(f => {
                  const status = getStatus(f.id);
                  const isSelected = colabAtivo?.id === f.id;
                  
                  return (
                     <button key={f.id} onClick={() => setColabAtivo(f)} className={`p-4 rounded-2xl text-left border transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white border-slate-200 hover:border-indigo-300'}`}>
                        <div className="flex justify-between items-center">
                           <div>
                              <p className={`font-black text-lg ${isSelected ? 'text-white' : 'text-slate-800'}`}>{f.nome}</p>
                              <p className={`text-xs font-bold uppercase tracking-widest mt-0.5 ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>{f.cargo}</p>
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
         <div className="w-full md:w-1/2 p-8 flex flex-col items-center justify-center bg-white relative">
            {!colabAtivo ? (
               <div className="text-center text-slate-500 flex flex-col items-center gap-4">
                  <Fingerprint size={80} strokeWidth={1} />
                  <p className="font-bold text-lg">Selecione seu nome na lista para bater o ponto.</p>
               </div>
            ) : (() => {
               const st = getStatus(colabAtivo.id);
               
               return (
                  <div className="w-full max-w-sm flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300">
                     <div className="w-24 h-24 rounded-full bg-indigo-50 flex items-center justify-center mb-4 text-indigo-600">
                        <Clock size={40} />
                     </div>
                     <h2 className="text-2xl font-black text-slate-900 mb-1">{colabAtivo.nome}</h2>
                     <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-10">{colabAtivo.cargo}</p>
                     
                     {st === 4 ? (
                        <div className="bg-emerald-50 text-emerald-600 p-6 rounded-3xl w-full flex flex-col items-center gap-2 border border-emerald-100">
                           <CheckCircle2 size={32}/>
                           <p className="font-black text-lg">Jornada Concluída</p>
                           <p className="font-medium text-emerald-700 text-sm">Você já bateu todos os pontos de hoje. Bom descanso!</p>
                        </div>
                     ) : (
                        <div className="w-full space-y-4">
                           <p className="text-xs font-bold text-slate-500 uppercase tracking-widest text-left ml-2 mb-2">Próxima Ação Requerida:</p>
                           
                           {/* Botão 1 */}
                           <button onClick={() => handleBaterPonto('entrada')} disabled={st !== 0} className={`w-full py-5 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 ${st === 0 ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 scale-105' : 'bg-slate-100 text-slate-500'}`}>
                              1. Entrada no Trabalho {st > 0 && <CheckCircle2 size={18}/>}
                           </button>

                           {/* Botão 2 */}
                           <button onClick={() => handleBaterPonto('saida_intervalo')} disabled={st !== 1} className={`w-full py-5 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 ${st === 1 ? 'bg-amber-500 text-white shadow-xl shadow-amber-500/20 hover:bg-amber-600 scale-105' : 'bg-slate-100 text-slate-500'}`}>
                              2. Saída para Intervalo {st > 1 && <CheckCircle2 size={18}/>}
                           </button>

                           {/* Botão 3 */}
                           <button onClick={() => handleBaterPonto('retorno_intervalo')} disabled={st !== 2} className={`w-full py-5 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 ${st === 2 ? 'bg-blue-500 text-white shadow-xl shadow-blue-500/20 hover:bg-blue-600 scale-105' : 'bg-slate-100 text-slate-500'}`}>
                              3. Retorno do Intervalo {st > 2 && <CheckCircle2 size={18}/>}
                           </button>

                           {/* Botão 4 */}
                           <button onClick={() => handleBaterPonto('saida_trabalho')} disabled={st !== 3} className={`w-full py-5 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 ${st === 3 ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 scale-105' : 'bg-slate-100 text-slate-500'}`}>
                              4. Saída do Trabalho
                           </button>
                        </div>
                     )}
                  </div>
               );
            })()}
         </div>
      </div>
    </div>
  );
}
