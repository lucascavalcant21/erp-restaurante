"use client";

// EVENTOS DA SEMANA — a semana do restaurante numa tela só.
// Quem trabalha cada dia (escala do RH), quais extras têm diária no dia
// (recibos), quanto custa a mão de obra, os feriados e os eventos da casa.
// Nada é digitado aqui: tudo vem do que já foi cadastrado no RH, nos Extras,
// nos feriados da unidade e no módulo de Eventos.
//
// Feriado e evento moravam cada um na sua tela. Quem monta escala precisava
// abrir três lugares para saber se o sábado tinha casamento marcado — e era
// justamente aí que faltava gente.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Loader2, PartyPopper,
  Star, UserRound, Users,
} from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchColaboradores, fetchFeriados, fetchRecibosPrestacaoUnidade } from "../../../lib/rh";
import { fetchEventos } from "../../../lib/eventos";
import { isoData } from "../../../lib/compras.mjs";

const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

// Domingo da semana da data escolhida.
function inicioDaSemana(referencia) {
  const d = new Date(referencia);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

const ehExtra = (c) => String(c?.tipo_contrato || "") === "Freelancer";
const ativo = (c) => (c?.status || "ativo") !== "inativo" && c?.ativo !== false;

// Escala fixa: dias_trabalho guarda os dias da semana separados por vírgula.
function trabalhaNoDia(colaborador, diaSemana) {
  const dias = String(colaborador?.dias_trabalho ?? "").trim();
  if (!dias) return false;
  return dias.split(",").map(d => d.trim()).includes(String(diaSemana));
}

export default function SemanaPage() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const [equipe, setEquipe] = useState([]);
  const [recibos, setRecibos] = useState([]);
  const [feriados, setFeriados] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [referencia, setReferencia] = useState(() => new Date());

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setCarregando(false); return; }
    let vivo = true;
    setCarregando(true);
    // Feriado e evento são acessórios: se a tabela deles não existir ou o
    // banco recusar, a semana continua mostrando escala e extras em vez de
    // ficar em branco. Por isso cada um cai para lista vazia sozinho.
    Promise.all([
      fetchColaboradores(unidadeAtiva),
      fetchRecibosPrestacaoUnidade(unidadeAtiva),
      fetchFeriados(unidadeAtiva).catch(() => ({ data: [] })),
      fetchEventos(unidadeAtiva).catch(() => ({ data: [] })),
    ])
      .then(([pessoas, historico, datasFeriado, agenda]) => {
        if (!vivo) return;
        setEquipe((pessoas.data || []).filter(ativo));
        setRecibos(historico.data || []);
        setFeriados(datasFeriado?.data || []);
        setEventos(agenda?.data || []);
        setCarregando(false);
      });
    return () => { vivo = false; };
  }, [unidadeAtiva]);

  const semana = useMemo(() => {
    const inicio = inicioDaSemana(referencia);
    const contratados = equipe.filter(c => !ehExtra(c));

    return Array.from({ length: 7 }, (_, i) => {
      const data = new Date(inicio);
      data.setDate(inicio.getDate() + i);
      const iso = isoData(data);

      const escalados = contratados.filter(c => trabalhaNoDia(c, data.getDay()));
      const diarias = recibos.filter(r => String(r.data_trabalho || "").slice(0, 10) === iso);
      const custoDiarias = diarias.reduce((s, r) => s + (Number(r.valor_total) || 0), 0);
      // slice(0,10) nos dois lados: a data vem "2026-08-30" do feriado e
      // "2026-08-30T00:00:00+00" do evento. Comparar cru nunca casaria.
      const feriadosDoDia = feriados.filter(f => String(f.data || "").slice(0, 10) === iso);
      const eventosDoDia = eventos.filter(e => String(e.data_evento || "").slice(0, 10) === iso);

      return { data, iso, diaSemana: data.getDay(), escalados, diarias, custoDiarias, feriadosDoDia, eventosDoDia };
    });
  }, [equipe, recibos, feriados, eventos, referencia]);

  const totalSemana = semana.reduce((s, d) => s + d.custoDiarias, 0);
  const hoje = isoData(new Date());
  const faixa = `${semana[0]?.data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} a ${semana[6]?.data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;

  const andar = (passo) => {
    const d = new Date(referencia);
    d.setDate(d.getDate() + passo * 7);
    setReferencia(d);
  };

  return (
    <div className="min-h-screen bg-[var(--surface)] pb-16">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <button onClick={() => router.push("/dashboard/rh")} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"><ArrowLeft size={19} /></button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black text-slate-900 sm:text-xl">Semana do restaurante</h1>
            <p className="text-xs font-bold text-slate-500">Escala, extras e custo de cada dia</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => andar(-1)} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"><ChevronLeft size={18} /></button>
            <span className="min-w-[130px] text-center text-sm font-black text-slate-800">{faixa}</span>
            <button onClick={() => andar(1)} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"><ChevronRight size={18} /></button>
          </div>
          <button onClick={() => setReferencia(new Date())} className="h-11 rounded-xl border-2 border-emerald-200 bg-white px-4 font-black text-emerald-700 hover:bg-emerald-50">Esta semana</button>
        </div>
      </div>

      <main className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        {!unidadeAtiva || unidadeAtiva === "todas" ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center font-bold text-slate-500">Selecione uma unidade específica.</div>
        ) : carregando ? (
          <div className="grid min-h-40 place-items-center"><Loader2 className="animate-spin text-emerald-600" size={28} /></div>
        ) : (
          <>
            <section className="rounded-2xl border-2 border-emerald-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700">Diárias de extras na semana</p>
              <p className="mt-1 text-3xl font-black text-slate-900 sm:text-4xl">{brl(totalSemana)}</p>
              <p className="mt-1 text-sm font-bold text-slate-500">
                {semana.reduce((s, d) => s + d.diarias.length, 0)} diária(s) · {equipe.filter(c => !ehExtra(c)).length} contratado(s) na escala
                {semana.reduce((s, d) => s + d.eventosDoDia.length, 0) > 0 && ` · ${semana.reduce((s, d) => s + d.eventosDoDia.length, 0)} evento(s)`}
                {semana.reduce((s, d) => s + d.feriadosDoDia.length, 0) > 0 && ` · ${semana.reduce((s, d) => s + d.feriadosDoDia.length, 0)} feriado(s)`}
              </p>
            </section>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {semana.map(dia => {
                const ehHoje = dia.iso === hoje;
                return (
                  <section key={dia.iso}
                    className={`rounded-2xl border bg-white p-4 shadow-sm ${ehHoje ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200"}`}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[15px] font-black text-slate-900">
                        {DIAS[dia.diaSemana]}
                        {ehHoje && <span className="ml-2 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">hoje</span>}
                      </p>
                      <p className="text-xs font-black text-slate-400">{dia.data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</p>
                    </div>

                    {/* Feriado e evento vêm ANTES da escala: são eles que mudam
                        quanta gente o dia precisa, então quem lê o card decide
                        a escala já sabendo disso. */}
                    {dia.feriadosDoDia.map(f => (
                      <div key={f.id} className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-rose-50 px-2 py-1.5 text-[12px] font-black text-rose-800">
                        <Star size={13} className="shrink-0" />
                        <span className="min-w-0 truncate">{f.nome || "Feriado"}</span>
                      </div>
                    ))}
                    {dia.eventosDoDia.map(e => (
                      <button key={e.id} type="button" onClick={() => router.push(`/dashboard/eventos/${e.id}`)}
                        className="mt-2.5 flex w-full items-center gap-1.5 rounded-lg bg-violet-50 px-2 py-1.5 text-left text-[12px] font-black text-violet-800 hover:bg-violet-100">
                        <PartyPopper size={13} className="shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{e.nome || "Evento"}</span>
                        {Number(e.capacidade) > 0 && <span className="shrink-0 text-[11px] font-bold">{e.capacidade} lug.</span>}
                      </button>
                    ))}

                    <p className="mt-3 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-500">
                      <Users size={13} /> Escala · {dia.escalados.length}
                    </p>
                    {dia.escalados.length === 0 ? (
                      <p className="mt-1 text-[13px] font-bold text-slate-400">Ninguém escalado.</p>
                    ) : (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {dia.escalados.map(c => (
                          <span key={c.id} className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">
                            {String(c.nome || "").split(" ")[0]}
                            {c.horario_entrada ? ` ${String(c.horario_entrada).slice(0, 5)}` : ""}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="mt-3 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-500">
                      <UserRound size={13} /> Extras · {dia.diarias.length}
                    </p>
                    {dia.diarias.length === 0 ? (
                      <p className="mt-1 text-[13px] font-bold text-slate-400">Sem extras neste dia.</p>
                    ) : (
                      <div className="mt-1.5 space-y-1">
                        {dia.diarias.map(r => (
                          <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-2 py-1">
                            <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-amber-900">
                              {r.nome_prestador || r.funcao_exercida || "Extra"}
                            </span>
                            <span className="shrink-0 text-[12px] font-black text-amber-800">{brl(r.valor_total)}</span>
                          </div>
                        ))}
                        <p className="pt-1 text-right text-[11px] font-black text-slate-500">Dia: {brl(dia.custoDiarias)}</p>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>

            <p className="flex items-center justify-center gap-1.5 pt-2 text-xs font-bold text-slate-400">
              <CalendarDays size={13} /> Escala vem do RH; diárias, dos recibos dos extras; feriados e eventos, dos módulos deles.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
