"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../context/ERPContext";
import { fetchColaboradores, inserirColaborador, removerColaborador, fetchDocumentos, uploadDocumentoRH, removerDocumento } from "../../lib/rh";
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
  const [novoFunc, setNovoFunc] = useState({ nome: "", cargo: "", salario: "" });
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

  const handleSalvar = async () => {
    if(!novoFunc.nome || !novoFunc.cargo) return;
    await inserirColaborador({
      unidade_id: unidadeAtiva,
      nome: novoFunc.nome,
      cargo: novoFunc.cargo,
      salario: Number(novoFunc.salario) || 0
    });
    setModalNovo(false);
    setNovoFunc({ nome: "", cargo: "", salario: "" });
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
            <button onClick={() => setModalNovo(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">
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
                              if (!pt) return <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md">Não iniciou</span>;
                              if (pt.status_jornada === 1) return <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md">Trabalhando (Entrou {new Date(pt.hora_entrada).toLocaleTimeString('pt-BR').slice(0,5)})</span>;
                              if (pt.status_jornada === 2) return <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-md">Intervalo (Saiu {new Date(pt.hora_saida_intervalo).toLocaleTimeString('pt-BR').slice(0,5)})</span>;
                              if (pt.status_jornada === 3) return <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md">Trabalhando (Voltou {new Date(pt.hora_retorno_intervalo).toLocaleTimeString('pt-BR').slice(0,5)})</span>;
                              if (pt.status_jornada === 4) return <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-md">Concluída (Saiu {new Date(pt.hora_saida).toLocaleTimeString('pt-BR').slice(0,5)})</span>;
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

      {/* Modal Adicionar Funcionário */}
      {modalNovo && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="font-black text-2xl text-slate-800">Novo Funcionário</h2>
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
               </div>

               <button onClick={handleSalvar} disabled={!novoFunc.nome} className="w-full mt-8 py-5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95">
                  Salvar Colaborador
               </button>
            </div>
         </div>
      )}

    </div>
  );
}
