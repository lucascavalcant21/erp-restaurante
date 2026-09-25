"use client";

import { useState, useEffect } from "react";
import { Plus, Search, CalendarDays, Filter, MoreHorizontal, User, Clock, Phone, X, Check } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import supabase from "../../../lib/supabase";

export default function ReservasPage() {
  const { unidadeAtiva, user } = useERP();
  const [reservas, setReservas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);

  async function carregarReservas() {
    if (!unidadeAtiva) return;
    setCarregando(true);
    const { data, error } = await supabase
      .from("reservas")
      .select("*")
      .eq("unidade_id", unidadeAtiva)
      .order("data_reserva", { ascending: true })
      .order("horario", { ascending: true });
      
    if (!error && data) setReservas(data);
    setCarregando(false);
  }

  useEffect(() => {
    carregarReservas();
  }, [unidadeAtiva]);

  if (!unidadeAtiva) return <div className="p-8 text-center text-slate-500">Selecione uma loja.</div>;

  return (
    <main className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Reservas (Á La Carte)</h1>
          <p className="text-slate-500 font-medium mt-1">Gerencie as mesas do dia a dia</p>
        </div>
        <div className="flex gap-3">
          <button className="h-11 px-5 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold flex items-center gap-2 hover:bg-slate-50">
            <Filter size={18} /> Filtros
          </button>
          <button onClick={() => setModalAberto(true)} className="h-11 px-5 rounded-xl bg-slate-900 text-white font-bold flex items-center gap-2 hover:bg-slate-800">
            <Plus size={18} /> Nova Reserva
          </button>
        </div>
      </header>

      <div className="flex-1 bg-white border border-slate-200 rounded-3xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por cliente, telefone..." 
              className="w-full pl-10 pr-4 h-10 rounded-xl border border-slate-300 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 outline-none font-medium"
            />
          </div>
          <div className="flex bg-slate-200 p-1 rounded-xl">
            <button className="px-4 py-1.5 rounded-lg bg-white shadow-sm text-sm font-bold text-slate-800">Lista</button>
            <button className="px-4 py-1.5 rounded-lg text-slate-600 text-sm font-bold hover:bg-slate-300/50">Kanban</button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-0">
          {carregando ? (
            <div className="p-12 text-center text-slate-500 font-bold">Carregando reservas...</div>
          ) : reservas.length === 0 ? (
            <div className="p-20 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mb-4">
                <CalendarDays size={32} />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 mb-2">Nenhuma reserva encontrada</h3>
              <p className="text-slate-500 font-medium max-w-sm">
                Não há reservas agendadas no momento. Clique em "Nova Reserva" para adicionar.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-slate-200">
                  <th className="py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-wider">Cliente</th>
                  <th className="py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-wider">Data e Hora</th>
                  <th className="py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-wider">Pessoas</th>
                  <th className="py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-wider">Mesa</th>
                  <th className="py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="py-4 px-6 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reservas.map(reserva => (
                  <tr key={reserva.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6">
                      <strong className="block text-slate-900 font-bold">{reserva.cliente_nome}</strong>
                      {reserva.telefone && <span className="text-sm text-slate-500 flex items-center gap-1 mt-1"><Phone size={12}/> {reserva.telefone}</span>}
                    </td>
                    <td className="py-4 px-6">
                      <strong className="block text-slate-900 font-bold">{new Date(reserva.data_reserva).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</strong>
                      <span className="text-sm text-slate-500 flex items-center gap-1 mt-1"><Clock size={12}/> {reserva.horario.substring(0,5)}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm">
                        <User size={14}/> {reserva.qtd_pessoas}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-700">
                      {reserva.mesa || '-'}
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs uppercase tracking-wider">
                        {reserva.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors">
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalAberto && (
        <NovaReservaModal 
          onClose={() => setModalAberto(false)} 
          unidadeAtiva={unidadeAtiva} 
          user={user}
          onSuccess={() => {
            setModalAberto(false);
            carregarReservas();
          }} 
        />
      )}
    </main>
  );
}

function NovaReservaModal({ onClose, onSuccess, unidadeAtiva, user }) {
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    cliente_nome: "",
    telefone: "",
    data_reserva: "",
    horario: "",
    qtd_pessoas: 2,
    ocasiao: "",
    mesa: "",
    observacoes: "",
    origem: "manual",
    status: "nova"
  });

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSalvando(true);
    const { error } = await supabase.from("reservas").insert([{
      ...form,
      unidade_id: unidadeAtiva,
      responsavel_id: user?.id || null,
      responsavel_nome: user?.user_metadata?.full_name || "Staff"
    }]);
    setSalvando(false);
    if (!error) {
      onSuccess();
    } else {
      console.error(error);
      alert("Erro ao salvar reserva.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <header className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Nova Reserva</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </header>
        
        <div className="flex-1 overflow-auto p-6">
          <form id="reserva-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Cliente *</label>
                <input required type="text" name="cliente_nome" value={form.cliente_nome} onChange={handleChange} className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-medium" placeholder="Nome completo" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Telefone (WhatsApp)</label>
                <input type="text" name="telefone" value={form.telefone} onChange={handleChange} className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-medium" placeholder="(11) 90000-0000" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Data *</label>
                <input required type="date" name="data_reserva" value={form.data_reserva} onChange={handleChange} className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-medium text-slate-700" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Horário *</label>
                <input required type="time" name="horario" value={form.horario} onChange={handleChange} className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-medium text-slate-700" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Pessoas</label>
                <input required type="number" min="1" name="qtd_pessoas" value={form.qtd_pessoas} onChange={handleChange} className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-medium" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Mesa (Opcional)</label>
                <input type="text" name="mesa" value={form.mesa} onChange={handleChange} className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-medium" placeholder="Ex: T2, Salão Principal" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Ocasião</label>
                <select name="ocasiao" value={form.ocasiao} onChange={handleChange} className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-medium bg-white">
                  <option value="">Comum</option>
                  <option value="Aniversário">Aniversário</option>
                  <option value="Encontro">Encontro Romântico</option>
                  <option value="Negócios">Negócios</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Observações / Restrições</label>
              <textarea name="observacoes" value={form.observacoes} onChange={handleChange} rows={3} className="w-full p-4 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-medium resize-none" placeholder="Alergias, crianças, pedido especial..."></textarea>
            </div>
            
          </form>
        </div>
        
        <footer className="px-6 py-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-11 px-6 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors">
            Cancelar
          </button>
          <button type="submit" form="reserva-form" disabled={salvando} className="h-11 px-6 rounded-xl bg-slate-900 text-white font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors disabled:opacity-50">
            {salvando ? "Salvando..." : <><Check size={18} /> Confirmar Reserva</>}
          </button>
        </footer>
      </div>
    </div>
  );
}
