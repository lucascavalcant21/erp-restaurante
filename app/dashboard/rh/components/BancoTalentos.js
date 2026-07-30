import { useState, useEffect } from "react";
import { fetchCandidatos, atualizarStatusCandidato, removerCandidato, fetchPortalVagasConfig, salvarPortalVagasConfig, PERGUNTAS_RECRUTAMENTO } from "../../../lib/recrutamento";
import { supabase } from "../../../lib/supabase";
import { Loader2, Search, ExternalLink, FileText, Trash2, ShieldAlert, X, Phone, MapPin, Briefcase, Pencil, Plus, Save, UserRound, GraduationCap, Baby, Car, MessageSquareText, CalendarDays, RefreshCw, Copy, Check } from "lucide-react";

const valorOuTraco = valor => valor === null || valor === undefined || valor === "" ? "Não informado" : String(valor);

function respostasDoCandidato(candidato) {
  const respostas = candidato?.respostas_comportamentais;
  if (!respostas) return {};
  if (typeof respostas === "object") return respostas;
  try {
    return JSON.parse(respostas);
  } catch {
    return {};
  }
}

function detalhesDoCandidato(candidato) {
  const respostas = respostasDoCandidato(candidato);
  const salvos = respostas._dados_pessoais && typeof respostas._dados_pessoais === "object"
    ? respostas._dados_pessoais
    : {};
  const detalhes = {
    ...salvos,
    cpf: salvos.cpf || candidato?.cpf,
    telefone: salvos.telefone || candidato?.telefone,
    enderecoCompleto: salvos.enderecoCompleto || candidato?.endereco,
    cargoPretendido: salvos.cargoPretendido || candidato?.cargo_pretendido,
    temFilhos: salvos.temFilhos || candidato?.tem_filhos,
    experiencia: salvos.experiencia || candidato?.experiencia,
  };

  if (!respostas._dados_pessoais && typeof candidato?.experiencia === "string" && candidato.experiencia.includes("|")) {
    const legado = {};
    candidato.experiencia.split("|").forEach(parte => {
      const [chave, ...resto] = parte.split(":");
      legado[chave.trim().toLowerCase()] = resto.join(":").trim();
    });
    detalhes.genero = detalhes.genero || legado["gênero"] || legado.genero;
    detalhes.escolaridade = detalhes.escolaridade || legado.escolaridade;
    const automovel = legado.carro;
    detalhes.temAutomovel = detalhes.temAutomovel || (automovel && automovel !== "Não" ? "Sim" : "Não");
    detalhes.qualAutomovel = detalhes.qualAutomovel || (automovel !== "Não" ? automovel : "");
    detalhes.qtdFilhos = detalhes.qtdFilhos || legado.filhos;
    detalhes.temFilhos = detalhes.temFilhos || (legado.filhos && legado.filhos !== "0" ? "Sim" : "Não");
    detalhes.experiencia = legado.exp || candidato.experiencia;
  }

  return detalhes;
}

function respostaFormatada(candidato, pergunta) {
  const resposta = respostasDoCandidato(candidato)[pergunta.id];
  const indice = Number(resposta);
  if (Number.isInteger(indice) && pergunta.opcoes[indice]) return pergunta.opcoes[indice];
  if (typeof resposta === "string" && resposta.trim()) {
    return pergunta.opcoes.find(opcao => opcao.texto === resposta) || { texto: resposta, tag: "" };
  }
  return null;
}

function dataHora(valor) {
  if (!valor) return "Data não informada";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data);
}

