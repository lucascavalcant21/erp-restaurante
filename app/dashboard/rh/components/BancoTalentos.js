import { useState, useEffect } from "react";
import { fetchCandidatos, atualizarStatusCandidato, removerCandidato } from "../../../../lib/recrutamento";
import { Loader2, Search, ExternalLink, FileText, Trash2, ShieldAlert, X, Phone, MapPin, Briefcase } from "lucide-react";

export default function BancoTalentos({ unidadeAtiva }) {
  const [candidatos, setCandidatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [candidatoAberto, setCandidatoAberto] = useState(null);

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
    // Copiar para o clipboard
    const cpfLimpo = cpf.replace(/\D/g, "");
    navigator.clipboard.writeText(cpfLimpo);
    alert(`O CPF ${cpf} foi copiado para a sua área de transferência!\n\nVocê será redirecionado para o portal do Governo (Gov.br) para emitir a certidão. Basta colar o CPF lá.`);
    window.open("https://www.gov.br/pt-br/servicos/emitir-certidao-de-antecedentes-criminais", "_blank");
  };

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return <div className="p-10 text-center font-bold text-slate-500 bg-white rounded-3xl border border-slate-200">Selecione uma loja específica no menu lateral para ver os candidatos.</div>;
  }

  const filtrados = candidatos.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()) || c.cargo_pretendido.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="animate-in fade-in">
      
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
         <div className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center gap-3 w-full max-w-md shadow-sm">
            <Search size={18} className="text-slate-500" />
            <input type="text" placeholder="Buscar por nome ou cargo..." value={busca} onChange={e=>setBusca(e.target.value)} className="flex-1 outline-none font-medium text-slate-700 text-sm" />
         </div>
         <a href={`/vagas/${unidadeAtiva}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-3 rounded-2xl font-bold hover:bg-indigo-100 transition-colors border border-indigo-200 whitespace-nowrap">
            <ExternalLink size={18} /> Acessar Portal de Vagas
         </a>
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

      {/* Modal Perfil Completo */}
      {candidatoAberto && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-2xl p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[95vh] overflow-hidden">
               <div className="flex justify-between items-start mb-6 shrink-0 border-b border-slate-100 pb-4">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">{candidatoAberto.nome}</h2>
                     <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest">{candidatoAberto.cargo_pretendido}</p>
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
                  
                  {/* Info Pessoais */}
                  <div className="grid grid-cols-2 gap-4">
                     <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <Phone size={20} className="text-slate-400" />
                        <div>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Telefone / WhatsApp</p>
                           <p className="font-black text-slate-700">{candidatoAberto.telefone}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <Briefcase size={20} className="text-slate-400" />
                        <div>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Experiência</p>
                           <p className="font-black text-slate-700 line-clamp-2">{candidatoAberto.experiencia}</p>
                        </div>
                     </div>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                     <MapPin size={20} className="text-slate-400 shrink-0" />
                     <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Endereço</p>
                        <p className="font-black text-slate-700">{candidatoAberto.endereco}</p>
                     </div>
                  </div>

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
