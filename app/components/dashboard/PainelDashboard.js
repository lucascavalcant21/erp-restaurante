"use client";

import React, { memo } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

function PainelDashboardComponent({
  titulo,
  subtitulo,
  href,
  acao,
  className = "",
  children,
}) {
  return (
    <section
      className={`flex flex-col rounded-2xl border border-zinc-200/80 bg-hf-surface p-5 shadow-card transition-shadow sm:p-6 ${className}`}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-black tracking-tight text-hf-text sm:text-lg">
            {titulo}
          </h2>
          {subtitulo && (
            <p className="mt-0.5 text-xs sm:text-sm font-medium text-hf-text-2">
              {subtitulo}
            </p>
          )}
        </div>
        {href && (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1 text-xs sm:text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 hover:text-emerald-800"
          >
            {acao} <ChevronRight size={15} aria-hidden />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

export const PainelDashboard = memo(PainelDashboardComponent);

export const VazioDashboard = memo(function VazioDashboard({ children }) {
  return (
    <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-zinc-200/80 bg-zinc-50/50 px-4 py-8 text-center text-xs sm:text-sm font-medium text-hf-text-2">
      {children}
    </div>
  );
});
