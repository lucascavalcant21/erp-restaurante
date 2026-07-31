"use client";

// ═══════════════════════════════════════════════════════════════
// KIT DE UI — componentes reutilizáveis (design tokens v4)
// Base de TODOS os módulos do ERP. Mantém consistência visual e
// acelera a criação/recriação de telas.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, X, Plus, Inbox } from "lucide-react";

// ── Formatadores ───────────────────────────────────────────────
export function fmtBRL(v, dec = 2) {
  return Number(v || 0).toLocaleString("pt-BR", {
    style: "currency", currency: "BRL",
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  });
}
export function fmtPct(v, dec = 1) { return `${Number(v || 0).toFixed(dec)}%`; }
export function fmtData(iso) { return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—"; }

// ── Cabeçalho de página ────────────────────────────────────────
export function PageHeader({ title, subtitle, icon: Icon, onAction, actionLabel = "Novo", back = true, children }) {
  const router = useRouter();
  return (
    <div className="erp-page-header sticky top-0 z-20 border-b px-3 sm:px-4 pt-3 sm:pt-4 md:pt-8 lg:pt-12 pb-3 flex flex-col md:flex-row md:items-center gap-3 glass-panel min-w-0"
      style={{ borderColor: "var(--line-soft)" }}>
      <div className="erp-page-header-main flex items-center gap-2.5 sm:gap-3 w-full md:w-auto min-w-0">
        {back && (
          <button onClick={() => router.back()}
            aria-label="Voltar"
            className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center erp-card active:scale-95 transition-transform flex-shrink-0">
            <ArrowLeft size={18} style={{ color: "var(--muted)" }} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg md:text-xl font-bold leading-tight flex items-center gap-2 min-w-0" style={{ color: "var(--fg)" }}>
            {Icon && (
              <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent-soft)" }}>
                <Icon size={16} style={{ color: "var(--accent-strong)" }} />
              </span>
            )}
            <span className="erp-page-title min-w-0">{title}</span>
          </h1>
          {subtitle && <p className="erp-page-subtitle text-[11px] md:text-xs font-medium mt-0.5" style={{ color: "var(--dim)" }}>{subtitle}</p>}
        </div>
      </div>
      <div className="erp-page-header-actions flex flex-wrap items-center gap-2 w-full md:w-auto md:ml-auto min-w-0">
        {children}
        {onAction && (
          <button onClick={onAction}
            className="erp-btn erp-btn-primary !min-h-10 !h-auto text-xs md:text-sm active:scale-95 transition-transform w-full md:w-auto">
            <Plus size={14} /> {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Container de conteúdo ──────────────────────────────────────
export function PageBody({ children, className = "", ...rest }) {
  return <div className={`erp-page-body w-full min-w-0 px-3 sm:px-4 md:px-5 pt-4 pb-28 space-y-4 md:space-y-6 ${className}`} {...rest}>{children}</div>;
}

// ── Cartão genérico ────────────────────────────────────────────
export function Card({ children, className = "", ...rest }) {
  return <div className={`erp-card erp-shared-card min-w-0 p-3.5 sm:p-4 ${className}`} {...rest}>{children}</div>;
}

export function SectionLabel({ children }) {
  return <p className="erp-label mb-2">{children}</p>;
}

// ── KPI ────────────────────────────────────────────────────────
export function KpiGrid({ children }) {
  return <div className="erp-kpi-grid grid gap-3 md:gap-4 min-w-0">{children}</div>;
}
export function Kpi({ icon: Icon, label, value, onClick, active = false, note }) {
  const isClickable = typeof onClick === "function";
  return (
    <div
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => (e.key === "Enter" || e.key === " ") && onClick(e) : undefined}
      className={`erp-card erp-kpi-card p-4 sm:p-5 md:p-6 xl:p-8 relative overflow-hidden flex flex-col justify-between group min-w-0 transition-all ${
        isClickable
          ? "cursor-pointer hover:shadow-md hover:border-emerald-500/50 active:scale-[0.98]"
          : ""
      } ${active ? "ring-2 ring-emerald-500 bg-emerald-50/20" : ""}`}
    >
      <div className="flex items-start justify-between gap-2 mb-4 min-w-0">
        <p className="text-[10px] sm:text-xs md:text-sm font-bold tracking-widest uppercase min-w-0 break-words" style={{ color: "var(--muted)" }}>{label}</p>
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-[16px] flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110" style={{ background: "var(--accent-soft)" }}>
          {Icon && <Icon size={22} style={{ color: "var(--accent-strong)" }} />}
        </div>
      </div>
      <div>
        <p className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mt-auto min-w-0 break-words" style={{ color: "var(--fg)" }}>{value}</p>
        {note && <p className="text-xs font-semibold text-slate-500 mt-1">{note}</p>}
      </div>
    </div>
  );
}

// ── Busca ──────────────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder = "Buscar no sistema...", autoFocus = false, className = "" }) {
  return (
    <div className={`relative min-w-0 w-full ${className}`}>
      <Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-900 font-black z-10" />
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="erp-input w-full rounded-2xl border-2 border-slate-400 bg-white font-black text-slate-900 shadow-md transition-all focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/25 placeholder:text-slate-500 placeholder:font-bold"
        style={{ paddingLeft: 46, paddingRight: 40, height: 46 }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition"
          title="Limpar busca"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

// ── Chips de filtro ────────────────────────────────────────────
export function Chips({ options, value, onChange }) {
  return (
    <div className="erp-chips flex gap-2 overflow-x-auto overscroll-x-contain pb-1 min-w-0" style={{ scrollbarWidth: "none" }}>
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : o.label;
        const ativo = v === value;
        return (
          <button key={v} onClick={() => onChange(v)}
            className="flex-shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full transition-all active:scale-95"
            style={ativo
              ? { background: "var(--accent-strong)", color: "var(--accent-fg)" }
              : { background: "var(--card)", color: "var(--muted)", border: "1px solid var(--line)" }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Skeletons de carregamento ──────────────────────────────────
export function Skeleton({ className = "", style }) {
  return <div className={`erp-skeleton ${className}`} style={style} />;
}
export function SkeletonList({ rows = 4 }) {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="erp-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4 min-w-0">
          <Skeleton className="w-11 h-11 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}

// ── Estado vazio ───────────────────────────────────────────────
// Se o título começa com "Carregando", vira skeleton automaticamente —
// todas as telas que usam <EmptyState title="Carregando..."/> ganham
// loading premium sem precisar mudar nada.
export function EmptyState({ icon: Icon = Inbox, title = "Nada por aqui ainda", hint, actionLabel, onAction }) {
  if (/^carregando/i.test(String(title))) return <SkeletonList />;
  return (
    <div className="erp-card p-6 sm:p-10 flex flex-col items-center text-center gap-2 min-w-0">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1" style={{ background: "var(--elevated)" }}>
        <Icon size={24} style={{ color: "var(--subtle)" }} />
      </div>
      <p className="text-sm font-bold" style={{ color: "var(--fg-soft)" }}>{title}</p>
      {hint && <p className="text-xs font-medium" style={{ color: "var(--dim)" }}>{hint}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction} className="erp-btn erp-btn-primary !h-10 text-sm mt-3">
          <Plus size={15} /> {actionLabel}
        </button>
      )}
    </div>
  );
}

// ── Modal (bottom sheet) ───────────────────────────────────────
export function Modal({ open, onClose, title, children, maxWidth = "md:max-w-md", className = "" }) {
  const titleId = useId();

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const anterior = document.body.style.overflow;
    const fecharComEsc = (event) => { if (event.key === "Escape") onClose?.(); };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", fecharComEsc);
    return () => {
      document.body.style.overflow = anterior;
      document.removeEventListener("keydown", fecharComEsc);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="erp-modal-backdrop fixed inset-0 z-50 flex items-end md:items-center justify-center backdrop-blur-sm bg-slate-900/40" onClick={onClose}>
      <div className={`erp-modal-panel w-full ${maxWidth} overflow-y-auto overscroll-contain rounded-t-3xl md:rounded-3xl p-4 sm:p-6 pb-8 sm:pb-10 animate-in fade-in zoom-in-95 duration-200 border min-w-0 ${className}`}
        style={{ background: "var(--card)", borderColor: "var(--line)", boxShadow: "var(--shadow-float)" }}
        role="dialog" aria-modal="true" aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 mb-4 min-w-0">
          <p id={titleId} className="text-base font-bold min-w-0 break-words" style={{ color: "var(--fg)" }}>{title}</p>
          <button onClick={onClose} aria-label="Fechar" className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--elevated)" }}>
            <X size={16} style={{ color: "var(--muted)" }} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Campos de formulário ───────────────────────────────────────
export function Field({ label, children }) {
  return (
    <div className="mb-3 min-w-0">
      <label className="erp-label block mb-1.5 break-words">{label}</label>
      {children}
    </div>
  );
}
export function TextInput({ className = "", ...props }) { return <input {...props} className={`erp-input min-w-0 ${className}`} />; }
export function NumberInput({ className = "", ...props }) { return <input type="number" inputMode="decimal" {...props} className={`erp-input min-w-0 ${className}`} />; }
export function Select({ children, className = "", ...props }) {
  return (
    <select {...props} className={`erp-input min-w-0 ${className}`} style={{ appearance: "none", ...(props.style || {}) }}>
      {children}
    </select>
  );
}

// ── Botões ─────────────────────────────────────────────────────
export function Btn({ children, variant = "primary", className = "", ...rest }) {
  const cls = variant === "ghost" ? "erp-btn-ghost" : variant === "danger" ? "erp-btn-danger" : "erp-btn-primary";
  return <button className={`erp-btn ${cls} ${className}`} {...rest}>{children}</button>;
}

// ── Toast flutuante ────────────────────────────────────────────
// Flutua no rodapé sem empurrar o layout; o ponto verde indica sucesso.
export function Toast({ show, children }) {
  if (!show) return null;
  return (
    <div className="erp-toast">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--accent)" }} />
      {children}
    </div>
  );
}

// ── Toggle Switch ──────────────────────────────────────────────
export function Toggle({ active, onChange }) {
  return (
    <button onClick={onChange} className="w-10 h-6 rounded-full relative transition-colors flex-shrink-0"
      style={{ background: active ? "var(--accent-strong)" : "var(--elevated)" }}>
      <div className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all shadow-sm"
        style={{ left: active ? "calc(100% - 20px)" : "4px" }} />
    </button>
  );
}

