"use client";

// Peças de tela do orçamento do evento. Números entram como texto (aceitam
// "1,5") e a conta lê com parseNumero, em evento-orcamento.mjs.

import { fmtReais, fmtPct } from "../../../../../lib/valor-percentual.mjs";

export const vp = (v, pct) => `${fmtReais(v)}${pct !== null && pct !== undefined ? ` · ${fmtPct(pct)}` : ""}`;

export function Cartao({ titulo, descricao, acoes, children, className = "" }) {
  return (
    <section className={`rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 ${className}`}>
      {(titulo || acoes) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {titulo && <h2 className="text-base font-black tracking-tight text-slate-900">{titulo}</h2>}
            {descricao && <p className="mt-0.5 text-sm font-medium text-slate-600">{descricao}</p>}
          </div>
          {acoes}
        </div>
      )}
      {children}
    </section>
  );
}

const baseInput = "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

export function Campo({ rotulo, ajuda, children, className = "" }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">{rotulo}</span>
      {children}
      {ajuda && <span className="mt-1 block text-xs font-medium text-slate-500">{ajuda}</span>}
    </label>
  );
}

export function Texto({ valor, onChange, className = "", ...resto }) {
  return <input type="text" value={valor ?? ""} onChange={(e) => onChange(e.target.value)} className={`${baseInput} ${className}`} {...resto} />;
}

// Número com vírgula: guarda o texto digitado, sem pular o cursor.
export function Numero({ valor, onChange, prefixo, sufixo, className = "", ...resto }) {
  return (
    <div className={`relative ${className}`}>
      {prefixo && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">{prefixo}</span>}
      <input type="text" inputMode="decimal" value={valor ?? ""} onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ""))}
        className={`${baseInput} tabular-nums ${prefixo ? "pl-10" : ""} ${sufixo ? "pr-10" : ""}`} {...resto} />
      {sufixo && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">{sufixo}</span>}
    </div>
  );
}

export function Selecao({ valor, onChange, opcoes, className = "", ...resto }) {
  return (
    <select value={valor ?? ""} onChange={(e) => onChange(e.target.value)} className={`${baseInput} ${className}`} {...resto}>
      {opcoes.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>))}
    </select>
  );
}

// Alterna R$ / % (pró-labore e comissões).
export function ModoValor({ modo, onChange }) {
  return (
    <div className="flex h-11 shrink-0 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Valor fixo ou porcentagem">
      {[["valor", "R$"], ["pct", "%"]].map(([id, rot]) => (
        <button key={id} type="button" role="radio" aria-checked={modo === id} onClick={() => onChange(id)}
          className={`min-w-10 rounded-lg px-3 text-sm font-black ${modo === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>{rot}</button>
      ))}
    </div>
  );
}

export function BotaoRemover({ onClick, rotulo }) {
  return (
    <button type="button" onClick={onClick} aria-label={rotulo} title={rotulo}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
    </button>
  );
}

export function BotaoAdicionar({ onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className="flex h-11 items-center gap-2 rounded-xl border border-dashed border-emerald-400 bg-emerald-50/50 px-4 text-sm font-bold text-emerald-800 hover:bg-emerald-50">
      <span aria-hidden="true" className="text-lg leading-none">+</span> {children}
    </button>
  );
}

export function LinhaValor({ rotulo, valor, forte = false, tom = "" }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5">
      <span className={`text-sm ${forte ? "font-black text-slate-900" : "font-semibold text-slate-700"}`}>{rotulo}</span>
      <span className={`ml-auto whitespace-nowrap tabular-nums ${forte ? "text-base font-black" : "text-sm font-bold"} ${tom || "text-slate-900"}`}>{valor}</span>
    </div>
  );
}
