"use client";

import { Calendar, Users, CalendarDays, BookOpen, Clock } from "lucide-react";
import EventosKanban from "./eventos/page";
import ReservasList from "./reservas/page";
import { useERP } from "../../context/ERPContext";

export default function ReservasEventosOverview() {
  const { unidadeAtiva, unidadeInfo } = useERP();

  if (!unidadeAtiva) {
    return <div className="p-8 text-center text-gray-500 font-bold">Selecione uma loja.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24 text-slate-800">
      {/* HEADER PADRÃO ERP */}
      <div className="pt-4 sm:pt-5 pb-5 px-4 sm:px-6 max-w-[1500px] mx-auto">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent-strong flex items-center justify-center border border-emerald-100/80 shadow-sm shrink-0">
              <CalendarDays size={24} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-fg">Reservas & Eventos</h1>
              <p className="text-xs font-semibold text-fg mt-0.5">Gestão de mesas e funil de eventos · {unidadeInfo?.nome || "Unidade"}</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1500px] mx-auto px-4 sm:px-6 space-y-10">
        
        {/* SEÇÃO 1: FUNIL DE EVENTOS */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={20} className="text-emerald-600" />
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Pipeline de Eventos</h2>
          </div>
          <EventosKanban />
        </section>

        {/* SEÇÃO 2: RESERVAS DE MESAS */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Users size={20} className="text-emerald-600" />
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Reservas Á La Carte</h2>
          </div>
          <ReservasList />
        </section>

      </main>
    </div>
  );
}
