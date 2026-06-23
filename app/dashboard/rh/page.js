"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../context/ERPContext";
import {
  fetchColaboradores, inserirColaborador, removerColaborador, atualizarColaborador, 
  fetchDocumentos, uploadDocumentoRH, removerDocumento,
  fetchCargos,
  fetchAllFolgasDaUnidade, fetchFolgasEsporadicas, inserirFolgaEsporadica, removerFolgaEsporadica,
  fetchConsumoFuncionario, inserirConsumoFuncionario, atualizarStatusConsumo, removerConsumoFuncionario
} from "../../lib/rh";
import { fetchPontoHoje } from "../../lib/ponto";
import { salvarConta } from "../../lib/financeiro";
import { 
  Users, UserPlus, FileText, Upload, Save, X, Search, Trash2, Loader2, CalendarHeart, Star, Phone, CreditCard, ClipboardList, Clock, CalendarDays, ShoppingBag, CheckCircle, Store
} from "lucide-react";
import { fmtBRL } from "../../components/ui";

export default function RHPage() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  
  const [funcionarios, setFuncionarios] = useState([]);
  const [pontosHoje, setPontosHoje] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [busca, setBusca] = useState("");
  const [abaAtiva, setAbaAtiva] = useState("Fixo");
  const statePadrao = { nome: "", cargo: "", salario: "", horario_entrada: "", horario_saida: "", dias_trabalho: "1,2,3,4,5,6", tempo_intervalo: 60, tipo_contrato: "Fixo", telefone: "", cpf: "", chave_pix: "", avaliacao_estrelas: 0, anotacoes_rh: "", data_admissao: "", status_contrato: "Definitivo" };
  const [modalNovo, setModalNovo] = useState(false);
  const [novoFunc, setNovoFunc] = useState(statePadrao);
  const [editandoId, setEditandoId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState(null);

  const fileInputRef = useRef(null);
  const [funcParaUpload, setFuncParaUpload] = useState(null);
  
  const [modalFolgas, setModalFolgas] = useState(false);
  const [funcParaFolgas, setFuncParaFolgas] = useState(null);
  const [folgasEsporadicas, setFolgasEsporadicas] = useState([]);
  const [todasFolgasDaUnidade, setTodasFolgasDaUnidade] = useState([]);
  const [novaFolgaData, setNovaFolgaData] = useState("");
  const [domingosProximos, setDomingosProximos] = useState([]);

  // Estados Modal Consumo (Vales)
  const [modalConsumo, setModalConsumo] = useState(false);
  const [funcionarioConsumo, setFuncionarioConsumo] = useState(null);
  const [listaConsumo, setListaConsumo] = useState([]);
  const stateConsumo = { descricao: "", valor_original: "", forma_pagamento: "Desconto em Folha", data_consumo: new Date().toISOString().substring(0,16) };
  const [novoConsumo, setNovoConsumo] = useState(stateConsumo);
  const [loadingConsumo, setLoadingConsumo] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const [resRh, resPonto, resCargos] = await Promise.all([
      fetchColaboradores(unidadeAtiva),
      fetchPontoHoje(unidadeAtiva),
      fetchCargos(unidadeAtiva)
    ]);
    
    const comDocs = await Promise.all((resRh.data || []).map(async (f) => {
       const docsResp = await fetchDocumentos(f.id);
       return { ...f, docs: docsResp.data || [] };
    }));

    setFuncionarios(comDocs);
    setPontosHoje(resPonto.data || []);
    setCargos(resCargos.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva]);

  // --- Funções de Consumo ---
  const carregarConsumo = async (funcId) => {
    setLoadingConsumo(true);
    const { data } = await fetchConsumoFuncionario(funcId);
    setListaConsumo(data || []);
    setLoadingConsumo(false);
  };

  const abrirModalConsumo = (f) => {
    setFuncionarioConsumo(f);
    setNovoConsumo({ ...stateConsumo, data_consumo: new Date().toISOString().substring(0,16) });
    setListaConsumo([]);
    setModalConsumo(true);
    carregarConsumo(f.id);
  };

  const salvarConsumo = async () => {
    if (!novoConsumo.descricao || !novoConsumo.valor_original) return alert("Preencha descrição e valor.");
    
    const valOriginal = Number(novoConsumo.valor_original);
    const valDesconto = valOriginal * 0.8; // 20% de desconto
    const statPagto = novoConsumo.forma_pagamento === "Desconto em Folha" ? "Pendente" : "Pago";
    
    const payload = {
      unidade_id: unidadeAtiva,
      funcionario_id: funcionarioConsumo.id,
      descricao: novoConsumo.descricao,
      valor_original: valOriginal,
      valor_desconto: valDesconto,
      forma_pagamento: novoConsumo.forma_pagamento,
      status_pagamento: statPagto,
      data_consumo: new Date(novoConsumo.data_consumo).toISOString(),
    };
    if (statPagto === "Pago") payload.data_pagamento = new Date().toISOString();

    const { error } = await inserirConsumoFuncionario(payload);
    if (error) return alert("Erro: " + error);
    
    setNovoConsumo({ ...stateConsumo, data_consumo: new Date().toISOString().substring(0,16) });
    carregarConsumo(funcionarioConsumo.id);
  };

  const quitarConsumo = async (consumoId) => {
    if (!confirm("Confirmar quitação (pagamento recebido) deste consumo?")) return;
    const { error } = await atualizarStatusConsumo(consumoId, "Pago");
    if (error) alert("Erro: " + error);
    else carregarConsumo(funcionarioConsumo.id);
  };

  const alterarFormaPagamentoConsumo = async (consumoId, statusAtual, novaForma) => {
    const { error } = await atualizarStatusConsumo(consumoId, statusAtual, novaForma);
    if (error) alert("Erro: " + error);
    else carregarConsumo(funcionarioConsumo.id);
  };

  const apagarConsumo = async (consumoId) => {
    if (!confirm("Apagar este registro?")) return;
    const { error } = await removerConsumoFuncionario(consumoId);
    if (error) alert("Erro: " + error);
    else carregarConsumo(funcionarioConsumo.id);
  };

  const filtrados = funcionarios.filter(f => f.nome.toLowerCase().includes(busca.toLowerCase()) && (f.tipo_contrato || "Fixo") === abaAtiva);

  const abrirModalNovo = () => {
    setEditandoId(null);
    setNovoFunc(statePadrao);
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
       tempo_intervalo: f.tempo_intervalo || 60,
       tipo_contrato: f.tipo_contrato || "Fixo",
       telefone: f.telefone || "",
       cpf: f.cpf || "",
       chave_pix: f.chave_pix || "",
       avaliacao_estrelas: f.avaliacao_estrelas || 0,
       anotacoes_rh: f.anotacoes_rh || "",
       data_admissao: f.data_admissao || "",
       status_contrato: f.status_contrato || "Definitivo"
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
      tempo_intervalo: Number(novoFunc.tempo_intervalo) || 60,
      tipo_contrato: novoFunc.tipo_contrato,
      telefone: novoFunc.telefone,
      cpf: novoFunc.cpf,
      chave_pix: novoFunc.chave_pix,
      avaliacao_estrelas: Number(novoFunc.avaliacao_estrelas) || 0,
      anotacoes_rh: novoFunc.anotacoes_rh,
      data_admissao: novoFunc.data_admissao || null,
      status_contrato: novoFunc.status_contrato
    };

    if (editandoId) {
      await atualizarColaborador(editandoId, payload);
    } else {
      await inserirColaborador(payload);
    }
    
    setModalNovo(false);
    setEditandoId(null);
    setNovoFunc(statePadrao);
    carregar();
  };

  const handleRemover = async (id) => {
    if(confirm("Remover este funcionário?")) {
      await removerColaborador(id);
      carregar();
    }
  };

  const calcularProgresso = (f) => {
     if (f.tipo_contrato !== "Fixo" || !f.data_admissao) return null;
     const badges = [];
     const dAdm = new Date(f.data_admissao + "T12:00:00Z");
     const hj = new Date();
     hj.setHours(0,0,0,0);
     dAdm.setHours(0,0,0,0);
     
     const diffDias = Math.floor((hj - dAdm) / (1000 * 60 * 60 * 24));
     const anoAtual = hj.getFullYear();
     
     if (f.status_contrato && f.status_contrato.startsWith("Experiência")) {
        const m = f.status_contrato.match(/\d+/);
        if (m) {
           const diasTotal = parseInt(m[0], 10);
           const faltam = diasTotal - diffDias;
           if (faltam > 0) badges.push({ text: `Faltam ${faltam} dias (Experiência)`, color: 'text-amber-700 bg-amber-50 border-amber-200' });
           else badges.push({ text: `Vencido há ${Math.abs(faltam)} dias`, color: 'text-rose-700 bg-rose-50 border-rose-200' });
        }
     } else if (f.status_contrato === "Definitivo") {
        let prox = new Date(dAdm);
        prox.setFullYear(anoAtual);
        if (hj > prox) prox.setFullYear(anoAtual + 1);
        const faltamFerias = Math.floor((prox - hj) / (1000 * 60 * 60 * 24));
        badges.push({ text: `1 Ano em ${faltamFerias} dias`, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' });
     }

     let proxColetiva = new Date(anoAtual, 11, 21);
     if (hj > proxColetiva) proxColetiva.setFullYear(anoAtual + 1);
     const faltamColetiva = Math.floor((proxColetiva - hj) / (1000 * 60 * 60 * 24));
     badges.push({ text: `Coletivas em ${faltamColetiva} dias (21/12)`, color: 'text-teal-700 bg-teal-50 border-teal-200' });

     return badges;
  };

  const handleLancarFinanceiro = async (f) => {
    const isFree = f.tipo_contrato === "Freelancer";
    const labelLabel = isFree ? "Diária" : "Salário";
    if(confirm(`Deseja lançar R$ ${f.salario} no Financeiro como ${labelLabel} para o funcionário ${f.nome}?`)) {
       const hoje = new Date().toISOString().split('T')[0];
       await salvarConta({
          unidade_id: unidadeAtiva,
          descricao: `${labelLabel}: ${f.nome} - ${f.cargo}`,
          valor: f.salario,
          data_vencimento: hoje,
          categoria: 'cmo',
          status: 'pago',
          data_pagamento: hoje
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
    fileInputRef.current.value = ""; 

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

  const abrirModalFolgas = async (f) => {
     setFuncParaFolgas(f);
     setModalFolgas(true);
     setNovaFolgaData("");
     
     const domingos = [];
     const hoje = new Date();
     const anoAtual = hoje.getFullYear();
     const mesAtual = hoje.getMonth();
     
     for(let i=1; i<=31; i++) {
        const d = new Date(Date.UTC(anoAtual, mesAtual, i, 12, 0, 0));
        if(d.getUTCMonth() !== mesAtual) break;
        if(d.getUTCDay() === 0) {
           const isoDate = d.toISOString().split('T')[0];
           if(!domingos.some(x => x.data === isoDate)) {
              domingos.push({
                 data: isoDate,
                 label: d.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', timeZone: 'UTC'})
              });
           }
        }
     }
     setDomingosProximos(domingos);

     const res = await fetchFolgasEsporadicas(f.id);
     setFolgasEsporadicas(res.data || []);
     
     const resTodas = await fetchAllFolgasDaUnidade(unidadeAtiva);
     setTodasFolgasDaUnidade(resTodas.data || []);
  };
  
  const handleAdicionarFolga = async (dataAdicionar, descricao) => {
     if(!dataAdicionar) return;
     const { error } = await inserirFolgaEsporadica(unidadeAtiva, funcParaFolgas.id, dataAdicionar, descricao);
     if (error) {
        alert("Erro ao salvar folga: " + error);
        return;
     }
     setNovaFolgaData("");
     
     const res = await fetchFolgasEsporadicas(funcParaFolgas.id);
     setFolgasEsporadicas(res.data || []);
     const resTodas = await fetchAllFolgasDaUnidade(unidadeAtiva);
     setTodasFolgasDaUnidade(resTodas.data || []);
  };

  const handleRemoverFolga = async (id) => {
     if(confirm("Remover esta folga?")) {
        const { error } = await removerFolgaEsporadica(id);
        if (error) {
           alert("Erro ao remover: " + error);
           return;
        }
        const res = await fetchFolgasEsporadicas(funcParaFolgas.id);
        setFolgasEsporadicas(res.data || []);
        const resTodas = await fetchAllFolgasDaUnidade(unidadeAtiva);
        setTodasFolgasDaUnidade(resTodas.data || []);
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
         
         <div className="flex gap-4 mb-4">
            <button onClick={()=>setAbaAtiva("Fixo")} className={`flex-1 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${abaAtiva === "Fixo" ? "bg-slate-800 text-white shadow-lg shadow-slate-800/20" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"}`}>Equipe Fixa</button>
            <button onClick={()=>setAbaAtiva("Freelancer")} className={`flex-1 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${abaAtiva === "Freelancer" ? "bg-slate-800 text-white shadow-lg shadow-slate-800/20" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"}`}>Freelancers Extras</button>
         </div>

         <div className="bg-white p-4 rounded-t-3xl border border-slate-200 border-b-0 flex items-center gap-3">
            <Search size={18} className="text-slate-500" />
            <input type="text" placeholder="Buscar funcionário..." value={busca} onChange={e=>setBusca(e.target.value)} className="flex-1 outline-none font-medium text-slate-700" />
         </div>

         <div className="bg-white rounded-b-3xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                     <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Colaborador</th>
                     <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Perfil & Contato</th>
                     <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">{abaAtiva === "Freelancer" ? "Diária Base" : "Remuneração Base"}</th>
                     <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Ponto Hoje</th>
                     <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Documentos / Ações</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {loading && <tr><td colSpan={5} className="p-10 text-center text-slate-500 font-bold">Carregando...</td></tr>}
                  {!loading && filtrados.map(f => (
                     <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                           <div className="font-black text-slate-800 text-base">{f.nome}</div>
                           {f.tipo_contrato === "Freelancer" && (
                              <div className="flex text-amber-400 mt-1">
                                 {[...Array(5)].map((_, i) => (
                                    <Star key={i} size={12} className={i < (f.avaliacao_estrelas || 0) ? "fill-amber-400" : "text-slate-200"} />
                                 ))}
                              </div>
                           )}
                           {f.anotacoes_rh && <div className="text-[10px] font-bold text-slate-400 mt-1 flex items-start gap-1"><ClipboardList size={10} className="mt-0.5 shrink-0"/> <span className="line-clamp-1">{f.anotacoes_rh}</span></div>}
                        </td>
                        <td className="p-4">
                           <div className="font-bold text-slate-700">{f.cargo}</div>
                           {f.telefone && <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mt-1"><Phone size={10}/> {f.telefone}</div>}
                           {f.chave_pix && <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mt-0.5"><CreditCard size={10}/> PIX: {f.chave_pix}</div>}
                           {(() => {
                              const badges = calcularProgresso(f);
                              if(!badges || badges.length === 0) return null;
                              return (
                                 <div className="flex flex-col gap-1 mt-2">
                                    {badges.map((b, idx) => (
                                       <div key={idx} className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-block w-fit ${b.color}`}>
                                          <Clock size={10} className="inline mr-1 -mt-0.5" />
                                          {b.text}
                                       </div>
                                    ))}
                                 </div>
                              );
                           })()}
                        </td>
                        <td className="p-4 font-black text-emerald-700">{fmtBRL(f.salario)}</td>
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
                                 if (m < 0) m += 24 * 60; 
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
                                 if (minVolta < minSaida) minVolta += 24 * 60; 
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
                                 <button onClick={() => router.push(`/dashboard/rh/contrato/${f.id}`)} className="flex items-center gap-1 text-xs font-black text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors">
                                    <FileText size={14}/> Regulamento
                                 </button>
                                 <button onClick={() => abrirModalFolgas(f)} className="flex items-center gap-1 text-xs font-black text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg hover:bg-rose-100 transition-colors">
                                    <CalendarHeart size={14}/> Folgas
                                 </button>
                                 <button onClick={() => abrirModalConsumo(f)} className="flex items-center gap-1 text-xs font-black text-teal-600 bg-teal-50 px-3 py-1.5 rounded-lg hover:bg-teal-100 transition-colors">
                                    <ShoppingBag size={14}/> Consumo / Vales
                                 </button>
                                 <button onClick={() => handleLancarFinanceiro(f)} className="flex items-center gap-1 text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors">
                                    Lançar {f.tipo_contrato === "Freelancer" ? "Diária" : "Salário"}
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
            <div className="bg-white rounded-[32px] w-full max-w-md p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[95vh] overflow-hidden">
               <div className="flex justify-between items-center mb-6 shrink-0 border-b border-slate-100 pb-4">
                  <h2 className="font-black text-2xl text-slate-800">{editandoId ? "Editar Colaborador" : "Novo Funcionário"}</h2>
                  <button onClick={() => setModalNovo(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="space-y-4 flex-1 overflow-y-auto pr-2 pb-4 custom-scrollbar">
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Tipo de Contrato</label>
                        <select value={novoFunc.tipo_contrato} onChange={e=>setNovoFunc({...novoFunc, tipo_contrato: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500 text-slate-700 appearance-none">
                           <option value="Fixo">Equipe Fixa (CLT/Mensalista)</option>
                           <option value="Freelancer">Freelancer / Extra (Diária)</option>
                        </select>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome Completo</label>
                        <input type="text" value={novoFunc.nome} onChange={e=>setNovoFunc({...novoFunc, nome: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Função / Cargo</label>
                     {cargos.length > 0 ? (
                       <select value={novoFunc.cargo} onChange={e=>setNovoFunc({...novoFunc, cargo: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500 appearance-none text-slate-700">
                          <option value="">Selecione um Cargo</option>
                          {cargos.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                       </select>
                     ) : (
                       <input type="text" value={novoFunc.cargo} onChange={e=>setNovoFunc({...novoFunc, cargo: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500" placeholder="Digite ou crie cargos nas Configurações" />
                     )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Telefone / WhatsApp</label>
                        <input type="text" value={novoFunc.telefone} onChange={e=>setNovoFunc({...novoFunc, telefone: e.target.value})} placeholder="(00) 00000-0000" className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">CPF</label>
                        <input type="text" value={novoFunc.cpf} onChange={e=>setNovoFunc({...novoFunc, cpf: e.target.value})} placeholder="000.000.000-00" className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Chave PIX</label>
                        <input type="text" value={novoFunc.chave_pix} onChange={e=>setNovoFunc({...novoFunc, chave_pix: e.target.value})} placeholder="Chave para pagamento" className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{novoFunc.tipo_contrato === "Freelancer" ? "Valor da Diária Base (R$)" : "Salário Base (R$)"}</label>
                        <input type="number" value={novoFunc.salario} onChange={e=>setNovoFunc({...novoFunc, salario: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-black text-emerald-600 outline-none focus:border-emerald-500"/>
                     </div>
                  </div>

                  {novoFunc.tipo_contrato === "Fixo" && (
                     <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 mt-4 bg-indigo-50/30 p-4 rounded-2xl">
                        <div>
                           <label className="text-xs font-bold text-indigo-600 uppercase tracking-widest block mb-1">Data de Admissão</label>
                           <input type="date" value={novoFunc.data_admissao || ""} onChange={e=>setNovoFunc({...novoFunc, data_admissao: e.target.value})} className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-500 text-slate-700"/>
                        </div>
                        <div>
                           <label className="text-xs font-bold text-indigo-600 uppercase tracking-widest block mb-1">Fase do Contrato</label>
                           <select value={novoFunc.status_contrato} onChange={e=>setNovoFunc({...novoFunc, status_contrato: e.target.value})} className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-500 text-slate-700 appearance-none">
                              <option value="Experiência (30 dias)">Experiência (30 dias)</option>
                              <option value="Experiência (45 dias)">Experiência (45 dias)</option>
                              <option value="Experiência (90 dias)">Experiência (90 dias)</option>
                              <option value="Definitivo">Contrato Definitivo</option>
                           </select>
                        </div>
                     </div>
                  )}

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
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Dias Trabalho</label>
                        <div className="flex flex-wrap gap-1">
                           {[ {v:'0',l:'D'},{v:'1',l:'S'},{v:'2',l:'T'},{v:'3',l:'Q'},{v:'4',l:'Q'},{v:'5',l:'S'},{v:'6',l:'S'} ].map(dia => {
                              const selecionados = novoFunc.dias_trabalho ? novoFunc.dias_trabalho.split(',') : [];
                              const ativo = selecionados.includes(dia.v);
                              return (
                                 <button key={dia.v} type="button" onClick={() => {
                                    let novos = [...selecionados];
                                    if(ativo) novos = novos.filter(d => d !== dia.v);
                                    else novos.push(dia.v);
                                    setNovoFunc({...novoFunc, dias_trabalho: novos.sort().join(',')});
                                 }} className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-all ${ativo ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                                    {dia.l}
                                 </button>
                              );
                           })}
                        </div>
                     </div>
                     <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Intervalo (Minutos)</label>
                        <input type="number" value={novoFunc.tempo_intervalo || ""} onChange={e=>setNovoFunc({...novoFunc, tempo_intervalo: e.target.value})} placeholder="Ex: 60" className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                     </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4 mt-4">
                     {novoFunc.tipo_contrato === "Freelancer" && (
                        <div className="mb-4">
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Avaliação do Freelancer (Estrelas)</label>
                           <div className="flex gap-2">
                              {[1,2,3,4,5].map(star => (
                                 <button key={star} type="button" onClick={() => setNovoFunc({...novoFunc, avaliacao_estrelas: star})} className={`p-2 rounded-lg transition-colors ${novoFunc.avaliacao_estrelas >= star ? 'bg-amber-100 text-amber-500' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`}>
                                    <Star size={24} className={novoFunc.avaliacao_estrelas >= star ? 'fill-amber-500' : ''} />
                                 </button>
                              ))}
                           </div>
                        </div>
                     )}
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Anotações / Ocorrências (Oculto para o funcionário)</label>
                        <textarea value={novoFunc.anotacoes_rh} onChange={e=>setNovoFunc({...novoFunc, anotacoes_rh: e.target.value})} rows="3" placeholder="Registre advertências, faltas não justificadas, comportamento, etc..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500 text-slate-700 resize-none"></textarea>
                     </div>
                  </div>
               </div>

               <div className="mt-4 pt-4 border-t border-slate-100 shrink-0">
                  <button onClick={handleSalvar} disabled={!novoFunc.nome} className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95">
                     {editandoId ? "Salvar Alterações" : "Salvar Colaborador"}
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* Modal Gerenciar Folgas */}
      {modalFolgas && funcParaFolgas && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-[800px] p-8 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-hidden flex flex-col">
               <div className="flex justify-between items-center mb-6 shrink-0">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">Gerenciar Folgas</h2>
                     <p className="text-xs font-bold text-slate-500">{funcParaFolgas.nome}</p>
                  </div>
                  <button onClick={() => setModalFolgas(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Coluna 1: Adicionar Folgas */}
                  <div>
                     <div className="bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-100">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Folgas Fixas (Semanais)</p>
                        <p className="text-sm font-medium text-slate-700 leading-snug">
                           As folgas semanais de <b>{funcParaFolgas.nome}</b> são os dias da semana que NÃO estão marcados na ficha de contratação.
                        </p>
                     </div>

                     <div className="mb-6">
                        <label className="text-xs font-bold text-indigo-600 uppercase tracking-widest block mb-2">Folga Dominical (1 ao Mês)</label>
                        <div className="space-y-2">
                           {domingosProximos.map(dom => {
                              // Verifica conflitos com outras pessoas
                              const folgasNestaData = todasFolgasDaUnidade.filter(f => f.data_folga === dom.data && f.colaborador_id !== funcParaFolgas.id);
                              const nomesConflito = folgasNestaData.map(f => {
                                 const colab = funcionarios.find(func => func.id === f.colaborador_id);
                                 return colab ? colab.nome : "Desconhecido";
                              }).join(", ");
                              const hasConflito = folgasNestaData.length > 0;
                              const jaTemFolgaNesteDia = folgasEsporadicas.some(f => f.data_folga === dom.data);

                              return (
                                 <div key={dom.data} className="flex flex-col bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                                    <div className="flex items-center justify-between mb-1">
                                       <span className="font-bold text-slate-700">Dom, {dom.label}</span>
                                       <button 
                                          onClick={() => handleAdicionarFolga(dom.data, "Domingo")} 
                                          disabled={jaTemFolgaNesteDia}
                                          className="bg-indigo-50 text-indigo-700 px-3 py-1 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                          {jaTemFolgaNesteDia ? "Agendado" : "Agendar"}
                                       </button>
                                    </div>
                                    {hasConflito && (
                                       <span className="text-[10px] font-bold text-rose-500">
                                          Aviso: {folgasNestaData.length} funcionário(s) de folga ({nomesConflito})
                                       </span>
                                    )}
                                 </div>
                              )
                           })}
                        </div>
                     </div>

                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Folga Extra (Feriado ou Outro)</label>
                        <div className="flex gap-2">
                           <input type="date" value={novaFolgaData} onChange={e=>setNovaFolgaData(e.target.value)} className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500 text-slate-700"/>
                           <button onClick={() => handleAdicionarFolga(novaFolgaData, "Extra / Feriado")} className="bg-emerald-600 text-white px-4 font-bold rounded-xl hover:bg-emerald-700 transition-colors">Adicionar</button>
                        </div>
                     </div>
                  </div>

                  {/* Coluna 2: Folgas Agendadas */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
                     <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-4 border-b border-slate-200 pb-2">Folgas Extras Agendadas</h3>
                     <div className="space-y-3">
                        {folgasEsporadicas.length === 0 ? (
                           <p className="text-center text-sm font-bold text-slate-400 py-4">Nenhuma folga extra agendada.</p>
                        ) : folgasEsporadicas.map(folga => (
                           <div key={folga.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                              <div>
                                 <div className="font-black text-slate-700">{new Date(folga.data_folga).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</div>
                                 <div className="text-[10px] font-bold text-indigo-500 uppercase">{folga.descricao || "Folga Extra"}</div>
                              </div>
                              <button onClick={() => handleRemoverFolga(folga.id)} className="text-slate-400 hover:text-rose-600 transition-colors bg-slate-50 p-2 rounded-lg"><Trash2 size={16}/></button>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* Modal Consumo de Funcionários (Vales / Lanches / etc) */}
      {modalConsumo && funcionarioConsumo && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-[900px] p-8 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-hidden flex flex-col">
               <div className="flex justify-between items-center mb-6 shrink-0 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                     <div className="w-12 h-12 bg-teal-100 text-teal-600 rounded-2xl flex items-center justify-center">
                        <ShoppingBag size={24} />
                     </div>
                     <div>
                        <h2 className="font-black text-2xl text-slate-800">Consumo & Vales</h2>
                        <p className="text-xs font-bold text-slate-500">{funcionarioConsumo.nome}</p>
                     </div>
                  </div>
                  <button onClick={() => setModalConsumo(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"><X size={20}/></button>
               </div>

               <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Lado Esquerdo: Adicionar Consumo */}
                  <div className="flex flex-col">
                     <div className="bg-teal-50 p-4 rounded-2xl mb-6 border border-teal-100">
                        <p className="text-xs font-bold text-teal-700 uppercase tracking-widest mb-1">20% de Desconto Automático</p>
                        <p className="text-sm font-medium text-teal-800 leading-snug">
                           Os funcionários têm desconto em produtos e refeições. O sistema calculará o valor a pagar com base no valor original informado.
                        </p>
                     </div>

                     <div className="space-y-4 flex-1">
                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Descrição do Consumo</label>
                           <input type="text" value={novoConsumo.descricao} onChange={e=>setNovoConsumo({...novoConsumo, descricao: e.target.value})} placeholder="Ex: Almoço, Cerveja, Hambúrguer..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-teal-500 text-slate-700"/>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Data / Hora</label>
                              <input type="datetime-local" value={novoConsumo.data_consumo} onChange={e=>setNovoConsumo({...novoConsumo, data_consumo: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-teal-500 text-slate-700"/>
                           </div>
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Valor Original (R$)</label>
                              <input type="number" step="0.01" value={novoConsumo.valor_original} onChange={e=>setNovoConsumo({...novoConsumo, valor_original: e.target.value})} placeholder="Ex: 50.00" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-700 outline-none focus:border-teal-500"/>
                           </div>
                        </div>

                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Forma de Pagamento</label>
                           <select value={novoConsumo.forma_pagamento} onChange={e=>setNovoConsumo({...novoConsumo, forma_pagamento: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-teal-500 text-slate-700 appearance-none">
                              <option value="Desconto em Folha">Desconto em Folha (Fica Pendente)</option>
                              <option value="Dinheiro">Dinheiro (Pago na hora)</option>
                              <option value="Pix">PIX (Pago na hora)</option>
                              <option value="Cartão">Cartão (Pago na hora)</option>
                           </select>
                        </div>
                     </div>

                     <div className="mt-6 pt-6 border-t border-slate-100">
                        {novoConsumo.valor_original && (
                           <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl text-white mb-4">
                              <span className="font-bold">Total a Pagar (com 20% desc.):</span>
                              <span className="font-black text-xl text-emerald-400">{fmtBRL(Number(novoConsumo.valor_original) * 0.8)}</span>
                           </div>
                        )}
                        <button onClick={salvarConsumo} disabled={!novoConsumo.descricao || !novoConsumo.valor_original} className="w-full py-4 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-teal-600/20 active:scale-95">
                           Lançar Consumo
                        </button>
                     </div>
                  </div>

                  {/* Lado Direito: Histórico */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 flex flex-col h-full overflow-hidden">
                     <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-4 border-b border-slate-200 pb-2 flex items-center justify-between">
                        <span>Extrato de Consumo</span>
                        {listaConsumo.length > 0 && (
                           <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{listaConsumo.length} itens</span>
                        )}
                     </h3>
                     
                     <div className="space-y-3 overflow-y-auto flex-1 pr-1 pb-4">
                        {loadingConsumo && <p className="text-center text-sm font-bold text-slate-400 py-4">Carregando histórico...</p>}
                        {!loadingConsumo && listaConsumo.length === 0 && (
                           <p className="text-center text-sm font-bold text-slate-400 py-4 flex flex-col items-center">
                              <Store size={32} className="text-slate-300 mb-2"/>
                              Nenhum consumo registrado.
                           </p>
                        )}
                        {!loadingConsumo && listaConsumo.map(item => {
                           const isPago = item.status_pagamento === "Pago";
                           return (
                              <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm relative group">
                                 <div className="flex justify-between items-start mb-2">
                                    <div>
                                       <div className="font-black text-slate-800 leading-tight">{item.descricao}</div>
                                       <div className="text-[10px] font-bold text-slate-400">
                                          {new Date(item.data_consumo).toLocaleString('pt-BR')}
                                       </div>
                                    </div>
                                    <div className="text-right">
                                       <div className="font-black text-teal-700">{fmtBRL(item.valor_desconto)}</div>
                                       <div className="text-[10px] font-medium text-slate-400 line-through">De {fmtBRL(item.valor_original)}</div>
                                    </div>
                                 </div>
                                 
                                 <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                                    <div className="flex items-center gap-2">
                                       {isPago ? (
                                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                                             <CheckCircle size={10}/> PAGO
                                          </span>
                                       ) : (
                                          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                                             <Clock size={10}/> PENDENTE
                                          </span>
                                       )}
                                       
                                       <select 
                                          value={item.forma_pagamento} 
                                          onChange={(e) => alterarFormaPagamentoConsumo(item.id, item.status_pagamento, e.target.value)}
                                          className="text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-600 rounded-md px-1 py-1 outline-none focus:border-teal-500 max-w-[120px]"
                                       >
                                          <option value="Desconto em Folha">Desconto em Folha</option>
                                          <option value="Dinheiro">Dinheiro</option>
                                          <option value="PIX">PIX</option>
                                          <option value="Cartão">Cartão</option>
                                       </select>
                                       
                                       {!isPago && (
                                          <button onClick={() => quitarConsumo(item.id)} className="text-[10px] font-bold uppercase tracking-wider text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-md transition-colors">
                                             Quitar agora
                                          </button>
                                       )}
                                    </div>
                                    
                                    <button onClick={() => apagarConsumo(item.id)} className="text-slate-400 hover:text-rose-600 transition-colors bg-slate-50 p-1.5 rounded-lg opacity-0 group-hover:opacity-100">
                                       <Trash2 size={14}/>
                                    </button>
                                 </div>
                              </div>
                           )
                        })}
                     </div>
                     
                     {!loadingConsumo && listaConsumo.length > 0 && (
                        <div className="pt-4 border-t border-slate-200 mt-2">
                           <div className="flex justify-between items-center text-sm">
                              <span className="font-bold text-slate-500 uppercase tracking-widest text-xs">Total Pendente</span>
                              <span className="font-black text-rose-600 text-lg">
                                 {fmtBRL(listaConsumo.filter(i => i.status_pagamento !== "Pago").reduce((acc, curr) => acc + curr.valor_desconto, 0))}
                              </span>
                           </div>
                        </div>
                     )}
                  </div>
               </div>
            </div>
         </div>
      )}

    </div>
  );
}
