"use client";

// ═══════════════════════════════════════════════════════════════
// KIT DE UI — componentes reutilizáveis (design tokens v4)
// Base de TODOS os módulos do ERP. Mantém consistência visual e
// acelera a criação/recriação de telas.
// ═══════════════════════════════════════════════════════════════

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
    <div className="sticky top-0 z-20 border-b px-4 pt-4 md:pt-12 pb-3 flex flex-col md:flex-row md:items-center gap-3 glass-panel"
      style={{ borderColor: "rgba(0,0,0,0.05)" }}>
      <div className="flex items-center gap-3 w-full md:w-auto">
        {back && (
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl flex items-center justify-center erp-card active:scale-95 transition-transform flex-shrink-0">
            <ArrowLeft size={18} style={{ color: "var(--muted)" }} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg md:text-xl font-bold leading-tight flex items-center gap-2" style={{ color: "var(--fg)" }}>
            {Icon && <Icon size={18} style={{ color: "var(--accent-fg)" }} className="flex-shrink-0" />}
            <span className="truncate">{title}</span>
          </h1>
          {subtitle && <p className="text-[11px] md:text-xs font-medium truncate" style={{ color: "var(--dim)" }}>{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 w-full md:w-auto md:ml-auto">
        {children}
        {onAction && (
          <button onClick={onAction}
            className="erp-btn erp-btn-primary !h-9 text-xs md:text-sm active:scale-95 transition-transform w-full md:w-auto">
            <Plus size={14} /> {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Container de conteúdo ──────────────────────────────────────
export function PageBody({ children }) {
  return <div className="px-3 md:px-5 pt-4 pb-28 space-y-4 md:space-y-6">{children}</div>;
}

// ── Cartão genérico ────────────────────────────────────────────
export function Card({ children, className = "", ...rest }) {
  return <div className={`erp-card p-4 ${className}`} {...rest}>{children}</div>;
}

export function SectionLabel({ children }) {
  return <p className="erp-label mb-2">{children}</p>;
}

// ── KPI ────────────────────────────────────────────────────────
export function KpiGrid({ children }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">{children}</div>;
}
export function Kpi({ icon: Icon, label, value }) {
  // Estilo Takeat Premium: Layout flex, número grande, ícone colorido sutil
  return (
    <div className="erp-card p-6 md:p-8 relative overflow-hidden flex flex-col justify-between group" style={{ minHeight: '140px' }}>
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs md:text-sm font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>{label}</p>
        <div className="w-12 h-12 rounded-[16px] flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110" style={{ background: "var(--accent-soft)" }}>
          {Icon && <Icon size={22} style={{ color: "var(--accent-strong)" }} />}
        </div>
      </div>
      <p className="text-3xl md:text-4xl font-black tracking-tighter mt-auto" style={{ color: "var(--fg)" }}>{value}</p>
    </div>
  );
}

// ── Busca ──────────────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder = "Buscar..." }) {
  return (
    <div className="relative">
      <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--dim)" }} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="erp-input" style={{ paddingLeft: 42, paddingRight: 38, height: 44 }} />
      {value && (
        <button onClick={() => onChange("")} className="absolute right-3 top-1/2 -translate-y-1/2">
          <X size={15} style={{ color: "var(--dim)" }} />
        </button>
      )}
    </div>
  );
}

// ── Chips de filtro ────────────────────────────────────────────
export function Chips({ options, value, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : o.label;
        const ativo = v === value;
        return (
          <button key={v} onClick={() => onChange(v)}
            className="flex-shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full transition-all active:scale-95"
            style={ativo
              ? { background: "var(--accent-strong)", color: "#fff" }
              : { background: "var(--card)", color: "var(--muted)", border: "1px solid var(--line)" }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Estado vazio ───────────────────────────────────────────────
export function EmptyState({ icon: Icon = Inbox, title = "Nada por aqui ainda", hint }) {
  return (
    <div className="erp-card p-10 flex flex-col items-center text-center gap-2">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1" style={{ background: "var(--elevated)" }}>
        <Icon size={24} style={{ color: "var(--subtle)" }} />
      </div>
      <p className="text-sm font-bold" style={{ color: "var(--fg-soft)" }}>{title}</p>
      {hint && <p className="text-xs font-medium" style={{ color: "var(--dim)" }}>{hint}</p>}
    </div>
  );
}

// ── Modal (bottom sheet) ───────────────────────────────────────
export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center backdrop-blur-sm" style={{ background: "rgba(9, 9, 11, 0.4)" }} onClick={onClose}>
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-[32px] md:rounded-[32px] p-6 pb-10 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        style={{ background: "var(--card)", border: "1px solid rgba(255,255,255,0.2)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-base font-bold" style={{ color: "var(--fg)" }}>{title}</p>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--elevated)" }}>
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
    <div className="mb-3">
      <label className="erp-label block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
export function TextInput(props) { return <input {...props} className="erp-input" />; }
export function NumberInput(props) { return <input type="number" inputMode="decimal" {...props} className="erp-input" />; }
export function Select({ children, ...props }) {
  return (
    <select {...props} className="erp-input" style={{ appearance: "none", ...(props.style || {}) }}>
      {children}
    </select>
  );
}

// ── Botões ─────────────────────────────────────────────────────
export function Btn({ children, variant = "primary", className = "", ...rest }) {
  const cls = variant === "ghost" ? "erp-btn-ghost" : variant === "danger" ? "erp-btn-danger" : "erp-btn-primary";
  return <button className={`erp-btn ${cls} ${className}`} {...rest}>{children}</button>;
}

// ── Toast simples de sucesso ───────────────────────────────────
export function Toast({ show, children }) {
  if (!show) return null;
  return (
    <div className="erp-badge erp-badge-ok w-full justify-center py-3 text-sm">{children}</div>
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