export default function BancoTalentos({ unidadeAtiva }) {
  const [candidatos, setCandidatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [candidatoAberto, setCandidatoAberto] = useState(null);
  const [editorPortal, setEditorPortal] = useState(null);
  const [salvandoPortal, setSalvandoPortal] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);

  const carregar = async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") {
      setCandidatos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await fetchCandidatos(unidadeAtiva);
    setCandidatos(data || []);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, [unidadeAtiva]);

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    const canal = supabase
      .channel(`candidatos-portal-${unidadeAtiva}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "candidatos",
        filter: `unidade_id=eq.${unidadeAtiva}`,
      }, carregar)
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [unidadeAtiva]);

  const handleDragStart = (e, id) => {
    e.dataTransfer.setData("candidato_id", id);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, novoStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("candidato_id");
    if (!id) return;

    // Otimista
    setCandidatos(prev => prev.map(c => c.id === id ? { ...c, status: novoStatus } : c));
    await atualizarStatusCandidato(id, novoStatus);
  };

  const colunas = [
    { nome: "Novo", status: "Novo", cor: "bg-blue-50", borda: "border-blue-200" },
    { nome: "Em Contato / Entrevista", status: "Entrevista Marcada", cor: "bg-amber-50", borda: "border-amber-200" },
    { nome: "Banco de Talentos", status: "Banco de Talentos", cor: "bg-emerald-50", borda: "border-emerald-200" },
    { nome: "Descartado", status: "Reprovado", cor: "bg-slate-50", borda: "border-slate-200" }
  ];

  const getCorNota = (nota) => {
    if (nota >= 80) return "text-emerald-600 bg-emerald-100";
    if (nota >= 50) return "text-amber-600 bg-amber-100";
    return "text-rose-600 bg-rose-100";
  };

  const abrirChecagemAntecedentes = (cpf) => {
    if (!cpf) return alert("Este candidato não informou o CPF.");
    // Copiar para o clipboard
    const cpfLimpo = cpf.replace(/\D/g, "");
    navigator.clipboard.writeText(cpfLimpo);
    alert(`O CPF ${cpf} foi copiado para a sua área de transferência!\n\nVocê será redirecionado para o portal do Governo (Gov.br) para emitir a certidão. Basta colar o CPF lá.`);
    window.open("https://www.gov.br/pt-br/servicos/emitir-certidao-de-antecedentes-criminais", "_blank");
  };

  const abrirEditorPortal = async () => {
    const { data, error } = await fetchPortalVagasConfig(unidadeAtiva);
    if (error) return alert("Não foi possível carregar a configuração: " + error);
    setEditorPortal(data);
  };

  const salvarEditorPortal = async () => {
    if (!editorPortal?.titulo?.trim()) return alert("Informe o título do portal.");
    if (!editorPortal.vagas?.some(vaga => vaga.cargo?.trim())) return alert("Cadastre pelo menos uma vaga.");
    setSalvandoPortal(true);
    const { error, data } = await salvarPortalVagasConfig(unidadeAtiva, editorPortal);
    setSalvandoPortal(false);
    if (error) return alert("Não foi possível salvar: " + error);
    setEditorPortal(data);
    alert("Portal de Vagas atualizado com sucesso.");
  };

  const copiarLinkPortal = async () => {
    const link = `${window.location.origin}/vagas/${unidadeAtiva}`;
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopiado(true);
      window.setTimeout(() => setLinkCopiado(false), 2500);
    } catch {
      window.prompt("Copie o link do Portal de Vagas:", link);
    }
  };

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return <div className="p-10 text-center font-bold text-slate-500 bg-white rounded-3xl border border-slate-200">Selecione uma loja específica no menu lateral para ver os candidatos.</div>;
  }

  const filtrados = candidatos.filter(c =>
    String(c.nome || "").toLowerCase().includes(busca.toLowerCase())
    || String(c.cargo_pretendido || "").toLowerCase().includes(busca.toLowerCase())
  );
  const detalhesAbertos = candidatoAberto ? detalhesDoCandidato(candidatoAberto) : null;

  return (
    <div className="animate-in fade-in">
      
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
         <div className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center gap-3 w-full max-w-md shadow-sm">
            <Search size={18} className="text-slate-500" />
            <input type="text" placeholder="Buscar por nome ou cargo..." value={busca} onChange={e=>setBusca(e.target.value)} className="flex-1 outline-none font-medium text-slate-700 text-sm" />
         </div>
         <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button type="button" onClick={carregar} disabled={loading} className="flex items-center justify-center gap-2 bg-white text-slate-600 px-4 py-3 rounded-2xl font-bold hover:bg-slate-50 transition-colors border border-slate-200 disabled:opacity-60 whitespace-nowrap">
               <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> Atualizar candidatos
            </button>
            <button type="button" onClick={abrirEditorPortal} className="flex items-center justify-center gap-2 bg-white text-slate-700 px-4 py-3 rounded-2xl font-bold hover:bg-slate-50 transition-colors border border-slate-200 whitespace-nowrap">
               <Pencil size={18} /> Editar Portal de Vagas
            </button>
            <a href={`/vagas/${unidadeAtiva}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-3 rounded-2xl font-bold hover:bg-indigo-100 transition-colors border border-indigo-200 whitespace-nowrap">
               <ExternalLink size={18} /> Acessar Portal de Vagas
            </a>
            <button type="button" onClick={copiarLinkPortal} className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold transition-colors border whitespace-nowrap ${linkCopiado ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"}`}>
               {linkCopiado ? <Check size={18} /> : <Copy size={18} />} {linkCopiado ? "Link copiado" : "Copiar link"}
            </button>
         </div>
      </div>

      {loading ? (
        <div className="p-20 text-center flex flex-col items-center text-slate-500">
           <Loader2 size={32} className="animate-spin mb-4 text-indigo-500" />
           <p className="font-bold">Carregando banco de talentos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start pb-10">
           {colunas.map(coluna => (
              <div 
                 key={coluna.status}
                 onDragOver={handleDragOver}
                 onDrop={(e) => handleDrop(e, coluna.status)}
                 className={`${coluna.cor} border ${coluna.borda} rounded-[24px] p-4 min-h-[500px] flex flex-col gap-3 shadow-inner`}
              >
                 <div className="flex justify-between items-center mb-2 px-2">
                    <h3 className="font-black text-slate-700 uppercase tracking-widest text-xs">{coluna.nome}</h3>
                    <span className="bg-white px-2 py-0.5 rounded-full text-xs font-bold text-slate-500 shadow-sm border border-slate-200">
                       {filtrados.filter(c => c.status === coluna.status).length}
                    </span>
                 </div>

                 {filtrados.filter(c => c.status === coluna.status).map(c => (
                    <div 
                       key={c.id} 
                       draggable
                       onDragStart={(e) => handleDragStart(e, c.id)}
                       onClick={() => setCandidatoAberto(c)}
                       className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm cursor-grab active:cursor-grabbing hover:border-indigo-300 hover:shadow-md transition-all group"
                    >
                       <div className="flex justify-between items-start mb-2">
                          <p className="font-black text-sm text-slate-800 line-clamp-1">{c.nome}</p>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${getCorNota(c.nota_ia)}`}>
                             {c.nota_ia} pts
                          </span>
                       </div>
                       <p className="text-xs font-bold text-slate-500 mb-3">{c.cargo_pretendido}</p>
                       <div className="flex gap-2">
                          {c.url_curriculo && <div className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded font-bold flex items-center gap-1"><FileText size={10}/> Tem CV</div>}
                          {c.tem_filhos === "Sim" && <div className="text-[10px] bg-rose-50 text-rose-600 px-2 py-1 rounded font-bold border border-rose-100">Tem Filhos</div>}
                       </div>
                    </div>
                 ))}
              </div>
           ))}
        </div>
      )}

      {editorPortal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-5">
          <div className="bg-white rounded-[28px] w-full max-w-4xl max-h-[94vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between gap-4 px-5 sm:px-7 py-5 border-b border-slate-100">
              <div>
                <h2 className="font-black text-xl sm:text-2xl text-slate-800">Editar Portal de Vagas</h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">As alterações aparecem no portal público desta unidade.</p>
              </div>
              <button type="button" onClick={() => setEditorPortal(null)} className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 grid place-items-center hover:bg-slate-200"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Título</span>
                  <input value={editorPortal.titulo} onChange={e => setEditorPortal({ ...editorPortal, titulo: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-bold outline-none focus:border-indigo-500" />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Mensagem depois da candidatura</span>
                  <input value={editorPortal.mensagem_sucesso} onChange={e => setEditorPortal({ ...editorPortal, mensagem_sucesso: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-medium outline-none focus:border-indigo-500" />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Apresentação do portal</span>
                  <textarea rows={3} value={editorPortal.subtitulo} onChange={e => setEditorPortal({ ...editorPortal, subtitulo: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-medium outline-none focus:border-indigo-500 resize-y" />
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-black text-lg text-slate-800">Vagas disponíveis</h3>
                    <p className="text-xs text-slate-500">Edite cargo, quantidade, remuneração, benefícios e jornada.</p>
                  </div>
                  <button type="button" onClick={() => setEditorPortal({
                    ...editorPortal,
                    vagas: [...editorPortal.vagas, { id: `vaga-${Date.now()}`, cargo: "", quantidade: 1, salario: "", alimentacao: "", taxa: "", jornada: "", ativa: true }],
                  })} className="flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-2 text-xs font-black">
                    <Plus size={15} /> Nova vaga
                  </button>
                </div>

                <div className="space-y-3">
                  {editorPortal.vagas.map((vaga, index) => (
                    <div key={vaga.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[
                          ["cargo", "Cargo"],
                          ["salario", "Salário"],
                          ["alimentacao", "Vale-alimentação"],
                          ["taxa", "Taxa de serviço"],
                          ["jornada", "Jornada"],
                        ].map(([campo, label]) => (
                          <label key={campo} className="block">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
                            <input value={vaga[campo]} onChange={e => setEditorPortal({
                              ...editorPortal,
                              vagas: editorPortal.vagas.map((item, i) => i === index ? { ...item, [campo]: e.target.value } : item),
                            })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-bold outline-none focus:border-indigo-500" />
                          </label>
                        ))}
                        <label className="block">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Quantidade</span>
                          <input type="number" min="1" value={vaga.quantidade} onChange={e => setEditorPortal({
                            ...editorPortal,
                            vagas: editorPortal.vagas.map((item, i) => i === index ? { ...item, quantidade: Number(e.target.value) || 1 } : item),
                          })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-bold outline-none focus:border-indigo-500" />
                        </label>
                      </div>
                      <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-200">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                          <input type="checkbox" checked={vaga.ativa} onChange={e => setEditorPortal({
                            ...editorPortal,
                            vagas: editorPortal.vagas.map((item, i) => i === index ? { ...item, ativa: e.target.checked } : item),
                          })} />
                          Exibir no portal
                        </label>
                        <button type="button" onClick={() => setEditorPortal({ ...editorPortal, vagas: editorPortal.vagas.filter((_, i) => i !== index) })} className="flex items-center gap-1.5 text-xs font-black text-rose-600 hover:text-rose-700">
                          <Trash2 size={14} /> Excluir vaga
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 sm:px-7 py-4 border-t border-slate-100 bg-white">
              <button type="button" onClick={() => setEditorPortal(null)} className="px-5 py-3 rounded-xl border border-slate-200 font-bold text-slate-600">Fechar</button>
              <button type="button" disabled={salvandoPortal} onClick={salvarEditorPortal} className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-black flex items-center justify-center gap-2 disabled:opacity-60">
                {salvandoPortal ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} Salvar alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Perfil Completo */}
      {candidatoAberto && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-4xl p-5 sm:p-8 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[95vh] overflow-hidden">
               <div className="flex justify-between items-start mb-6 shrink-0 border-b border-slate-100 pb-4">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">{candidatoAberto.nome}</h2>
                     <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest">{candidatoAberto.cargo_pretendido}</p>
                     <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5"><CalendarDays size={13} /> Candidatura recebida em {dataHora(candidatoAberto.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                     <button onClick={async () => {
                        if(confirm("Tem certeza que deseja apagar este candidato?")) {
                           await removerCandidato(candidatoAberto.id);
                           setCandidatos(prev => prev.filter(c => c.id !== candidatoAberto.id));
                           setCandidatoAberto(null);
                        }
                     }} className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 hover:bg-rose-100"><Trash2 size={18}/></button>
                     <button onClick={() => setCandidatoAberto(null)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto pr-2 pb-4 space-y-6 custom-scrollbar">
                  
                  <section>
                     <h3 className="font-black text-lg text-slate-800 mb-3">Dados pessoais</h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[
                           { label: "Telefone / WhatsApp", value: detalhesAbertos.telefone, icon: Phone },
                           { label: "CPF", value: detalhesAbertos.cpf, icon: UserRound },
                           { label: "Gênero", value: detalhesAbertos.genero, icon: UserRound },
                           { label: "Escolaridade", value: detalhesAbertos.escolaridade, icon: GraduationCap },
                           { label: "Tem filhos", value: detalhesAbertos.temFilhos === "Sim" ? `Sim (${valorOuTraco(detalhesAbertos.qtdFilhos)})` : detalhesAbertos.temFilhos, icon: Baby },
                           { label: "Automóvel", value: detalhesAbertos.temAutomovel === "Sim" ? `Sim — ${valorOuTraco(detalhesAbertos.qualAutomovel)}` : detalhesAbertos.temAutomovel, icon: Car },
                        ].map(({ label, value, icon: Icon }) => (
                           <div key={label} className="flex items-start gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 min-w-0">
                              <Icon size={19} className="text-slate-400 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
                                 <p className="font-black text-sm text-slate-700 break-words">{valorOuTraco(value)}</p>
                              </div>
                           </div>
                        ))}
                     </div>
                  </section>

                  <section>
                     <h3 className="font-black text-lg text-slate-800 mb-3">Endereço informado</h3>
                     <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <MapPin size={20} className="text-slate-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                           <p className="font-black text-slate-700 break-words">{valorOuTraco(detalhesAbertos.enderecoCompleto)}</p>
                           {(detalhesAbertos.cidade || detalhesAbertos.estado) && (
                              <p className="text-xs font-bold text-slate-500 mt-1">
                                 {[detalhesAbertos.rua, detalhesAbertos.numero, detalhesAbertos.bairro, detalhesAbertos.cidade, detalhesAbertos.estado].filter(Boolean).join(" • ")}
                              </p>
                           )}
                        </div>
                     </div>
                  </section>

                  <section>
                     <h3 className="font-black text-lg text-slate-800 mb-3">Vaga e experiência profissional</h3>
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="flex items-start gap-3 bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                           <Briefcase size={20} className="text-indigo-500 shrink-0 mt-0.5" />
                           <div>
                              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Cargo pretendido</p>
                              <p className="font-black text-indigo-800">{valorOuTraco(detalhesAbertos.cargoPretendido)}</p>
                           </div>
                        </div>
                        <div className="sm:col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Experiência declarada</p>
                           <p className="font-bold text-sm text-slate-700 whitespace-pre-wrap">{valorOuTraco(detalhesAbertos.experiencia)}</p>
                        </div>
                     </div>
                  </section>

                  <section>
                     <h3 className="font-black text-lg text-slate-800 mb-3 flex items-center gap-2"><MessageSquareText size={20} className="text-indigo-500" /> Respostas do teste de perfil</h3>
                     <div className="space-y-3">
                        {PERGUNTAS_RECRUTAMENTO.map((pergunta, index) => {
                           const resposta = respostaFormatada(candidatoAberto, pergunta);
                           return (
                              <div key={pergunta.id} className="rounded-2xl border border-slate-200 p-4 bg-white">
                                 <p className="text-xs font-black text-slate-500 mb-2">{index + 1}. {pergunta.pergunta}</p>
                                 {resposta ? (
                                    <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                                       <p className="font-bold text-sm text-emerald-900">{resposta.texto}</p>
                                       {resposta.tag && <span className="inline-flex mt-2 text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-white border border-emerald-200 rounded-full px-2 py-1">{resposta.tag}</span>}
                                    </div>
                                 ) : (
                                    <p className="text-sm font-bold text-slate-400 bg-slate-50 rounded-xl p-3">Resposta não disponível neste cadastro antigo.</p>
                                 )}
                              </div>
                           );
                        })}
                     </div>
                  </section>

                  {/* Laudo IA */}
                  <div>
                     <h3 className="font-black text-lg text-slate-800 mb-3 flex items-center gap-2">
                        <span className={`text-sm px-2 py-1 rounded-lg ${getCorNota(candidatoAberto.nota_ia)}`}>Nota: {candidatoAberto.nota_ia}</span>
                        Parecer do Sistema
                     </h3>
                     <div className="bg-slate-800 text-slate-200 p-5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap font-medium">
                        {candidatoAberto.avaliacao_ia}
                     </div>
                  </div>

                  {/* Ações */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-6">
                     <button onClick={() => abrirChecagemAntecedentes(candidatoAberto.cpf)} className="flex items-center justify-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 px-4 py-4 rounded-xl font-black transition-colors">
                        <ShieldAlert size={18} />
                        Checar Antecedentes
                     </button>
                     {candidatoAberto.url_curriculo ? (
                        <a href={candidatoAberto.url_curriculo} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 px-4 py-4 rounded-xl font-black transition-colors">
                           <FileText size={18} />
                           Visualizar Currículo (PDF)
                        </a>
                     ) : (
                        <div className="flex items-center justify-center gap-2 bg-slate-50 text-slate-400 border border-slate-200 px-4 py-4 rounded-xl font-black cursor-not-allowed">
                           <FileText size={18} />
                           Sem Currículo Anexado
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
