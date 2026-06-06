"use client";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * COMPONENTE: Skeleton
 * ─────────────────────────────────────────────────────────────────────────────
 * Loader reutilizável para qualquer módulo com Supabase.
 *
 * Uso básico:
 *   import Skeleton from "@/app/components/Skeleton";
 *   {loading && <Skeleton />}
 *
 * Variantes:
 *   <Skeleton />                        — 3 cards padrão
 *   <Skeleton count={5} />             — N cards
 *   <Skeleton variant="list" />        — linhas de lista
 *   <Skeleton variant="table" rows={6} columns={4} />  — tabela
 *   <Skeleton variant="kpi" count={4} />               — grid de KPIs
 * ─────────────────────────────────────────────────────────────────────────────
 */

export default function Skeleton({ variant = "card", count = 3, rows = 5, columns = 3 }) {
  // ── Card (padrão) ──────────────────────────────────────────────────────────
  if (variant === "card") {
    return (
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100 animate-pulse">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-neutral-100 rounded-full w-3/4" />
                <div className="h-2.5 bg-neutral-100 rounded-full w-1/2" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-2.5 bg-neutral-100 rounded-full w-full" />
              <div className="h-2.5 bg-neutral-100 rounded-full w-5/6" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Lista ──────────────────────────────────────────────────────────────────
  if (variant === "list") {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl px-4 py-3 border border-neutral-100 animate-pulse flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-100 flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 bg-neutral-100 rounded-full w-2/3" />
              <div className="h-2 bg-neutral-100 rounded-full w-1/3" />
            </div>
            <div className="w-12 h-6 bg-neutral-100 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  // ── Tabela ─────────────────────────────────────────────────────────────────
  if (variant === "table") {
    return (
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden animate-pulse">
        {/* Header */}
        <div className="flex gap-4 px-4 py-3 border-b border-neutral-100">
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className="h-2.5 bg-neutral-100 rounded-full flex-1" />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={`flex gap-4 px-4 py-3 ${i < rows - 1 ? "border-b border-neutral-50" : ""}`}>
            {Array.from({ length: columns }).map((_, j) => (
              <div key={j} className="h-2.5 bg-neutral-100 rounded-full flex-1"
                style={{ opacity: 1 - i * 0.12 }} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // ── KPI grid ───────────────────────────────────────────────────────────────
  if (variant === "kpi") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-3 animate-pulse">
            <div className="h-2 bg-neutral-100 rounded-full w-1/2 mb-2" />
            <div className="h-6 bg-neutral-100 rounded-lg w-3/4 mb-1.5" />
            <div className="h-2 bg-neutral-100 rounded-full w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  return null;
}
