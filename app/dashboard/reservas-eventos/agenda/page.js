"use client";

// Agenda: eventos e reservas juntos, dia a dia. Só leitura — cada evento abre
// o hub dele; reservas se editam na lista de reservas.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock, Users, Loader2, PartyPopper, UtensilsCrossed } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { supabase } from "../../../lib/supabase";
import { normalizarEtapa, rotuloEtapa } from "../../../lib/evento-financeiro.mjs";
import { erroDeColunaDeEventos } from "../../../lib/evento-orcamento.mjs";
import { rotuloStatusReserva } from "../../../lib/reservas-lista.mjs";

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
    const eventos = (colunas) => supabase.from("eventos").select(colunas)
      .eq("unidade_id", unidadeAtiva).gte("data_evento", hoje).lte("data_evento", ate);
    // Banco sem a EVENTOS-ORC-1 não tem hora_inicio: busca sem a hora em vez
    // de esconder os eventos atrás do erro.
    const eventosComHora = eventos("id, nome, cliente_nome, data_evento, hora_inicio, capacidade, funil_status, tipo_evento")
      .then((r) => (r.error && erroDeColunaDeEventos(r.error.message)
        ? eventos("id, nome, cliente_nome, data_evento, capacidade, funil_status, tipo_evento")
        : r));
    Promise.all([
      eventosComHora,
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
          titulo: r.cliente_nome || "Reserva", sub: "", pessoas: r.qtd_pessoas, etapa: r.status }));
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

  if (!unidadeAtiva) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-hf-text-2">Próximos {dias} dias · {totais.eventos} evento(s), {totais.reservas} reserva(s), {totais.pessoas.toLocaleString("pt-BR")} pessoas</p>
        <div className="flex rounded-xl bg-hf-elevated p-1" role="radiogroup" aria-label="Período">
          {JANELAS.map(([n, rotulo]) => (
            <button key={n} type="button" role="radio" aria-checked={dias === n} onClick={() => setDias(n)}
              className={`min-h-[36px] rounded-lg px-3 text-sm font-semibold ${dias === n ? "bg-hf-surface text-hf-text shadow-sm" : "text-hf-text-2 hover:text-hf-text"}`}>{rotulo}</button>
          ))}
        </div>
      </div>

      {erro && <p className="rounded-xl border border-hf-warning/30 bg-hf-warning/5 p-3 text-sm text-hf-text">{erro}</p>}
      {carregando ? (
        <div className="grid min-h-[30vh] place-items-center"><Loader2 className="animate-spin text-hf-accent" size={28} /></div>
      ) : porDia.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hf-border-strong bg-hf-surface/60 p-8 text-center text-sm font-semibold text-hf-text-2">Nada agendado nos próximos {dias} dias.</div>
      ) : (
        <div className="space-y-5">
          {porDia.map(([data, lista]) => (
            <section key={data}>
              <h2 className={`mb-2 text-xs font-bold uppercase tracking-wide ${data === hoje ? "text-hf-accent" : "text-hf-text-2"}`}>{rotuloDia(data, hoje)}</h2>
              <ul className="grid gap-2 lg:grid-cols-2">
                {lista.map((i) => {
                  const conteudo = (
                    <div className={`flex items-center gap-3 rounded-xl border border-hf-border bg-hf-surface px-3 py-3 ${i.tipo === "evento" ? "hover:border-hf-border-strong" : ""}`}>
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${i.tipo === "evento" ? "bg-hf-accent/10 text-hf-accent" : "bg-hf-elevated text-hf-text-2"}`}>
                        {i.tipo === "evento" ? <PartyPopper size={16} /> : <UtensilsCrossed size={16} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm font-bold text-hf-text">{i.titulo}</strong>
                        <span className="block truncate text-xs text-hf-text-2">{i.tipo === "evento" ? `Evento · ${i.etapa}` : `Reserva · ${rotuloStatusReserva(i.etapa)}`}{i.sub ? ` · ${i.sub}` : ""}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3 text-xs font-bold text-hf-text-2">
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
    </div>
  );
}
