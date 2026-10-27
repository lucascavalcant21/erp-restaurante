"use client";

import React, { memo } from "react";
import { fmtBRL } from "../ui";

const brlCompacto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

const COR_BARRA = {
  passado: "#94a3b8", // Slate 400
  hoje: "#047857",    // Emerald 700 (Brand Accent)
};

const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");

function GraficoSemanaComponent({ dias = [], destaque }) {
  const max = Math.max(0, ...dias.map((d) => d.total || 0));

  return (
    <div className="flex flex-1 flex-col pt-2">
      <ol
        aria-label="Faturamento diário dos últimos 7 dias"
        className="relative flex min-h-48 flex-1 items-end gap-1.5 border-b border-zinc-200/80 sm:gap-3"
      >
        {dias.map((d, i) => {
          const altura = max > 0 && d.total ? (d.total / max) * 82 : 0;
          const emDestaque = d.iso === destaque;
          const rotular = d.total > 0 && (emDestaque || d.total === max);
          const lado =
            i === 0
              ? "left-0"
              : i === dias.length - 1
              ? "right-0"
              : "left-1/2 -translate-x-1/2";
          const texto = `${d.hoje ? "Hoje" : `${d.sigla} ${ddmm(d.iso)}`} · ${
            d.total === null
              ? d.hoje
                ? "ainda não lançado"
                : "sem lançamento"
              : fmtBRL(d.total)
          }`;

          return (
            <li
              key={d.iso}
              tabIndex={0}
              aria-label={texto}
              className="group relative flex h-full flex-1 cursor-default flex-col items-center justify-end rounded-t-lg outline-none transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              {rotular && (
                <span
                  aria-hidden
                  className="mb-1 whitespace-nowrap text-xs font-bold text-hf-text"
                >
                  {brlCompacto.format(d.total)}
                </span>
              )}

              <span
                aria-hidden
                className="block w-full max-w-[28px] rounded-t-md transition-all duration-300"
                style={{
                  height: `${d.total > 0 ? Math.max(altura, 2) : 0}%`,
                  background: emDestaque ? COR_BARRA.hoje : COR_BARRA.passado,
                }}
              />

              {d.total === null && (
                <span aria-hidden className="mb-1 text-xs font-bold text-zinc-300">
                  —
                </span>
              )}

              <span
                aria-hidden
                style={{ bottom: `calc(${altura}% + ${rotular ? 28 : 10}px)` }}
                className={`pointer-events-none absolute z-20 hidden whitespace-nowrap rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white shadow-float group-hover:block group-focus-visible:block ${lado}`}
              >
                {texto}
              </span>
            </li>
          );
        })}
      </ol>

      <ol className="mt-2.5 flex gap-1.5 sm:gap-3" aria-hidden>
        {dias.map((d) => (
          <li
            key={d.iso}
            className={`flex-1 text-center text-xs font-semibold transition-colors ${
              d.iso === destaque ? "font-bold text-hf-text" : "text-hf-text-2"
            }`}
          >
            {d.hoje ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800 font-bold">
                Hoje
              </span>
            ) : (
              <>
                <span className="hidden capitalize sm:inline">{d.sigla} </span>
                {d.dia}
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export const GraficoSemana = memo(GraficoSemanaComponent);
