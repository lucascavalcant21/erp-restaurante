"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import supabase from "../../../lib/supabase";
import { Calendar, Users, MessageSquare, Phone, User, CheckCircle, ChevronRight, Loader2 } from "lucide-react";
import { use } from "react";

export default function OrcamentoPublicoPage({ params }) {
  // O Next 15 pode exigir que params seja desempacotado
  const unwrappedParams = use(params);
  const unidadeStr = unwrappedParams.unidade;

  const [form, setForm] = useState({
    nome: "",
    telefone: "",
    tipo: "Casamento",
    data: "",
    convidados: "",
    obs: ""
  });
  
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [unidadeInfo, setUnidadeInfo] = useState(null);

  useEffect(() => {
    async function loadConfig() {
      const { data } = await supabase.from("unidades").select("nome, config").eq("id", unidadeStr).single();
      if (data) setUnidadeInfo(data);
    }
    loadConfig();
  }, [unidadeStr]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEnviando(true);

    const tituloEvento = `${form.tipo} de ${form.nome.split(" ")[0]}`;

    const { error } = await supabase.from("eventos").insert([{
      unidade_id: unidadeStr,
      nome: tituloEvento,
      cliente_nome: form.nome,
      cliente_telefone: form.telefone,
      tipo_evento: "buffet",
      funil_status: "NOVO CONTATO",
      data_evento: form.data || null,
      capacidade: Number(form.convidados) || 0,
      observacoes: form.obs
    }]);

    setEnviando(false);
    if (!error) {
      setSucesso(true);
    } else {
      alert("Ocorreu um erro ao enviar seu pedido. Tente novamente ou nos chame no WhatsApp.");
    }
  };

  if (sucesso) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white max-w-md w-full rounded-3xl p-8 text-center shadow-sm border border-slate-200">
          <CheckCircle className="text-emerald-500 w-20 h-20 mx-auto mb-6" />
          <h1 className="text-2xl font-black text-slate-900 mb-2">Pedido Recebido!</h1>
          <p className="text-slate-500 font-medium mb-8">Nossa equipe de eventos analisará as informações e entrará em contato pelo WhatsApp em breve.</p>
          <button onClick={() => window.location.reload()} className="h-12 w-full rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors">
            Enviar Novo Pedido
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 py-12 px-6">
      <div className="max-w-2xl mx-auto">
        
        <header className="text-center mb-10">
          {unidadeInfo?.config?.logo_url ? (
            <img src={unidadeInfo.config.logo_url} alt="Logo" className="h-16 mx-auto mb-6 object-contain" />
          ) : (
            <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 font-black text-xl">
              EVT
            </div>
          )}
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3">Faça seu evento conosco</h1>
          <p className="text-slate-500 font-medium text-lg">Preencha o formulário abaixo para receber uma proposta personalizada do {unidadeInfo?.nome || "nosso restaurante"}.</p>
        </header>

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-3xl p-6 md:p-10 shadow-sm space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><User size={16} className="text-slate-400"/> Nome Completo</label>
              <input 
                type="text" 
                required
                value={form.nome}
                onChange={e => setForm({...form, nome: e.target.value})}
                placeholder="Ex: João da Silva"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium outline-none focus:border-emerald-600 focus:bg-white transition-colors" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><Phone size={16} className="text-slate-400"/> WhatsApp</label>
              <input 
                type="tel" 
                required
                value={form.telefone}
                onChange={e => setForm({...form, telefone: e.target.value})}
                placeholder="(00) 00000-0000"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium outline-none focus:border-emerald-600 focus:bg-white transition-colors" 
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Tipo de Evento</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {["Casamento", "Aniversário", "Corporativo", "Outro"].map(tipo => (
                <label key={tipo} className={\`border rounded-xl p-3 text-center cursor-pointer font-bold transition-all \${form.tipo === tipo ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}\`}>
                  <input type="radio" name="tipo" className="hidden" checked={form.tipo === tipo} onChange={() => setForm({...form, tipo})} />
                  {tipo}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><Calendar size={16} className="text-slate-400"/> Data Estimada</label>
              <input 
                type="date" 
                required
                value={form.data}
                onChange={e => setForm({...form, data: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium outline-none focus:border-emerald-600 focus:bg-white transition-colors" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><Users size={16} className="text-slate-400"/> Convidados</label>
              <input 
                type="number" 
                required
                min="1"
                value={form.convidados}
                onChange={e => setForm({...form, convidados: e.target.value})}
                placeholder="Ex: 80"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium outline-none focus:border-emerald-600 focus:bg-white transition-colors" 
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><MessageSquare size={16} className="text-slate-400"/> Detalhes do Pedido</label>
            <textarea 
              value={form.obs}
              onChange={e => setForm({...form, obs: e.target.value})}
              placeholder="Conte-nos um pouco sobre como você imagina o evento (opcional)"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium outline-none focus:border-emerald-600 focus:bg-white transition-colors min-h-[100px] resize-y" 
            />
          </div>

          <button disabled={enviando} className="w-full h-14 rounded-xl bg-emerald-600 text-white font-black text-lg flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors disabled:opacity-50">
            {enviando ? <Loader2 className="animate-spin" /> : "Solicitar Orçamento"}
            {!enviando && <ChevronRight size={20} />}
          </button>
          
        </form>
        
        <p className="text-center text-slate-400 text-sm mt-8 font-medium">
          Tecnologia <strong className="text-slate-900">Cérebro ERP</strong>
        </p>

      </div>
    </main>
  );
}
