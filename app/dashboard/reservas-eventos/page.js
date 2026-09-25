"use client";

import { Calendar, AlertCircle, ArrowRight, Clock, Users, ChefHat } from "lucide-react";
import Link from "next/link";
import { useERP } from "../../context/ERPContext";

export default function ReservasEventosOverview() {
  const { unidadeAtiva } = useERP();

  if (!unidadeAtiva) {
    return <div className="p-8 text-center text-gray-500">Selecione uma loja.</div>;
  }

  return (
    <main className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Eventos & Reservas</h1>
          <p className="text-slate-500 font-medium mt-1">Visão geral do dia e próximos agendamentos</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/reservas-eventos/reservas" className="h-11 px-5 rounded-xl bg-slate-900 text-white font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors">
            <Users size={18} /> Nova Reserva
          </Link>
          <Link href="/dashboard/reservas-eventos/eventos" className="h-11 px-5 rounded-xl border-2 border-emerald-600 bg-emerald-50 text-emerald-700 font-bold flex items-center gap-2 hover:bg-emerald-100 transition-colors">
            <Calendar size={18} /> Novo Evento
          </Link>
        </div>
      </header>

      {/* DASHBOARD WIDGETS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* HOJE */}
        <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm col-span-1 md:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <Clock className="text-emerald-600" /> Hoje
            </h2>
            <Link href="/dashboard/reservas-eventos/agenda" className="text-emerald-600 font-bold text-sm flex items-center gap-1 hover:underline">
              Ver agenda <ArrowRight size={16} />
            </Link>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-2xl p-4">
              <span className="block text-slate-500 text-sm font-bold mb-1">Reservas</span>
              <strong className="text-3xl font-black text-slate-900">0</strong>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4">
              <span className="block text-slate-500 text-sm font-bold mb-1">Pessoas</span>
              <strong className="text-3xl font-black text-slate-900">0</strong>
            </div>
            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
              <span className="block text-emerald-700 text-sm font-bold mb-1">Eventos</span>
              <strong className="text-3xl font-black text-emerald-900">0</strong>
            </div>
            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
              <span className="block text-emerald-700 text-sm font-bold mb-1">Convidados</span>
              <strong className="text-3xl font-black text-emerald-900">0</strong>
            </div>
          </div>
        </section>

        {/* PRECISA DE ATENÇÃO */}
        <section className="bg-red-50 rounded-3xl p-6 border border-red-100 shadow-sm">
          <h2 className="text-lg font-extrabold text-red-700 uppercase tracking-widest flex items-center gap-2 mb-6">
            <AlertCircle /> Atenção
          </h2>
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-red-100 flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0" />
              <div>
                <strong className="block text-slate-900 font-bold text-sm">Nenhum alerta</strong>
                <span className="text-slate-500 text-xs">Tudo em dia para as reservas e eventos de hoje.</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* PRÓXIMOS EVENTOS E RESERVAS RECENTES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-800 uppercase tracking-widest mb-6">Próximos Eventos</h2>
          <div className="text-slate-500 text-sm font-medium py-8 text-center border-2 border-dashed border-slate-200 rounded-2xl">
            Nenhum evento futuro agendado.
          </div>
        </section>
        
        <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-800 uppercase tracking-widest mb-6">Novos Contatos / Reservas</h2>
          <div className="text-slate-500 text-sm font-medium py-8 text-center border-2 border-dashed border-slate-200 rounded-2xl">
            Nenhum contato pendente.
          </div>
        </section>
      </div>

    </main>
  );
}
