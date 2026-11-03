"use client";

import React, { memo } from "react";
import Link from "next/link";
import { rotuloEtapa } from "../../lib/evento-financeiro.mjs";
import { PainelDashboard, VazioDashboard } from "./PainelDashboard";
import { ROTAS_DASHBOARD } from "./usePainelInicio";

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

const corEtapa = (etapa) =>
  ["CONFIRMADO", "SINAL PAGO", "PREPARACAO", "EM PRODUCAO", "EVENTO"].includes(etapa)
    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
    : ["APROVADO", "AGUARDANDO SINAL", "NEGOCIACAO", "PROPOSTA ENVIADA"].includes(etapa)
    ? "bg-amber-50 text-amber-800 border-amber-200"
    : "bg-zinc-100 text-zinc-700 border-zinc-200";

export const PainelProximosEventos = memo(function PainelProximosEventos({
  dados,
}) {
  const eventosObj = dados?.eventos;
  const carregando = dados === undefined;

  return (
    <PainelDashboard
      titulo="Próximos eventos"
      href={ROTAS_DASHBOARD.eventos}
      acao="Funil"
    >
      {carregando ? (
        <div className="h-36 animate-pulse rounded-2xl bg-zinc-100/70" aria-hidden />
      ) : !eventosObj?.ok ? (
        <VazioDashboard>Não foi possível carregar os eventos agora.</VazioDashboard>
      ) : !eventosObj.dados.lista.length ? (
        <VazioDashboard>Nenhum evento agendado para o período.</VazioDashboard>
      ) : (
        <ul className="space-y-2.5">
          {eventosObj.dados.lista.slice(0, 4).map((e) => (
            <li key={e.id}>
              <Link
                href={`/dashboard/reservas-eventos/eventos/${e.id}`}
                className="group flex items-center gap-3.5 rounded-xl border border-zinc-200/60 bg-hf-surface p-3 transition-all duration-200 hover:border-hf-accent/50 hover:bg-hf-accent/5 hover:shadow-sm"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-zinc-100/90 text-center leading-none transition-colors group-hover:bg-hf-accent/15">
                  <span>
                    <span className="block text-base font-black text-hf-text">
                      {e.dataIso.slice(8, 10)}
                    </span>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-hf-text-2">
                      {MESES[Number(e.dataIso.slice(5, 7)) - 1]}
                    </span>
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block line-clamp-2 text-xs sm:text-sm font-bold leading-snug text-hf-text group-hover:text-hf-accent">
                    {e.nome || e.cliente_nome || "Evento sem título"}
                  </span>
                  <span className="block truncate text-xs font-medium text-hf-text-2">
                    {Number(e.capacidade) > 0
                      ? plural(Number(e.capacidade), "convidado", "convidados")
                      : e.nome && e.cliente_nome
                      ? e.cliente_nome
                      : "Convidados a definir"}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-lg border px-2 py-0.5 text-[11px] font-bold ${corEtapa(
                    e.etapa
                  )}`}
                >
                  {rotuloEtapa(e.etapa)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PainelDashboard>
  );
});

export const PainelReservasHoje = memo(function PainelReservasHoje({
  dados,
}) {
  const reservasObj = dados?.reservas;
  const carregando = dados === undefined;

  return (
    <PainelDashboard
      titulo="Reservas de hoje"
      href={ROTAS_DASHBOARD.reservas}
      acao="Reservas"
    >
      {carregando ? (
        <div className="h-28 animate-pulse rounded-2xl bg-zinc-100/70" aria-hidden />
      ) : !reservasObj?.ok ? (
        <VazioDashboard>Não foi possível carregar as reservas agora.</VazioDashboard>
      ) : !reservasObj.dados.lista.length ? (
        <VazioDashboard>Nenhuma reserva registrada para hoje.</VazioDashboard>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {reservasObj.dados.lista.slice(0, 6).map((r) => (
            <li key={r.id}>
              <Link
                href={ROTAS_DASHBOARD.eventos}
                className="group flex items-center gap-3 py-2.5 text-xs sm:text-sm transition-colors hover:text-hf-accent"
              >
                <span className="w-12 shrink-0 font-black tabular-nums text-hf-text group-hover:text-hf-accent">
                  {String(r.horario || "").slice(0, 5)}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold text-hf-text group-hover:text-hf-accent">
                  {r.cliente_nome || "Cliente sem nome"}
                </span>
                <span className="shrink-0 font-medium text-hf-text-2">
                  {plural(Number(r.qtd_pessoas) || 0, "pessoa", "pessoas")}
                  {r.mesa ? ` · ${r.mesa}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PainelDashboard>
  );
});
