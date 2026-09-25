"use client";

import { CalendarDays } from "lucide-react";

export default function AgendaPage() {
  return (
    <main className="p-8 max-w-7xl mx-auto h-full flex flex-col items-center justify-center text-center">
      <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mb-6">
        <CalendarDays size={40} />
      </div>
      <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Agenda Unificada</h1>
      <p className="text-slate-500 font-medium max-w-md">
        A visão em calendário de todas as reservas e eventos está em construção.
      </p>
    </main>
  );
}
