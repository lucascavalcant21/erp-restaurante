"use client";

import { useState, useEffect } from "react";
import { useERP } from "../../context/ERPContext";
import { fetchColaboradores } from "../../lib/rh";
import { fetchPontoHoje, baterPonto } from "../../lib/ponto";
import { Fingerprint, Search, LogIn, Coffee, Utensils, LogOut, CheckCircle2 } from "lucide-react";

export default function PontoPage() {
  const { unidadeInfo, unidadeAtiva } = useERP();
  const [funcionarios, setFuncionarios] = useState([]);
  const [busca, setBusca] = useState("");
  const [funcSelecionado, setFuncSelecionado] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const [loading, setLoading] = useState(true);

  const carregarDados = async () => {
    setLoading(true);
    const [resColab, resPonto] = await Promise.all([
      fetchColaboradores(unidadeAtiva),
      fetchPontoHoje(unidadeAtiva)
    ]);
    
    const colabs = resColab.data || [];
    const pontos = resPonto.data || [];

    // Mesclar o status do dia para cada colaborador
    const funcComStatus = colabs.map(c => {
      const pontoDeHoje = pontos.find(p => p.colaborador_id === c.id);
      return {
        ...c,
        status: pontoDeHoje ? pontoDeHoje.status_jornada : 0
      };
    });

    setFuncionarios(funcComStatus);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregarDados();
  }, [unidadeAtiva]);

  const filtrados = funcionarios.filter(f => 
    f.nome.toLowerCase().includes(busca.toLowerCase()) || 
    f.cargo.toLowerCase().includes(busca.toLowerCase())
  );

  const handleBaterPonto = async (novoStatus, texto, colunaHora) => {
    // Registra no banco
    await baterPonto(unidadeAtiva, funcSelecionado.id, novoStatus, colunaHora);
    
    // Atualiza a tela localmente
    setFuncionarios(prev => prev.map(f => f.id === funcSelecionado.id ? { ...f, status: novoStatus } : f));
    
    // Mostra mensagem de sucesso
    setMensagem(`${texto} registrado com sucesso para ${funcSelecionado.nome}!`);
    setTimeout(() => {
       setMensagem(null);
       setFuncSelecionado(null);
       setBusca("");
       carregarDados(); // Recarrega os dados pra garantir
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-slate-900 font-sans pb-24 text-white flex flex-col items-center justify-center p-4">
      
      <div className="text-center mb-10">
         <div className="w-20 h-20 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(249,115,22,0.3)]">
            <Fingerprint size={40} />
         </div>
         <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white">Relógio de Ponto</h1>
         <p className="text-slate-400 font-bold uppercase tracking-widest mt-2">{unidadeInfo?.nome || "Unidade"}</p>
      </div>

      {!funcSelecionado ? (
        <div className="w-full max-w-xl">
           <div className="bg-slate-800 p-2 rounded-2xl flex items-center gap-3 mb-6 border border-slate-700 shadow-xl">
              <Search size={24} className="text-slate-400 ml-3" />
              <input 
                type="text" 
                placeholder="Busque seu nome ou cargo..." 
                value={busca} 
                onChange={e => setBusca(e.target.value)}
                className="w-full bg-transparent p-3 outline-none font-bold text-xl text-white placeholder:text-slate-500" 
              />
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
              {loading && <div className="col-span-1 md:col-span-2 text-center p-10 font-bold text-slate-400">Carregando quadro...</div>}
              {!loading && filtrados.map(f => (
                 <button 
                   key={f.id} 
                   onClick={() => setFuncSelecionado(f)}
                   className="p-5 bg-slate-800 border border-slate-700 hover:border-orange-500 hover:bg-slate-750 rounded-2xl text-left transition-all group"
                 >
                    <p className="text-xl font-black text-white group-hover:text-orange-500 transition-colors">{f.nome}</p>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">{f.cargo}</p>
                 </button>
              ))}
              {!loading && filtrados.length === 0 && (
                 <div className="col-span-1 md:col-span-2 text-center p-10 text-slate-500 font-bold">Colaborador não encontrado.</div>
              )}
           </div>
        </div>
      ) : mensagem ? (
        <div className="w-full max-w-xl bg-emerald-500 text-white p-10 rounded-[32px] text-center shadow-[0_0_80px_rgba(16,185,129,0.3)] animate-in zoom-in-95">
           <CheckCircle2 size={80} className="mx-auto mb-6" />
           <h2 className="text-3xl font-black">{mensagem}</h2>
        </div>
      ) : (
        <div className="w-full max-w-xl bg-slate-800 p-8 md:p-10 rounded-[32px] border border-slate-700 shadow-2xl animate-in zoom-in-95">
           <div className="text-center mb-8">
              <p className="text-slate-400 font-bold uppercase tracking-widest text-sm mb-1">Registrar Ponto</p>
              <h2 className="text-3xl font-black text-white">{funcSelecionado.nome}</h2>
           </div>

           <div className="flex flex-col gap-4">
              <button 
                disabled={funcSelecionado.status !== 0}
                onClick={() => handleBaterPonto(1, "Entrada", "hora_entrada")}
                className={`p-6 rounded-2xl flex items-center justify-between font-black text-xl transition-all ${
                  funcSelecionado.status === 0 
                  ? 'bg-blue-600 text-white hover:bg-blue-500 hover:shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:-translate-y-1' 
                  : 'bg-slate-900 text-slate-600 cursor-not-allowed opacity-50'
                }`}
              >
                 <span className="flex items-center gap-3"><LogIn size={28}/> 1. Entrada no Trabalho</span>
                 {funcSelecionado.status > 0 && <CheckCircle2 size={24} className="text-emerald-500" />}
              </button>

              <button 
                disabled={funcSelecionado.status !== 1 && funcSelecionado.status !== 3}
                onClick={() => handleBaterPonto(2, "Saída para Intervalo", "hora_saida_intervalo")}
                className={`p-6 rounded-2xl flex items-center justify-between font-black text-xl transition-all ${
                  (funcSelecionado.status === 1 || funcSelecionado.status === 3)
                  ? 'bg-amber-600 text-white hover:bg-amber-500 hover:shadow-[0_0_30px_rgba(217,119,6,0.4)] hover:-translate-y-1' 
                  : 'bg-slate-900 text-slate-600 cursor-not-allowed opacity-50'
                }`}
              >
                 <span className="flex items-center gap-3"><Utensils size={28}/> 2. Saída p/ Intervalo</span>
                 {funcSelecionado.status > 1 && <CheckCircle2 size={24} className="text-emerald-500" />}
              </button>

              <button 
                disabled={funcSelecionado.status !== 2}
                onClick={() => handleBaterPonto(3, "Retorno do Intervalo", "hora_retorno_intervalo")}
                className={`p-6 rounded-2xl flex items-center justify-between font-black text-xl transition-all ${
                  funcSelecionado.status === 2
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-[0_0_30px_rgba(79,70,229,0.4)] hover:-translate-y-1' 
                  : 'bg-slate-900 text-slate-600 cursor-not-allowed opacity-50'
                }`}
              >
                 <span className="flex items-center gap-3"><Coffee size={28}/> 3. Retorno do Intervalo</span>
                 {funcSelecionado.status > 2 && <CheckCircle2 size={24} className="text-emerald-500" />}
              </button>

              <button 
                disabled={funcSelecionado.status !== 1 && funcSelecionado.status !== 3}
                onClick={() => handleBaterPonto(4, "Fim do Expediente", "hora_saida")}
                className={`p-6 rounded-2xl flex items-center justify-between font-black text-xl transition-all ${
                  (funcSelecionado.status === 1 || funcSelecionado.status === 3)
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:-translate-y-1' 
                  : 'bg-slate-900 text-slate-600 cursor-not-allowed opacity-50'
                }`}
              >
                 <span className="flex items-center gap-3"><LogOut size={28}/> 4. Saída do Trabalho</span>
                 {funcSelecionado.status > 3 && <CheckCircle2 size={24} className="text-emerald-500" />}
              </button>
           </div>

           <button 
             onClick={() => setFuncSelecionado(null)}
             className="w-full mt-6 py-4 text-slate-400 hover:text-white font-bold tracking-widest uppercase transition-colors"
           >
              Cancelar
           </button>
        </div>
      )}
    </div>
  );
}
