"use client";

import { useState } from "react";
import { CheckCircle2, ChevronRight, Briefcase, MapPin, Clock, ChefHat } from "lucide-react";
import { candidatarSe } from "../lib/recrutamento";

const CARGOS = ["Garçom / Atendimento", "Auxiliar de Cozinha", "Cozinheiro(a)", "Operador(a) de Caixa", "Gerente", "Outro"];

export default function VagasPage() {
  const [etapa, setEtapa] = useState(1);
  const [form, setForm] = useState({
    nome: "",
    telefone: "",
    cargo_desejado: "Garçom / Atendimento",
    exp_anos: "",
    trabalha_fim_semana: null,
    mora_perto: null,
  });
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState("");

  const avançar = () => {
    if (etapa === 1 && (!form.nome || !form.telefone)) return setErro("Preencha seu nome e WhatsApp.");
    if (etapa === 2 && !form.cargo_desejado) return setErro("Escolha o cargo desejado.");
    setErro("");
    setEtapa(e => e + 1);
  };

  const enviar = async () => {
    if (form.trabalha_fim_semana === null || form.mora_perto === null || !form.exp_anos) {
      return setErro("Responda todas as perguntas para finalizar.");
    }
    setEnviando(true); setErro("");
    
    // Opcional: Se quiser capturar ID da unidade pela URL, poderia ler "?loja=matriz" e injetar aqui.
    const res = await candidatarSe({ ...form });
    
    setEnviando(false);
    if (!res.ok) setErro("Erro ao enviar: " + res.error);
    else setSucesso(true);
  };

  if (sucesso) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-slate-900">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={40} />
        </div>
        <h1 className="text-2xl font-bold text-center mb-2">Ficha Enviada!</h1>
        <p className="text-center text-slate-500 mb-8 max-w-sm">
          Agradecemos o seu interesse! Nossa equipe de RH vai avaliar seu perfil e entrará em contato via WhatsApp caso você avance para a etapa de entrevistas.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: "linear-gradient(135deg,#059669,#34D399)" }}>
            <ChefHat size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">Trabalhe Conosco</h1>
            <p className="text-xs text-slate-500">Faça parte da nossa equipe</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto p-6 flex flex-col">
        {/* Barra de progresso */}
        <div className="flex gap-2 mb-8">
          {[1,2,3].map(i => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${etapa >= i ? 'bg-emerald-500' : 'bg-slate-200'}`} />
          ))}
        </div>

        <div className="flex-1">
          {etapa === 1 && (
            <div className="space-y-6 animation-fade-in">
              <div>
                <h2 className="text-xl font-bold mb-1">Seus dados básicos</h2>
                <p className="text-sm text-slate-500">Como podemos chamar você?</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nome Completo</label>
                  <input type="text" className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 ring-emerald-500/20"
                    placeholder="João da Silva" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">WhatsApp</label>
                  <input type="tel" className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 ring-emerald-500/20"
                    placeholder="(11) 99999-9999" value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} />
                </div>
              </div>
            </div>
          )}

          {etapa === 2 && (
            <div className="space-y-6 animation-fade-in">
              <div>
                <h2 className="text-xl font-bold mb-1">Qual vaga você procura?</h2>
                <p className="text-sm text-slate-500">Selecione a área do seu interesse</p>
              </div>
              <div className="space-y-2">
                {CARGOS.map(c => (
                  <button key={c} onClick={() => setForm({...form, cargo_desejado: c})}
                    className={`w-full text-left px-4 py-4 rounded-xl border-2 flex items-center gap-3 transition-colors ${form.cargo_desejado === c ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}>
                    <Briefcase size={20} className={form.cargo_desejado === c ? 'text-emerald-500' : 'text-slate-400'} />
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {etapa === 3 && (
            <div className="space-y-6 animation-fade-in">
              <div>
                <h2 className="text-xl font-bold mb-1">Perfil e Disponibilidade</h2>
                <p className="text-sm text-slate-500">Responda sinceramente para otimizar sua chance</p>
              </div>
              <div className="space-y-5">
                
                {/* Pergunta 1 */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <p className="font-bold text-sm mb-3">Você tem experiência prévia na área?</p>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-emerald-500"
                    value={form.exp_anos} onChange={e => setForm({...form, exp_anos: e.target.value})}>
                    <option value="">Selecione...</option>
                    <option value="Não">Não, busco primeira oportunidade</option>
                    <option value="Menos de 1 ano">Sim, menos de 1 ano</option>
                    <option value="De 1 a 3 anos">Sim, de 1 a 3 anos</option>
                    <option value="Mais de 3 anos">Sim, mais de 3 anos</option>
                  </select>
                </div>

                {/* Pergunta 2 */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <p className="font-bold text-sm mb-3 flex items-center gap-2"><Clock size={16} className="text-slate-400"/> Tem disponibilidade para trabalhar à noite e aos finais de semana?</p>
                  <div className="flex gap-2">
                    <button onClick={() => setForm({...form, trabalha_fim_semana: true})} className={`flex-1 py-2 rounded-lg font-bold border-2 ${form.trabalha_fim_semana === true ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>Sim</button>
                    <button onClick={() => setForm({...form, trabalha_fim_semana: false})} className={`flex-1 py-2 rounded-lg font-bold border-2 ${form.trabalha_fim_semana === false ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-500'}`}>Não</button>
                  </div>
                </div>

                {/* Pergunta 3 */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <p className="font-bold text-sm mb-3 flex items-center gap-2"><MapPin size={16} className="text-slate-400"/> Você mora perto ou pega no máximo 1 condução até o local?</p>
                  <div className="flex gap-2">
                    <button onClick={() => setForm({...form, mora_perto: true})} className={`flex-1 py-2 rounded-lg font-bold border-2 ${form.mora_perto === true ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>Sim</button>
                    <button onClick={() => setForm({...form, mora_perto: false})} className={`flex-1 py-2 rounded-lg font-bold border-2 ${form.mora_perto === false ? 'border-slate-400 bg-slate-50 text-slate-700' : 'border-slate-200 text-slate-500'}`}>Não</button>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        {erro && <p className="text-red-500 text-sm text-center font-medium my-4">{erro}</p>}

        <div className="mt-8 flex gap-3">
          {etapa > 1 && (
            <button onClick={() => setEtapa(e => e - 1)} className="px-6 py-4 rounded-xl font-bold text-slate-500 bg-slate-200 hover:bg-slate-300">
              Voltar
            </button>
          )}
          
          {etapa < 3 ? (
            <button onClick={avançar} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold py-4 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30">
              Avançar <ChevronRight size={20} />
            </button>
          ) : (
            <button onClick={enviar} disabled={enviando} className="flex-1 bg-black hover:bg-slate-800 text-white rounded-xl font-bold py-4 flex items-center justify-center gap-2 disabled:opacity-50">
              {enviando ? "Enviando Ficha..." : "Finalizar Inscrição"}
            </button>
          )}
        </div>
      </main>

      <style jsx global>{`
        .animation-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
