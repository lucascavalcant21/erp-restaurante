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
    <div className="sticky top-0 z-20 border-b px-4 pt-12 pb-3 flex items-center gap-3"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      {back && (
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl flex items-center justify-center erp-card active:scale-95 transition-transform">
          <ArrowLeft size={18} style={{ color: "var(--muted)" }} />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-bold leading-tight flex items-center gap-2" style={{ color: "var(--fg)" }}>
          {Icon && <Icon size={18} style={{ color: "var(--accent-fg)" }} />}
          {title}
        </h1>
        {subtitle && <p className="text-[11px] font-medium truncate" style={{ color: "var(--dim)" }}>{subtitle}</p>}
      </div>
      {children}
      {onAction && (
        <button onClick={onAction}
          className="erp-btn erp-btn-primary !h-9 text-xs active:scale-95 transition-transform">
          <Plus size={14} /> {actionLabel}
        </button>
      )}
    </div>
  );
}

// ── Container de conteúdo ──────────────────────────────────────
export function PageBody({ children }) {
  return <div className="px-4 pt-4 pb-28 space-y-5">{children}</div>;
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
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}
export function Kpi({ icon: Icon, label, value }) {
  // Minimalista: ícone neutro (monocromático). A cor fica reservada
  // para ações (acento) e status de alerta (badges).
  return (
    <div className="erp-card p-4">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: "var(--panel)" }}>
        {Icon && <Icon size={16} style={{ color: "var(--subtle)" }} />}
      </div>
      <p className="text-xl font-bold" style={{ color: "var(--fg)" }}>{value}</p>
      <p className="text-[11px] font-medium" style={{ color: "var(--dim)" }}>{label}</p>
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
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl p-5 pb-10"
        style={{ background: "var(--card)", border: "1px solid var(--line)" }}
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
