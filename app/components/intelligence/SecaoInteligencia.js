"use client";

import { memo } from "react";

export const SecaoInteligencia = memo(function SecaoInteligencia({ titulo, contador, children, acao }) {
  return (
    <section className="space-y-3 hf-animate-in">
      <div className="flex items-end justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.14em] text-hf-text-2">
          <span>{titulo}</span>
          {contador != null && (
            <span className="inline-flex items-center justify-center rounded-full bg-hf-text px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-hf-surface">
              {contador}
            </span>
          )}
        </h2>
        {acao}
      </div>
      {children}
    </section>
  );
});

export const EsqueletoInteligencia = memo(function EsqueletoInteligencia() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando análises da unidade">
      <div className="space-y-2">
        <div className="erp-skeleton h-4 w-36 rounded-lg" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-2xl border border-hf-border bg-hf-surface p-4 shadow-xs space-y-2.5">
              <div className="erp-skeleton h-3 w-20 rounded" />
              <div className="erp-skeleton h-7 w-28 rounded-lg" />
              <div className="erp-skeleton h-3 w-32 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <div className="erp-skeleton h-4 w-44 rounded-lg" />
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl border border-hf-border bg-hf-surface p-5 shadow-xs space-y-3">
            <div className="erp-skeleton h-4 w-24 rounded-full" />
            <div className="erp-skeleton h-5 w-3/4 rounded-lg" />
            <div className="erp-skeleton h-4 w-full rounded" />
          </div>
        ))}
      </div>
    </div>
  );
});
