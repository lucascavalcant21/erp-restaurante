const fs = require('fs');

// 1. Update TopNavigation
let topNav = fs.readFileSync('app/components/layout/TopNavigation.js', 'utf-8');
topNav = topNav.replace(
  /href: "\/dashboard\/reservas-eventos\/eventos",\s*submodules: \[[^\]]*\]/,
  'href: "/dashboard/reservas-eventos"'
);
fs.writeFileSync('app/components/layout/TopNavigation.js', topNav);

// 2. Rewrite Eventos (kanban)
let eventos = fs.readFileSync('app/dashboard/reservas-eventos/eventos/page.js', 'utf-8');
eventos = eventos.replace(
  '<main className="h-screen flex flex-col pt-8 pl-8 pr-8 pb-4 max-w-[100vw] overflow-hidden">',
  '<div className="flex flex-col w-full h-[600px] overflow-hidden bg-white border border-slate-200 rounded-3xl p-4">'
);
eventos = eventos.replace(
  /<header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 shrink-0">[\s\S]*?<\/header>/,
  `
  <div className="flex justify-between items-center mb-4">
    <div className="flex bg-slate-100 p-1 rounded-xl">
      <button onClick={() => setModoVisao("lista")} className={\`px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 \${modoVisao === 'lista' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:bg-slate-200'}\`}>
        <List size={16} /> Lista
      </button>
      <button onClick={() => setModoVisao("kanban")} className={\`px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 \${modoVisao === 'kanban' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:bg-slate-200'}\`}>
        <LayoutGrid size={16} /> Kanban
      </button>
    </div>
    <button onClick={() => setModalAberto(true)} className="h-10 px-4 rounded-xl bg-accent text-accent-fg font-bold flex items-center gap-2 hover:opacity-90">
      <Plus size={18} /> Novo Evento
    </button>
  </div>
  `
);
eventos = eventos.replace(/<\/main>/, '</div>');
fs.writeFileSync('app/dashboard/reservas-eventos/eventos/page.js', eventos);

// 3. Rewrite Reservas (table)
let reservas = fs.readFileSync('app/dashboard/reservas-eventos/reservas/page.js', 'utf-8');
reservas = reservas.replace(
  '<main className="p-8 max-w-7xl mx-auto h-full flex flex-col">',
  '<div className="flex flex-col w-full h-[500px] overflow-hidden">'
);
reservas = reservas.replace(
  /<header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">[\s\S]*?<\/header>/,
  `
  <div className="flex justify-end items-center mb-4 gap-3">
    <button className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold flex items-center gap-2 hover:bg-slate-50">
      <Filter size={18} /> Filtros
    </button>
    <button onClick={() => setModalAberto(true)} className="h-10 px-4 rounded-xl bg-accent text-accent-fg font-bold flex items-center gap-2 hover:opacity-90">
      <Plus size={18} /> Nova Reserva
    </button>
  </div>
  `
);
reservas = reservas.replace(/<\/main>/, '</div>');
fs.writeFileSync('app/dashboard/reservas-eventos/reservas/page.js', reservas);

// 4. Rewrite the main Overview page
const newOverview = `"use client";

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
`;

fs.writeFileSync('app/dashboard/reservas-eventos/page.js', newOverview);
console.log('Fixed Eventos');
