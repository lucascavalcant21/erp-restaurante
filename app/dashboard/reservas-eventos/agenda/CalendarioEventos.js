"use client";

// Calendário dos eventos (dono, 21/11/2026): mês inteiro, filtro por
// categoria, e em cada dia o evento, os pagamentos (parcial, integral ou
// quitação) e o vencimento do restante, em vermelho quando atrasou.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { supabase } from "../../../lib/supabase";
import { normalizarEtapa } from "../../../lib/evento-financeiro.mjs";
import { erroDeColunaDeEventos } from "../../../lib/evento-orcamento.mjs";
import { fetchModeloProposta } from "../../../lib/parametros";
import { eventoDoCalendario, marcasDosEventos, recebimentosDosEventos, semanasDoMes, somarDias } from "../../../lib/evento-calendario.mjs";
import { fmtReais } from "../../../lib/valor-percentual.mjs";

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const mudarMes = (mes, n) => { const [a, m] = mes.split("-").map(Number); const d = new Date(a, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const dataBR = (s) => (s ? new Date(`${s}T12:00:00`).toLocaleDateString("pt-BR") : "—");
const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const COR = {
  evento: "bg-hf-menu text-white",
  pagamento: "bg-hf-success text-white",
  vencimento: "bg-hf-warning text-white",
  atrasado: "bg-hf-danger text-white",
};
const corDa = (x) => (x.tipo === "vencimento" ? (x.atrasado ? COR.atrasado : COR.vencimento) : COR[x.tipo]);
const ROTULO_PAG = { parcial: "Pagamento parcial", integral: "Pagamento integral", quitacao: "Quitação (pagou o restante)" };

export default function CalendarioEventos() {
  const { unidadeAtiva } = useERP();
  const hoje = iso(new Date());
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [linhas, setLinhas] = useState([]);
  const [restanteDias, setRestanteDias] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [diaAberto, setDiaAberto] = useState(hoje);

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    let ativo = true;
    setCarregando(true);
    // Eventos de um ano para trás até um ano e meio para frente: pagamento e
    // vencimento caem em meses diferentes do evento.
    const de = somarDias(`${mudarMes(hoje.slice(0, 7), -12)}-01`, 0);
    const ate = somarDias(`${mudarMes(hoje.slice(0, 7), 18)}-01`, 0);
    const buscar = (cols) => supabase.from("eventos").select(cols).eq("unidade_id", unidadeAtiva).gte("data_evento", de).lte("data_evento", ate).limit(800);
    Promise.all([
      buscar("id, nome, cliente_nome, data_evento, hora_inicio, capacidade, funil_status, tipo_evento, valor_contratado, historico_pagamentos, operacao_detalhes")
        .then((r) => (r.error && erroDeColunaDeEventos(r.error.message) ? buscar("id, nome, cliente_nome, data_evento, capacidade, funil_status, tipo_evento, valor_contratado") : r)),
      fetchModeloProposta(unidadeAtiva),
    ]).then(([r, modelo]) => {
      if (!ativo) return;
      setErro(r.error?.message || "");
      setLinhas((r.data || []).filter((e) => e.tipo_evento !== "especial" && normalizarEtapa(e.funil_status) !== "CANCELADO"));
      setRestanteDias(modelo?.data?.pagamento?.restante_dias ?? null);
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, [unidadeAtiva, hoje]);

  const eventos = useMemo(() => linhas.map((e) => eventoDoCalendario(e, { hojeIso: hoje, restanteDias })), [linhas, hoje, restanteDias]);
  const categorias = useMemo(() => [...new Set(eventos.map((e) => e.categoria))].sort((a, b) => (a === "Sem categoria") - (b === "Sem categoria") || a.localeCompare(b, "pt-BR")), [eventos]);
  const filtrados = useMemo(() => eventos.filter((e) => categoria === "todas" || e.categoria === categoria), [eventos, categoria]);
  const marcas = useMemo(() => marcasDosEventos(filtrados), [filtrados]);
  const rec = useMemo(() => recebimentosDosEventos(filtrados), [filtrados]);
  const semanas = useMemo(() => semanasDoMes(mes), [mes]);
  const doDia = marcas.get(diaAberto) || [];
  const nomeMes = new Date(`${mes}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  if (carregando) return <div className="grid min-h-[30vh] place-items-center"><Loader2 className="animate-spin text-hf-accent" size={28} /></div>;

  return (
    <div className="space-y-4">
      {erro && <p className="rounded-xl border border-hf-warning/30 bg-hf-warning/5 p-3 text-sm text-hf-text">{erro}</p>}

      {rec.atrasados.length > 0 && (
        <section className="rounded-2xl border border-hf-danger/30 bg-hf-danger/5 p-4">
          <p className="text-sm font-bold text-hf-text">{rec.atrasados.length} evento(s) com pagamento atrasado · {fmtReais(rec.totalAtrasado)}</p>
          <ul className="mt-2 space-y-1">
            {rec.atrasados.slice(0, 6).map((e) => (
              <li key={e.id}><Link href={`/dashboard/reservas-eventos/eventos/${e.id}?etapa=pagamentos`} className="flex flex-wrap justify-between gap-2 text-sm hover:underline">
                <span className="font-semibold text-hf-text">{e.nome}{e.cliente ? ` · ${e.cliente}` : ""}</span>
                <span className="font-bold tabular-nums text-hf-danger">{fmtReais(e.pagamento.falta)} · venceu {dataBR(e.pagamento.vencimento)} ({e.pagamento.diasAtraso} dia(s))</span>
              </Link></li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Categoria">
        {["todas", ...categorias].map((c) => (
          <button key={c} type="button" aria-pressed={categoria === c} onClick={() => setCategoria(c)}
            className={`min-h-[40px] rounded-full border px-3 text-sm font-semibold ${categoria === c ? "border-hf-menu bg-hf-menu text-white" : "border-hf-border bg-hf-surface text-hf-text-2"}`}>
            {c === "todas" ? `Todas (${eventos.length})` : `${c} (${eventos.filter((e) => e.categoria === c).length})`}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-hf-border bg-hf-surface p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => setMes(mudarMes(mes, -1))} aria-label="Mês anterior" className="grid h-11 w-11 place-items-center rounded-xl hover:bg-hf-elevated"><ChevronLeft size={20} /></button>
          <div className="text-center">
            <p className="text-base font-bold capitalize text-hf-text">{nomeMes}</p>
            {mes !== hoje.slice(0, 7) && <button type="button" onClick={() => { setMes(hoje.slice(0, 7)); setDiaAberto(hoje); }} className="text-xs font-semibold text-hf-accent">Voltar para hoje</button>}
          </div>
          <button type="button" onClick={() => setMes(mudarMes(mes, 1))} aria-label="Próximo mês" className="grid h-11 w-11 place-items-center rounded-xl hover:bg-hf-elevated"><ChevronRight size={20} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-hf-muted">{SEMANA.map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {semanas.flat().map((d, i) => {
            if (!d) return <span key={i} />;
            const lista = marcas.get(d) || [];
            const tipos = [...new Set(lista.map((x) => (x.tipo === "vencimento" && x.atrasado ? "atrasado" : x.tipo)))];
            return (
              <button key={d} type="button" onClick={() => setDiaAberto(d)} aria-label={`${dataBR(d)}: ${lista.length} marcação(ões)`} aria-pressed={diaAberto === d}
                className={`flex min-h-[52px] flex-col items-center rounded-xl border p-1 text-sm ${diaAberto === d ? "border-hf-menu" : "border-transparent"} ${d === hoje ? "bg-hf-accent/10 font-bold" : "hover:bg-hf-elevated"}`}>
                <span className="tabular-nums text-hf-text">{Number(d.slice(8))}</span>
                <span className="mt-1 flex flex-wrap justify-center gap-0.5">
                  {tipos.map((t) => <span key={t} className={`h-2 w-2 rounded-full ${COR[t].split(" ")[0]}`} />)}
                </span>
              </button>
            );
          })}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-hf-text-2">
          <li className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-hf-menu" /> Evento</li>
          <li className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-hf-success" /> Pagamento recebido</li>
          <li className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-hf-warning" /> Restante a vencer</li>
          <li className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-hf-danger" /> Restante atrasado</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-hf-text-2">{dataBR(diaAberto)}{diaAberto === hoje ? " · hoje" : ""}</h2>
        {doDia.length === 0 ? <p className="rounded-xl border border-dashed border-hf-border p-4 text-sm text-hf-text-2">Nada neste dia.</p> : (
          <ul className="space-y-2">
            {doDia.map((x, i) => {
              const ev = x.ev;
              const titulo = x.tipo === "evento" ? `Evento${ev.hora ? ` às ${ev.hora}` : ""}` : x.tipo === "pagamento" ? ROTULO_PAG[x.tipoPag] : x.atrasado ? "Restante ATRASADO" : "Vence o restante";
              const detalhe = x.tipo === "evento"
                ? [ev.categoria, ev.pessoas ? `${ev.pessoas} pessoas` : null,
                  ev.pagamento.estado === "pago" ? "pago" : ev.pagamento.estado === "parcial" ? `pago ${fmtReais(ev.pagamento.recebido)}, falta ${fmtReais(ev.pagamento.falta)}${ev.pagamento.vencimento ? ` até ${dataBR(ev.pagamento.vencimento)}` : ""}` : ev.pagamento.estado === "nada" ? `nada pago${ev.pagamento.falta ? ` (${fmtReais(ev.pagamento.falta)})` : ""}` : "sem valor"].filter(Boolean).join(" · ")
                : x.tipo === "pagamento" ? `${fmtReais(x.valor)}${x.metodo ? ` · ${x.metodo}` : ""} · evento em ${dataBR(ev.data)}`
                : `${fmtReais(x.valor)} · evento em ${dataBR(ev.data)}${x.atrasado ? ` · ${ev.pagamento.diasAtraso} dia(s) de atraso` : ""}`;
              return (
                <li key={i}>
                  <Link href={`/dashboard/reservas-eventos/eventos/${ev.id}${x.tipo === "evento" ? "" : "?etapa=pagamentos"}`} className="flex items-center gap-3 rounded-xl border border-hf-border bg-hf-surface px-3 py-3 hover:border-hf-border-strong">
                    <span className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold ${corDa(x)}`}>{x.tipo === "evento" ? "Evento" : x.tipo === "pagamento" ? "Pago" : x.atrasado ? "Atrasado" : "Vence"}</span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm font-bold text-hf-text">{ev.nome}{ev.cliente ? ` · ${ev.cliente}` : ""}</strong>
                      <span className="block text-xs text-hf-text-2">{titulo} · {detalhe}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {rec.aVencer.length > 0 && (
        <section className="rounded-2xl border border-hf-border bg-hf-surface p-4">
          <p className="text-sm font-bold text-hf-text">A receber dos eventos · {fmtReais(rec.totalAReceber)}</p>
          <ul className="mt-2 divide-y divide-hf-border">
            {rec.aVencer.slice(0, 10).map((e) => (
              <li key={e.id}><Link href={`/dashboard/reservas-eventos/eventos/${e.id}?etapa=pagamentos`} className="flex flex-wrap justify-between gap-2 py-2 text-sm hover:underline">
                <span className="min-w-0 font-semibold text-hf-text">{e.nome} <span className="font-normal text-hf-text-2">· {e.categoria}</span></span>
                <span className="tabular-nums text-hf-text-2">{fmtReais(e.pagamento.falta)}{e.pagamento.vencimento ? ` · vence ${dataBR(e.pagamento.vencimento)}` : " · sem vencimento"}</span>
              </Link></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
