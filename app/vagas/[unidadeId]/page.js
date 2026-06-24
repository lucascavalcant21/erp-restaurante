"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import { enviarCandidatura, PERGUNTAS_RECRUTAMENTO } from "../../lib/recrutamento";
import { Upload, CheckCircle, Send, FileText, User, MapPin, Briefcase, ChevronRight, Store, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function VagasPage() {
  const params = useParams();
  const unidadeId = params.unidadeId;

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const [dadosPessoais, setDadosPessoais] = useState({
    nome: "",
    cpf: "",
    telefone: "",
    endereco: "",
    cargoPretendido: "Garçom/Garçonete",
    temFilhos: "Não",
    experiencia: ""
  });

  const [respostas, setRespostas] = useState({});
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleNextStep = () => {
    if (step === 1) {
      if (!dadosPessoais.nome || !dadosPessoais.telefone || !dadosPessoais.cpf || !dadosPessoais.endereco || !dadosPessoais.experiencia) {
        return alert("Preencha todos os campos obrigatórios.");
      }
    }
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    if (Object.keys(respostas).length < PERGUNTAS_RECRUTAMENTO.length) {
      return alert("Por favor, responda todas as perguntas do teste de perfil.");
    }

    setLoading(true);
    let fileUrl = "";

    if (file) {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(`curriculos/${fileName}`, file);
      
      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage.from("documentos").getPublicUrl(uploadData.path);
        fileUrl = urlData.publicUrl;
      }
    }

    const res = await enviarCandidatura(unidadeId, dadosPessoais, respostas, fileUrl);
    
    setLoading(false);

    if (res.error) {
      alert("Erro ao enviar: " + res.error);
    } else {
      setSucesso(true);
    }
  };

  if (sucesso) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="bg-white max-w-md w-full p-8 rounded-3xl shadow-xl text-center">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} />
          </div>
          <h1 className="text-2xl font-black text-slate-800 mb-2">Candidatura Enviada!</h1>
          <p className="text-slate-500 font-medium mb-8">
            Seu perfil foi recebido com sucesso. Nossa equipe de RH irá analisar seus dados e, caso seu perfil esteja alinhado com a vaga, entraremos em contato pelo WhatsApp.
          </p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Boa sorte!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      {/* Header */}
      <div className="bg-emerald-950 text-white pt-12 pb-24 px-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
           {/* Abstract pattern */}
           <div className="absolute w-96 h-96 bg-emerald-500 rounded-full blur-3xl -top-20 -left-20"></div>
        </div>
        <div className="max-w-3xl mx-auto relative z-10 text-center">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Store size={32} className="text-emerald-300" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4">Trabalhe Conosco - seldeestrela</h1>
          <p className="text-emerald-200 text-lg md:text-xl font-medium max-w-xl mx-auto">
            Estamos em busca de talentos para integrar nossa equipe. Preencha seus dados e faça o teste de perfil.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-16 relative z-20">
        <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100">
          
          {/* Progress Bar */}
          <div className="flex border-b border-slate-100">
             <div className={`flex-1 py-4 text-center font-black text-sm uppercase tracking-widest transition-colors ${step === 1 ? 'bg-emerald-50 text-emerald-700' : 'text-slate-400'}`}>
                1. Dados Pessoais
             </div>
             <div className={`flex-1 py-4 text-center font-black text-sm uppercase tracking-widest transition-colors border-l border-slate-100 ${step === 2 ? 'bg-emerald-50 text-emerald-700' : 'text-slate-400'}`}>
                2. Teste de Perfil
             </div>
          </div>

          <div className="p-6 md:p-10">
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nome Completo *</label>
                    <div className="relative">
                      <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        value={dadosPessoais.nome}
                        onChange={e => setDadosPessoais({...dadosPessoais, nome: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 outline-none focus:border-emerald-500 font-medium text-slate-700"
                        placeholder="João da Silva"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">CPF *</label>
                    <div className="relative">
                      <FileText size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        value={dadosPessoais.cpf}
                        onChange={e => setDadosPessoais({...dadosPessoais, cpf: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 outline-none focus:border-emerald-500 font-medium text-slate-700"
                        placeholder="000.000.000-00"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">WhatsApp *</label>
                    <input 
                      type="tel" 
                      value={dadosPessoais.telefone}
                      onChange={e => setDadosPessoais({...dadosPessoais, telefone: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:border-emerald-500 font-medium text-slate-700"
                      placeholder="(00) 90000-0000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Tem Filhos?</label>
                    <select 
                      value={dadosPessoais.temFilhos}
                      onChange={e => setDadosPessoais({...dadosPessoais, temFilhos: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:border-emerald-500 font-medium text-slate-700"
                    >
                      <option>Não</option>
                      <option>Sim</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Endereço Completo (Rua, Bairro, Cidade) *</label>
                  <div className="relative">
                    <MapPin size={18} className="absolute left-4 top-4 text-slate-400" />
                    <textarea 
                      value={dadosPessoais.endereco}
                      onChange={e => setDadosPessoais({...dadosPessoais, endereco: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 outline-none focus:border-emerald-500 font-medium text-slate-700 h-24 resize-none"
                      placeholder="Ex: Rua das Flores, 123 - Bairro Centro"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Cargo Pretendido *</label>
                    <div className="relative">
                      <Briefcase size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <select 
                        value={dadosPessoais.cargoPretendido}
                        onChange={e => setDadosPessoais({...dadosPessoais, cargoPretendido: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 outline-none focus:border-emerald-500 font-medium text-slate-700 appearance-none"
                      >
                        <option>Garçom/Garçonete</option>
                        <option>Cozinheiro(a)</option>
                        <option>Auxiliar de Cozinha</option>
                        <option>Caixa</option>
                        <option>Gerente</option>
                        <option>Outros</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Resumo da Experiência *</label>
                    <input 
                      type="text" 
                      value={dadosPessoais.experiencia}
                      onChange={e => setDadosPessoais({...dadosPessoais, experiencia: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:border-emerald-500 font-medium text-slate-700"
                      placeholder="Ex: 2 anos como garçom na Pizzaria X"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Anexar Currículo (Opcional - PDF/Word)</label>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.doc,.docx" onChange={e => setFile(e.target.files[0])} />
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <Upload size={24} className="mx-auto text-slate-400 mb-2" />
                    <p className="font-bold text-slate-700">{file ? file.name : "Clique para anexar arquivo"}</p>
                    <p className="text-xs text-slate-500 mt-1">Máx 5MB</p>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-end">
                  <button 
                    onClick={handleNextStep}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-8 py-4 rounded-xl font-black hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                  >
                    Próxima Etapa <ChevronRight size={20} />
                  </button>
                </div>

              </div>
            )}

            {step === 2 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-8">
                
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-amber-800 text-sm font-medium mb-8">
                  <p>Responda com sinceridade. Não existe resposta "certa" ou "errada", queremos apenas conhecer seu perfil comportamental para ver se encaixa com o ritmo do nosso restaurante.</p>
                </div>

                {PERGUNTAS_RECRUTAMENTO.map((q, qIndex) => (
                  <div key={q.id} className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <p className="font-black text-slate-800 mb-4">{qIndex + 1}. {q.pergunta}</p>
                    <div className="space-y-3">
                      {q.opcoes.map((op, opIndex) => (
                        <label key={opIndex} className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer border-2 transition-all ${respostas[q.id] === opIndex.toString() ? 'border-emerald-600 bg-emerald-50/50' : 'border-transparent bg-white hover:border-slate-200'}`}>
                          <div className="pt-1">
                            <input 
                              type="radio" 
                              name={q.id} 
                              value={opIndex}
                              checked={respostas[q.id] === opIndex.toString()}
                              onChange={e => setRespostas({...respostas, [q.id]: e.target.value})}
                              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                            />
                          </div>
                          <span className="text-slate-700 font-medium leading-relaxed">{op.texto}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                  <button 
                    onClick={() => setStep(1)}
                    className="text-slate-500 font-bold hover:text-slate-800 px-4 py-2"
                  >
                    Voltar
                  </button>
                  <button 
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-8 py-4 rounded-xl font-black hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                    {loading ? "Enviando..." : "Finalizar Candidatura"}
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
