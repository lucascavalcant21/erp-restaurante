"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../context/ERPContext";
import { fetchColaboradores, inserirColaborador, atualizarColaborador, removerColaborador, fetchDocumentos, uploadDocumentoRH, removerDocumento } from "../../lib/rh";
import { fetchPontoHoje } from "../../lib/ponto";
import { salvarConta } from "../../lib/financeiro";
import { 
  Users, UserPlus, FileText, Upload, Save, X, Search, Trash2, Loader2
} from "lucide-react";
import { fmtBRL } from "../../components/ui";

export default function RHPage() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  
  const [funcionarios, setFuncionarios] = useState([]);
  const [pontosHoje, setPontosHoje] = useState([]);
  const [busca, setBusca] = useState("");
  const [modalNovo, setModalNovo] = useState(false);
  const [novoFunc, setNovoFunc] = useState({ nome: "", cargo: "", salario: "", horario_entrada: "", horario_saida: "", dias_trabalho: "1,2,3,4,5,6", tempo_intervalo: 60 });
  const [editandoId, setEditandoId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState(null);

  const fileInputRef = useRef(null);
  const [funcParaUpload, setFuncParaUpload] = useState(null);

  const carregar = async () => {
    setLoading(true);
    const [resRh, resPonto] = await Promise.all([
      fetchColaboradores(unidadeAtiva),
      fetchPontoHoje(unidadeAtiva)
    ]);
    
    // Busca os documentos de cada um (ideal seria uma query relacional no supabase, mas pro MVP assim serve)
    const comDocs = await Promise.all((resRh.data || []).map(async (f) => {
       const docsResp = await fetchDocumentos(f.id);
       return { ...f, docs: docsResp.data || [] };
    }));

    setFuncionarios(comDocs);
    setPontosHoje(resPonto.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva]);

  const filtrados = funcionarios.filter(f => f.nome.toLowerCase().includes(busca.toLowerCase()));

  const abrirModalNovo = () => {
    setEditandoId(null);
    setNovoFunc({ nome: "", cargo: "", salario: "", horario_entrada: "", horario_saida: "", dias_trabalho: "1,2,3,4,5,6", tempo_intervalo: 60 });
    setModalNovo(true);
  };

  const abrirModalEdicao = (f) => {
    setEditandoId(f.id);
    setNovoFunc({ 
       nome: f.nome || "", 
       cargo: f.cargo || "", 
       salario: f.salario || "", 
       horario_entrada: f.horario_entrada || "", 
       horario_saida: f.horario_saida || "", 
       dias_trabalho: f.dias_trabalho || "1,2,3,4,5,6", 
       tempo_intervalo: f.tempo_intervalo || 60 
    });
    setModalNovo(true);
  };

  const handleSalvar = async () => {
    if(!novoFunc.nome || !novoFunc.cargo) return;
    
    const payload = {
      unidade_id: unidadeAtiva,
      nome: novoFunc.nome,
      cargo: novoFunc.cargo,
      salario: Number(novoFunc.salario) || 0,
      horario_entrada: novoFunc.horario_entrada,
      horario_saida: novoFunc.horario_saida,
      dias_trabalho: novoFunc.dias_trabalho,
      tempo_intervalo: Number(novoFunc.tempo_intervalo) || 60
    };

    if (editandoId) {
      await atualizarColaborador(editandoId, payload);
    } else {
      await inserirColaborador(payload);
    }
    
    setModalNovo(false);
    setEditandoId(null);
    setNovoFunc({ nome: "", cargo: "", salario: "", horario_entrada: "", horario_saida: "", dias_trabalho: "1,2,3,4,5,6", tempo_intervalo: 60 });
    carregar();
  };

  const handleRemover = async (id) => {
    if(confirm("Remover este funcionário?")) {
      await removerColaborador(id);
      carregar();
    }
  };

  const handleLancarFinanceiro = async (f) => {
    if(confirm(`Deseja lançar R$ ${f.salario} no Financeiro para o funcionário ${f.nome}?`)) {
       const hoje = new Date().toISOString().split('T')[0];
       await salvarConta({
          unidade_id: unidadeAtiva,
          descricao: `Salário: ${f.nome} - ${f.cargo}`,
          valor: f.salario,
          data_vencimento: hoje,
          categoria: 'cmo',
          status: 'pendente'
       });
       alert("Lançado com sucesso em Contas a Pagar (Financeiro)!");
    }
  };

  const acionarUpload = (f) => {
    setFuncParaUpload(f.id);
    fileInputRef.current.click();
  };

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !funcParaUpload) return;

    setUploadingId(funcParaUpload);
    const { error } = await uploadDocumentoRH(funcParaUpload, file);
    setUploadingId(null);
    setFuncParaUpload(null);
    fileInputRef.current.value = ""; // reseta o input

    if (error) {
       alert(error);
    } else {
       carregar();
    }
  };

  const handleApagarDoc = async (docId, url) => {
     if(confirm("Apagar este documento permanentemente?")) {
        await removerDocumento(docId, url);
        carregar();
     }
  };

  return (
    <div className="min-h-screen font-sans pb-24 text-slate-800">
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleUploadFile} accept=".pdf,.png,.jpg,.jpeg" />
      
      {/* HEADER */}
      <div className="pt-6 pb-8 px-6 max-w-5xl mx-auto flex items-center justify-between">
         <div className="flex items-center gap-4">
           <div className="w-16 h-16 rounded-3xl bg-slate-100 text-emerald-600 flex items-center justify-center shadow-inner">
              <Users size={32} />
           </div>
           <div>
              <h1 className="text-4xl font-black tracking-tighter text-slate-900">RH & Equipe</h1>
              <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">Gestão de Funcionários</p>
           </div>
         </div>
         <div className="flex items-center gap-3">
            <a 
               href={(!unidadeAtiva || unidadeAtiva === "todas") ? "#" : `/exportar-afd?unidadeId=${unidadeAtiva}`} 
               onClick={(e) => { if(!unidadeAtiva || unidadeAtiva === "todas") { e.preventDefault(); alert("Por favor, selecione uma unidade específica no menu lateral esquerdo para exportar o AFD daquela empresa."); } }}
               target={(!unidadeAtiva || unidadeAtiva === "todas") ? "_self" : "_blank"} 
               rel="noreferrer" 
               className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-colors shadow-lg ${(!unidadeAtiva || unidadeAtiva === "todas") ? "bg-slate-300 text-slate-500 cursor-not-allowed" : "bg-slate-800 text-white hover:bg-slate-900 shadow-slate-800/20"}`}>
               <FileText size={18} /> Exportar AFD
            </a>
            <button onClick={abrirModalNovo} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">
               <UserPlus size={18} /> Contratar
            </button>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-6">
         
         <div className="bg-white p-4 rounded-t-3xl border border-slate-200 border-b-0 flex items-center gap-3">
            <Search size={18} className="text-slate-500" />
            <input type="text" placeholder="Buscar funcionário..." value={busca} onChange={e=>setBusca(e.target.value)} className="flex-1 outline-none font-medium text-slate-700" />
         </div>

         <div className="bg-white rounded-b-3xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                     <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Colaborador</th>
                     <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Cargo</th>
                     <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Remuneração Base</th>
                     <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Ponto Hoje</th>
                     <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Documentos / Ações</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {loading && <tr><td colSpan={5} className="p-10 text-center text-slate-500 font-bold">Carregando...</td></tr>}
                  {!loading && filtrados.map(f => (
                     <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-bold text-slate-800">{f.nome}</td>
                        <td className="p-4 font-medium text-slate-600">{f.cargo}</td>
                        <td className="p-4 font-black text-slate-800">{fmtBRL(f.salario)}</td>
                        <td className="p-4">
                           {(() => {
                              const pt = pontosHoje.find(p => p.colaborador_id === f.id);
                              
                              const strToMin = (str) => {
                                 if(!str) return null;
                                 const [h,m] = str.split(':').map(Number);
                                 return h*60+m;
                              };
                              const dateToMin = (dStr) => {
                                 if(!dStr) return null;
                                 const d = new Date(dStr);
                                 return d.getHours()*60 + d.getMinutes();
                              };
                              const minToStr = (m) => {
                                 if (m < 0) m += 24 * 60; // Caso vire a noite
                                 const hh = Math.floor(m/60);
                                 const mm = m%60;
                                 if(hh === 0) return `${mm}min`;
                                 return `${hh}h${mm.toString().padStart(2,'0')}`;
                              };

                              if (!pt) {
                                 if(f.horario_entrada && f.dias_trabalho && f.dias_trabalho.split(',').includes(new Date().getDay().toString())) {
                                    const minAgora = new Date().getHours() * 60 + new Date().getMinutes();
                                    const minEntrada = strToMin(f.horario_entrada);
                                    if(minAgora > minEntrada) {
                                       return <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-md border border-rose-200">Atrasado (Era p/ {f.horario_entrada})</span>;
                                    }
                                 }
                                 return <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">Não iniciou</span>;
                              }

                              const hrEntrada = new Date(pt.hora_entrada).toLocaleTimeString('pt-BR').slice(0,5);

                              if (pt.status_jornada === 1) {
                                 let extra = "";
                                 if(f.horario_entrada) {
                                    const mPt = dateToMin(pt.hora_entrada);
                                    const mAg = strToMin(f.horario_entrada);
                                    if(mPt > mAg + 5) extra = ` (Era p/ ${f.horario_entrada})`;
                                    else extra = ` (No horário)`;
                                 }
                                 const atrasado = extra.includes("Era p/");
                                 return <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md border ${atrasado ? 'text-rose-700 bg-rose-100 border-rose-200' : 'text-emerald-700 bg-emerald-100 border-emerald-200'}`}>Trab: Entrou {hrEntrada}{extra}</span>;
                              }

                              if (pt.status_jornada === 2) {
                                 const hrSaidaInt = new Date(pt.hora_saida_intervalo).toLocaleTimeString('pt-BR').slice(0,5);
                                 return <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-md border border-amber-200">No Intervalo: Saiu {hrSaidaInt}</span>;
                              }

                              if (pt.status_jornada === 3) {
                                 const hrVolta = new Date(pt.hora_retorno_intervalo).toLocaleTimeString('pt-BR').slice(0,5);
                                 let intTexto = "";
                                 const minSaida = dateToMin(pt.hora_saida_intervalo);
                                 let minVolta = dateToMin(pt.hora_retorno_intervalo);
                                 if (minVolta < minSaida) minVolta += 24 * 60; // Virou a noite
                                 const duracao = minVolta - minSaida; 
                                 const limite = f.tempo_intervalo || 60;
                                 
                                 if(duracao > limite) {
                                    intTexto = ` (Tirou ${minToStr(duracao)}, o limite é ${minToStr(limite)})`;
                                    return <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-md border border-rose-200">Voltou {hrVolta}{intTexto}</span>;
                                 }
                                 return <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md border border-emerald-200">Voltou {hrVolta} (Intervalo OK)</span>;
                              }

                              if (pt.status_jornada === 4) {
                                 const hrSaida = new Date(pt.hora_saida).toLocaleTimeString('pt-BR').slice(0,5);
                                 return <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-md border border-blue-200">Expediente Concluído: Saiu {hrSaida}</span>;
                              }

                              return <span className="text-[11px] font-bold text-slate-400">--</span>;
                           })()}
                        </td>
                        <td className="p-4 text-right">
                           <div className="flex flex-col items-end gap-2">
                              {f.docs?.length > 0 ? f.docs.map((d) => (
                                <div key={d.id} className="flex items-center gap-2">
                                  <a href={d.url_arquivo} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-emerald-600 px-2 py-1 rounded-md hover:bg-slate-50 hover:underline">
                                    <FileText size={10}/> {d.nome_arquivo}
                                  </a>
                                  <button onClick={() => handleApagarDoc(d.id, d.url_arquivo)} className="text-slate-500 hover:text-emerald-600"><X size={12}/></button>
                                </div>
                              )) : <span className="text-[10px] text-slate-500">Sem docs</span>}
                              
                              <div className="flex items-center gap-3 mt-2 flex-wrap justify-end">
                                <button onClick={() => router.push(`/dashboard/rh/espelho/${f.id}?mes=${new Date().toISOString().slice(0,7)}`)} className="flex items-center gap-1 text-xs font-black text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors">
                                   Espelho de Ponto
                                </button>
                                <button onClick={() => handleLancarFinanceiro(f)} className="flex items-center gap-1 text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors">
                                   Lançar Salário
                                </button>
                                <button onClick={() => acionarUpload(f)} disabled={uploadingId === f.id} className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-indigo-800 disabled:opacity-50">
                                   {uploadingId === f.id ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14}/>} 
                                   {uploadingId === f.id ? "Enviando..." : "Anexar Doc"}
                                </button>
                                 <button onClick={() => abrirModalEdicao(f)} className="text-slate-600 hover:bg-slate-50 p-1.5 rounded transition-colors text-[10px] font-bold uppercase border border-slate-200">Editar</button>
                                 <button onClick={() => handleRemover(f.id)} className="text-slate-600 hover:bg-slate-50 p-1.5 rounded transition-colors"><Trash2 size={16}/></button>
                              </div>
                           </div>
                        </td>
                     </tr>
                  ))}
                  {!loading && filtrados.length === 0 && (
                     <tr><td colSpan={5} className="p-10 text-center text-slate-500 font-bold">Nenhum funcionário cadastrado.</td></tr>
                  )}
               </tbody>
            </table>
         </div>

      </div>

      {/* Modal Adicionar/Editar Funcionário */}
      {modalNovo && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="font-black text-2xl text-slate-800">{editandoId ? "Editar Colaborador" : "Novo Funcionário"}</h2>
                  <button onClick={() => setModalNovo(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="space-y-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome Completo</label>
                     <input type="text" value={novoFunc.nome} onChange={e=>setNovoFunc({...novoFunc, nome: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Função / Cargo</label>
                     <input type="text" value={novoFunc.cargo} onChange={e=>setNovoFunc({...novoFunc, cargo: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Salário Base (R$)</label>
                     <input type="number" value={novoFunc.salario} onChange={e=>setNovoFunc({...novoFunc, salario: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-black text-emerald-600 outline-none focus:border-emerald-500"/>
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 mt-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Entrada (HH:MM)</label>
                        <input type="time" value={novoFunc.horario_entrada || ""} onChange={e=>setNovoFunc({...novoFunc, horario_entrada: e.target.value})} className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Saída (HH:MM)</label>
                        <input type="time" value={novoFunc.horario_saida || ""} onChange={e=>setNovoFunc({...novoFunc, horario_saida: e.target.value})} className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Dias Trabalho (Ex: 1,2,3,4,5,6)</label>
                        <input type="text" placeholder="0=Dom, 1=Seg..." value={novoFunc.dias_trabalho || ""} onChange={e=>setNovoFunc({...novoFunc, dias_trabalho: e.target.value})} className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500 text-sm"/>
                     </div>
                     <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Intervalo (Minutos)</label>
                        <input type="number" value={novoFunc.tempo_intervalo || ""} onChange={e=>setNovoFunc({...novoFunc, tempo_intervalo: e.target.value})} placeholder="Ex: 60" className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                     </div>
                  </div>
               </div>

               <button onClick={handleSalvar} disabled={!novoFunc.nome} className="w-full mt-8 py-5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95">
                  {editandoId ? "Salvar Alterações" : "Salvar Colaborador"}
               </button>
            </div>
         </div>
      )}

    </div>
  );
}
