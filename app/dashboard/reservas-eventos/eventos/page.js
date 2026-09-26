"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Calendar, Users, Building2, ChevronRight, LayoutGrid, List, X, Check } from "lucide-react";
import Link from "next/link";
import { useERP } from "../../../context/ERPContext";
import { supabase } from "../../../lib/supabase";

const FUNIL_ETAPAS = [
  "NOVO CONTATO",
  "INFORMACOES RECEBIDAS",
  "MONTANDO PROPOSTA",
  "PROPOSTA ENVIADA",
  "NEGOCIACAO",
  "APROVADO",
  "AGUARDANDO SINAL",
  "SINAL PAGO",
  "CONFIRMADO",
  "PREPARACAO",
  "EM PRODUCAO",
  "EVENTO",
  "FINALIZADO"
];

export default function EventosKanbanPage() {
  const { unidadeAtiva, user } = useERP();
  const [eventos, setEventos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modoVisao, setModoVisao] = useState("kanban"); // "kanban" | "lista"
  const [modalAberto, setModalAberto] = useState(false);

  async function carregarEventos() {
    if (!unidadeAtiva) return;
    setCarregando(true);
    const { data, error } = await supabase
      .from("eventos")
      .select("*")
      .eq("unidade_id", unidadeAtiva)
      .neq("tipo_evento", "especial") // Oculta os antigos temáticos legados
      .order("data_evento", { ascending: true });
      
    if (!error && data) setEventos(data);
    setCarregando(false);
  }

  useEffect(() => {
    carregarEventos();
  }, [unidadeAtiva]);

  if (!unidadeAtiva) return <div className="p-8 text-center text-slate-500">Selecione uma loja.</div>;

  const getEventosPorEtapa = (etapa) => {
    return eventos.filter(e => (e.funil_status || "NOVO CONTATO") === etapa);
  };

  return (
    <main className="h-screen flex flex-col pt-8 pl-8 pr-8 pb-4 max-w-[100vw] overflow-hidden">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Eventos & Buffet</h1>
          <p className="text-slate-500 font-medium mt-1">Gerencie propostas e pipeline de eventos comerciais</p>
        </div>
        <div className="flex gap-3">
          <div className="flex bg-slate-200 p-1 rounded-xl">
            <button onClick={() => setModoVisao("lista")} className={`px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 ${modoVisao === 'lista' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-600 hover:bg-slate-300/50'}`}>
              <List size={16} /> Lista
            </button>
            <button onClick={() => setModoVisao("kanban")} className={`px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 ${modoVisao === 'kanban' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-600 hover:bg-slate-300/50'}`}>
              <LayoutGrid size={16} /> Kanban
            </button>
          </div>
          <button onClick={() => setModalAberto(true)} className="h-11 px-5 rounded-xl bg-slate-900 text-white font-bold flex items-center gap-2 hover:bg-slate-800">
            <Plus size={18} /> Novo Evento
          </button>
        </div>
      </header>

      <div className="relative flex-1 max-w-md mb-6 shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="Buscar por cliente, data..." 
          className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-300 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 outline-none font-medium"
        />
      </div>

      {carregando ? (
        <div className="flex-1 flex items-center justify-center font-bold text-slate-500">Carregando pipeline...</div>
      ) : modoVisao === "kanban" ? (
        // VISÃO KANBAN (Horizontal scroll)
        <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4 flex gap-4 snap-x">
          {FUNIL_ETAPAS.map((etapa) => {
            const cards = getEventosPorEtapa(etapa);
            return (
              <div key={etapa} className="w-80 min-w-[320px] bg-slate-50 border border-slate-200 rounded-3xl flex flex-col shrink-0 snap-start">
                <header className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-100/50 rounded-t-3xl">
                  <h3 className="font-bold text-slate-800 text-sm tracking-wide">{etapa}</h3>
                  <span className="bg-slate-200 text-slate-600 text-xs font-black px-2 py-0.5 rounded-full">{cards.length}</span>
                </header>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {cards.map(evt => (
                    <Link key={evt.id} href={`/dashboard/reservas-eventos/eventos/${evt.id}`} className="block bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group">
                      <div className="flex justify-between items-start mb-2">
                        <strong className="text-slate-900 font-bold leading-tight group-hover:text-emerald-700 transition-colors">
                          {evt.nome || evt.cliente_nome || "Evento sem título"}
                        </strong>
                        <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-600" />
                      </div>
                      
                      {evt.cliente_nome && (
                        <div className="text-sm text-slate-500 font-medium mb-3">
                          {evt.cliente_nome}
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                        <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-lg">
                          <Calendar size={12} className="text-slate-400" /> 
                          {evt.data_evento ? new Date(evt.data_evento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}
                        </span>
                        <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-lg">
                          <Users size={12} className="text-slate-400" /> 
                          {evt.capacidade || 0}
                        </span>
                      </div>
                    </Link>
                  ))}
                  
                  {cards.length === 0 && (
                    <div className="p-4 text-center text-xs font-bold text-slate-400 uppercase tracking-widest border-2 border-dashed border-slate-200 rounded-2xl mt-2">
                      Vazio
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // VISÃO LISTA
        <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-3xl">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white shadow-sm z-10">
              <tr className="border-b border-slate-200">
                <th className="py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-wider">Evento / Cliente</th>
                <th className="py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-wider">Data</th>
                <th className="py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-wider">Convidados</th>
                <th className="py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-wider">Etapa do Funil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {eventos.map(evt => (
                <tr key={evt.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => window.location.href = `/dashboard/reservas-eventos/eventos/${evt.id}`}>
                  <td className="py-4 px-6">
                    <strong className="block text-slate-900 font-bold">{evt.nome || evt.cliente_nome}</strong>
                    <span className="text-sm text-slate-500 font-medium">{evt.cliente_nome}</span>
                  </td>
                  <td className="py-4 px-6 font-bold text-slate-700">
                    {evt.data_evento ? new Date(evt.data_evento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm">
                      <Users size={14}/> {evt.capacidade || 0}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs uppercase tracking-wider">
                      {evt.funil_status || "NOVO CONTATO"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAberto && (
        <NovoEventoModal 
          onClose={() => setModalAberto(false)} 
          unidadeAtiva={unidadeAtiva} 
          user={user}
          onSuccess={() => {
            setModalAberto(false);
            carregarEventos();
          }} 
        />
      )}
    </main>
  );
}

function NovoEventoModal({ onClose, onSuccess, unidadeAtiva, user }) {
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    cliente_nome: "",
    cliente_telefone: "",
    data_evento: "",
    capacidade: 50,
    local_evento: "",
    tipo_evento: "buffet",
    funil_status: "NOVO CONTATO",
    status: "ativo"
  });

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSalvando(true);
    
    const payload = {
      ...form,
      unidade_id: unidadeAtiva,
      responsavel_id: user?.id || null
    };

    // 'nome' é not null no banco, então se o usuário não digitar um título, 
    // usamos o nome do cliente ou geramos um genérico.
    if (!payload.nome) {
      payload.nome = payload.cliente_nome ? `Evento: ${payload.cliente_nome}` : 'Novo Evento Buffet';
    }

    const { error } = await supabase.from("eventos").insert([payload]);
    setSalvando(false);
    
    if (!error) {
      onSuccess();
    } else {
      console.error(error);
      alert("Erro ao criar evento.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <header className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="text-emerald-600" /> Novo Contato de Evento
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </header>
        
        <div className="flex-1 overflow-auto p-6">
          <form id="evento-form" onSubmit={handleSubmit} className="space-y-6">
            
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Informações do Cliente</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nome do Cliente / Empresa *</label>
                  <input required type="text" name="cliente_nome" value={form.cliente_nome} onChange={handleChange} className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-medium" placeholder="Ex: Ana Souza" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Telefone (WhatsApp)</label>
                  <input type="text" name="cliente_telefone" value={form.cliente_telefone} onChange={handleChange} className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-medium" placeholder="(11) 90000-0000" />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Detalhes do Evento</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Título do Evento (Opcional)</label>
                  <input type="text" name="nome" value={form.nome} onChange={handleChange} className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-medium" placeholder="Ex: Casamento Ana e João" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Data Estimada *</label>
                    <input required type="date" name="data_evento" value={form.data_evento} onChange={handleChange} className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-medium text-slate-700" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Convidados Estimados</label>
                    <input required type="number" min="1" name="capacidade" value={form.capacidade} onChange={handleChange} className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-medium" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Local</label>
                  <input type="text" name="local_evento" value={form.local_evento} onChange={handleChange} className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-medium" placeholder="Ex: Salão Principal do Héfisto, Chácara da Família..." />
                </div>
              </div>
            </div>
          </form>
        </div>
        
        <footer className="px-6 py-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-11 px-6 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors">
            Cancelar
          </button>
          <button type="submit" form="evento-form" disabled={salvando} className="h-11 px-6 rounded-xl bg-slate-900 text-white font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors disabled:opacity-50">
            {salvando ? "Criando..." : <><Check size={18} /> Iniciar Proposta</>}
          </button>
        </footer>
      </div>
    </div>
  );
}
