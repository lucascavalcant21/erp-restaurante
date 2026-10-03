"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Calendar, Users, Building2, ChevronRight, LayoutGrid, List, X, Check } from "lucide-react";
import Link from "next/link";
import { useERP } from "../../../context/ERPContext";
import { supabase } from "../../../lib/supabase";
import { FUNIL_ETAPAS, normalizarEtapa, rotuloEtapa } from "../../../lib/evento-financeiro.mjs";
import { fmtReais, fmtPct } from "../../../lib/valor-percentual.mjs";
import { indicadoresDoFunil } from "../../../lib/evento-orcamento.mjs";
import { mascaraTelefone } from "../../../lib/mascaras.mjs";

// As etapas do funil vêm de evento-financeiro.mjs (a mesma lista do seletor
// dentro do evento): antes eram duas listas e o evento sumia do funil.

export default function EventosKanbanPage() {
  const { unidadeAtiva, user } = useERP();
  const [eventos, setEventos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modoVisao, setModoVisao] = useState("kanban"); // "kanban" | "lista"
  const [modalAberto, setModalAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [mes, setMes] = useState(""); // "" = todos; "YYYY-MM" = mês da data do evento
  const [arrastando, setArrastando] = useState(null);
  const [alvo, setAlvo] = useState(null);
  const [erroMover, setErroMover] = useState("");

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

  if (!unidadeAtiva) return <div className="p-8 text-center text-slate-900">Selecione uma loja.</div>;

  // Busca por nome do evento, cliente, telefone ou data (dd/mm).
  const termo = busca.trim().toLowerCase();
  const doMes = !mes ? eventos : eventos.filter(e => String(e.data_evento || "").slice(0, 7) === mes);
  const ind = indicadoresDoFunil(eventos, mes);
  // Meses com evento, do mais recente ao mais antigo, para o filtro.
  const meses = [...new Set(eventos.map(e => String(e.data_evento || "").slice(0, 7)).filter(Boolean))].sort().reverse();
  const rotuloMes = (m) => { const [a, mm] = m.split("-"); const t = new Date(Number(a), Number(mm) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); };
  // Arrastar o card para outra coluna muda a etapa (otimista; desfaz se o banco recusar).
  const moverPara = async (eventoId, etapa) => {
    const antes = eventos.find(e => e.id === eventoId);
    if (!antes || normalizarEtapa(antes.funil_status) === etapa) return;
    setEventos(l => l.map(e => e.id === eventoId ? { ...e, funil_status: etapa } : e));
    const { error } = await supabase.from("eventos").update({ funil_status: etapa }).eq("id", eventoId);
    if (error) { setEventos(l => l.map(e => e.id === eventoId ? antes : e)); setErroMover(`Não mudou a etapa: ${error.message}`); }
  };
  const visiveis = !termo ? doMes : doMes.filter(e => {
    const data = e.data_evento ? new Date(e.data_evento).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "";
    return [e.nome, e.cliente_nome, e.cliente_telefone, data].some(v => String(v || "").toLowerCase().includes(termo));
  });
  const getEventosPorEtapa = (etapa) => visiveis.filter(e => normalizarEtapa(e.funil_status) === etapa);

  return (
    <div className="flex flex-col w-full h-[780px] overflow-hidden bg-white border border-slate-200 rounded-3xl p-4">
      
  <div className="flex justify-between items-center mb-4">
    <div className="flex bg-slate-100 p-1 rounded-xl">
      <button onClick={() => setModoVisao("lista")} className={`px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 ${modoVisao === 'lista' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:bg-slate-200'}`}>
        <List size={16} /> Lista
      </button>
      <button onClick={() => setModoVisao("kanban")} className={`px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 ${modoVisao === 'kanban' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:bg-slate-200'}`}>
        <LayoutGrid size={16} /> Kanban
      </button>
    </div>
    <button onClick={() => setModalAberto(true)} className="h-10 px-4 rounded-xl bg-accent text-accent-fg font-bold flex items-center gap-2 hover:opacity-90">
      <Plus size={18} /> Novo Evento
    </button>
  </div>
  

      <div className="mb-4 grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-5">
        {[["Eventos", String(ind.eventos)], ["Fechados", String(ind.fechados)], ["Valor fechado", fmtReais(ind.valor)],
          ["Lucro previsto", ind.lucro === null ? "—" : `${fmtReais(ind.lucro)}${ind.lucroParcial ? "*" : ""}`], ["Conversão", ind.conversao === null ? "—" : fmtPct(ind.conversao, 0)]].map(([r, v]) => (
          <div key={r} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{r}</p>
            <p className="truncate text-base font-black tabular-nums text-slate-900">{v}</p>
          </div>
        ))}
      </div>
      {ind.lucroParcial && <p className="-mt-2 mb-3 text-xs font-medium text-slate-500">* Só dos eventos já abertos no orçamento novo.</p>}
      {erroMover && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{erroMover}</p>}
      <div className="mb-6 flex shrink-0 flex-wrap items-center gap-2">
      <select value={mes} onChange={e => setMes(e.target.value)} aria-label="Mês do evento"
        className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-500">
        <option value="">Todos os meses</option>
        {meses.map(m => <option key={m} value={m}>{rotuloMes(m)}</option>)}
      </select>
      <div className="relative w-full max-w-md shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-800" size={18} />
        <input 
          type="text" 
          placeholder="Buscar por evento, cliente, telefone ou data..." value={busca} onChange={e => setBusca(e.target.value)} 
          className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-300 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 outline-none font-medium"
        />
      </div>
      </div>

      {carregando ? (
        <div className="flex-1 flex items-center justify-center font-bold text-slate-900">Carregando pipeline...</div>
      ) : modoVisao === "kanban" ? (
        // VISÃO KANBAN (Horizontal scroll)
        <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4 flex gap-4 snap-x">
          {FUNIL_ETAPAS.map((etapa) => {
            const cards = getEventosPorEtapa(etapa);
            return (
              <div key={etapa}
                onDragOver={e => { if (arrastando) { e.preventDefault(); setAlvo(etapa); } }}
                onDragLeave={() => setAlvo(a => (a === etapa ? null : a))}
                onDrop={e => { e.preventDefault(); const idEv = e.dataTransfer.getData("text/plain") || arrastando; setAlvo(null); setArrastando(null); if (idEv) moverPara(idEv, etapa); }}
                className={`w-80 min-w-[320px] bg-white border rounded-3xl flex flex-col shrink-0 snap-start transition-colors ${alvo === etapa ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200"}`}>
                <header className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-100/50 rounded-t-3xl">
                  <h3 className="font-bold text-slate-800 text-sm tracking-wide">{rotuloEtapa(etapa)}</h3>
                  <span className="bg-slate-200 text-slate-900 text-xs font-black px-2 py-0.5 rounded-full">{cards.length}</span>
                </header>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {cards.map(evt => (
                    <Link key={evt.id} href={`/dashboard/reservas-eventos/eventos/${evt.id}`} draggable
                      onDragStart={e => { e.dataTransfer.setData("text/plain", evt.id); e.dataTransfer.effectAllowed = "move"; setArrastando(evt.id); }}
                      onDragEnd={() => { setArrastando(null); setAlvo(null); }}
                      title="Arraste para outra etapa"
                      className={`block bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-grab group ${arrastando === evt.id ? "opacity-50" : ""}`}>
                      <div className="flex justify-between items-start mb-2">
                        <strong className="text-slate-900 font-bold leading-tight group-hover:text-emerald-700 transition-colors">
                          {evt.nome || evt.cliente_nome || "Evento sem título"}
                        </strong>
                        <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-600" />
                      </div>
                      
                      {evt.cliente_nome && (
                        <div className="text-sm text-slate-900 font-medium mb-3">
                          {evt.cliente_nome}
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-xs font-bold text-slate-900">
                        <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-lg">
                          <Calendar size={12} className="text-slate-800" /> 
                          {evt.data_evento ? new Date(evt.data_evento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}
                        </span>
                        <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-lg">
                          <Users size={12} className="text-slate-800" /> 
                          {evt.capacidade || 0}
                        </span>
                        {Number(evt.valor_contratado) > 0 && (
                          <span className="ml-auto whitespace-nowrap rounded-lg bg-emerald-50 px-2 py-1 text-emerald-800">{fmtReais(evt.valor_contratado)}</span>
                        )}
                      </div>
                      {typeof evt.operacao_detalhes?.resumo?.lucro === "number" && Number(evt.valor_contratado) > 0 && (
                        <div className={`mt-2 text-xs font-bold ${evt.operacao_detalhes.resumo.lucro < 0 ? "text-red-600" : "text-slate-600"}`}>
                          Lucro limpo: {fmtReais(evt.operacao_detalhes.resumo.lucro)}{evt.operacao_detalhes.resumo.lucro_pct !== null && evt.operacao_detalhes.resumo.lucro_pct !== undefined ? ` · ${fmtPct(evt.operacao_detalhes.resumo.lucro_pct)}` : ""}
                        </div>
                      )}
                    </Link>
                  ))}
                  
                  {cards.length === 0 && (
                    <div className="p-4 text-center text-xs font-bold text-slate-800 uppercase tracking-widest border-2 border-dashed border-slate-200 rounded-2xl mt-2">
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
                <th className="py-4 px-6 text-xs font-black text-slate-800 uppercase tracking-wider">Evento / Cliente</th>
                <th className="py-4 px-6 text-xs font-black text-slate-800 uppercase tracking-wider">Data</th>
                <th className="py-4 px-6 text-xs font-black text-slate-800 uppercase tracking-wider">Convidados</th>
                <th className="py-4 px-6 text-xs font-black text-slate-800 uppercase tracking-wider">Etapa do Funil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visiveis.map(evt => (
                <tr key={evt.id} className="hover:bg-white transition-colors cursor-pointer" onClick={() => window.location.href = `/dashboard/reservas-eventos/eventos/${evt.id}`}>
                  <td className="py-4 px-6">
                    <strong className="block text-slate-900 font-bold">{evt.nome || evt.cliente_nome}</strong>
                    <span className="text-sm text-slate-900 font-medium">{evt.cliente_nome}</span>
                  </td>
                  <td className="py-4 px-6 font-bold text-slate-900">
                    {evt.data_evento ? new Date(evt.data_evento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-900 font-bold text-sm">
                      <Users size={14}/> {evt.capacidade || 0}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs uppercase tracking-wider">
                      {rotuloEtapa(normalizarEtapa(evt.funil_status))}
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
    </div>
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

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.name === "cliente_telefone" ? mascaraTelefone(e.target.value) : e.target.value }));

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
          <button onClick={onClose} className="p-2 text-slate-800 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </header>
        
        <div className="flex-1 overflow-auto p-6">
          <form id="evento-form" onSubmit={handleSubmit} className="space-y-6">
            
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-4">Informações do Cliente</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1">Nome do Cliente / Empresa *</label>
                  <input required type="text" name="cliente_nome" value={form.cliente_nome} onChange={handleChange} className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-medium" placeholder="Ex: Ana Souza" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1">Telefone (WhatsApp)</label>
                  <input type="text" inputMode="tel" name="cliente_telefone" value={form.cliente_telefone} onChange={handleChange} className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-medium" placeholder="(11) 90000-0000" />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-4">Detalhes do Evento</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1">Título do Evento (Opcional)</label>
                  <input type="text" name="nome" value={form.nome} onChange={handleChange} className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-medium" placeholder="Ex: Casamento Ana e João" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1">Data Estimada *</label>
                    <input required type="date" name="data_evento" value={form.data_evento} onChange={handleChange} className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-medium text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1">Convidados Estimados</label>
                    <input required type="number" min="1" name="capacidade" value={form.capacidade} onChange={handleChange} className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-medium" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1">Local</label>
                  <input type="text" name="local_evento" value={form.local_evento} onChange={handleChange} className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-medium" placeholder="Ex: Salão Principal do Héfisto, Chácara da Família..." />
                </div>
              </div>
            </div>
          </form>
        </div>
        
        <footer className="px-6 py-5 border-t border-slate-100 bg-white flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-11 px-6 rounded-xl font-bold text-slate-900 hover:bg-slate-200 transition-colors">
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
