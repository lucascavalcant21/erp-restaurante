"use client";

// Agenda: eventos e reservas juntos, dia a dia. Só leitura — cada evento abre
// o hub dele; reservas se editam na lista de reservas.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, Users, Loader2, PartyPopper, UtensilsCrossed } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { supabase } from "../../../lib/supabase";
import { normalizarEtapa, rotuloEtapa } from "../../../lib/evento-financeiro.mjs";

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const somarDias = (dIso, n) => { const d = new Date(`${dIso}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); };
const rotuloDia = (dIso, hojeIso) => {
  const d = new Date(`${dIso}T12:00:00`);
  const txt = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  if (dIso === hojeIso) return `Hoje · ${txt}`;
  if (dIso === somarDias(hojeIso, 1)) return `Amanhã · ${txt}`;
  return txt.charAt(0).toUpperCase() + txt.slice(1);
};

const JANELAS = [[7, "7 dias"], [30, "30 dias"], [90, "90 dias"]];

export default function AgendaPage() {
  const { unidadeAtiva } = useERP();
  const [dias, setDias] = useState(30);
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const hoje = iso(new Date());

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    let ativo = true;
    setCarregando(true);
    const ate = somarDias(hoje, dias);
    Promise.all([
      supabase.from("eventos").select("id, nome, cliente_nome, data_evento, hora_inicio, capacidade, funil_status, tipo_evento")
        .eq("unidade_id", unidadeAtiva).gte("data_evento", hoje).lte("data_evento", ate),
      supabase.from("reservas").select("id, cliente_nome, data_reserva, horario, qtd_pessoas, status")
        .eq("unidade_id", unidadeAtiva).gte("data_reserva", hoje).lte("data_reserva", ate),
    ]).then(([ev, rs]) => {
      if (!ativo) return;
      setErro([ev.error?.message, rs.error?.message].filter(Boolean).join(" · "));
      const eventos = (ev.data || []).filter((e) => e.tipo_evento !== "especial" && normalizarEtapa(e.funil_status) !== "CANCELADO")
        .map((e) => ({ tipo: "evento", id: e.id, data: String(e.data_evento).slice(0, 10), hora: String(e.hora_inicio || "").slice(0, 5),
          titulo: e.nome || e.cliente_nome || "Evento", sub: e.cliente_nome && e.nome ? e.cliente_nome : "", pessoas: e.capacidade, etapa: rotuloEtapa(normalizarEtapa(e.funil_status)) }));
      const reservas = (rs.data || []).filter((r) => !/cancel/i.test(String(r.status || "")))
        .map((r) => ({ tipo: "reserva", id: r.id, data: String(r.data_reserva).slice(0, 10), hora: String(r.horario || "").slice(0, 5),
          titulo: r.cliente_nome || "Reserva", sub: "", pessoas: r.qtd_pessoas, etapa: r.status || "" }));
      setItens([...eventos, ...reservas]);
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, [unidadeAtiva, dias, hoje]);

  const porDia = useMemo(() => {
    const m = new Map();
    for (const i of [...itens].sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))) {
      if (!m.has(i.data)) m.set(i.data, []);
      m.get(i.data).push(i);
    }
    return [...m.entries()];
  }, [itens]);

  const totais = { eventos: itens.filter((i) => i.tipo === "evento").length, reservas: itens.filter((i) => i.tipo === "reserva").length,
    pessoas: itens.reduce((t, i) => t + (Number(i.pessoas) || 0), 0) };

  if (!unidadeAtiva) return <div className="p-8 text-center text-slate-900">Selecione uma loja.</div>;

  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900"><CalendarDays className="text-emerald-600" /> Agenda</h1>
          <p className="text-sm font-medium text-slate-600">Eventos e reservas dos próximos {dias} dias · {totais.eventos} evento(s), {totais.reservas} reserva(s), {totais.pessoas.toLocaleString("pt-BR")} pessoas</p>
        </div>
        <div className="flex rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Período">
          {JANELAS.map(([n, rotulo]) => (
            <button key={n} type="button" role="radio" aria-checked={dias === n} onClick={() => setDias(n)}
              className={`rounded-lg px-3 py-1.5 text-sm font-bold ${dias === n ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>{rotulo}</button>
          ))}
        </div>
      </div>

      {erro && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{erro}</p>}
      {carregando ? (
        <div className="grid min-h-[30vh] place-items-center"><Loader2 className="animate-spin text-emerald-600" size={28} /></div>
      ) : porDia.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm font-semibold text-slate-600">Nada agendado nos próximos {dias} dias.</div>
      ) : (
        <div className="mt-6 space-y-6">
          {porDia.map(([data, lista]) => (
            <section key={data}>
              <h2 className={`mb-2 text-xs font-black uppercase tracking-widest ${data === hoje ? "text-emerald-700" : "text-slate-500"}`}>{rotuloDia(data, hoje)}</h2>
              <ul className="space-y-2">
                {lista.map((i) => {
                  const conteudo = (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:border-slate-300">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${i.tipo === "evento" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                        {i.tipo === "evento" ? <PartyPopper size={16} /> : <UtensilsCrossed size={16} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm font-bold text-slate-900">{i.titulo}</strong>
                        <span className="block truncate text-xs font-medium text-slate-600">{i.tipo === "evento" ? `Evento · ${i.etapa}` : `Reserva${i.etapa ? ` · ${i.etapa}` : ""}`}{i.sub ? ` · ${i.sub}` : ""}</span>
                      </span>
                      <span className="flex items-center gap-3 text-xs font-bold text-slate-700">
                        {i.hora && <span className="flex items-center gap-1"><Clock size={12} /> {i.hora}</span>}
                        {Number(i.pessoas) > 0 && <span className="flex items-center gap-1"><Users size={12} /> {i.pessoas}</span>}
                      </span>
                    </div>
                  );
                  return <li key={`${i.tipo}-${i.id}`}>{i.tipo === "evento" ? <Link href={`/dashboard/reservas-eventos/eventos/${i.id}`}>{conteudo}</Link> : conteudo}</li>;
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
