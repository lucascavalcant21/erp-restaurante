"use client";

import React, { memo } from "react";
import Link from "next/link";
import { ArrowUpRight, AlertTriangle } from "lucide-react";

const TONS = {
  neutro: "bg-zinc-100 text-zinc-700",
  verde: "bg-emerald-50 text-emerald-800",
  alerta: "bg-amber-50 text-amber-800",
  perigo: "bg-rose-50 text-rose-800",
};

function CardIndicadorComponent({
  href,
  icone: Icone,
  rotulo,
  bloco,
  tom = "neutro",
  children,
}) {
  const carregando = bloco === undefined;
  const erro = bloco && !bloco.ok;

  return (
    <Link
      href={href}
      className="group relative flex min-h-[132px] flex-col justify-between rounded-2xl border border-zinc-200/80 bg-hf-surface p-4 shadow-card transition-all duration-200 sm:min-h-[148px] sm:p-5 hover:border-emerald-500/50 hover:shadow-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-105 sm:h-9 sm:w-9 ${
              TONS[erro ? "neutro" : tom]
            }`}
          >
            <Icone size={17} aria-hidden />
          </span>
          <span className="line-clamp-2 text-[13px] font-bold leading-tight text-hf-text-2 sm:truncate sm:text-sm">
            {rotulo}
          </span>
        </div>
        <ArrowUpRight
          size={18}
          aria-hidden
          className="hidden shrink-0 text-zinc-300 transition-colors duration-200 group-hover:text-emerald-700 sm:block"
        />
      </div>

      <div className="mt-3">
        {carregando ? (
          <div aria-hidden className="space-y-2">
            <div className="h-7 w-28 animate-pulse rounded-lg bg-zinc-100" />
            <div className="h-4 w-40 animate-pulse rounded bg-zinc-100/70" />
          </div>
        ) : erro ? (
          <div>
            <p className="text-[22px] font-black leading-none text-zinc-300 sm:text-[28px]">
              —
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600">
              <AlertTriangle size={13} /> Não foi possível sincronizar agora
            </p>
          </div>
        ) : (
          children
        )}
      </div>
    </Link>
  );
}

export const CardIndicador = memo(CardIndicadorComponent);

export const ValorIndicador = memo(function ValorIndicador({ children }) {
  return (
    <p className="text-[22px] font-black leading-none tracking-tight text-hf-text sm:text-[28px]">
      {children}
    </p>
  );
});

export const DetalheIndicador = memo(function DetalheIndicador({ children }) {
  return (
    <p className="mt-2 text-[13px] font-medium leading-relaxed text-hf-text-2 sm:text-sm">
      {children}
    </p>
  );
});
