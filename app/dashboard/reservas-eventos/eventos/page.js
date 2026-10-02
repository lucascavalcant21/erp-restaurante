"use client";

// Funil de eventos em página própria. Menus, catálogo de permissões e o
// "Voltar" do evento apontam para esta rota, que não tinha página (caía em
// 404). O funil é o mesmo componente da visão geral de Reservas & Eventos.

import Link from "next/link";
import { ArrowLeft, BookOpen, CalendarDays } from "lucide-react";
import EventosKanban from "./EventosKanban";
import { useERP } from "../../../context/ERPContext";

export default function FunilDeEventosPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  if (!unidadeAtiva) return <div className="p-8 text-center font-bold text-slate-700">Selecione uma loja.</div>;
  return (
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-800">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 pb-5 pt-4 sm:px-6 sm:pt-5">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/reservas-eventos" aria-label="Voltar para Reservas & Eventos"
            className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-100"><ArrowLeft size={18} /></Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-fg"><BookOpen size={22} className="text-emerald-600" /> Funil de eventos</h1>
            <p className="text-xs font-semibold text-fg">{unidadeInfo?.nome || "Unidade"}</p>
          </div>
        </div>
        <Link href="/dashboard/reservas-eventos/agenda" className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-100">
          <CalendarDays size={16} /> Agenda
        </Link>
      </div>
      <main className="mx-auto max-w-[1500px] px-4 sm:px-6">
        <EventosKanban />
      </main>
    </div>
  );
}
